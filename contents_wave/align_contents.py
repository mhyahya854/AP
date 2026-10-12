"""Align the user-supplied numbered Contents with the reader manifest rows.

Ordered Needleman-Wunsch over normalized titles, with every normalization
recorded so the reconciliation ledger can show exactly what was matched on
what evidence. Nothing is inferred from position alone: two titles only pair
when their normalized forms (or a recorded explicit variant) are equal.
"""
from __future__ import annotations

import io
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from user_contents import NUMBERED  # noqa: E402

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = Path(r'C:\Users\mhyah\Downloads\book-source\Word')
REPO = ROOT / '_master_work' / 'repo' / 'AP'
OUT = ROOT / '_master_work' / 'contents_wave'


def dedash(t: str) -> str:
    return (t.replace('\u2019', "'").replace('\u2018', "'")
             .replace('\u201c', '"').replace('\u201d', '"')
             .replace('\u2013', '-').replace('\u2014', '-'))


def base(t: str) -> str:
    s = dedash(t).lower()
    s = s.replace('\u00ae', '').replace('\u2122', '').replace('\u00a9', '')
    s = re.sub(r'\.\.\.+', ' ', s)
    s = re.sub(r'[\s]+', ' ', s).strip()
    s = s.strip('. ')
    return s


def canon(t: str) -> str:
    s = base(t)
    s = re.sub(r'^case stud(?:y|ies)\s*:?\s*', 'case study ', s)
    s = s.replace('/', ' ')
    s = re.sub(r'^unit\s+\d+\s+', '', s)          # "Unit 1 AP Exam Practice Questions"
    s = s.replace(':', ' ')
    s = s.replace('businesses', 'business')       # "Unit 1 Business(es), ..."
    s = re.sub(r'[^a-z0-9. ]+', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def compact(s: str) -> str:
    return re.sub(r'[^a-z0-9]', '', s)


def keys(t: str) -> set[str]:
    """Normalized keys for matching; extras are explicit, recorded variants."""
    c = canon(t)
    out = {compact(c)}
    if compact(c) in ('practiceyourapskills', 'practiceyourapskillsquestions'):
        out |= {'practiceyourapskills', 'practiceyourapskillsquestions'}
    if compact(c) in ('promotionandmarketingcommunication',
                      'promotionandmarketingcommunications'):
        out |= {'promotionandmarketingcommunication',
                'promotionandmarketingcommunications'}
    return out


def variant_note(a: str, b: str) -> str | None:
    ca, cb = canon(a), canon(b)
    if ca == cb:
        if base(a) == base(b):
            return None
        return 'normalization applied: case/space/punctuation/slash/plural ("{:s}" vs "{:s}")'.format(
            base(a), base(b))
    na, nb = base(a), base(b)
    if compact(ca) == compact(cb):
        return 'punctuation/space variant'
    if compact(ca) == compact(cb).replace('businesses', 'business'):
        return 'singular/plural variant ("Business" vs "Businesses")'
    if {compact(ca), compact(cb)} <= {'practiceyourapskills',
                                      'practiceyourapskillsquestions'}:
        return 'short/long form ("Practice Your AP Skills" vs "... Questions")'
    if {compact(ca), compact(cb)} <= {'promotionandmarketingcommunication',
                                      'promotionandmarketingcommunications'}:
        return 'singular/plural variant ("Communication(s)")'
    return f'normalized variant: "{na}" vs "{nb}"'


def main() -> None:
    manifest = json.loads(
        (REPO / 'reader' / 'manifests' / 'source_contents_navigation_manifest_v2.json')
        .read_text(encoding='utf-8'))
    rows = manifest['detailed_contents_entries']

    A = [(t, lab) for t, lab in NUMBERED]           # user list
    B = [(r['source_id'], r['exact_selected_contents_text']) for r in rows]

    n, m = len(A), len(B)
    MATCH, VAR, MISMATCH, GAP = 6, 4, -20, -1

    ka = [keys(t) for t, _ in A]
    kb = [keys(t) for _, t in B]

    score = [[0] * (m + 1) for _ in range(n + 1)]
    trace = [[None] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        score[i][0] = score[i - 1][0] + GAP
        trace[i][0] = 'up'
    for j in range(1, m + 1):
        score[0][j] = score[0][j - 1] + GAP
        trace[0][j] = 'left'
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            inter = ka[i - 1] & kb[j - 1]
            if inter:
                s = MATCH if base(A[i - 1][0]) == base(B[j - 1][1]) else VAR
            else:
                s = MISMATCH
            diag = score[i - 1][j - 1] + s
            up = score[i - 1][j] + GAP
            left = score[i][j - 1] + GAP
            best = max(diag, up, left)
            score[i][j] = best
            # only take a diagonal when it strictly beats a gap: a tie means the
            # safer gap is preferred, so two unrelated titles are never paired
            if diag > up and diag > left:
                trace[i][j] = 'diag'
            elif up >= left:
                trace[i][j] = 'up'
            else:
                trace[i][j] = 'left'

    pairs, only_user, only_manifest = [], [], []
    i, j = n, m
    while i > 0 or j > 0:
        step = trace[i][j] if (i and j) else ('up' if i else 'left')
        if i > 0 and j > 0 and step == 'diag':
            pairs.append((i - 1, j - 1))
            i -= 1
            j -= 1
        elif i > 0 and (j == 0 or step == 'up'):
            only_user.append(i - 1)
            i -= 1
        else:
            only_manifest.append(j - 1)
            j -= 1
    pairs.reverse()
    only_user.reverse()
    only_manifest.reverse()

    print(f'user entries {n}, manifest rows {m}')
    print(f'paired {len(pairs)}  user-only {len(only_user)}  manifest-only {len(only_manifest)}')
    print()
    print('--- variant pairs (title differs) ---')
    for ui, mi in pairs:
        note = variant_note(A[ui][0], B[mi][1])
        if note:
            print(f'  U{ui+1:>3} "{A[ui][0]}" == M{mi+1:>3} "{B[mi][1]}"  [{note}]')
    print()
    print('--- user entries with no manifest row ---')
    for ui in only_user:
        print(f'  U{ui+1:>3} "{A[ui][0]}" -> {A[ui][1]}')
    print()
    print('--- manifest rows with no user entry ---')
    for mi in only_manifest:
        print(f'  M{mi+1:>3} {B[mi][0]} "{B[mi][1]}" (kind {rows[mi]["contents_kind"]})')

    (OUT / 'alignment.json').write_text(json.dumps({
        'pairs': [{'user_index': ui + 1, 'manifest_index': mi + 1,
                   'user_title': A[ui][0], 'user_label': A[ui][1],
                   'manifest_source_id': B[mi][0], 'manifest_text': B[mi][1],
                   'normalization': variant_note(A[ui][0], B[mi][1])}
                  for ui, mi in pairs],
        'user_only': [{'user_index': ui + 1, 'title': A[ui][0], 'label': A[ui][1]}
                      for ui in only_user],
        'manifest_only': [{'manifest_index': mi + 1, 'source_id': B[mi][0],
                           'text': B[mi][1], 'kind': rows[mi]['contents_kind'],
                           'group_context': rows[mi]['group_context'],
                           'module_context': rows[mi]['module_context']}
                          for mi in only_manifest],
    }, indent=1, ensure_ascii=False), encoding='utf-8')
    print('\nwritten alignment.json')


if __name__ == '__main__':
    main()
