"""Locate the article-list end in the baseline and in a candidate."""
from __future__ import annotations

import os
import sys


def look(path: str) -> None:
    size = os.path.getsize(path)
    with open(path, "rb") as fh:
        fh.seek(max(0, size - (8 << 20)))
        base = max(0, size - (8 << 20))
        blob = fh.read()
    print(path)
    print("  size", size)
    for needle in (b'<aside class="right" id="reader-controls"',
                   b"</main>", b"TMP-1899", b"TMP-1898", b"</article>"):
        idx = blob.rfind(needle)
        print("   rfind", needle[:28], idx, "-> abs", base + idx if idx >= 0 else None)


def main() -> int:
    for p in sys.argv[1:]:
        look(p)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
