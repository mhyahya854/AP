"""Write the printed-page reference cells into the reader sidebar.

Streaming and surgical: only the `<nav id="contents-nav">` block is rewritten;
every byte outside it is copied unchanged. For each navigation row the page
cell is set from printed_page_references.json (manifest row id, or anchor href
for the front-matter / Glossary rows). No href, label or wording of a Contents
entry is touched, and no row is added or removed.

Usage: python patch_contents_labels.py <in.html> <out.html> [--report r.json]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(r'C:\Users\mhyah\Downloads\book-source\Word')
WAVE = ROOT / '_master_work' / 'contents_wave'

NAV_OPEN = b'<nav id="contents-nav"'
NAV_CLOSE = b'</nav>'
HEAD_BYTES = 8 << 20

NOTE_OLD = (b'<p class="rail-note">Printed page references are shown where the supplied '
            b'numbered Contents list provides them; the remaining rows keep an empty cell. '
            b'The printed Contents pages in the source carry no page numbers.</p>')
NOTE_NEW = (b'<p class="rail-note">Page numbers are the printed labels from the supplied '
            b'numbered Contents list. A blank cell means that list has no label for the row.</p>')

PAGE_RX = re.compile(r'<span class="nav-page">[^<]*</span>')


def row_extent(nav: str, tag: str, inner_start: int) -> int:
    """Index of the row's own closing tag, past any nested nav-page span."""
    if tag == 'a':
        end = nav.find('</a>', inner_start)
        if end < 0:
            raise SystemExit('anchor row has no closing tag')
        return end
    depth = 0
    pos = inner_start
    while True:
        nxt_open = nav.find('<span', pos)
        nxt_close = nav.find('</span>', pos)
        if nxt_close < 0:
            raise SystemExit('span row has no closing tag')
        if nxt_open != -1 and nxt_open < nxt_close:
            depth += 1
            pos = nxt_open + 5
        else:
            if depth == 0:
                return nxt_close
            depth -= 1
            pos = nxt_close + 7


def transform(nav: str, mapping: dict[str, str]) -> tuple[str, int, list[str]]:
    edits = []
    missing = []
    for key, label in mapping.items():
        needle = f'href="{key}"' if key.startswith('#') else f'data-source-contents-id="{key}"'
        at = nav.find(needle)
        if at < 0:
            missing.append(key)
            continue
        if nav.find(needle, at + 1) != -1:
            raise SystemExit(f'row key is not unique in the nav: {key}')
        lt = nav.rfind('<', 0, at)
        tag = re.match(r'<([a-z]+)', nav[lt:]).group(1)
        gt = nav.index('>', at)
        inner_start = gt + 1
        close = row_extent(nav, tag, inner_start)
        body = PAGE_RX.sub('', nav[inner_start:close])
        cell = f'<span class="nav-page">{label}</span>' if label else ''
        edits.append((gt + 1, close, cell + body))

    for start, end, replacement in sorted(edits, reverse=True):
        nav = nav[:start] + replacement + nav[end:]
    return nav, len(edits), missing


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('output')
    ap.add_argument('--report', default='')
    args = ap.parse_args()

    refs = json.loads((WAVE / 'printed_page_references.json').read_text(encoding='utf-8'))
    mapping: dict[str, str] = dict(refs['references'])
    mapping.update(refs['by_href'])

    src = Path(args.source)
    out = Path(args.output)
    stats = {
        'source': str(src), 'output': str(out),
        'source_bytes': src.stat().st_size,
        'labels_in_mapping': len(mapping),
        'rows_written': 0, 'rows_missing': [],
        'note_replaced': 0,
    }
    with src.open('rb') as fh:
        head = fh.read(HEAD_BYTES)
        i = head.find(NAV_OPEN)
        if i < 0:
            raise SystemExit('contents nav not found in the first block')
        j = head.find(NAV_CLOSE, i)
        if j < 0:
            raise SystemExit('contents nav end not found in the first block')
        nav = head[i:j + len(NAV_CLOSE)].decode('utf-8')
        new_nav, written, missing = transform(nav, mapping)
        stats['rows_written'] = written
        stats['rows_missing'] = missing
        head = head[:i] + new_nav.encode('utf-8') + head[j + len(NAV_CLOSE):]
        if NOTE_OLD in head:
            head = head.replace(NOTE_OLD, NOTE_NEW, 1)
            stats['note_replaced'] = 1
        elif NOTE_NEW in head:
            stats['note_replaced'] = 1
        else:
            raise SystemExit('sidebar note not found')
        h = hashlib.sha256()
        h.update(head)
        written_bytes = len(head)
        with out.open('wb') as oh:
            oh.write(head)
            while True:
                chunk = fh.read(8 << 20)
                if not chunk:
                    break
                oh.write(chunk)
                h.update(chunk)
                written_bytes += len(chunk)

    stats['output_bytes'] = out.stat().st_size
    stats['output_sha256'] = h.hexdigest()
    stats['bytes_added'] = stats['output_bytes'] - stats['source_bytes']
    # the only allowed change is the page cells plus the longer note, so the
    # file may grow but must never shrink and must stay within a small bound
    stats['ok'] = (not missing and written == len(mapping)
                   and 0 < stats['bytes_added'] < 200_000)
    if args.report:
        Path(args.report).write_text(json.dumps(stats, indent=2), encoding='utf-8')
    print(json.dumps(stats, indent=2))
    return 0 if stats['ok'] else 3


if __name__ == '__main__':
    raise SystemExit(main())
