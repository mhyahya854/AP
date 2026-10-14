"""Step 3: build the row-by-row Contents navigation ledger.

Joins four independent sources of evidence, so a row is never called correct
just because its href resolves:

  1. the rendered sidebar markup   (reports/contents_navigation/extracted/)
  2. the audited Contents manifest (reader/manifests/source_contents_navigation_manifest_v2.json)
  3. the offline region index      (reports/contents_navigation/region_index.json)
  4. the supplied numbered list    (contents_wave/user_contents.py)

usage: python reader/step3_ledger.py [outJson]
"""
import importlib.util
import json
import os
import re
import sys
import unicodedata

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'reports/contents_navigation/navigation_ledger.json')
SIDEBAR_PATH = (sys.argv[2] if len(sys.argv) > 2
                else os.path.join(BASE, 'reports/contents_navigation/extracted/aside-1-left-left.html'))


def norm(s):
    if not s:
        return ''
    s = unicodedata.normalize('NFKD', s)
    for ch in ('\u00ae', '\u2122', '\u2019', '\u2018', '\u201c', '\u201d'):
        s = s.replace(ch, ' ')
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


STOP = {'case', 'study', 'questions', 'question', 'the', 'a', 'of', 'and', 'to', 'in', 'your', 'skills'}


def compact(s):
    return re.sub(r'[^a-z0-9]', '', norm(s))


def tokens(s):
    return [t for t in norm(s).split() if t not in STOP]


def overlap(a, b):
    ta, tb = set(tokens(a)), set(tokens(b))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(1, min(len(ta), len(tb)))


def plain(html):
    html = re.sub(r'<(script|style)\b.*?</\1>', ' ', html, flags=re.S | re.I)
    html = re.sub(r'<[^>]*>', ' ', html)
    html = html.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    html = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), html)
    return re.sub(r'\s+', ' ', html).strip()


def read(path):
    with open(path, encoding='utf-8') as fh:
        return fh.read()


def attr(attrs, name):
    m = re.search(name + r'="([^"]*)"', attrs or '')
    return m.group(1) if m else None


def parse_sidebar(html):
    start = html.find('<nav id="contents-nav"')
    end = html.find('</nav>', start)
    nav = html[start:end]
    events = []
    for m in re.finditer(r'<details class="(nav-group|nav-module|source-contents)"([^>]*)>', nav):
        kind = 'module' if m.group(1) == 'nav-module' else 'group'
        events.append({'pos': m.start(), 'kind': 'open', 'type': kind, 'cls': m.group(1)})
    for m in re.finditer(r'</details>', nav):
        events.append({'pos': m.start(), 'kind': 'close'})
    events.sort(key=lambda e: e['pos'])

    def ancestors(pos):
        stack = []
        for e in events:
            if e['pos'] >= pos:
                break
            if e['kind'] == 'open':
                stack.append(e)
            elif stack:
                stack.pop()
        return stack

    # tag scanner: nav rows nest <span class="nav-page">, so a plain regex over
    # inner HTML would stop at the wrong closing tag.  Walk real tags instead.
    tag_re = re.compile(r'<(/?)([a-zA-Z0-9]+)([^>]*)>')
    tags = [(m.start(), m.end(), m.group(1) == '/', m.group(2).lower(), m.group(3)) for m in tag_re.finditer(nav)]
    rows = []

    def row_at(k):
        pos, tagend, closing, name, attrs = tags[k]
        cls = attr(attrs, 'class') or ''
        if closing or name not in ('a', 'span') or not ('nav-child' in cls.split() or 'nav-unlinked' in cls.split()):
            return None
        depth = 0
        for j in range(k + 1, len(tags)):
            _, tend, c2, n2, _ = tags[j]
            if n2 != name:
                continue
            if c2:
                if depth == 0:
                    inner = nav[tagend:tend - len(name) - 3]
                    return {'pos': pos, 'end': tend, 'name': name, 'attrs': attrs, 'classes': cls.split(), 'inner': inner}
                depth -= 1
            else:
                depth += 1
        return None

    consumed_to = 0
    for k in range(len(tags)):
        pos = tags[k][0]
        if pos < consumed_to:
            continue
        r = row_at(k)
        if r:
            consumed_to = r['end']
            href = attr(r['attrs'], 'href')
            page = re.search(r'<span class="nav-page">(.*?)</span>', r['inner'])
            rows.append({
                'kind': 'row', 'element': r['name'], 'classes': r['classes'],
                'href': href, 'targetId': href[1:] if href else None,
                'attrs': r['attrs'],
                'title': plain(re.sub(r'<span class="nav-page">.*?</span>', '', r['inner'], flags=re.S)),
                'page': plain(page.group(1)) if page else None,
                'manifestId': attr(r['attrs'], 'data-source-contents-id'),
                'suppliedEntry': attr(r['attrs'], 'data-supplied-entry'),
                'depth': attr(r['attrs'], 'data-depth'),
                'pos': pos, 'stack': ancestors(pos),
            })

    for m in re.finditer(r'<summary><a href="#(book-group-\d+)"([^>]*)>(.*?)</a></summary>', nav, re.S):
        inner = m.group(3)
        page = re.search(r'<span class="nav-page">(.*?)</span>', inner)
        rows.append({
            'kind': 'group-header', 'element': 'a', 'href': '#' + m.group(1), 'targetId': m.group(1),
            'attrs': m.group(2), 'classes': ['nav-group-header'],
            'title': plain(re.sub(r'<span class="nav-page">.*?</span>', '', inner, flags=re.S)),
            'page': plain(page.group(1)) if page else None,
            'manifestId': None, 'suppliedEntry': None, 'depth': None,
            'pos': m.start(), 'stack': ancestors(m.start()),
        })
    rows.sort(key=lambda r: r['pos'])
    return rows


def main():
    idx = json.load(open(os.path.join(BASE, 'reports/contents_navigation/region_index.json'), encoding='utf-8'))
    manifest = json.load(open(os.path.join(BASE, 'reader/manifests/source_contents_navigation_manifest_v2.json'), encoding='utf-8'))
    sidebar_html = read(SIDEBAR_PATH if os.path.isabs(SIDEBAR_PATH)
                        else os.path.join(BASE, SIDEBAR_PATH))
    spec = importlib.util.spec_from_file_location('uc', os.path.join(BASE, 'contents_wave/user_contents.py'))
    uc = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(uc)

    regions = idx['regions']
    order = idx['order']
    region_pos = {r: i for i, r in enumerate(order)}

    heading = {}
    doc_order = []
    for r in order:
        for h in regions[r]['headings']:
            heading[h['id']] = {'region': r, 'tag': h['tag'], 'text': h['text'], 'truncated': h['truncated']}
            doc_order.append(h['id'])
    heading_pos = {h: i for i, h in enumerate(doc_order)}
    group_anchor = {}
    for r in order:
        for g in regions[r]['groupAnchors']:
            group_anchor[g] = r

    rows = parse_sidebar(sidebar_html)
    module_positions = [rr['pos'] for rr in rows if 'nav-module-link' in rr['classes']]
    group_positions = [rr['pos'] for rr in rows if rr['kind'] == 'group-header']

    modules = []
    for rr in rows:
        if 'nav-module-link' in rr['classes'] and rr['targetId'] in heading_pos:
            modules.append({'title': rr['title'], 'heading': rr['targetId'], 'pos': heading_pos[rr['targetId']]})
    modules.sort(key=lambda m: m['pos'])

    def module_for(hid):
        if hid not in heading_pos:
            return None
        p = heading_pos[hid]
        found = None
        for i, m in enumerate(modules):
            if m['pos'] <= p:
                found = i
            else:
                break
        return found

    ledger = []
    for i, rr in enumerate(rows):
        gs = [e for e in rr['stack'] if e['type'] == 'group']
        ms = [e for e in rr['stack'] if e['type'] == 'module']
        entry = {
            'i': i, 'kind': rr['kind'], 'element': rr['element'], 'classes': rr['classes'],
            'title': rr['title'], 'page': rr['page'], 'href': rr['href'], 'targetId': rr['targetId'],
            'depth': rr['depth'], 'manifestId': rr['manifestId'], 'suppliedEntry': rr['suppliedEntry'],
            'groupOrdinal': (1 + sum(1 for p in group_positions if p < gs[-1]['pos'])) if gs else None,
            'moduleOrdinal': (1 + sum(1 for p in module_positions if p < ms[-1]['pos'])) if ms else None,
            'notes': [],
            'suppliedEntry': rr['suppliedEntry'],
        }
        if rr['kind'] == 'group-header':
            entry['groupOrdinal'] = 1 + sum(1 for p in group_positions if p < rr['pos'])
        ledger.append(entry)

    manifest_by_id = {e['source_id']: e for e in manifest['detailed_contents_entries']}
    for entry in ledger:
        tid = entry['targetId']
        dest = None
        if tid:
            if tid in heading:
                dest = {'kind': 'heading', 'region': heading[tid]['region'], 'tag': heading[tid]['tag'],
                        'text': heading[tid]['text']}
            elif tid.startswith('TMP-') and tid in regions:
                dest = {'kind': 'region', 'region': tid, 'text': regions[tid]['navLabel'] or ''}
            elif tid in group_anchor:
                dest = {'kind': 'group-anchor', 'region': group_anchor[tid],
                        'text': regions[group_anchor[tid]]['groupTitle'] or ''}
            else:
                entry['notes'].append('href does not resolve in the offline index')
        entry['destination'] = dest
        if dest:
            entry['destGroupIndex'] = int(regions[dest['region']]['groupIndex'] or 0)
            entry['destGroupTitle'] = regions[dest['region']]['groupTitle']
            entry['destRegionOrdinal'] = region_pos[dest['region']] + 1
            entry['destHeadingPos'] = heading_pos.get(tid, 0) + 1 if dest['kind'] == 'heading' else None
            mi = module_for(tid) if dest['kind'] == 'heading' else None
            entry['destModuleOrdinal'] = (mi + 1) if mi is not None else None
            entry['destModuleTitle'] = modules[mi]['title'] if mi is not None else None

    def classify(entry):
        if not entry['href']:
            held = manifest_by_id.get(entry['manifestId'])
            if held and str(held.get('disposition', '')).startswith('held'):
                return 'SOURCE_BACKED_BUT_UNLINKED'
            if held and held.get('disposition') == 'index_body_absent':
                return 'SOURCE_ABSENT'
            if norm(entry['title']) == 'index':
                return 'SOURCE_ABSENT'
            if entry['suppliedEntry']:
                return 'SOURCE_ABSENT'
            return 'UNVERIFIED'
        d = entry['destination']
        if not d:
            return 'UNVERIFIED'
        if d['kind'] == 'region':
            # a capture link is exact when the row's own words *begin* the
            # capture (the printed Contents pages and the group headers are
            # separate cases, handled below)
            ctitle = compact(entry['title'])
            rtext = compact(regions[d['region']]['text'])
            off = rtext.find(ctitle) if ctitle else -1
            head_match = [h['id'] for h in regions[d['region']]['headings']
                          if compact(h['text']) == ctitle]
            entry['titleMatch'] = {'equal': off == 0, 'score': None,
                                   'destText': regions[d['region']]['text'][:120],
                                   'phraseOffset': off}
            entry['regionMatch'] = {'titleInRegion': off >= 0, 'phraseOffset': off,
                                    'headingWithTitle': head_match,
                                    'navLabel': regions[d['region']]['navLabel']}
            unit_ok = entry['groupOrdinal'] is None or entry['destGroupIndex'] == entry['groupOrdinal']
            entry['unitMatch'] = unit_ok
            if head_match:
                entry['notes'].append('precise heading %s exists inside the linked capture'
                                      % head_match[0])
                return 'WRONG_TARGET'
            if 0 <= off <= 6:
                return 'EXACT_SOURCE_LOCATION'
            if d['region'] == 'TMP-0001' and norm(entry['title']) == 'cover page':
                entry['notes'].append('front-cover capture (verified in the supplied-entries wave)')
                return 'EXACT_SOURCE_LOCATION'
            if off < 0:
                entry['notes'].append('row title not found inside the linked capture')
                return 'UNVERIFIED'
            entry['notes'].append('row title is inside the capture but does not begin it')
            return 'UNVERIFIED'
        title, dt = entry['title'], d['text']
        equal = norm(title) == norm(dt)
        score = overlap(title, dt)
        entry['titleMatch'] = {'equal': equal, 'score': round(score, 3), 'destText': dt[:160]}
        # a module/unit banner is set as stacked display lines, so the anchor's
        # own text is a prefix of the sidebar title ("MODULE 1.4" vs "Module 1.4
        # How Do Business Ideas Originate?").  Treat it as matching, but say so:
        # the browser pass confirms the rest of the title follows the anchor.
        banner = False
        if not equal and d['kind'] == 'heading':
            c = compact(dt)
            if c and (compact(title).startswith(c) or c in compact(title)):
                equal = True
                banner = True
                entry['notes'].append('banner-style anchor (destination text is a prefix of the row title)')
        entry['bannerAnchor'] = banner
        unit_ok = entry['groupOrdinal'] is None or entry['destGroupIndex'] == entry['groupOrdinal']
        entry['unitMatch'] = unit_ok
        mod_ok = None
        if entry['moduleOrdinal']:
            mod_ok = (entry.get('destModuleOrdinal') == entry['moduleOrdinal'])
            entry['moduleMatch'] = mod_ok
        if d['kind'] == 'group-anchor':
            return 'EXACT_SOURCE_LOCATION' if unit_ok else 'WRONG_TARGET'
        if equal or score >= 0.8:
            if not unit_ok:
                entry['notes'].append('unit mismatch: row group %s, destination group %s'
                                      % (entry['groupOrdinal'], entry['destGroupIndex']))
                return 'WRONG_TARGET'
            if mod_ok is False:
                entry['notes'].append('module mismatch: row module %s, destination module %s'
                                      % (entry['moduleOrdinal'], entry.get('destModuleOrdinal')))
                return 'WRONG_TARGET'
            return 'EXACT_HEADING' if d['kind'] == 'heading' else 'EXACT_SOURCE_LOCATION'
        if score >= 0.5:
            entry['notes'].append('partial title overlap %.2f' % score)
            return 'UNVERIFIED'
        entry['notes'].append('title/destination mismatch')
        return 'WRONG_TARGET'

    for entry in ledger:
        entry['classification'] = classify(entry)

    counts = {}
    for entry in ledger:
        counts[entry['classification']] = counts.get(entry['classification'], 0) + 1

    # printed labels: counted, not re-derived (the label cells are verified
    # byte-for-byte elsewhere in this step)
    labeled = sum(1 for e in ledger if e['page'])
    supplied_titles = {norm(t) for t, _ in uc.NUMBERED}
    supplied_labels = sorted({p for _, p in uc.NUMBERED})
    label_issues = {
        'labelled_rail_cells': labeled,
        'supplied_entries': len(uc.NUMBERED),
        'supplied_ui_controls': len(uc.UI_CONTROLS),
        'distinct_supplied_labels': supplied_labels,
        'special_labels_present': [p for p in ('FC', 'A1', '103A', '201A', '327A', '327B', '385A', '429A', 'G-1', 'EP-1', 'BC')
                                    if p in supplied_labels],
        'rows_without_label': sum(1 for e in ledger if e['kind'] == 'row' and not e['page']),
        'rows_whole_title_not_in_supplied_list': sum(
            1 for e in ledger
            if e['kind'] == 'row' and e['suppliedEntry'] is None and e['manifestId'] is None
            and norm(e['title']) not in supplied_titles),
    }

    summary = {
        'schema': 'book2.step3.navigation_ledger.v1',
        'source': {
            'rail_entries': len(ledger),
            'rows': sum(1 for e in ledger if e['kind'] == 'row'),
            'group_headers': sum(1 for e in ledger if e['kind'] == 'group-header'),
            'linked': sum(1 for e in ledger if e['href']),
            'unlinked': sum(1 for e in ledger if not e['href']),
            'headings_indexed': len(heading),
            'regions': len(order),
            'modules': len(modules),
        },
        'classification': counts,
        'supplied_label_mismatches': label_issues,
    }
    payload = {'schema': summary['schema'], 'summary': summary, 'rows': ledger}
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    print('written', OUT)


if __name__ == '__main__':
    main()
