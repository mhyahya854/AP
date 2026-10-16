"""Assemble the redesigned reader.

Reads the accepted 1.13 GB artifact, replaces only the application shell
(head stylesheet tail, header, contents-panel wrapper, main open tag, footer
and scripts) and copies the 1,899 <article> regions through byte-identically.

    python patch_book.py                    # full candidate
    python patch_book.py --fixture OUT.html --regions 1-13,119,120
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\AP Book Final.html")
UI = HERE / "ui"

FIRST_ARTICLE = 189229
SCAN_BACK = 6 << 20


def read_prefix(fh) -> bytes:
    fh.seek(0)
    return fh.read(FIRST_ARTICLE)


def locate_tail(fh) -> int:
    """Offset of the `</main>` that closes the article list."""
    size = BASE.stat().st_size
    base = max(0, size - SCAN_BACK)
    fh.seek(base)
    blob = fh.read()
    i = blob.find(b'<aside class="right" id="reader-controls"')
    if i < 0:
        raise SystemExit("reader-controls aside not found")
    j = blob.rfind(b"</main>", 0, i)
    if j < 0:
        raise SystemExit("</main> not found before the right aside")
    return base + j


def cover_img(prefix: str) -> str:
    m = re.search(r'<img class="rail-cover" src="data:image/png;base64,[^"]*"[^>]*>', prefix)
    if not m:
        raise SystemExit("rail cover image not found")
    return m.group(0)


def build_prefix(prefix: bytes) -> bytes:
    """Rewrite the shell.  All work is done on bytes so no payload byte can be
    altered by a decode/encode round-trip."""
    css = (UI / "reader_ui.css").read_bytes()
    head = (UI / "shell_head.html").read_bytes().strip()

    # 1. title + colour-scheme hint
    title_old = b"<title>AP Book Final</title>"
    title_new = ("<title>Business with Personal Finance \u2014 for the AP\u00ae Course</title>").encode("utf-8")
    assert prefix.count(title_old) == 1
    prefix = prefix.replace(title_old, title_new, 1)
    vp = b'<meta name="viewport" content="width=device-width,initial-scale=1">'
    assert prefix.count(vp) == 1
    prefix = prefix.replace(vp, vp + b'<meta name="color-scheme" content="light dark">', 1)

    # 2. new reader stylesheet, appended so every existing content rule keeps winning
    assert prefix.count(b"</style></head>") == 1
    prefix = prefix.replace(b"</style></head>", css + b"\n</style></head>", 1)

    # 3. header + navigation rail, inserted as the first children of .app
    marker = b'<div class="app" id="b2-app">'
    assert prefix.count(marker) == 1
    prefix = prefix.replace(marker, marker + b"\n" + head + b"\n", 1)

    # 4. two frontmatter rows the stale audit called source-absent now have
    #    verified destinations (TMP-0007 title page, TMP-0009 copyright page)
    for entry, page, target in ((b"4", b"i", b"TMP-0007"), (b"5", b"ii", b"TMP-0009")):
        old = (b'<span class="nav-child nav-unlinked" data-supplied-entry="' + entry
               + b'" title="No verified destination"><span class="nav-page">' + page
               + b'</span>')
        if prefix.count(old) != 1:
            raise SystemExit("frontmatter row not found: " + old.decode())
        new = (b'<a class="nav-child" data-supplied-entry="' + entry + b'" href="#' + target
               + b'"><span class="nav-page">' + page + b'</span>')
        prefix = prefix.replace(old, new, 1)
    for tail_old, tail_new in ((b"</span>Title Page</span>", b"</span>Title Page</a>"),
                               (b"</span>Copyright Page</span>", b"</span>Copyright Page</a>")):
        assert prefix.count(tail_old) == 1, tail_old
        prefix = prefix.replace(tail_old, tail_new, 1)

    # 5. contents panel wrapper: rebuilt around the byte-identical nav subtree
    nav_at = prefix.find(b'<nav id="contents-nav"')
    if nav_at < 0:
        raise SystemExit("contents nav not found")
    aside_at = prefix.rfind(b'<aside class="left" id="contents-panel"', 0, nav_at)
    if aside_at < 0:
        raise SystemExit("contents aside not found")
    nav_end = prefix.find(b"</nav>", nav_at)
    if nav_end < 0:
        raise SystemExit("contents nav end not found")
    nav_end += len(b"</nav>")
    aside_end = prefix.find(b"</aside>", nav_end)
    if aside_end < 0:
        raise SystemExit("contents aside end not found")
    aside_end += len(b"</aside>")

    nav_block = prefix[nav_at:nav_end]
    img = cover_img(prefix.decode("utf-8"))
    panel = (
        '<aside class="left" id="contents-panel" aria-labelledby="contents-heading">\n'
        '  <div class="panel-head">\n'
        '    <h2 id="contents-heading" class="sr-only">Contents</h2>\n'
        '    <div class="book-card">\n'
        '      ' + img.replace('class="rail-cover"', 'class="rail-cover" alt="Cover of Business with Personal Finance"') + '\n'
        '      <div>\n'
        '        <p class="rail-title">Business with Personal Finance</p>\n'
        '        <p class="rail-authors">David A. Anderson &#9642; Heidi M. Neck &#9642; Christopher P. Neck &#9642; Emma L. Murray</p>\n'
        '      </div>\n'
        '      <button type="button" id="panel-close" class="panel-close" aria-label="Close contents" aria-controls="contents-panel" aria-expanded="false">&#215;</button>\n'
        '    </div>\n'
        '    <div class="panel-tools">\n'
        '      <button type="button" id="nav-expand">Expand all</button>\n'
        '      <button type="button" id="nav-collapse">Collapse all</button>\n'
        '    </div>\n'
        '  </div>\n'
    ).encode("utf-8") + b"  " + nav_block + (
        '\n  <p class="panel-note">Page labels are the printed labels from the supplied numbered Contents list. '
        'A row without a label has none in that list; rows still marked as unlinked have no verified destination in '
        'the available source.</p>\n'
        '</aside>'
    ).encode("utf-8")
    prefix = prefix[:aside_at] + panel + prefix[aside_end:]

    # 6. main open tag: the floating toolbar is gone
    m = re.search(rb"<main><div class=\"toolbar\">.*?</div>", prefix, re.S)
    if not m:
        raise SystemExit("toolbar not found")
    prefix = prefix[: m.start()] + b'<main id="reader-main">' + prefix[m.end():]
    return prefix


def build_tail() -> str:
    tail = (UI / "shell_tail.html").read_text(encoding="utf-8")
    headings = (UI / "headings.js").read_text(encoding="utf-8")
    js = (UI / "reader_ui.js").read_text(encoding="utf-8")
    for blob in (headings, js):
        if "</script" in blob.lower():
            raise SystemExit("script body contains a </script> sequence")
    return ("</main>\n" + tail.strip() + "\n<script>\n" + headings + "</script>\n<script>\n" + js
            + "</script>\n</div>\n</body></html>\n")


def region_spans(fh, wanted):
    """Yield (start, end, id) for the requested ordinals, streaming."""
    ART = re.compile(rb'<article class="book-page" id="TMP-(\d{4})"')
    ART_END = b"</article>"
    size = BASE.stat().st_size
    fh.seek(FIRST_ARTICLE)
    buf = b""
    pos = FIRST_ARTICLE
    cur = None
    start = None
    while pos < size:
        chunk = fh.read(8 << 20)
        if not chunk:
            break
        buf += chunk
        while True:
            if cur is None:
                m = ART.search(buf)
                if not m:
                    keep = max(0, len(buf) - 8192)
                    buf = buf[keep:]
                    pos += keep
                    break
                buf = buf[m.start():]
                pos += m.start()
                cur = int(m.group(1))
                start = pos
            e = buf.find(ART_END)
            if e < 0:
                break
            end = pos + e + len(ART_END)
            if cur in wanted:
                yield (start, end, cur)
            buf = buf[e + len(ART_END):]
            pos = end
            cur = None


def main() -> int:
    global BASE
    ap = argparse.ArgumentParser()
    ap.add_argument("out", nargs="?", default=str(Path(
        r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\redesign\candidate\AP Book Final (redesign).html")))
    ap.add_argument("--fixture", action="store_true")
    ap.add_argument("--regions", default="")
    ap.add_argument("--from-base", default="")
    args = ap.parse_args()

    if args.from_base:
        BASE = Path(args.from_base)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(out.suffix + ".part")

    with BASE.open("rb") as fh:
        prefix = build_prefix(read_prefix(fh))
        tail_start = locate_tail(fh)
        tail = build_tail()
        if not args.fixture:
            with tmp.open("wb") as w:
                w.write(prefix)
                fh.seek(FIRST_ARTICLE)
                remaining = tail_start - FIRST_ARTICLE
                while remaining > 0:
                    chunk = fh.read(min(8 << 20, remaining))
                    if not chunk:
                        break
                    w.write(chunk)
                    remaining -= len(chunk)
                w.write(tail.encode("utf-8"))
        else:
            wanted = set()
            for part in args.regions.split(","):
                part = part.strip()
                if "-" in part:
                    a, b = part.split("-")
                    wanted.update(range(int(a), int(b) + 1))
                elif part:
                    wanted.add(int(part))
            with tmp.open("wb") as w:
                w.write(prefix)
                spans = []
                with BASE.open("rb") as rf:
                    for span in region_spans(rf, wanted):
                        spans.append(span)
                for start, end, rid in spans:
                    fh.seek(start)
                    w.write(fh.read(end - start))
                    w.write(b"\n")
                w.write(tail.encode("utf-8"))
    tmp.replace(out)
    print(out, out.stat().st_size, "bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
