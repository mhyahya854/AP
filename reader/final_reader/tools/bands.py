"""Print the ink bands (text lines / figures) of a source capture.

Usage: python bands.py <png> [x0 x1] [--min-h N]
A band is a maximal run of rows containing dark pixels; it reports the row
range and the horizontal extent, which is how source typography and spacing are
measured before any CSS value is chosen.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = [a for a in sys.argv[1:] if a.startswith("--")]
    path = Path(args[0])
    x0 = int(args[1]) if len(args) > 2 else 0
    x1 = int(args[2]) if len(args) > 2 else None
    thresh = 150
    for o in opts:
        if o.startswith("--thresh="):
            thresh = int(o.split("=", 1)[1])

    im = Image.open(path).convert("L")
    px = im.load()
    w, h = im.size
    if x1 is None:
        x1 = w
    print(f"{path.name} {w}x{h} window x{x0}..{x1}")

    cur = None
    for y in range(h):
        l = r = None
        for x in range(x0, x1):
            if px[x, y] < thresh:
                l = x
                break
        for x in range(x1 - 1, x0 - 1, -1):
            if px[x, y] < thresh:
                r = x
                break
        if l is None:
            if cur:
                    print(f"  y {cur[0]:5d}-{y - 1:5d} h={y - cur[0]:5d}  x {cur[1]:5d}-{cur[2]:5d} w={cur[2] - cur[1] + 1}")
                    cur = None
        else:
            if cur is None:
                cur = [y, l, r]
            else:
                cur[1] = min(cur[1], l)
                cur[2] = max(cur[2], r)
    if cur:
        print(f"  y {cur[0]:5d}-{h - 1:5d} h={h - cur[0]:5d}  x {cur[1]:5d}-{cur[2]:5d} w={cur[2] - cur[1] + 1}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
