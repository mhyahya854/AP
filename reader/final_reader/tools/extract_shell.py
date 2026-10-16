"""Extract the reader shell slices from the published 1.13 GB HTML.

Read-only with respect to the book: writes small stand-alone slices into the
redesign scratch directory so the shell can be inspected and rebuilt in
isolation.
"""
from __future__ import annotations

import sys
from pathlib import Path

BOOK = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\AP Book Final.html")
OUT = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\redesign\shell")

# (name, start, end) -- end None means EOF.  Offsets come from shell_scan.py.
SLICES = [
    ("00-head.html", 0, 56008),
    ("01-left-aside.html", 56008, 188662),
    ("02-main-open.html", 188662, 195000),
    ("10-right-aside.html", 1132224215, 1132226579),
    ("11-script1.js", 1132226579, 1132244335),
    ("12-script2.js", 1132244335, 1132270892),
    ("13-script3.js", 1132270892, 1132273563),
    ("14-script4.js", 1132273563, 1132293091),
    ("15-script5.js", 1132293091, None),
]


def main() -> int:
    size = BOOK.stat().st_size
    OUT.mkdir(parents=True, exist_ok=True)
    ranges = []
    for name, start, end in SLICES:
        stop = size if end is None else min(end, size)
        ranges.append((name, start, stop))

    with BOOK.open("rb") as fh:
        for name, start, stop in sorted(ranges, key=lambda r: r[1]):
            fh.seek(start)
            blob = fh.read(stop - start)
            (OUT / name).write_bytes(blob)
            print(f"{name:24s} {start:>12} .. {stop:>12}  {stop - start:>9} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
