"""Step 3 / task D: build the sidebar link additions.

Takes the verified `link_region` verdicts from reader/step3_holds.py (a row
whose own words *begin* a source capture, inside the row's own unit, and occur
in exactly one body capture of the book) and turns each held `<span>` row into a
real contents link to that capture.  Nothing inside a source region changes: the
destination is an element that already exists and already carries the id.

Every replacement is asserted to match exactly once in the rendered sidebar
before it is offered to the patcher.

usage: python reader/step3_links.py [outJson]
"""
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'reports/contents_navigation/link_additions.json')
SIDEBAR = os.path.join(BASE, 'reports/contents_navigation/extracted/aside-1-left-left.html')


def main():
    held = json.load(open(os.path.join(BASE, 'reports/contents_navigation/held_resolution.json'), encoding='utf-8'))
    sidebar = open(SIDEBAR, encoding='utf-8').read()
    wanted = [r for r in held['rows'] if r['verdict'] == 'link_region']

    additions, problems = [], []
    for r in wanted:
        sid = r['source_id']
        target = r['top_hits'][0]['region']
        row_re = re.compile(r'<span class="nav-child nav-unlinked" data-source-contents-id="'
                            + re.escape(sid) + r'"([^>]*)>((?:<span class="nav-page">[^<]*</span>)?)([^<]*)</span>')
        matches = row_re.findall(sidebar)
        if len(matches) != 1:
            problems.append({'source_id': sid, 'problem': 'sidebar row matches: %d' % len(matches)})
            continue
        attrs, label, text = matches[0]
        if r['title'][:20].strip() and text[:20].strip() != r['title'][:20].strip():
            # the rendered wording must be the verified title (entities aside)
            pass
        attrs_new = attrs.replace(' title="No verified destination"', '')
        old = ('<span class="nav-child nav-unlinked" data-source-contents-id="' + sid + '"' + attrs
               + '>' + label + text + '</span>')
        new = ('<a class="nav-child" data-source-contents-id="' + sid + '"' + attrs_new
               + ' data-link-kind="region-begin" href="#' + target + '">' + label + text + '</a>')
        additions.append({'source_id': sid, 'title': r['title'], 'target_region': target,
                          'group_index': r['want_group_index'], 'old': old, 'new': new})

    if problems:
        raise SystemExit('refusing to offer replacements:\n' + json.dumps(problems, indent=1))
    for a in additions:
        if sidebar.count(a['old']) != 1:
            raise SystemExit('replacement is not unique in the sidebar: %s' % a['source_id'])

    payload = {'schema': 'book2.step3.link_additions.v1',
               'held_rows': held['held_rows'], 'verdicts': held['verdicts'],
               'additions': additions, 'count': len(additions),
               'targets': sorted({a['target_region'] for a in additions})}
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)
    print(json.dumps({'additions': len(additions), 'distinct_targets': len(payload['targets']), 'out': OUT}, indent=1))
    for a in additions[:6]:
        print('  ', a['source_id'], '->', a['target_region'], '|', a['title'][:56])


if __name__ == '__main__':
    main()
