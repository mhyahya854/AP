"""Derive the verified module / unit start headings from the reader's own nav.

Writes _master_work/wave/section_starts.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

MODULE_RX = re.compile(
    r'<a class="nav-child nav-module-link"[^>]*href="#(?P<h>book-heading-\d+)"[^>]*>'
    r'(?P<t>[^<]*)</a>')
UNIT_RX = re.compile(
    r'<a class="nav-child"[^>]*href="#(?P<h>book-heading-\d+)"[^>]*data-depth="1">'
    r'(?P<t>[^<]*)</a>')


def main() -> None:
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'AP Book Final.html'
    with src.open('r', encoding='utf-8', errors='replace', newline='') as fh:
        head = fh.read(4 << 20)
    nav_start = head.find('<nav')
    nav_end = head.find('</nav>')
    nav = head[nav_start:nav_end]
    modules = [(m.group('h'), m.group('t')) for m in MODULE_RX.finditer(nav)]
    units = [(m.group('h'), m.group('t')) for m in UNIT_RX.finditer(nav)
             if m.group('t').strip().lower().startswith('unit ')]
    headings = []
    for hid, title in units + modules:
        if hid not in headings:
            headings.append(hid)
    groups = [f'book-group-{i:02d}' for i in range(2, 11)]
    out = {
        'source': str(src),
        'headings': headings,
        'groups': groups,
        'module_openers': [{'id': h, 'title': t} for h, t in modules],
        'unit_openers': [{'id': h, 'title': t} for h, t in units],
    }
    (HERE / 'section_starts.json').write_text(json.dumps(out, indent=1), encoding='utf-8')
    print('module openers', len(modules))
    print('unit openers', len(units))
    print('distinct section-start headings', len(headings))
    print('groups', groups)
    for h, t in (units + modules)[:12]:
        print(' ', h, t)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    main()
