"""Extract embedded <img> payloads from a region of the reader into PNG files.

Usage: python extract_img.py <book> <TMP-0005> <outdir>
Writes 000.png, 001.png ... and prints each image's PNG header size.
"""
from __future__ import annotations

import base64
import re
import struct
import sys
from pathlib import Path

IMG = re.compile(r'<img[^>]*src="data:image/(?P<fmt>png|jpeg);base64,(?P<b64>[^"]+)"[^>]*>')


def main() -> int:
    book = Path(sys.argv[1])
    want = sys.argv[2]
    out = Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)

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
        end = buf.find("</article>", i)
        while end < 0 and not eof:
            chunk = fh.read(4 << 20)
            eof = not chunk
            buf += chunk
            end = buf.find("</article>", i)
        markup = buf[i:end]

    for n, m in enumerate(IMG.finditer(markup)):
        data = base64.b64decode(m.group("b64"))
        ext = "png" if m.group("fmt") == "png" else "jpg"
        path = out / f"{n:03d}.{ext}"
        path.write_bytes(data)
        if ext == "png" and data[12:16] == b"IHDR":
            w, h = struct.unpack(">II", data[16:24])
            print(f"{path.name} {w}x{h} {len(data)} bytes")
        else:
            print(f"{path.name} {len(data)} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
