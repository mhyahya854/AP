"""Write source_png/SOURCE_PNG_MANIFEST.csv and its JSON equivalent.

Usage: python build_source_manifest.py <repo-root> <staging-json>
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

from PIL import Image

# Printed labels come only from the user's supplied numbered Contents list.
# Nine of its rows sit on the printed Contents page B2P1-0016.png, whose
# capture therefore carries nine labels in its own right; every other capture
# has no label because none was supplied.  A TMP number is never a page number.
TOC_LABELS = {
    'B2P1-0016.png': ['4', '6', '9', '11'],
    'B2P1-0022.png': ['104'],
    'B2P1-0029.png': ['202'],
    'B2P1-0036.png': ['328'],
    'B2P1-0040.png': ['386'],
    'B2P1-0044.png': ['456'],
}


def main() -> int:
    repo = Path(sys.argv[1]).resolve()
    staging = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
    records = staging['records']

    rows = []
    for rec in records:
        path = repo / rec['repo_path']
        with Image.open(path) as im:
            width, height = im.size
        rows.append({
            'ordinal': rec['ordinal'],
            'original_filename': rec['original_filename'],
            'repo_path': rec['repo_path'],
            'source_batch': rec['source_batch'],
            'source_order': rec['ordinal'],
            'tmp_identifier': rec['tmp_identifier'],
            'width_px': width,
            'height_px': height,
            'bytes': rec['bytes'],
            'sha256': rec['sha256'],
            'source_status': 'legitimate_original_book2_source_capture',
            'record_kind': 'source_capture_partial_or_full_page_not_a_printed_page',
            'section_or_module': rec['region_group'],
            'region_nav_label': rec['region_nav_label'],
            'printed_page_labels': ';'.join(TOC_LABELS.get(rec['original_filename'], [])),
        })

    csv_path = repo / 'source_png' / 'SOURCE_PNG_MANIFEST.csv'
    fields = list(rows[0].keys())
    with csv_path.open('w', encoding='utf-8', newline='') as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    json_path = repo / 'source_png' / 'SOURCE_PNG_MANIFEST.json'
    payload = {
        'schema': 'book2.source_png_manifest.v1',
        'capture_count': len(rows),
        'total_bytes': sum(r['bytes'] for r in rows),
        'excluded_captures': {
            'files': ['B2P3-0034.png', 'B2P3-0035.png'],
            'reason': 'captures of a different book; not part of the Book 2 reconstruction',
        },
        'ordering': 'source_order is the verified reconstruction order (1..1899); '
                    'original_filename order inside a batch is zero-padded and therefore '
                    'lexicographic, while source_order is numeric',
        'not_page_numbers': 'tmp_identifier is an internal reconstruction id. It is not a '
                            'printed page number, and a capture may span only part of a '
                            'printed page.',
        'printed_page_labels_note': 'Printed labels are supplied only for the rows of the '
                                    'user-supplied numbered Contents list that were actually '
                                    'provided; all other captures carry no label here.',
        'captures': rows,
    }
    json_path.write_text(json.dumps(payload, indent=1), encoding='utf-8')
    print(json.dumps({'csv': str(csv_path), 'json': str(json_path),
                      'capture_count': len(rows),
                      'total_bytes': payload['total_bytes'],
                      'csv_bytes': csv_path.stat().st_size,
                      'json_bytes': json_path.stat().st_size}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
