"""Guarded atomic promotion of the verified wave candidate."""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WAVE = Path(__file__).resolve().parent
FINAL = ROOT / 'AP Book Final.html'
STAGED = WAVE / 'AP-Book-Final-wave-staged.html'
BACKUP_DIR = ROOT / '_master_work' / 'integration_backups' / 'continuous-wave-20261012'


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as fh:
        for block in iter(lambda: fh.read(8 << 20), b''):
            h.update(block)
    return h.hexdigest()


def main() -> None:
    report = json.loads((WAVE / 'patch_wave_report.json').read_text(encoding='utf-8'))
    staged_sha = sha(STAGED)
    if staged_sha != report['target_sha256']:
        raise SystemExit(f'staged file hash {staged_sha} != patcher report '
                         f"{report['target_sha256']}")
    prev_sha = sha(FINAL)
    prev_bytes = FINAL.stat().st_size
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    prev_copy = BACKUP_DIR / 'prev-final-AP Book Final.html'
    if not prev_copy.exists() or sha(prev_copy) != prev_sha:
        shutil.copy2(FINAL, prev_copy)
    tmp = ROOT / 'AP Book Final.html.staging'
    shutil.copy2(STAGED, tmp)
    if sha(tmp) != staged_sha:
        raise SystemExit('staged copy hash mismatch')
    os.replace(tmp, FINAL)
    new_sha = sha(FINAL)
    out = {
        'promoted_at_utc': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
        'previous_sha256': prev_sha,
        'previous_bytes': prev_bytes,
        'previous_backup': str(prev_copy),
        'final_sha256': new_sha,
        'final_bytes': FINAL.stat().st_size,
        'candidate_sha256': staged_sha,
        'patched_from': report['source'],
        'match': new_sha == staged_sha,
    }
    (WAVE / 'promotion_report.json').write_text(json.dumps(out, indent=1), encoding='utf-8')
    print(json.dumps(out, indent=1))
    if new_sha != staged_sha:
        raise SystemExit('promotion hash mismatch')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    main()
