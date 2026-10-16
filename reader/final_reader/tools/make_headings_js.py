"""Build ui/headings.js from the audited HEADING_LEVELS map in the live reader.

The map is the accessibility wave's manifest-derived role/aria-level assignment
for the 383 verified heading anchors; it is reused verbatim rather than
regenerated.
"""
from __future__ import annotations

import re
from pathlib import Path

SRC = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\redesign\shell\11-script1.js")
OUT = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\redesign\ui\headings.js")


def main() -> int:
    text = SRC.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"const HEADING_LEVELS=(\{.*?\});", text, re.S)
    if not m:
        raise SystemExit("HEADING_LEVELS not found")
    table = m.group(1)
    n = table.count("book-heading-")
    body = (
        "/* Book 2 verified heading semantics (reused verbatim from the\n"
        "   accessibility wave: role=heading / aria-level per audited anchor). */\n"
        "(function () {\n"
        "  var LEVELS = " + table + ";\n"
        "  for (var id in LEVELS) {\n"
        "    var el = document.getElementById(id);\n"
        "    if (el) { el.setAttribute('role', 'heading'); el.setAttribute('aria-level', String(LEVELS[id])); }\n"
        "  }\n"
        "})();\n"
    )
    OUT.write_text(body, encoding="utf-8")
    print("anchors", n, "->", OUT, len(body), "bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
