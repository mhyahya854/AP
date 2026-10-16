"""Print the raw markup of one region, optionally with its <img> tags intact.

Usage: python peek_region.py <book> <TMP-0005> [--imgs] [--max-bytes N]
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ART = re.compile(r'<article class="book-page" id="(?P<id>TMP-\d{4})"')


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("book")
    ap.add_argument("region_id")
    ap.add_argument("--imgs", action="store_true", help="keep <img> tags (their base64 is truncated)")
    ap.add_argument("--img-preview", type=int, default=120)
    ap.add_argument("--max-bytes", type=int, default=400_000)
    args = ap.parse_args()

    book = Path(args.book)
    want = args.region_id
    with book.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        buf = ""
        eof = False
        while True:
            i = buf.find(f'<article class="book-page" id="{want}"')
            if i >= 0:
                break
            if eof:
                print("region not found")
                return 1
            buf = buf[-8192:] if len(buf) > 8192 else buf
            chunk = fh.read(4 << 20)
            eof = not chunk
            buf += chunk
            if eof and buf.find(f'<article class="book-page" id="{want}"') < 0:
                print("region not found")
                return 1
        end = buf.find("</article>", i)
        while end < 0 and not eof:
            chunk = fh.read(4 << 20)
            eof = not chunk
            buf += chunk
            end = buf.find("</article>", i)
        markup = buf[i:end]
    if not args.imgs:
        markup = re.sub(r"<img\b[^>]*>", "<!--img elided-->", markup)
    elif args.img_preview:
        def shrink(m: re.Match[str]) -> str:
            tag = m.group(0)
            return re.sub(r'(src="data:image/png;base64,)([^"]{0,%d})[^"]*' % args.img_preview,
                          r"\1\2…[B64 TRUNCATED]", tag)
        markup = re.sub(r"<img\b[^>]*>", shrink, markup)
    if len(markup) > args.max_bytes:
        markup = markup[: args.max_bytes] + "\n<!--TRUNCATED-->\n"
    print(markup)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
