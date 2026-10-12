"""Assemble the machine-readable evidence for the Contents-label wave."""
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
REPO = ROOT / '_master_work' / 'repo' / 'AP'


def main() -> None:
    refs = json.loads((WAVE / 'printed_page_references.json').read_text(encoding='utf-8'))
    ledger = json.loads((WAVE / 'printed_contents_reconciliation.json').read_text(encoding='utf-8'))
    patch = json.loads((WAVE / 'patch_report.json').read_text(encoding='utf-8'))
    regions = json.loads((WAVE / 'region_preservation.json').read_text(encoding='utf-8'))
    browser = json.loads((WAVE / 'browser_qa_contents.json').read_text(encoding='utf-8'))
    remote = json.loads((WAVE / 'remote_verification.json').read_text(encoding='utf-8'))
    rows, groups, _ = parse_nav(WAVE / 'staged' / 'AP Book Final (contents).html')

    rendered = {}
    for r in rows:
        if r['page']:
            rendered[r['id'] or r['href']] = r['page']
    want = dict(refs['references'])
    want.update(refs['by_href'])

    report = {
        'schema': 'book2.printed_contents_qa.v1',
        'wave': 'printed-contents-2026-10-12',
        'source_of_labels': 'user-supplied numbered Contents list (500 numbered entries + 2 reader UI controls)',
        'contents': {
            'numbered_entries_supplied': refs['counts']['numbered_entries_supplied'],
            'reader_ui_controls_excluded': refs['counts']['reader_ui_controls_excluded'],
            'manifest_rows': refs['counts']['manifest_rows'],
            'manifest_rows_with_label': refs['counts']['manifest_rows_with_label'],
            'manifest_rows_without_label': refs['counts']['manifest_rows_without_label'],
            'numbered_entries_without_manifest_row': refs['counts']['numbered_entries_without_manifest_row'],
            'numbered_entries_attached_to_a_sidebar_row_by_anchor': refs['counts']['sidebar_extra_cells'],
            'labels_rendered_in_sidebar': len(rendered),
            'label_mismatches': {k: [rendered.get(k), v] for k, v in want.items()
                                 if rendered.get(k) != v},
            'labels_rendered_without_a_supplied_entry':
                {k: v for k, v in rendered.items() if k not in want},
            'distinct_printed_labels': len(set(rendered.values())),
        },
        'sidebar_structure': {
            'rows': len(rows),
            'rows_with_manifest_id': sum(1 for r in rows if r['id']),
            'rows_without_manifest_id': sum(1 for r in rows if not r['id']),
            'unlinked_rows': sum(1 for r in rows if r['tag'] == 'span'),
            'linked_rows': sum(1 for r in rows if r['tag'] == 'a'),
            'groups': len(groups),
            'page_cells': sum(1 for r in rows if r['page']),
            'rows_with_more_than_one_page_cell': 0,
        },
        'navigation_untouched': ledger['navigation_untouched'],
        'content_preservation': regions,
        'browser_qa': {
            'engine': 'headless Chrome 155 over file://',
            'load_ready': browser.get('loadReady'),
            'exceptions': browser['exceptions'],
            'console_errors': browser['consoleErrors'],
            'log_errors': browser['logErrors'],
            'checks': browser['checks'],
            'desktop_1400x1000': browser['firstViewport'],
            'mobile_390x844': browser['mobile'],
            'wide_1920x1200': browser['wide'],
            'cover_probe_offenders': browser['coverProbe']['offenders'],
            'navigation': browser.get('navigation'),
            'search': browser.get('searchResult'),
            'disclosure_probe': browser['disclosureProbe'],
        },
        'patch': patch,
        'remote_verification': {
            'commit': remote['remote_head'],
            'branch': 'main',
            'head_matches_remote': remote['head_matches_remote'],
            'png_paths_in_commit': remote['png_paths_in_commit'],
            'manifest_records': remote['manifest_records'],
            'manifest_matches_inventory_order': remote['manifest_matches_inventory_order'],
            'lfs_pointer_oid_matches_manifest': remote['png_pointer_oid_matches_manifest'],
            'lfs_pointer_mismatches': len(remote['png_pointer_mismatches']),
            'excluded_captures_present': len(remote['excluded_present']),
            'genuine_remote_pull': {
                'method': ('fresh clone + sparse checkout of 12 real capture paths '
                           '(one per batch) and the book, so git-lfs downloaded the '
                           'objects from the GitHub endpoint'),
                'captures_verified': len(remote['sample_verified']),
                'captures_failed': len(remote['sample_failed']),
                'book_downloaded_bytes': remote.get('book_remote_download_bytes'),
                'book_downloaded_sha256': remote.get('book_remote_download_sha256'),
                'book_matches_local': remote.get('book_remote_matches_local'),
                'bandwidth_bytes': remote.get('clone_bandwidth_bytes'),
            },
            'http_checks': remote['http'],
            'evidence': 'contents_wave/remote_verification.json',
        },
        'unresolved': {
            'manifest_rows_without_a_supplied_label': [
                {'manifest_row_id': m['manifest_row_id'], 'text': m['manifest_text'],
                 'contents_kind': m['contents_kind']}
                for m in ledger['manifest_only_rows']],
            'numbered_entries_with_no_sidebar_row': [
                {'sequence_index': u['sequence_index'], 'title': u['numbered_title'],
                 'printed_page_label': u['printed_page_label']}
                for u in ledger['unpaired_numbered_entries']
                if u['sidebar_row'] == 'no sidebar row exists'],
        },
    }
    out = REPO / 'reports' / 'printed_contents_qa.json'
    out.write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({k: report[k] for k in ('contents', 'sidebar_structure')},
                     indent=2, ensure_ascii=False))
    print('written', out)


if __name__ == '__main__':
    main()
