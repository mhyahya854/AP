"""Read-only structural scan of the published 1.13 GB reader HTML.

Reports byte offsets of the document shell landmarks and the article-region
markers so later patching can be scoped without loading the whole file.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

BOOK = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\AP Book Final.html")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\redesign\shell_scan.json")

CHUNK = 1 << 23  # 8 MiB
OVERLAP = 64

PATTERNS = {
    "doctype": re.compile(rb"<!doctype html>", re.I),
    "head_open": re.compile(rb"<head[ >]"),
    "head_close": re.compile(rb"</head>"),
    "body_open": re.compile(rb"<body[ >]"),
    "body_close": re.compile(rb"</body>"),
    "html_close": re.compile(rb"</html>"),
    "app_div": re.compile(rb'<div class="app'),
    "left_aside": re.compile(rb'<aside class="left"'),
    "right_aside": re.compile(rb'<aside class="right"'),
    "main_open": re.compile(rb"<main"),
    "article_open": re.compile(rb'<article class="book-page"'),
    "nav_open": re.compile(rb"<nav[ >]"),
    "style_open": re.compile(rb"<style[ >]"),
    "script_open": re.compile(rb"<script[ >]"),
    "region_marker": re.compile(rb'id="TMP-\d{4}"'),
    "region_ref": re.compile(rb'<span class="ref">TMP-\d{4}</span>'),
}


def main() -> int:
    size = BOOK.stat().st_size
    hits: dict[str, dict[str, object]] = {k: {"count": 0, "offsets": []} for k in PATTERNS}
    cap = 12
    with BOOK.open("rb") as fh:
        pos = 0
        tail = b""
        while True:
            buf = fh.read(CHUNK)
            if not buf:
                break
            data = tail + buf
            base = pos - len(tail)
            for name, pat in PATTERNS.items():
                rec = hits[name]
                for m in pat.finditer(data):
                    rec["count"] = int(rec["count"]) + 1  # type: ignore[arg-type]
                    offs = rec["offsets"]
                    if isinstance(offs, list) and len(offs) < cap:
                        offs.append(base + m.start())
            if len(data) >= OVERLAP:
                tail = data[-OVERLAP:]
            else:
                tail = data
            pos += len(buf)
            if pos >= size:
                break

    report = {"path": str(BOOK), "bytes": size, "landmarks": hits}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")

    for name in PATTERNS:
        rec = hits[name]
        print(f"{name:16s} count={rec['count']:<10} first={rec['offsets'][:6]}")
    print(f"written {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
