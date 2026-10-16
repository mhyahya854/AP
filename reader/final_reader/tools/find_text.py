"""Stream the reader once and report which regions contain each needle.

Usage: python find_text.py <book> "needle one" "needle two" ...
Prints, per needle, the list of <article> ordinals that contain it, plus a short
context window around the first hit in each region.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ART = re.compile(r'<article class="book-page" id="(?P<id>TMP-\d{4})"')


def main() -> int:
    book = Path(sys.argv[1])
    needles = [n.lower() for n in sys.argv[2:]]
    hits: dict[str, list[tuple[str, str]]] = {n: [] for n in needles}

    with book.open("r", encoding="utf-8", errors="replace", newline="") as fh:
        buf = ""
        eof = False
        current = None
        while True:
            if current is None:
                m = ART.search(buf)
                if not m:
                    if eof:
                        break
                    buf = buf[-8192:]
                    chunk = fh.read(8 << 20)
                    eof = not chunk
                    buf += chunk
                    continue
                current = m.group("id")
                buf = buf[m.end():]
            end = buf.find("</article>")
            while end < 0 and not eof:
                chunk = fh.read(8 << 20)
                eof = not chunk
                buf += chunk
                end = buf.find("</article>")
            if end < 0:
                break
            markup = buf[:end]
            low = markup.lower()
            for n in needles:
                i = low.find(n)
                if i >= 0:
                    ctx = re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", markup[max(0, i - 160): i + 260]))
                    hits[n].append((current, ctx.strip()))
            buf = buf[end + len("</article>"):]
            current = None

    for n in needles:
        print(f"### {n!r} -> {len(hits[n])} region(s): {[h[0] for h in hits[n]][:20]}")
        for rid, ctx in hits[n][:3]:
            print(f"    {rid}: …{ctx}…")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
