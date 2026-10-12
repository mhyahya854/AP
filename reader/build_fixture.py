"""Build a small fixture out of the REAL reader shell + selected REAL regions.

Usage: python build_fixture.py <source.html> <out.html> [--css extra.css] [--open]

The shell (head with the real stylesheet, sidebar, toolbar), the real reader
script and the selected `<article class="book-page">` regions are copied
verbatim, so anything observed in the fixture reflects the real reader.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

WORK = Path(__file__).resolve().parent

DEFAULT = [
    'TMP-0001',  # front cover
    'TMP-0002',  # cover extended description (disclosure)
    'TMP-0016',  # printed Contents
    'TMP-0117',  # Module 1.1 opener
    'TMP-0130',  # Businesses Create Value
    'TMP-0137',  # Module 1.1 Review
    'TMP-0542',  # case study / figure region
    'TMP-1105',  # LG variant A (p.lg-question)
    'TMP-1210',  # LG variant B (layout table)
    'TMP-1227',  # Module review LG rows
    'TMP-1309',  # LG variant C (inline span in padded paragraph)
    'TMP-1328',  # LG variant C with a 7pt goal
    'TMP-1468',  # disclosure with the info icon image
    'TMP-0740',  # figure + disclosure
    'TMP-0971',  # Unit 3 Part 2 opener
    'TMP-1500',  # text-heavy region
    'TMP-1671',  # later-book table region
    'TMP-1899',  # glossary tail
]

ART = re.compile(r'<article class="book-page" id="(TMP-\d{4})"[^>]*>')


def main() -> None:
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    want = DEFAULT
    extra_css = ''
    if '--css' in sys.argv:
        extra_css = Path(sys.argv[sys.argv.index('--css') + 1]).read_text(encoding='utf-8')

    want_set = set(want)
    head = None
    tail = None
    articles = {}
    buf = ''
    current = None
    parts = []
    saw_last = False
    with src.open('rb') as fh:
        while True:
            chunk = fh.read(4 << 20)
            if not chunk:
                break
            buf += chunk.decode('utf-8', 'replace')
            while True:
                if current is None:
                    m = ART.search(buf)
                    if not m:
                        if head is None and len(buf) > 8192:
                            buf = buf[-8192:]
                        break
                    if head is None:
                        head = buf[:m.start()]
                    current = m.group(1)
                    buf = buf[m.end():]
                end = buf.find('</article>')
                if end < 0:
                    if len(buf) > (1 << 21):
                        parts.append(buf)
                        buf = ''
                    break
                parts.append(buf[:end])
                markup = ''.join(parts)
                parts = []
                if current in want_set:
                    articles[current] = markup
                if current == want[-1]:
                    tail = buf[end + len('</article>'):]
                    saw_last = True
                buf = buf[end + len('</article>'):]
                current = None
            if saw_last:
                break
    missing = [t for t in want if t not in articles]
    if head is None or tail is None or missing:
        raise SystemExit(f'extraction failed: missing={missing} tail={tail is not None}')

    body = ''.join(
        f'<article class="book-page" id="{t}" data-source="fixture" data-status="UNVERIFIED" '
        f'data-group-index="1" data-group-title="Fixture" data-nav-label="{t}">'
        f'{articles[t]}</article>' for t in want)
    html = head + body + tail
    if extra_css:
        idx = html.find('</style>')
        html = html[:idx] + extra_css + '\n' + html[idx:]
    out.write_text(html, encoding='utf-8')
    print(f'{out} {len(html)/1e6:.2f} MB, {len(articles)} regions: {",".join(want)}')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    main()
