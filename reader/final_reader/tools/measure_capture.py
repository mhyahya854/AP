"""Measure a source capture: text column edges, icon size, heading size.

Read-only analysis used to derive source-faithful CSS values instead of
guessing them.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def ink_columns(img: Image.Image, y0: int, y1: int, thresh: int = 140):
    """Return (left, right) of the leftmost/rightmost dark pixel in a row band."""
    g = img.convert("L")
    px = g.load()
    w, _ = g.size
    left, right = None, None
    for y in range(y0, y1):
        for x in range(w):
            if px[x, y] < thresh:
                if left is None or x < left:
                    left = x
                if right is None or x > right:
                    right = x
                break
        for x in range(w - 1, -1, -1):
            if px[x, y] < thresh:
                if right is None or x > right:
                    right = x
                break
    return left, right


def ink_rows(img: Image.Image, x0: int, x1: int, y0: int, y1: int, thresh: int = 140):
    g = img.convert("L")
    px = g.load()
    top, bottom = None, None
    for y in range(y0, y1):
        dark = False
        for x in range(x0, x1):
            if px[x, y] < thresh:
                dark = True
                break
        if dark:
            if top is None:
                top = y
            bottom = y
    return top, bottom


def main() -> int:
    path = Path(sys.argv[1])
    img = Image.open(path)
    print("capture", path.name, img.size, img.mode)

    # 1. the info icon: search a generous window for the largest dark blob
    win = (int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else None
    if win:
        x0, y0, x1, y1 = win
        crop = img.convert("L").crop((x0, y0, x1, y1))
        px = crop.load()
        cw, ch = crop.size
        xs, ys = [], []
        for y in range(ch):
            for x in range(cw):
                if px[x, y] < 140:
                    xs.append(x)
                    ys.append(y)
        if xs:
            print("icon bbox in capture:",
                  f"x {x0 + min(xs)}..{x0 + max(xs)} (w={max(xs) - min(xs) + 1})",
                  f"y {y0 + min(ys)}..{y0 + max(ys)} (h={max(ys) - min(ys) + 1})")
        else:
            print("no ink found in window")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
