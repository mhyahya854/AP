"""Parse the reader's Contents navigation out of the built book."""
from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path

PAGE_OPEN = '<span class="nav-page">'


class NavParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_nav = 0
        self.rows: list[dict] = []
        self.groups: list[dict] = []
        self.stack: list[str] = []
        self.current: dict | None = None
        self.text: list[str] = []
        self.page: list[str] = []
        self.in_page = 0
        self.in_summary = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'nav' and a.get('id') == 'contents-nav':
            self.in_nav += 1
            return
        if not self.in_nav:
            return
        cls = a.get('class', '')
        if tag == 'summary':
            self.in_summary += 1
        if tag == 'span' and cls == 'nav-page' and self.current is not None:
            self.in_page += 1
            self.page = []
            return
        if tag == 'details':
            self.stack.append(cls)
        elif tag in ('a', 'span') and cls:
            self.current = {'tag': tag, 'class': cls,
                            'id': a.get('data-source-contents-id'),
                            'href': a.get('href'), 'depth': a.get('data-depth'),
                            'in_summary': bool(self.in_summary)}
            self.text = []

    def handle_data(self, data):
        if not self.in_nav:
            return
        if self.in_page:
            self.page.append(data)
        elif self.current is not None:
            self.text.append(data)

    def handle_endtag(self, tag):
        if not self.in_nav:
            return
        if tag == 'span' and self.in_page:
            self.in_page -= 1
            if self.current is not None:
                self.current['page'] = ''.join(self.page).strip()
            return
        if tag == 'summary' and self.in_summary:
            self.in_summary -= 1
        if tag == 'details' and self.stack:
            self.stack.pop()
        elif tag in ('a', 'span') and self.current is not None and tag == self.current['tag']:
            row = dict(self.current)
            row.setdefault('page', None)
            row['text'] = ' '.join(''.join(self.text).split())
            if row['in_summary'] and self.stack and 'nav-group' in self.stack[-1]:
                self.groups.append(row)
            else:
                self.rows.append(row)
            self.current = None
            self.text = []
        if tag == 'nav':
            self.in_nav = 0


def parse_nav(path: Path) -> tuple[list[dict], list[dict], str]:
    data = path.read_bytes()
    i = data.find(b'<nav id="contents-nav"')
    j = data.find(b'</nav>', i)
    nav = data[i:j + 6].decode('utf-8')
    p = NavParser()
    p.feed(nav)
    # the group summary anchors have no class, so collect them separately
    groups = re.findall(r'<details class="nav-group"><summary><a href="#(book-group-\d+)">([^<]*)</a>',
                        nav)
    return p.rows, [{'id': g, 'title': t} for g, t in groups], nav
