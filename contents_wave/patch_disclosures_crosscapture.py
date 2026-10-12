"""Task D: restore the Walmart and Merck Extended Descriptions across captures.

Evidence (crops/542-bottom.png, crops/543-top.png, crops/585-bottom.png,
crops/586-top.png): the description panel starts on the case-study page and the
capture boundary cuts it in two.  The panel is empty in B2P1-0542.png /
B2P1-0585.png, and its body stands at the very top of the *next* capture
(B2P1-0543.png / B2P1-0586.png) inside the same bordered grey panel, above the
horizontal divider, with the figure caption strip below it.

This moves those leading Georgia paragraphs - byte for byte, in order - into
the `<div class="desc-panel">` of the preceding region, exactly as the
corrective wave did for the Starbucks Rewards control.  The figure caption
strip (Arial, grey) stays outside the control, where it belongs.

Only the four named regions change; every other byte is copied unchanged.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ARTICLE = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"')
END = b"</article>"
P = re.compile(r'<p style="font-family:\'Georgia\',serif;color:#[0-9A-Fa-f]{6}">.*?</p>')
EMPTY_PANEL = '<div class="desc-panel"></div>'
CONTENT_OPEN = '"><div class="content">'

JOBS = [
    {"control": "TMP-0542", "donor": "TMP-0543", "figure": "Walmart"},
    {"control": "TMP-0585", "donor": "TMP-0586", "figure": "Merck"},
]


def scan(path: Path):
    """Absolute byte offsets: body_start (just after the article tag) and body_end."""
    marks = []
    buf = b""
    base = 0
    cur_id = None
    cur_tag_end = None
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(8 << 20)
            if not chunk:
                break
            buf += chunk
            pos = 0
            while True:
                if cur_id is None:
                    m = ARTICLE.search(buf, pos)
                    if not m:
                        break
                    cur_id = m.group(1).decode()
                    cur_tag_end = base + m.end()
                    pos = m.end()
                else:
                    e = buf.find(END, pos)
                    if e < 0:
                        break
                    marks.append((cur_tag_end, base + e, cur_id))
                    pos = e + len(END)
                    cur_id = None
            buf = buf[pos:]
            base += pos
    return marks


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("output")
    ap.add_argument("--report", default="")
    a = ap.parse_args()
    src, out = Path(a.source), Path(a.output)

    marks = scan(src)
    body_at = {rid: (s, e) for s, e, rid in marks}
    print("articles found:", len(marks))

    edits, checks = {}, []
    with src.open("rb") as fh:
        for job in JOBS:
            cid, did = job["control"], job["donor"]
            for rid in (cid, did):
                if rid not in body_at:
                    raise SystemExit("region %s not found" % rid)
            fh.seek(body_at[cid][0])
            cb = fh.read(body_at[cid][1] - body_at[cid][0]).decode("utf-8")
            fh.seek(body_at[did][0])
            db = fh.read(body_at[did][1] - body_at[did][0]).decode("utf-8")

            if EMPTY_PANEL not in cb:
                raise SystemExit("%s: description panel is not empty" % cid)
            if cb.count(EMPTY_PANEL) != 1:
                raise SystemExit("%s: more than one empty panel" % cid)

            head = db[db.index(CONTENT_OPEN) + len(CONTENT_OPEN):]
            paras, pos = [], 0
            while True:
                m = P.match(head, pos)
                if not m:
                    break
                paras.append(m.group(0))
                pos = m.end()
            if not paras:
                raise SystemExit("%s: no leading Georgia paragraphs" % did)
            moved = "".join(paras)
            if db.count(moved) != 1:
                raise SystemExit("%s: leading run is not unique" % did)

            words = " ".join(re.sub(r"<[^>]*>", " ", moved).split())
            if not words:
                raise SystemExit("%s: description text is empty" % did)

            new_cb = cb.replace(EMPTY_PANEL, '<div class="desc-panel">' + moved + "</div>", 1)
            new_db = db.replace(moved, "", 1)
            rest = new_db[new_db.index(CONTENT_OPEN) + len(CONTENT_OPEN):]
            if not rest.startswith("<p style="):
                raise SystemExit("%s: donor no longer starts with the caption paragraph" % did)

            edits[cid], edits[did] = new_cb, new_db
            checks.append({
                "figure": job["figure"], "control": cid, "donor": did,
                "paragraphs_moved": len(paras), "chars_moved": len(moved),
                "words_moved": len(words.split()),
                "description_text": words,
                "caption_left_in_place": rest[:120],
            })

    h = hashlib.sha256()
    copied = 0

    def copy_range(fh, oh, start: int, end: int) -> None:
        nonlocal copied
        fh.seek(start)
        left = end - start
        while left > 0:
            chunk = fh.read(min(8 << 20, left))
            if not chunk:
                raise SystemExit("unexpected end of file")
            oh.write(chunk)
            h.update(chunk)
            copied += len(chunk)
            left -= len(chunk)

    with src.open("rb") as fh, out.open("wb") as oh:
        prev = 0
        for s, e, rid in marks:
            if e <= prev:
                continue
            copy_range(fh, oh, prev, s)
            if rid in edits:
                data = edits[rid].encode("utf-8")
                oh.write(data)
                h.update(data)
                copied += len(data)
            else:
                copy_range(fh, oh, s, e)
            prev = e
        copy_range(fh, oh, prev, src.stat().st_size)

    report = {
        "source": str(src), "output": str(out),
        "source_bytes": src.stat().st_size, "output_bytes": copied,
        "output_sha256": h.hexdigest(),
        "regions_edited": sorted(edits), "checks": checks,
    }
    if a.report:
        Path(a.report).write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "checks"}, indent=1, ensure_ascii=False))
    for c in checks:
        print("\n%s: %s -> %s | %d paragraphs, %d chars, %d words"
              % (c["figure"], c["donor"], c["control"], c["paragraphs_moved"],
                 c["chars_moved"], c["words_moved"]))
        print("   ", c["description_text"][:340])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
