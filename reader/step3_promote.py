"""Step 3: guarded atomic promotion of the verified navigation candidate.

Refuses unless the staged file still hashes to what the patcher reported, keeps
a byte-exact backup of the artifact being replaced, and verifies the promoted
file afterwards.
usage: python reader/step3_promote.py
"""
import datetime
import hashlib
import json
import os
import shutil
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FINAL = os.path.join(BASE, 'AP Book Final.html')
STAGED = os.path.join(BASE, 'reader', 'AP-Book-Final-step3-staged.html')
PATCH = os.path.join(BASE, 'reports', 'contents_navigation', 'patch_report.json')
OUT = os.path.join(BASE, 'reports', 'contents_navigation', 'promotion_report.json')
BACKUP_DIR = os.path.join(BASE, '_master_work', 'integration_backups', 'step3-20261014')
BLOCK = 8 << 20


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for blk in iter(lambda: fh.read(BLOCK), b''):
            h.update(blk)
    return h.hexdigest()


def main():
    report = json.load(open(PATCH, encoding='utf-8'))
    staged_sha = sha(STAGED)
    if staged_sha != report['target_sha256']:
        raise SystemExit('staged hash %s != patcher report %s' % (staged_sha, report['target_sha256']))
    if os.path.getsize(STAGED) != report['target_bytes']:
        raise SystemExit('staged size changed')
    prev_sha = sha(FINAL)
    if prev_sha != report['source_sha256']:
        raise SystemExit('the current artifact is not the one this patch was built from '
                         '(%s != %s)' % (prev_sha, report['source_sha256']))
    prev_bytes = os.path.getsize(FINAL)
    os.makedirs(BACKUP_DIR, exist_ok=True)
    prev_copy = os.path.join(BACKUP_DIR, 'prev-final-AP Book Final.html')
    if not os.path.exists(prev_copy) or sha(prev_copy) != prev_sha:
        shutil.copy2(FINAL, prev_copy)
        if sha(prev_copy) != prev_sha:
            raise SystemExit('backup copy does not match the artifact being replaced')
    tmp = FINAL + '.staging'
    shutil.copy2(STAGED, tmp)
    if sha(tmp) != staged_sha:
        raise SystemExit('staged copy hash mismatch')
    os.replace(tmp, FINAL)
    new_sha = sha(FINAL)
    out = {
        'promoted_at_utc': datetime.datetime.utcnow().isoformat() + 'Z',
        'previous_sha256': prev_sha,
        'previous_bytes': prev_bytes,
        'previous_backup': os.path.relpath(prev_copy, BASE).replace('\\', '/'),
        'candidate_sha256': staged_sha,
        'final_sha256': new_sha,
        'final_bytes': os.path.getsize(FINAL),
        'match': new_sha == staged_sha,
        'link_rows_linked': report['inserted']['link_rows_linked'],
    }
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, indent=1)
    print(json.dumps(out, indent=1))
    if new_sha != staged_sha:
        raise SystemExit('promotion hash mismatch')


if __name__ == '__main__':
    main()
