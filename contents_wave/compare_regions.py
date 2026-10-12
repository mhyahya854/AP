"""Prove the contents patch changed nothing inside the 1,899 source regions.

Compares the two builds region by region (byte-identical article blocks) and
re-uses the same text fingerprint as the project's region_text tool.

Usage: python compare_regions.py <a.html> <b.html> <report.json>
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(r'C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\reader')))
from region_text import text_of, words_only, skeleton  # noqa: E402

ART = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"[^>]*>')
END = b'</article>'


def regions(path: Path):
    out = []
    cur = None
    buf = b''
    with path.open('rb') as fh:
        while True:
            chunk = fh.read(8 << 20)
            if not chunk:
                break
            buf += chunk
            while True:
                if cur is None:
                    m = ART.search(buf)
                    if not m:
                        buf = buf[-4096:]
                        break
                    cur = m.group(1).decode()
                    buf = buf[m.end():]
                e = buf.find(END)
                if e < 0:
                    break
                out.append((cur, buf[:e]))
                buf = buf[e + len(END):]
                cur = None
    return out


def main() -> int:
    a = regions(Path(sys.argv[1]))
    b = regions(Path(sys.argv[2]))
    report = {'regions_a': len(a), 'regions_b': len(b),
              'order_identical': [x[0] for x in a] == [x[0] for x in b]}
    byte_diff, text_diff, word_diff = [], [], []
    chars_a = chars_b = 0
    for (ia, ba), (ib, bb) in zip(a, b):
        ta = text_of(ba.decode('utf-8', 'replace'))
        tb = text_of(bb.decode('utf-8', 'replace'))
        chars_a += len(ta)
        chars_b += len(tb)
        if ba != bb:
            byte_diff.append(ia)
        if ta != tb:
            text_diff.append(ia)
        if words_only(ta) != words_only(tb):
            word_diff.append(ia)
    report.update({
        'regions_byte_identical': len(a) - len(byte_diff),
        'regions_byte_different': byte_diff,
        'regions_with_text_change': text_diff,
        'regions_with_word_change': word_diff,
        'total_chars_a': chars_a,
        'total_chars_b': chars_b,
    })
    Path(sys.argv[3]).write_text(json.dumps(report, indent=1), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items()
                      if k not in ('regions_byte_different',)}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
