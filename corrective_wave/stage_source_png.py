"""Copy the 1,899 legitimate Book 2 source captures into the repository.

The set is exactly the audited `_master_work/source_inventory.json` list: the
ordered TMP reconstruction sequence (B2P1-0001 ... B2P3-0038 minus the two
captures that belong to another book).  Original filenames and original bytes
are preserved; nothing is re-encoded, resized or merged.

Usage: python stage_source_png.py <repo-root> <report-json>
"""
from __future__ import annotations

import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(r'C:\Users\mhyah\Downloads\book-source\Word')
INVENTORY = ROOT / '_master_work' / 'source_inventory.json'
ATTRS = ROOT / '_tmp_attr.json'          # per-region attributes read from the book
EXCLUDED = {'B2P3-0034.png', 'B2P3-0035.png'}


def digest(path: Path) -> tuple[str, int]:
    h = hashlib.sha256()
    size = 0
    with path.open('rb') as fh:
        while True:
            chunk = fh.read(8 << 20)
            if not chunk:
                break
            size += len(chunk)
            h.update(chunk)
    return h.hexdigest(), size


def main() -> int:
    repo = Path(sys.argv[1]).resolve()
    report_path = Path(sys.argv[2])
    inventory = json.loads(INVENTORY.read_text(encoding='utf-8-sig'))
    attrs = json.loads(ATTRS.read_text(encoding='utf-8')) if ATTRS.exists() else {}

    ordered: list[tuple[str, str]] = []          # (batch, filename)
    for batch in inventory['batches']:
        for name in batch['source_png_names']:
            ordered.append((batch['batch'], name))

    print(f'inventory: {len(ordered)} captures')
    present_excluded = [n for _, n in ordered if n in EXCLUDED]
    if present_excluded:
        raise SystemExit(f'excluded captures present in the legitimate list: {present_excluded}')

    target_root = repo / 'source_png'
    records = []
    total = 0
    seen = set()
    for index, (batch, name) in enumerate(ordered, start=1):
        if name in seen:
            raise SystemExit(f'duplicate source name in inventory: {name}')
        seen.add(name)
        src = ROOT / batch / name
        if not src.is_file():
            raise SystemExit(f'missing source capture: {src}')
        dest_dir = target_root / batch
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / name
        shutil.copy2(src, dest)
        sha, size = digest(dest)
        total += size
        tmp = f'TMP-{index:04d}'
        attr = attrs.get(tmp) or {}
        records.append({
            'ordinal': index,
            'original_filename': name,
            'repo_path': f'source_png/{batch}/{name}',
            'source_batch': batch,
            'tmp_identifier': tmp,
            'bytes': size,
            'sha256': sha,
            'textbook_source_capture': True,
            'region_group': attr.get('group_title') or '',
            'region_nav_label': attr.get('nav_label') or '',
        })
        if index % 200 == 0:
            print(f'  {index}/{len(ordered)} copied ({total/2**30:.2f} GiB)')

    report = {
        'schema': 'book2.source_png_staging.v1',
        'repo': str(repo),
        'legitimate_captures': len(records),
        'total_bytes': total,
        'total_gib': round(total / 2**30, 4),
        'excluded': sorted(EXCLUDED),
        'excluded_reason': 'captures of a different book; not part of the Book 2 reconstruction',
        'records': records,
    }
    report_path.write_text(json.dumps(report, indent=1), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'records'}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
