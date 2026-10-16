"""Build matched-scale before/source/after comparison strips.

The supplied captures are scrolling screenshots of the source page; the reader
renders the same page on a 210 mm surface.  Each capture is therefore scaled by
the factor that makes its text measure equal the rendered measure, so the two
panes can be compared at the same type size.

Usage:
  python compare.py --source <capture.png> --after <rendered.png> --out <png>
                    [--scale S] [--crop-y0 N] [--crop-y1 N]
"""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


def band(img: Image.Image, thresh: int = 150):
    """Ink bands of a capture: list of (top, bottom)."""
    g = img.convert("L")
    px = g.load()
    w, h = g.size
    out = []
    cur = None
    for y in range(h):
        ink = False
        for x in range(0, w, 2):
            if px[x, y] < thresh:
                ink = True
                break
        if ink and cur is None:
            cur = y
        elif not ink and cur is not None:
            out.append((cur, y - 1))
            cur = None
    if cur is not None:
        out.append((cur, h - 1))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True)
    ap.add_argument("--after", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--scale", type=float, default=0.148)
    ap.add_argument("--crop-y0", type=int, default=0)
    ap.add_argument("--crop-y1", type=int, default=0)
    ap.add_argument("--label", default="")
    args = ap.parse_args()

    src = Image.open(args.source).convert("RGB")
    aft = Image.open(args.after).convert("RGB")

    y0, y1 = args.crop_y0, args.crop_y1 or src.size[1]
    if args.crop_y0 or args.crop_y1:
        src = src.crop((0, y0, src.size[0], y1))

    sw = max(1, int(round(src.size[0] * args.scale)))
    sh = max(1, int(round(src.size[1] * args.scale)))
    src_s = src.resize((sw, sh), Image.LANCZOS)

    pad = 14
    gap = 18
    W = pad * 2 + sw + gap + aft.size[0]
    H = pad * 2 + max(sh, aft.size[1]) + 24
    canvas = Image.new("RGB", (W, H), (28, 30, 34))
    canvas.paste(src_s, (pad, pad + 24))
    canvas.paste(aft, (pad + sw + gap, pad + 24))

    d = ImageDraw.Draw(canvas)
    d.text((pad, pad + 6), "SOURCE capture (scaled x%.3f)" % args.scale, fill=(230, 232, 236))
    d.text((pad + sw + gap, pad + 6), "RENDERED reader" + ("  " + args.label if args.label else ""),
           fill=(230, 232, 236))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)
    print(out, canvas.size, "source bands:", len(band(src)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
