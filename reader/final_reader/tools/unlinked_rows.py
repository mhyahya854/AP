"""Inventory the Contents rows that carry no destination, with source evidence.

For every `<span class="nav-child nav-unlinked" …>LABEL</span>` row this lists
the printed label, the supplied-entry id and every region whose text contains
the row's wording, so a row can be linked only when the source material is
actually there.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

NAV = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\redesign\shell\01-left-aside.html")
ROW = re.compile(
    r'<span class="nav-child nav-unlinked"([^>]*)>(?P<body>.*?)</span>\s*(?=<(?:a|span|details|/nav))',
    re.S)
PAGE = re.compile(r'<span class="nav-page">(.*?)</span>')
SUP = re.compile(r'data-supplied-entry="(\d+)"')
ATTR = re.compile(r'data-source-contents-id="([^"]+)"')
DEPTH = re.compile(r'data-depth="(\d+)"')


def rows():
    text = NAV.read_text(encoding="utf-8", errors="replace")
    out = []
    for m in ROW.finditer(text):
        body = m.group("body")
        label = re.sub(r"<[^>]*>", " ", body)
        label = re.sub(r"\s+", " ", label).strip()
        page = PAGE.search(body)
        sup = SUP.search(m.group(1))
        attrs = m.group(1)
        out.append({
            "label": label,
            "page": page.group(1).strip() if page else "",
            "supplied": sup.group(1) if sup else None,
            "source_contents_id": (ATTR.search(attrs).group(1) if ATTR.search(attrs) else None),
            "depth": (DEPTH.search(attrs).group(1) if DEPTH.search(attrs) else None),
        })
    return out


def main() -> int:
    rs = rows()
    print("unlinked rows:", len(rs))
    out = Path(sys.argv[1] if len(sys.argv) > 1 else
               r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\redesign\unlinked_rows.json")
    out.write_text(json.dumps(rs, ensure_ascii=False, indent=1), encoding="utf-8")
    for r in rs:
        print(f"  {r['page']:>5}  sup={str(r['supplied']):>4} depth={str(r['depth']):>4}  {r['label'][:78]}")
    print("written", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
