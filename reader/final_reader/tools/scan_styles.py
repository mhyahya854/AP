"""Frequency of inline font-size / padding values across the whole book.

Streams the artifact once and counts `font-size:<v>` and `padding-left:<v>`
occurrences inside <article> regions, so a scoped fix can be shown to be
scoped.
"""
from __future__ import annotations

import collections
import re
import sys
from pathlib import Path

FS = re.compile(r"font-size:([0-9.]+)pt")
PL = re.compile(r"padding-left:([0-9.]+)pt")


def main() -> int:
    book = Path(sys.argv[1])
    region_filter = None
    if len(sys.argv) > 2:
        region_filter = set(sys.argv[2:])

    fs = collections.Counter()
    pl = collections.Counter()
    cur = None
    with book.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        buf = ""
        eof = False
        while True:
            if cur is None:
                i = buf.find('class="book-page" id="TMP-')
                if i < 0:
                    if eof:
                        break
                    buf = buf[-8192:]
                    chunk = fh.read(8 << 20)
                    eof = not chunk
                    buf += chunk
                    continue
                start = i + len('class="book-page" id="')
                cur = buf[start: start + 8]
                buf = buf[i:]
            e = buf.find("</article>")
            while e < 0 and not eof:
                chunk = fh.read(8 << 20)
                eof = not chunk
                buf += chunk
                e = buf.find("</article>")
            if e < 0:
                break
            if region_filter is None or cur in region_filter:
                seg = buf[:e]
                fs.update(FS.findall(seg))
                pl.update(PL.findall(seg))
            buf = buf[e + 10:]
            cur = None
    print("font-size pt (top 30):")
    for v, n in sorted(fs.items(), key=lambda kv: -kv[1])[:30]:
        print(f"  {v:>7}pt  {n:>7}")
    print("padding-left pt (top 20):")
    for v, n in sorted(pl.items(), key=lambda kv: -kv[1])[:20]:
        print(f"  {v:>7}pt  {n:>7}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
