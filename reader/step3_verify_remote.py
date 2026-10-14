"""Step 3: verify the pushed commit, its tree and the Git LFS pointer.

Read-only: git plumbing plus HTTP HEAD/GET on the public endpoints.
usage: python reader/step3_verify_remote.py
"""
import hashlib
import io
import json
import os
import subprocess
import sys
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'reports', 'contents_navigation', 'remote_verification.json')
BOOK = 'AP Book Final.html'
RAW = 'https://raw.githubusercontent.com/mhyahya854/AP/main/'
MEDIA = 'https://media.githubusercontent.com/media/mhyahya854/AP/main/'


def git(*args):
    return subprocess.run(['git', '-C', BASE, *args], capture_output=True, text=True,
                          check=True).stdout


def main():
    patch = json.load(open(os.path.join(BASE, 'reports/contents_navigation/patch_report.json'), encoding='utf-8'))
    want_sha, want_bytes = patch['target_sha256'], patch['target_bytes']
    report = {'schema': 'book2.step3.remote_verification.v1',
              'expected': {'sha256': want_sha, 'bytes': want_bytes},
              'local_head': git('rev-parse', 'HEAD').strip(),
              'remote_head': git('rev-parse', 'origin/main').strip(),
              'previous_head': patch['source_sha256']}
    report['head_matches_remote'] = report['local_head'] == report['remote_head']
    tree = git('ls-tree', '-r', '--name-only', 'HEAD').splitlines()
    report['book_in_tree'] = BOOK in tree
    report['step3_files_in_tree'] = sorted(p for p in tree
                                           if p.startswith('reader/step3_') or p.startswith('reader/ui3.')
                                           or p.startswith('reports/contents_navigation/'))
    report['report_in_tree'] = 'docs/CONTENTS_NAVIGATION_FINAL_REPORT.md' in tree
    pointer = git('show', 'HEAD:' + BOOK).strip().splitlines()
    report['book_lfs_pointer'] = pointer[:3]
    report['book_pointer_matches'] = (('oid sha256:%s' % want_sha) in pointer
                                      and ('size %d' % want_bytes) in pointer)
    lfs = {}
    for line in git('lfs', 'ls-files', '--long', 'HEAD').splitlines():
        parts = line.split(None, 2)
        if len(parts) == 3:
            lfs[parts[2].strip()] = parts[0]
    report['lfs_book_oid'] = lfs.get(BOOK)
    report['lfs_book_oid_matches_pointer'] = lfs.get(BOOK) == want_sha
    report['lfs_objects'] = len(lfs)

    local = hashlib.sha256()
    n = 0
    with open(os.path.join(BASE, BOOK), 'rb') as fh:
        for blk in iter(lambda: fh.read(16 << 20), b''):
            n += len(blk)
            local.update(blk)
    report['book_local_bytes'] = n
    report['book_local_sha256'] = local.hexdigest()
    report['book_local_matches_pointer'] = (n == want_bytes and local.hexdigest() == want_sha)

    http = {}
    for name, url in {'readme': RAW + 'README.md',
                      'report': RAW + 'docs/CONTENTS_NAVIGATION_FINAL_REPORT.md',
                      'ui3_js': RAW + 'reader/ui3.js',
                      'ui3_css': RAW + 'reader/ui3.css',
                      'ledger': RAW + 'reports/contents_navigation/navigation_ledger_final.json'}.items():
        try:
            req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'codex-verify'})
            with urllib.request.urlopen(req, timeout=60) as r:
                http[name] = {'status': r.status, 'bytes': r.headers.get('Content-Length')}
        except Exception as exc:  # noqa: BLE001
            http[name] = {'error': str(exc)}
    report['http'] = http
    try:
        req = urllib.request.Request(MEDIA + BOOK.replace(' ', '%20'), method='HEAD',
                                     headers={'User-Agent': 'codex-verify'})
        with urllib.request.urlopen(req, timeout=90) as r:
            report['lfs_media'] = {'status': r.status, 'bytes': r.headers.get('Content-Length'),
                                   'type': r.headers.get('Content-Type')}
    except Exception as exc:  # noqa: BLE001
        report['lfs_media'] = {'error': str(exc)}
    try:
        body = urllib.request.urlopen(
            urllib.request.Request(RAW + 'README.md', headers={'User-Agent': 'codex-verify'}),
            timeout=90).read().decode('utf-8')
        report['readme_records_final_hash'] = want_sha in body
        report['readme_records_final_size'] = ('{:,}'.format(want_bytes) in body
                                               or str(want_bytes) in body)
    except Exception as exc:  # noqa: BLE001
        report['readme_error'] = str(exc)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=1)
    print(json.dumps({k: v for k, v in report.items()
                      if k not in ('step3_files_in_tree', 'book_lfs_pointer')}, indent=1, ensure_ascii=False))
    print('step3 files in tree:', len(report['step3_files_in_tree']))
    print('written', OUT)


if __name__ == '__main__':
    main()
