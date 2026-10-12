"""Extract the rendered Contents navigation rows from the built book."""
from __future__ import annotations

import io
import json
import sys
from html.parser import HTMLParser
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = Path(r'C:\Users\mhyah\Downloads\book-source\Word')
REPO = ROOT / '_master_work' / 'repo' / 'AP'
OUT = ROOT / '_master_work' / 'contents_wave'


class NavParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_nav = False
        self.rows: list[dict] = []
        self.groups: list[dict] = []
        self.stack: list[dict] = []
        self.current: dict | None = None
        self.text: list[str] = []
        self.group_depth = 0
        self.in_summary = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'nav' and a.get('id') == 'contents-nav':
            self.in_nav = True
            return
        if not self.in_nav:
            return
        cls = a.get('class', '')
        if tag == 'details' and 'nav-group' in cls.split():
            self.stack.append({'kind': 'group'})
        elif tag == 'details' and 'nav-module' in cls.split():
            self.stack.append({'kind': 'module'})
        if tag == 'summary':
            self.in_summary += 1
        if tag in ('a', 'span') and (cls.startswith('nav-child') or cls.startswith('nav-unlinked')):
            self.current = {
                'tag': tag,
                'class': cls,
                'id': a.get('data-source-contents-id'),
                'href': a.get('href'),
                'depth': a.get('data-depth'),
                'title': a.get('title'),
                'in_summary': bool(self.in_summary),
                'nested': [s['kind'] for s in self.stack],
            }
            self.text = []

    def handle_data(self, data):
        if self.in_nav and self.current is not None:
            self.text.append(data)

    def handle_endtag(self, tag):
        if not self.in_nav:
            return
        if tag == 'summary' and self.in_summary:
            self.in_summary -= 1
        if tag in ('a', 'span') and self.current is not None and tag == self.current['tag']:
            self.current['text'] = ' '.join(''.join(self.text).split())
            if self.current['in_summary'] and self.stack and self.stack[-1]['kind'] == 'group':
                self.groups.append({'href': self.current['href'], 'text': self.current['text']})
            else:
                self.rows.append(self.current)
            self.current = None
            self.text = []
        if tag == 'details' and self.stack:
            self.stack.pop()
        if tag == 'nav':
            self.in_nav = False


def main() -> None:
    data = (REPO / 'AP Book Final.html').read_bytes()
    i = data.find(b'<nav id="contents-nav"')
    j = data.find(b'</nav>', i)
    nav = data[i:j + 6].decode('utf-8', 'replace')

    p = NavParser()
    p.feed(nav)

    print('groups:', len(p.groups))
    for g in p.groups:
        print('  ', g['href'], '|', g['text'])
    print('rows:', len(p.rows))
    with_id = [r for r in p.rows if r['id']]
    print('rows with manifest id:', len(with_id))
    print('rows without manifest id:', len(p.rows) - len(with_id))
    for r in p.rows:
        if not r['id']:
            print('   no-id row:', r['href'], '|', r['text'], '| in_summary', r['in_summary'])

    # page cells currently rendered
    pages = [r for r in p.rows if r.get('page')]
    print('rows already showing a page cell:', len(pages))

    (OUT / 'nav_rows.json').write_text(json.dumps(
        {'groups': p.groups, 'rows': p.rows}, indent=1, ensure_ascii=False), encoding='utf-8')
    print('written nav_rows.json')


if __name__ == '__main__':
    main()
