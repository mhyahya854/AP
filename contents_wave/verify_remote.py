"""Verify the pushed commit: tree, LFS pointers, manifest, book hash, links."""
from __future__ import annotations

import hashlib
import io
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = Path(r'C:\Users\mhyah\Downloads\book-source\Word')
REPO = ROOT / '_master_work' / 'repo' / 'AP'
CLONE = ROOT / '_master_work' / 'contents_wave' / 'clone_verify' / 'AP'
BOOK_SHA = 'f606cdc8bf3af4451ed1a092e047fca77bc506244c163dc5ec9bb5531f63346d'
BOOK_BYTES = 1132297657


def git(*args: str, cwd: Path = REPO) -> str:
    return subprocess.run(['git', '-C', str(cwd), *args],
                          capture_output=True, text=True, check=True).stdout


def main() -> None:
    report: dict = {}
    report['local_head'] = git('rev-parse', 'HEAD').strip()
    report['remote_head'] = git('rev-parse', 'origin/main').strip()
    report['head_matches_remote'] = report['local_head'] == report['remote_head']

    # 1. committed tree
    tree = git('ls-tree', '-r', '--name-only', 'HEAD').splitlines()
    pngs = [p for p in tree if p.startswith('source_png/') and p.endswith('.png')]
    report['png_paths_in_commit'] = len(pngs)
    report['book_path_in_commit'] = 'AP Book Final.html' in tree
    report['preview_sheets'] = len([p for p in tree if p.startswith('docs/source_previews/')])
    report['contents_wave_files'] = sorted(p for p in tree if p.startswith('contents_wave/'))
    report['reports'] = sorted(p for p in tree if p.startswith('reports/'))

    # 2. LFS pointers
    listing = git('lfs', 'ls-files', '--long')
    lfs = {}
    for line in listing.splitlines():
        parts = line.split(None, 2)
        if len(parts) == 3:
            lfs[parts[2].strip()] = parts[0]
    report['lfs_files'] = len(lfs)
    report['lfs_png_entries'] = sum(1 for p in lfs if p.endswith('.png')
                                    and p.startswith('source_png/'))
    book_pointer = git('show', 'HEAD:AP Book Final.html').strip().splitlines()
    report['book_pointer'] = book_pointer
    report['book_pointer_ok'] = (f'oid sha256:{BOOK_SHA}' in book_pointer
                                 and f'size {BOOK_BYTES}' in book_pointer)

    # 3. manifest vs inventory vs tree
    manifest = json.loads((REPO / 'source_png' / 'SOURCE_PNG_MANIFEST.json')
                          .read_text(encoding='utf-8'))
    caps = manifest['captures']
    report['manifest_records'] = len(caps)
    report['manifest_unique_names'] = len({c['original_filename'] for c in caps})
    report['manifest_unique_paths'] = len({c['repo_path'] for c in caps})
    report['manifest_unique_ordinals'] = len({c['ordinal'] for c in caps})
    report['manifest_total_bytes'] = manifest['total_bytes']
    inventory = json.loads((ROOT / '_master_work' / 'source_inventory.json')
                           .read_text(encoding='utf-8-sig'))
    names = [n for b in inventory['batches'] for n in b['source_png_names']]
    report['inventory_records'] = len(names)
    report['manifest_matches_inventory_order'] = [c['original_filename'] for c in caps] == names
    tree_set = set(tree)
    report['manifest_paths_missing_from_tree'] = [c['repo_path'] for c in caps
                                                  if c['repo_path'] not in tree_set]
    report['png_pointer_oid_matches_manifest'] = sum(
        1 for c in caps if lfs.get(c['repo_path']) == c['sha256'])
    report['png_pointer_mismatches'] = [c['repo_path'] for c in caps
                                        if lfs.get(c['repo_path']) != c['sha256']]
    report['excluded_present'] = [p for p in tree
                                 if p.endswith(('B2P3-0034.png', 'B2P3-0035.png'))]

    # 4. genuine remote pull: sparse-checkout real paths in a fresh clone, which
    #    makes git-lfs download the objects from the GitHub endpoint
    sample = [caps[i] for i in (0, 249, 449, 500, 543, 562, 584, 899, 999, 1299, 1599, 1898)]
    wanted = [c['repo_path'] for c in sample] + ['AP Book Final.html']
    sparse = CLONE / '.git' / 'info' / 'sparse-checkout'
    sparse.parent.mkdir(parents=True, exist_ok=True)
    sparse.write_text('\n'.join(wanted) + '\n', encoding='utf-8')
    subprocess.run(['git', '-C', str(CLONE), 'config', 'core.sparseCheckout', 'true'],
                   check=True, capture_output=True)
    subprocess.run(['git', '-C', str(CLONE), 'config', 'core.sparseCheckoutCone', 'false'],
                   check=True, capture_output=True)
    co = subprocess.run(['git', '-C', str(CLONE), 'checkout', '-f', 'origin/main'],
                        capture_output=True, text=True)
    report['clone_checkout_exit'] = co.returncode
    report['clone_checkout_tail'] = (co.stdout + co.stderr)[-300:]
    report['clone_head'] = git('rev-parse', 'HEAD', cwd=CLONE).strip()
    report['clone_bandwidth_bytes'] = sum(
        (CLONE / p).stat().st_size for p in wanted if (CLONE / p).is_file())
    verified, failed = [], []
    for c in sample:
        f = CLONE / c['repo_path']
        if not f.is_file():
            failed.append({'path': c['repo_path'], 'why': 'not checked out'})
            continue
        h = hashlib.sha256()
        n = 0
        with f.open('rb') as fh:
            while True:
                chunk = fh.read(8 << 20)
                if not chunk:
                    break
                n += len(chunk)
                h.update(chunk)
        if h.hexdigest() == c['sha256'] and n == c['bytes']:
            verified.append({'path': c['repo_path'], 'bytes': n})
        else:
            failed.append({'path': c['repo_path'], 'why': f'{h.hexdigest()} {n}'})
    report['sample_verified'] = verified
    report['sample_failed'] = failed
    book_clone = CLONE / 'AP Book Final.html'
    if book_clone.is_file():
        h = hashlib.sha256()
        n = 0
        with book_clone.open('rb') as fh:
            while True:
                chunk = fh.read(16 << 20)
                if not chunk:
                    break
                n += len(chunk)
                h.update(chunk)
        report['book_remote_download_bytes'] = n
        report['book_remote_download_sha256'] = h.hexdigest()
        report['book_remote_matches_local'] = (n == BOOK_BYTES and h.hexdigest() == BOOK_SHA)
    else:
        report['book_remote_matches_local'] = 'not downloaded'

    # 5. book byte check against the local file
    h = hashlib.sha256()
    n = 0
    with (REPO / 'AP Book Final.html').open('rb') as fh:
        while True:
            chunk = fh.read(16 << 20)
            if not chunk:
                break
            n += len(chunk)
            h.update(chunk)
    report['book_local_bytes'] = n
    report['book_local_sha256'] = h.hexdigest()
    report['book_local_matches_pointer'] = (n == BOOK_BYTES and h.hexdigest() == BOOK_SHA)

    # 6. public links
    links = {
        'sheet': 'https://raw.githubusercontent.com/mhyahya854/AP/main/docs/source_previews/sheet-0001-0020.jpg',
        'manifest_csv': 'https://raw.githubusercontent.com/mhyahya854/AP/main/source_png/SOURCE_PNG_MANIFEST.csv',
        'index': 'https://raw.githubusercontent.com/mhyahya854/AP/main/docs/source_previews/index.html',
        'readme': 'https://raw.githubusercontent.com/mhyahya854/AP/main/README.md',
    }
    http = {}
    for name, url in links.items():
        try:
            req = urllib.request.Request(url, method='HEAD',
                                         headers={'User-Agent': 'codex-verify'})
            with urllib.request.urlopen(req, timeout=40) as r:
                http[name] = {'status': r.status, 'bytes': r.headers.get('Content-Length')}
        except Exception as exc:  # noqa: BLE001
            http[name] = {'error': str(exc)}
    report['http'] = http

    api_url = 'https://api.github.com/repos/mhyahya854/AP/git/trees/main?recursive=1'
    try:
        req = urllib.request.Request(api_url, headers={'User-Agent': 'codex-verify'})
        data = json.load(urllib.request.urlopen(req, timeout=60))
        paths = [t['path'] for t in data['tree']]
        report['api_total_paths'] = len(paths)
        report['api_png_paths'] = len([p for p in paths
                                       if p.startswith('source_png/') and p.endswith('.png')])
        report['api_previews'] = len([p for p in paths if p.startswith('docs/source_previews/')])
        report['api_truncated'] = data.get('truncated')
    except Exception as exc:  # noqa: BLE001
        report['api_error'] = str(exc)

    out = ROOT / '_master_work' / 'contents_wave' / 'remote_verification.json'
    out.write_text(json.dumps(report, indent=1), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items()
                      if k not in ('contents_wave_files', 'reports',
                                   'sample_verified', 'book_pointer')},
                     indent=2, ensure_ascii=False))
    print('sample verified:', len(verified), 'failed:', len(failed))


if __name__ == '__main__':
    main()
