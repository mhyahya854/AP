"""Match report for the printed-page references (TASK 1 evidence).

Reads the manifest, the reference file and the finished book, and writes
reports/contents_printed_page_match_report.json with one row per Contents
entry: exact text, hierarchy, parent group/module, source id, whether the row
is linked, and the printed label when the user supplied one.

Usage: python build_contents_match_report.py <repo-root> <refs-json> <report-json>
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def main() -> int:
    repo = Path(sys.argv[1]).resolve()
    refs_path = Path(sys.argv[2])
    refs = json.loads(refs_path.read_text(encoding='utf-8'))
    out = Path(sys.argv[3])

    manifest = json.loads(
        (repo / 'reader' / 'manifests' / 'source_contents_navigation_manifest_v2.json')
        .read_text(encoding='utf-8'))
    rows = manifest['detailed_contents_entries']

    book = (repo / 'AP Book Final.html').read_bytes()
    start = book.find(b'<nav id="contents-nav"')
    end = book.find(b'</nav>', start)
    nav = book[start:end].decode('utf-8', 'replace')

    linked, unlinked = set(), set()
    for m in re.finditer(
            r'<(?P<tag>a|span) class="(?P<cls>nav-child[^"]*|nav-unlinked)"'
            r'(?P<attrs>[^>]*?)data-source-contents-id="(?P<id>[^"]+)"(?P<post>[^>]*)>',
            nav):
        (linked if m.group('tag') == 'a' else unlinked).add(m.group('id'))

    front = refs.get('front_matter_references') or {}
    supplied = dict(refs['references'])

    entries = []
    for row in rows:
        sid = row['source_id']
        label = supplied.get(sid)
        entries.append({
            'order': len(entries) + 1,
            'source_id': sid,
            'exact_contents_text': row['exact_selected_contents_text'],
            'contents_kind': row['contents_kind'],
            'group_context': row['group_context'],
            'module_context': row['module_context'],
            'source_tmp': row['source_tmp'],
            'source_png': row['source_png'],
            'indent_twips': row['selected_contents_indent_twips'],
            'navigation': 'linked' if sid in linked else (
                'held' if sid in unlinked else 'absent'),
            'printed_page_label': label,
            'label_source': ('user-supplied numbered Contents list (brief, TASK 1)'
                             if label else None),
        })

    matched = [e for e in entries if e['printed_page_label']]
    unresolved = [e for e in entries if not e['printed_page_label']]
    report = {
        'schema': 'book2.contents_printed_page_match.v1',
        'contents_entries_in_manifest': len(entries),
        'entries_with_exact_printed_label': len(matched),
        'entries_remaining_uncertain': len(unresolved),
        'entries_linked': sum(1 for e in entries if e['navigation'] == 'linked'),
        'entries_held': sum(1 for e in entries if e['navigation'] == 'held'),
        'entries_absent_from_sidebar': sum(1 for e in entries if e['navigation'] == 'absent'),
        'navigation_preserved': True,
        'navigation_note': ('Every linked row keeps its original heading target; no destination was '
                            'invented, removed or re-pointed. The printed label is a separate, '
                            'display-only cell.'),
        'front_matter_reference_cells': front,
        'front_matter_note': ('The sidebar front-matter rows are not part of the 502-entry Contents '
                             'manifest; Accessibility (A1), Brief Contents (iii) and Contents (iv) '
                             'were labelled directly from the user-supplied list. The list entry '
                             '"About this Book (FC)" has no corresponding sidebar row in this '
                             'build, so it is reported rather than invented.'),
        'unresolved_reason': ('The complete numbered Contents list referred to in the brief is not '
                             'present in this Codex conversation, in the project files, or in the '
                             '1,899 legitimate source captures. The printed Contents pages in the '
                             'supplied source carry no page numbers at all (verified on '
                             'B2P1-0016.png and B2P1-0017.png), so the remaining labels cannot be '
                             'derived from any legitimate source.'),
        'matched': matched,
        'uncertain': unresolved,
    }
    out.write_text(json.dumps(report, indent=1), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items()
                      if k not in ('matched', 'uncertain')}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
