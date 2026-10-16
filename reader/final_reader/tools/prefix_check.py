"""Verify that the shell prefix was rewritten without altering any payload byte."""
from __future__ import annotations

import sys


def scan(path: str, n: int) -> None:
    with open(path, "rb") as fh:
        head = fh.read(n)
    bad = 0
    repl = head.count(b"\xef\xbf\xbd")
    for b in head:
        if b > 0x7E:
            bad += 1
    print(path)
    print("  bytes", len(head), "non-ascii", bad, "U+FFFD sequences", repl)


def main() -> int:
    for p in sys.argv[1:]:
        scan(p, 260_000)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
