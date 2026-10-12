"""Verify the patched sidebar: labels, counts, links and content preservation."""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nav import parse_nav  # noqa: E402

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = Path(r'C:\Users\mhyah\Downloads\book-source\Word')
WAVE = ROOT / '_master_work' / 'contents_wave'
BEFORE = ROOT / '_master_work' / 'repo' / 'AP' / 'AP Book Final.html'
AFTER = WAVE / 'staged' / 'AP Book Final (contents).html'


def key(row: dict) -> str:
    return row['id'] or row['href']


def main() -> None:
    refs = json.loads((WAVE / 'printed_page_references.json').read_text(encoding='utf-8'))
    before_rows, before_groups, nav_before = parse_nav(BEFORE)
    after_rows, after_groups, nav_after = parse_nav(AFTER)

    print('rows before/after:', len(before_rows), len(after_rows))
    print('page cells before/after:', sum(1 for r in before_rows if r['page']),
          sum(1 for r in after_rows if r['page']))
    print('unlinked rows before/after:', sum(1 for r in before_rows if r['tag'] == 'span'),
          sum(1 for r in after_rows if r['tag'] == 'span'))
    print('rows with manifest id before/after:',
          sum(1 for r in before_rows if r['id']), sum(1 for r in after_rows if r['id']))
    print('nav groups before/after:', len(before_groups), len(after_groups))

    text_diffs = [(b, a) for b, a in zip(before_rows, after_rows)
                  if b['text'] != a['text'] or b['href'] != a['href'] or b['id'] != a['id']
                  or b['tag'] != a['tag'] or b['depth'] != a['depth']]
    print('rows whose text/href/id/tag/depth changed:', len(text_diffs))
    for b, a in text_diffs[:5]:
        print('   ', b, '->', a)

    want = dict(refs['references'])
    want.update(refs['by_href'])
    got = {key(r): r['page'] for r in after_rows if r['page']}
    mismatch = {k: (got.get(k), v) for k, v in want.items() if got.get(k) != v}
    extra = {k: v for k, v in got.items() if k not in want}
    print('\nlabels expected:', len(want), 'rendered:', len(got))
    print('label mismatches:', len(mismatch), mismatch if len(mismatch) < 8 else '')
    print('labels rendered but not in the reference file:', extra)

    print('\nbrief checks:')
    for text, label in [('Module 1.1 What Is a Business?', '4'),
                        ('Businesses Create Value', '6'),
                        ('Module 1.1 Review', '9'),
                        ('Unit 2 Marketing', '104'),
                        ('Unit 3/Part 1 Personal Saving and Borrowing', '202'),
                        ('Unit 4 Management and Strategy', '328'),
                        ('Unit 5 Personal Goals, Budgeting, and Investing', '386'),
                        ('Index', '456')]:
        hit = [r for r in after_rows if r['text'] == text]
        ok = hit and hit[0]['page'] == label
        print(f'  {"OK " if ok else "!! "}{text!r} -> {[h["page"] for h in hit] or "NO ROW"} (want {label})')
    bc = [r for r in after_rows if r['text'] == 'Back Cover']
    print(f'  Back Cover row exists: {bool(bc)}')

    rendered = sorted({r['page'] for r in after_rows if r['page']})
    print('\nspecial labels rendered:', [s for s in refs['special_labels_preserved'] if s in rendered])
    print('special labels with no sidebar row:',
          [s for s in refs['special_labels_preserved'] if s not in rendered])
    print('all rendered labels are strings:',
          all(isinstance(r['page'], str) for r in after_rows if r['page']))
    print('distinct labels:', len(rendered))

    empty = [r for r in after_rows if r['id'] and not r['page']]
    print('\nmanifest rows with an empty cell:', len(empty))
    for r in empty:
        print('   ', r['id'], r['text'])

    empty_extra = [r for r in after_rows if not r['id'] and not r['page']]
    print('non-manifest sidebar rows with an empty cell:', len(empty_extra),
          [r['text'] for r in empty_extra])

    # no row may carry more than one page cell
    dupes = []
    for r in after_rows:
        span = nav_after[nav_after.find(r['text'][:0] or '', 0):]
        del span
    import re as _re
    for m in _re.finditer(r'<(a|span) class="(nav-child[^"]*|nav-unlinked)"[^>]*>', nav_after):
        end = nav_after.find('</' + m.group(1) + '>', m.end())
        cells = _re.findall(r'<span class="nav-page">', nav_after[m.end():end or len(nav_after)])
        if len(cells) > 1:
            dupes.append(nav_after[m.start():m.start() + 120])
    print('rows with more than one page cell:', len(dupes), dupes[:3])
    print('total page cells in nav:', nav_after.count('<span class="nav-page">'))


if __name__ == '__main__':
    main()
