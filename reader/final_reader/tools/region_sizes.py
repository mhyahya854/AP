"""Per-region inventory of inline font-size / margin / padding values.

Usage: python region_sizes.py <book> TMP-0005 TMP-0007 ...
"""
from __future__ import annotations

import collections
import re
import sys
from pathlib import Path

BOOK = Path(sys.argv[1])
WANT = set(sys.argv[2:])
FS = re.compile(r"font-size:([0-9.]+)pt")
MB = re.compile(r"margin-bottom:([0-9.]+)pt")
MT = re.compile(r"margin-top:([0-9.]+)pt")
PL = re.compile(r"padding-left:([0-9.]+)pt")
PR = re.compile(r"padding-right:([0-9.]+)pt")
TI = re.compile(r"text-indent:([0-9.]+)pt")


def main() -> int:
    cur = None
    with BOOK.open("r", encoding="utf-8", errors="replace", newline="") as fh:
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
            if cur in WANT:
                seg = buf[:e]
                print(f"--- {cur} ({len(seg)} bytes)")
                for label, pat in (("font-size", FS), ("margin-top", MT), ("margin-bottom", MB),
                                   ("padding-left", PL), ("padding-right", PR), ("text-indent", TI)):
                    c = collections.Counter(pat.findall(seg))
                    if c:
                        print(f"    {label:14s} " + ", ".join(f"{v}pt×{n}" for v, n in sorted(c.items())))
            buf = buf[e + 10:]
            cur = None
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
