"""Per-region text fingerprint of a reader build (content-preservation proof).

Usage: python region_text.py <file.html> <out.json>

For every `<article class="book-page" id="TMP-NNNN">` it records the element's
text with tags removed and whitespace collapsed, plus its length and SHA-256.
Image payloads never enter the text, so the fingerprints are small.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ART = re.compile(r'<article class="book-page" id="(?P<id>TMP-\d{4})"[^>]*>')
TAG = re.compile(r'<[^>]*>')
WS = re.compile(r'\s+')


def text_of(markup: str) -> str:
    body = markup
    body = re.sub(r'<img\b[^>]*>', ' ', body)
    body = TAG.sub(' ', body)
    body = (body.replace('&nbsp;', ' ').replace('&amp;', '&')
                .replace('&lt;', '<').replace('&gt;', '>')
                .replace('&#x27;', "'").replace('&quot;', '"'))
    return WS.sub(' ', body).strip()


GLYPHS = re.compile('[\u25b8\u25be\u25b6\u25bc\u25c2\u2139\u24d8\u25cf]')
SPACES = re.compile(r'\s+')
NUM_ENT = re.compile(r'&#x?[0-9A-Fa-f]+;')
UI_GLYPHS = re.compile(r'(?:\s*(?:\u25cf|\u2139|\u24d8|\u25b8|\u25be|\u25b6|\u25bc|\u25c2|'
                       r'\bi\b)\s*)')


def skeleton(text: str) -> str:
    """Text with the disclosure / chevron UI glyphs removed, so two builds can
    be compared on their actual words alone."""
    return SPACES.sub(' ', GLYPHS.sub(' ', text)).strip()


def words_only(text: str) -> str:
    """Text reduced to words: numeric entities, the disclosure UI glyphs and
    all whitespace are removed, so two builds can be compared on their words
    alone."""
    return SPACES.sub(' ', UI_GLYPHS.sub(' ', NUM_ENT.sub(' ', text))).strip()


def main() -> None:
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    regions = {}
    order = []
    eof = False
    with src.open('r', encoding='utf-8', errors='replace', newline='') as fh:
        buf = ''
        current = None
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
                order.append(current)
                buf = buf[m.end():]
            end = buf.find('</article>')
            if end < 0:
                if eof:
                    break
                chunk = fh.read(4 << 20)
                eof = not chunk
                buf += chunk
                continue
            text = text_of(buf[:end])
            regions[current] = {'chars': len(text),
                                'sha256': hashlib.sha256(text.encode('utf-8')).hexdigest(),
                                'skeleton': hashlib.sha256(
                                    skeleton(text).encode('utf-8')).hexdigest(),
                                'words': hashlib.sha256(
                                    words_only(text).encode('utf-8')).hexdigest()}
            buf = buf[end + len('</article>'):]
            current = None
    out.write_text(json.dumps({'order': order, 'regions': regions}), encoding='utf-8')
    print('regions', len(order))
    print('total chars', sum(r['chars'] for r in regions.values()))


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    main()
