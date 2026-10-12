"""Prove that every image the wave removed sat inside a disclosure <summary>
(the info-icon glyph), by counting them in the source build."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ART = re.compile(r'<article class="book-page" id="(?P<id>TMP-\d{4})"[^>]*>')
SUM = re.compile(r'<summary[^>]*>.*?</summary>', re.S)


def main() -> None:
    src = Path(sys.argv[1])
    before = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
    after = json.loads(Path(sys.argv[3]).read_text(encoding='utf-8'))
    want = {t for t in before['order']
            if before['regions'][t]['img'] != after['regions'][t]['img']}
    inside = {}
    buf = ''
    current = None
    eof = False
    with src.open('r', encoding='utf-8', errors='replace', newline='') as fh:
        while True:
            if current is None:
                m = ART.search(buf)
                if not m:
                    if eof:
                        break
                    buf = buf[-8192:]
                    chunk = fh.read(4 << 20)
                    eof = not chunk
                    buf += chunk
                    continue
                current = m.group('id')
                buf = buf[m.end():]
            end = buf.find('</article>')
            if end < 0:
                if eof:
                    break
                chunk = fh.read(4 << 20)
                eof = not chunk
                buf += chunk
                continue
            body = buf[:end]
            if current in want:
                n = sum(s.count('<img') for s in SUM.findall(body))
                inside[current] = n
            buf = buf[end + len('</article>'):]
            current = None
    bad = []
    for t in sorted(want):
        delta = before['regions'][t]['img'] - after['regions'][t]['img']
        if inside.get(t, 0) != delta:
            bad.append((t, delta, inside.get(t, 0)))
    total_delta = sum(before['regions'][t]['img'] - after['regions'][t]['img'] for t in want)
    print('regions with an image delta:', len(want))
    print('images removed in total    :', total_delta)
    print('all of them inside a <summary>:', not bad, bad[:10])


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    main()
