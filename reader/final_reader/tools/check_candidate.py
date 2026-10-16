"""Sanity-check an assembled candidate's shell landmarks."""
from __future__ import annotations

import os
import sys


def main() -> int:
    path = sys.argv[1]
    print("size", os.path.getsize(path))
    with open(path, "rb") as fh:
        head = fh.read(400_000)
    for needle in (b"b2-topbar", b"book2ReaderUI", b"mode-badge",
                   b'id="reader-controls"', b'class="toolbar"',
                   b'id="reader-main"', b"b2-bottombar", b"contents-nav",
                   b"id=\"mode\"", b"HEADING_LEVELS"):
        print(needle.decode(), head.count(needle))
    with open(path, "rb") as fh:
        fh.seek(os.path.getsize(path) - 40_000)
        tail = fh.read()
    for needle in (b"b2-bottombar", b"book2ReaderUI", b"HEADING_LEVELS",
                   b"</body></html>", b'id="contents-nav"'):
        print("tail", needle.decode(), tail.count(needle))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
