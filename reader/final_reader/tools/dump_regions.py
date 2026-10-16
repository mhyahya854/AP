"""Dump chosen <article class="book-page"> regions of the published reader.

Read-only.  Writes, per requested ordinal:
  <id>.txt   tags stripped, whitespace collapsed (the reader's visible words)
  <id>.raw   the region markup, truncated to --max-bytes (images elided)
plus an index JSON that records the nav label, the ids inside the region and
the first text lines, so frontmatter can be mapped source -> DOM.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ART = re.compile(r'<article class="book-page" id="(?P<id>TMP-\d{4})"(?P<attrs>[^>]*)>')
TAG = re.compile(r"<[^>]*>")
IMG = re.compile(r"<img\b[^>]*>")
ID_ATTR = re.compile(r'\sid="([^"]+)"')
LABEL = re.compile(r'data-nav-label="([^"]*)"')
WS = re.compile(r"\s+")


def text_of(markup: str) -> str:
    body = IMG.sub(" \u2591 ", markup)
    body = TAG.sub("\n", body)
    body = (body.replace("&nbsp;", " ").replace("&amp;", "&")
                .replace("&lt;", "<").replace("&gt;", ">")
                .replace("&#x27;", "'").replace("&quot;", '"'))
    lines = [WS.sub(" ", ln).strip() for ln in body.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("book")
    ap.add_argument("outdir")
    ap.add_argument("ordinals", help="e.g. 1-60 or 1,2,5")
    ap.add_argument("--max-bytes", type=int, default=400_000)
    args = ap.parse_args()

    wanted: set[int] = set()
    for part in args.ordinals.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-")
            wanted.update(range(int(a), int(b) + 1))
        elif part:
            wanted.add(int(part))

    book = Path(args.book)
    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    index: dict[str, dict[str, object]] = {}

    with book.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        buf = ""
        eof = False
        current = None
        while True:
            if current is None:
                m = ART.search(buf)
                if not m:
                    if eof:
                        break
                    buf = buf[-8192:]
                    chunk = fh.read(4 << 20)
                    eof = not chunk
                    buf += chunk
                    continue
                current = m.group("id")
                ordinal = int(current.split("-")[1])
                buf = buf[m.end():]
                if ordinal not in wanted:
                    end = buf.find("</article>")
                    while end < 0 and not eof:
                        chunk = fh.read(4 << 20)
                        eof = not chunk
                        buf += chunk
                        end = buf.find("</article>")
                    if end < 0:
                        break
                    buf = buf[end + len("</article>"):]
                    current = None
                    continue
                attrs = m.group("attrs")
                label_m = LABEL.search(attrs)
                index[current] = {
                    "ordinal": ordinal,
                    "attrs": attrs.strip(),
                    "nav_label": label_m.group(1) if label_m else None,
                }
                continue
            end = buf.find("</article>")
            while end < 0 and not eof:
                chunk = fh.read(4 << 20)
                eof = not chunk
                buf += chunk
                end = buf.find("</article>")
            if end < 0:
                break
            markup = buf[:end]
            rec = index[current]
            rec["ids"] = ID_ATTR.findall(markup)
            rec["markup_bytes"] = len(markup)
            rec["img_bytes"] = sum(len(x) for x in IMG.findall(markup))
            text = text_of(markup)
            rec["text_chars"] = len(text)
            rec["text_head"] = "\n".join(text.split("\n")[:40])
            (out / f"{current}.txt").write_text(text, encoding="utf-8")
            raw = IMG.sub("<!--img elided-->", markup)
            if len(raw) > args.max_bytes:
                raw = raw[: args.max_bytes] + "\n<!--TRUNCATED-->\n"
            (out / f"{current}.raw").write_text(raw, encoding="utf-8")
            buf = buf[end + len("</article>"):]
            current = None

    (out / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False), encoding="utf-8")
    for k in sorted(index, key=lambda s: index[s]["ordinal"]):  # type: ignore[arg-type]
        rec = index[k]
        print(f"{k} label={rec['nav_label']!r} markup={rec['markup_bytes']} text={rec['text_chars']} ids={len(rec['ids'])}")
    print("written", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
