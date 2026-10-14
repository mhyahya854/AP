"""Build the user's manual page-review package from the audit records.

Outputs:
  reports/final_release_qa/MANUAL_REVIEW_INDEX.csv   (reading-order checklist)
  docs/MANUAL_BOOK_REVIEW_GUIDE.md                   (how to use it)

Sources: the Contents ledger (titles, printed labels, anchors, destinations),
the region -> source-PNG map from the original sequence, the per-region content
census, the disclosure census, the table census and the documented source gaps.

usage: python reader/compose_manual_review.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
QA = BASE / 'reports' / 'final_release_qa'
WORK = BASE.parent.parent / 'final_release_qa'
LEDGER = BASE / 'reports' / 'contents_navigation' / 'navigation_ledger_final.json'
BLANK_CSV = BASE.parent.parent / 'blank_viewport_audit.csv'


def load(path):
    return json.loads(Path(path).read_text(encoding='utf-8')) if Path(path).exists() else {}


ledger = load(LEDGER)
coverage = load(QA / 'content_coverage.json')
disclosures = load(QA / 'disclosure_visibility_audit.json')
tables = load(QA / 'table_audit.json')
region_map = load(WORK / 'region_source_map.json')
images = load(QA / 'image_audit.json')

disclosure_regions = {r['region']: r['summary'] for r in disclosures.get('rows', [])}
data_table_regions = {}
for t in tables.get('dataTables', []):
    if t.get('dataTableId'):
        data_table_regions.setdefault(t['region'], []).append(t['dataTableId'])

blank_rows = []
if BLANK_CSV.exists():
    with BLANK_CSV.open(encoding='utf-8-sig', newline='') as handle:
        blank_rows = list(csv.DictReader(handle))
blank = {r['temporary_ref']: r for r in blank_rows}

coverage_by_region = {r['id']: r for r in coverage.get('allRows', [])}

REPAIRED = [
    ('TMP-0002', 'Front Cover description repair'),
    ('TMP-0107', 'merged interaction state (Walmart/Merck family)'),
    ('TMP-1304', 'merged interaction state'),
    ('TMP-0125', "Kellogg's Froot Loops description repair"),
    ('TMP-0428', 'Supply Chain flowchart description'),
    ('TMP-0715', 'Price Elasticity of Demand description'),
    ('TMP-1107', 'income statement table reconstruction'),
]
repaired_by_region = {}
for ref, note in REPAIRED:
    repaired_by_region.setdefault(ref, []).append(note)


def region_facts(ref, row):
    """Risk flags and neutral facts kept apart, so the checklist stays readable."""
    risk = []
    info = coverage_by_region.get(ref, {})
    mapping = region_map.get(ref, {})
    status = mapping.get('extraction_status')
    facts = {
        'has_extended_description': 'yes' if ref in disclosure_regions else '',
        'has_photograph': (str(info.get('imgs')) + ' embedded') if info.get('imgs') else '',
        'has_financial_table': ','.join(data_table_regions[ref]) if ref in data_table_regions else '',
    }
    if ref in blank:
        risk.append('SOURCE-GAP (' + blank[ref]['classification'].lower() + ')')
    if info:
        if info.get('chars', 0) == 0:
            risk.append('no reconstructed text')
        elif info.get('chars', 0) < 120 and info.get('imgs', 0) == 0:
            risk.append('thin text (' + str(info['chars']) + ' chars, no photograph)')
    if status in ('UNVERIFIED_OCR_ONLY', 'PROVISIONAL_OCR_ALIGNED_WORD'):
        risk.append('OCR-derived batch (' + str(mapping.get('batch')) + ')')
    if ref in repaired_by_region:
        risk.append('repaired: ' + repaired_by_region[ref][0])
    return facts, risk


ledger_rows = ledger.get('rows', [])

# Rail ancestry: groupOrdinal 1..11 plus moduleOrdinal, taken from the rail rows
# themselves (the ledger's dest* fields describe the destination, not the rail).
group_title = {}
module_title = {}
for entry in ledger_rows:
    if entry.get('kind') == 'group-header':
        group_title[entry.get('groupOrdinal')] = entry.get('title')
    if 'nav-module-link' in (entry.get('classes') or []):
        module_title[(entry.get('groupOrdinal'), entry.get('moduleOrdinal'))] = entry.get('title')


def clean_title(entry):
    title = entry.get('title') or ''
    page = entry.get('page') or ''
    if page and title.startswith(page) and len(title) > len(page):
        return title[len(page):].strip()
    return title


def span_of(refs):
    ordinals = sorted(int(r[4:]) for r in refs if r and r.startswith('TMP-'))
    if not ordinals:
        return ''
    return 'TMP-%04d .. TMP-%04d' % (ordinals[0], ordinals[-1])


group_refs = {}
module_refs = {}
for entry in ledger_rows:
    ref = (entry.get('destination') or {}).get('region')
    group_refs.setdefault(entry.get('groupOrdinal'), []).append(ref)
    if entry.get('moduleOrdinal'):
        module_refs.setdefault((entry.get('groupOrdinal'), entry.get('moduleOrdinal')), []).append(ref)

rows = []
index = 0
current_group = None
current_module = None
current_group_title = ''
current_module_title = ''

for entry in ledger_rows:
    group_ordinal = entry.get('groupOrdinal')
    module_ordinal = entry.get('moduleOrdinal')
    dest = entry.get('destination') or {}
    ref = dest.get('region') or ''
    mapping = region_map.get(ref, {})
    anchor = entry.get('href') or ''
    facts, risk = region_facts(ref, entry) if ref else ({}, [])
    if group_ordinal != current_group:
        current_group = group_ordinal
        current_module = None
        current_module_title = ''
        current_group_title = group_title.get(group_ordinal) or {
            11: 'Backmatter rows (no source body)',
            None: 'Front/back matter rows without a scope group',
        }.get(group_ordinal, 'Group %s' % group_ordinal)
        index += 1
        rows.append({
            'index': index, 'kind': 'unit-or-group', 'group': current_group_title, 'module': '',
            'title': current_group_title, 'printed_label': entry.get('page') or '',
            'reader_anchor': anchor, 'destination_region': ref,
            'source_png': mapping.get('source_png', ''), 'batch': mapping.get('batch', ''),
            'region_span': span_of(group_refs.get(group_ordinal, [])),
            'risk_flags': '; '.join(risk),
            'has_extended_description': facts.get('has_extended_description', ''),
            'has_photograph': facts.get('has_photograph', ''),
            'has_financial_table': facts.get('has_financial_table', ''),
            'review_status': '', 'defect_note': '',
        })
        if entry.get('kind') == 'group-header':
            continue
    if module_ordinal and module_ordinal != current_module:
        current_module = module_ordinal
        current_module_title = (module_title.get((group_ordinal, module_ordinal))
                                or entry.get('destModuleTitle') or 'Module %s' % module_ordinal)
        index += 1
        rows.append({
            'index': index, 'kind': 'module', 'group': current_group_title,
            'module': current_module_title, 'title': current_module_title,
            'printed_label': entry.get('page') or '', 'reader_anchor': anchor,
            'destination_region': ref, 'source_png': mapping.get('source_png', ''),
            'batch': mapping.get('batch', ''),
            'region_span': span_of(module_refs.get((group_ordinal, module_ordinal), [])),
            'risk_flags': '; '.join(risk),
            'has_extended_description': facts.get('has_extended_description', ''),
            'has_photograph': facts.get('has_photograph', ''),
            'has_financial_table': facts.get('has_financial_table', ''),
            'review_status': '', 'defect_note': '',
        })
        continue
    index += 1
    flags = list(risk)
    if not anchor:
        note = (entry.get('notes') or [''])[0]
        flags = flags + ['unlinked' + (' (' + note + ')' if note else '')]
    rows.append({
        'index': index, 'kind': 'entry', 'group': current_group_title,
        'module': current_module_title, 'title': clean_title(entry),
        'printed_label': entry.get('page') or '', 'reader_anchor': anchor,
        'destination_region': ref, 'source_png': mapping.get('source_png', ''),
        'batch': mapping.get('batch', ''), 'region_span': '',
        'risk_flags': '; '.join(flags),
        'has_extended_description': facts.get('has_extended_description', ''),
        'has_photograph': facts.get('has_photograph', ''),
        'has_financial_table': facts.get('has_financial_table', ''),
        'review_status': '', 'defect_note': '',
    })

OUT_CSV = QA / 'MANUAL_REVIEW_INDEX.csv'
fields = ['index', 'kind', 'group', 'module', 'title', 'printed_label', 'reader_anchor',
          'destination_region', 'source_png', 'batch', 'region_span',
          'has_extended_description', 'has_photograph', 'has_financial_table',
          'risk_flags', 'review_status', 'defect_note']
with OUT_CSV.open('w', encoding='utf-8-sig', newline='') as handle:
    writer = csv.DictWriter(handle, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)

print('rows:', len(rows))
print('units/groups:', len({r['group'] for r in rows if r['group']}))
print('modules:', len({r['module'] for r in rows if r['module']}))
print('entries:', len([r for r in rows if r['kind'] == 'entry']))
print('rows with risk flags:', len([r for r in rows if r['risk_flags']]))
print('written', OUT_CSV)
json.dump({'rows': len(rows), 'fields': fields}, (QA / 'manual_review_index_summary.json').open('w', encoding='utf-8'), indent=1)
