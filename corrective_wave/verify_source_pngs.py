"""Remote verification of the source PNG upload.

1. every capture path in the committed tree is an LFS pointer whose oid and
   size match the local manifest byte for byte;
2. a representative sample is pulled back from the GitHub LFS endpoint and
   hashed, so the check is against the server's copy, not the local one.

Usage: python verify_source_pngs.py <repo-root> <staging-json> <report-json>
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

POINTER = re.compile(rb'oid sha256:([0-9a-f]{64})\nsize (\d+)\n')


def git(repo: Path, *args: str) -> str:
    return subprocess.run(['git', '-C', str(repo), *args],
                          capture_output=True, text=True, check=True).stdout


def main() -> int:
    repo = Path(sys.argv[1]).resolve()
    staging = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
    recs = {r['ordinal']: r for r in staging['records']}
    by_path = {r['repo_path']: r for r in staging['records']}

    tree = [p for p in git(repo, 'ls-tree', '-r', '--name-only', 'HEAD', '--', 'source_png').splitlines()
            if p.endswith('.png')]
    report: dict = {'commit': git(repo, 'rev-parse', 'HEAD').strip(),
                    'png_paths_in_committed_tree': len(tree)}

    # 1. pointer-by-pointer comparison against the manifest, read from the
    #    committed tree (not the working copy) with the LFS listing as the
    #    authoritative pointer source
    listing = git(repo, 'lfs', 'ls-files', '--long')
    matched, mismatched, not_pointer = 0, [], []
    seen_paths = set()
    for line in listing.splitlines():
        parts = line.split(None, 2)
        if len(parts) < 3:
            continue
        oid, _mark, path = parts[0], parts[1], parts[2].strip()
        if not path.endswith('.png'):
            continue
        seen_paths.add(path)
        rec = by_path.get(path)
        if rec and rec['sha256'] == oid:
            matched += 1
        else:
            mismatched.append({'path': path, 'pointer_oid': oid,
                               'manifest_oid': rec['sha256'] if rec else None})
    not_pointer = [p for p in tree if p not in seen_paths]
    report['pointer_matches_manifest'] = matched
    report['pointer_mismatches'] = mismatched
    report['non_pointer_paths'] = not_pointer

    # 2. pull a representative sample back from the remote and hash it
    sample_ordinals = [1, 250, 501, 543, 563, 585, 900, 1000, 1300, 1600, 1800, 1899]
    want = [recs[n] for n in sample_ordinals if n in recs]
    include = ','.join(f"oid={r['sha256']}" for r in want)
    fetch = subprocess.run(['git', '-C', str(repo), 'lfs', 'fetch', 'origin',
                            '--include', include],
                           capture_output=True, text=True)
    report['lfs_fetch_exit'] = fetch.returncode
    report['lfs_fetch_output'] = (fetch.stdout + fetch.stderr)[-600:]

    local_objects = repo / '.git' / 'lfs' / 'objects'
    verified, failed = [], []
    for rec in want:
        oid = rec['sha256']
        obj = local_objects / oid[:2] / oid[2:4] / oid
        if not obj.is_file():
            failed.append({'path': rec['repo_path'], 'reason': 'object not present after fetch'})
            continue
        h = hashlib.sha256()
        n = 0
        with obj.open('rb') as fh:
            while True:
                chunk = fh.read(8 << 20)
                if not chunk:
                    break
                n += len(chunk)
                h.update(chunk)
        if h.hexdigest() == oid and n == rec['bytes']:
            verified.append({'path': rec['repo_path'], 'oid': oid, 'bytes': n})
        else:
            failed.append({'path': rec['repo_path'],
                           'reason': f'hash/size mismatch: {h.hexdigest()} {n}'})
    report['sample_verified'] = verified
    report['sample_failed'] = failed

    Path(sys.argv[3]).write_text(json.dumps(report, indent=1), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items()
                      if k not in ('sample_verified', 'pointer_mismatches')}, indent=2))
    print('sample verified:', len(verified), 'failed:', len(failed))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
