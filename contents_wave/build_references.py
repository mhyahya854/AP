"""Build reader/printed_page_references.json and the reconciliation ledger.

Every label comes from the user-supplied numbered Contents list. Nothing is
extrapolated: a manifest row only receives a label when a numbered entry was
matched to it, in order, on an equal or explicitly-normalized title.
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from user_contents import NUMBERED, UI_CONTROLS  # noqa: E402

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = Path(r'C:\Users\mhyah\Downloads\book-source\Word')
REPO = ROOT / '_master_work' / 'repo' / 'AP'
OUT = ROOT / '_master_work' / 'contents_wave'

# Sidebar rows that exist outside the 502-entry manifest (front matter + the
# back-matter Glossary row).  Keyed by the anchor the row links to.
SIDEBAR_EXTRA = {
    'about this book': None,            # not present in the sidebar
    'cover page': None,
    'accessibility': '#book-heading-0002',
    'title page': None,
    'copyright page': None,
    'brief contents': '#book-heading-0003',
    'contents': '#book-heading-0004',
    'about the authors': '#book-heading-0005',
    'content advisory board': '#book-heading-0006',
    'business with personal finance': '#book-heading-0001',
    'get the most out of your textbook\u2019s . . .': None,
    'glossary': '#book-heading-0382',
    'fep': None,
    'back cover': None,
}


def main() -> None:
    alignment = json.loads((OUT / 'alignment.json').read_text(encoding='utf-8'))
    manifest = json.loads(
        (REPO / 'reader' / 'manifests' / 'source_contents_navigation_manifest_v2.json')
        .read_text(encoding='utf-8'))
    rows = {r['source_id']: r for r in manifest['detailed_contents_entries']}

    titles = {i + 1: t for i, (t, lab) in enumerate(NUMBERED)}
    labels = {i + 1: lab for i, (t, lab) in enumerate(NUMBERED)}

    references: dict[str, str] = {}
    entries = []
    for pair in alignment['pairs']:
        seq = pair['user_index']
        sid = pair['manifest_source_id']
        label = pair['user_label']
        row = rows[sid]
        if sid in references:
            raise SystemExit(f'manifest row matched twice: {sid}')
        references[sid] = label
        entries.append({
            'sequence_index': seq,
            'title': pair['user_title'],
            'printed_page_label': label,
            'manifest_row_id': sid,
            'manifest_text': row['exact_selected_contents_text'],
            'contents_kind': row['contents_kind'],
            'parent_group': row['group_context'],
            'parent_module': row['module_context'],
            'indent_twips': row['selected_contents_indent_twips'],
            'source_tmp': row['source_tmp'],
            'source_png': row['source_png'],
            'normalization': pair['normalization'],
        })

    by_href: dict[str, str] = {}
    for item in alignment['user_only']:
        seq = item['user_index']
        href = SIDEBAR_EXTRA.get(item['title'].lower())
        if href:
            by_href[href] = item['label']

    out = {
        'schema': 'book2.printed_page_references.v2',
        'authority': 'the user-supplied numbered Contents list, verbatim',
        'order': 'sequence_index follows the supplied list exactly (1-based)',
        'counts': {
            'numbered_entries_supplied': len(NUMBERED),
            'reader_ui_controls_excluded': len(UI_CONTROLS),
            'manifest_rows': len(rows),
            'manifest_rows_with_label': len(references),
            'manifest_rows_without_label': len(rows) - len(references),
            'numbered_entries_without_manifest_row': len(alignment['user_only']),
            'sidebar_extra_cells': len(by_href),
        },
        'special_labels_preserved': [
            'FC', 'A1', 'i', 'ii', 'iii', 'iv', 'x', 'xii', 'xiii', 'xiv',
            '103A', '201A', '327A', '327B', '385A', '429A', 'G-1', 'EP-1', 'BC',
        ],
        'not_inferred': ('No label is derived from TMP names, capture order, region '
                         'numbers, Word pagination, neighbouring headings, the previous or '
                         'next Contents entry, or any counter. Rows absent from the supplied '
                         'list keep an empty reference cell and are listed in '
                         'reports/printed_contents_reconciliation.json.'),
        'references': dict(sorted(references.items())),
        'by_href': by_href,
        'entries': entries,
    }
    (OUT / 'printed_page_references.json').write_text(
        json.dumps(out, indent=1, ensure_ascii=False), encoding='utf-8')

    ledger = {
        'schema': 'book2.printed_contents_reconciliation.v1',
        'source': 'user-supplied numbered Contents list (500 numbered entries)',
        'counts': out['counts'],
        'paired': [{
            'sequence_index': e['sequence_index'],
            'numbered_title': e['title'],
            'printed_page_label': e['printed_page_label'],
            'manifest_row_id': e['manifest_row_id'],
            'manifest_text': e['manifest_text'],
            'evidence': ('exact title match' if not e['normalization']
                         else e['normalization']),
            'parent_group': e['parent_group'],
            'parent_module': e['parent_module'],
            'sidebar_row': 'manifest row rendered in the contents nav',
        } for e in entries],
        'unpaired_numbered_entries': [{
            'sequence_index': item['user_index'],
            'numbered_title': item['title'],
            'printed_page_label': item['label'],
            'sidebar_row': ('rendered by href ' + SIDEBAR_EXTRA[item['title'].lower()])
            if SIDEBAR_EXTRA.get(item['title'].lower()) else 'no sidebar row exists',
            'status': 'label attached to an existing sidebar row'
            if SIDEBAR_EXTRA.get(item['title'].lower()) else 'no sidebar row to attach it to',
        } for item in alignment['user_only']],
        'manifest_only_rows': [{
            'manifest_index': item['manifest_index'],
            'manifest_row_id': item['source_id'],
            'manifest_text': item['text'],
            'contents_kind': item['kind'],
            'parent_group': item['group_context'],
            'parent_module': item['module_context'],
            'status': 'no matching entry in the supplied numbered list; reference cell left empty',
        } for item in alignment['manifest_only']],
        'reader_ui_controls': {
            'entries': UI_CONTROLS,
            'status': 'reader UI controls, not printed Contents rows; no label assigned',
        },
        'navigation_untouched': ('No href was added, removed or re-pointed; held and Index '
                                 'rows stay unlinked.'),
    }
    (OUT / 'printed_contents_reconciliation.json').write_text(
        json.dumps(ledger, indent=1, ensure_ascii=False), encoding='utf-8')

    print(json.dumps(out['counts'], indent=2))
    print('references written:', len(references), 'by_href:', by_href)
    checks = {
        'Module 1.1 What Is a Business?': '4',
        'Businesses Create Value': '6',
        'Module 1.1 Review': '9',
        'Unit 2 Marketing': '104',
        'Unit 3 Part 1 Personal Saving and Borrowing': '202',
        'Unit 4 Management and Strategy': '328',
        'Unit 5 Personal Goals, Budgeting, and Investing': '386',
        'Index': '456',
        'Back Cover': 'BC',
    }
    for title, want in checks.items():
        seq = next((i + 1 for i, (t, _) in enumerate(NUMBERED) if t == title), None)
        got = labels.get(seq)
        print(f'  check {title!r} -> {got!r} (want {want!r}) {"OK" if got == want else "MISMATCH"}')


if __name__ == '__main__':
    main()
