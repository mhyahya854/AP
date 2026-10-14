"""Step 3 / task D: can any held Contents row now be linked to a verified
destination?

Each held row in the audited manifest carries the reason it was held and the
source interval (`expected_interval`) the book itself places it in.  This
script searches *only* that interval in the reconstructed artifact for a
heading whose words match the row's title.  A row is linkable when exactly one
match exists there - the interval comes from the source ordering, not from a
guess, and a second independent match disqualifies it.

usage: python reader/step3_holds.py [outJson]
"""
import json
import os
import re
import sys
import unicodedata

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, 'reports/contents_navigation/held_resolution.json')


def compact(s):
    s = unicodedata.normalize('NFKD', s or '')
    for ch in ('\u00ae', '\u2122', '\u2019', '\u2018', '\u201c', '\u201d'):
        s = s.replace(ch, ' ')
    return re.sub(r'[^a-z0-9]', '', s.lower())


def words(s):
    s = unicodedata.normalize('NFKD', s or '')
    for ch in ('\u00ae', '\u2122', '\u2019'):
        s = s.replace(ch, ' ')
    return [w for w in re.sub(r'[^a-z0-9]+', ' ', s.lower()).split() if len(w) > 2]


def phrase_hits(text, ctitle):
    """count whole-phrase occurrences of a compacted title inside compacted text"""
    c = compact(text)
    return c.count(ctitle) if ctitle else 0


def main():
    idx = json.load(open(os.path.join(BASE, 'reports/contents_navigation/region_index.json'), encoding='utf-8'))
    manifest = json.load(open(os.path.join(BASE, 'reader/manifests/source_contents_navigation_manifest_v2.json'), encoding='utf-8'))
    regions, order = idx['regions'], idx['order']
    index = {r: i for i, r in enumerate(order)}

    # unit guard: the destination capture must belong to the unit the row is
    # filed under in the Contents, so a same-word entry somewhere else (a
    # glossary headword, say) can never capture a body row
    ledger = json.load(open(os.path.join(BASE, 'reports/contents_navigation/navigation_ledger.json'), encoding='utf-8'))
    group_titles = {r['groupOrdinal']: compact(r['title']) for r in ledger['rows'] if r['kind'] == 'group-header'}

    def group_of_context(ctx):
        c = compact(ctx)
        for k, v in group_titles.items():
            if v and (v == c or v in c or c in v):
                return k
        return None

    held = [e for e in manifest['detailed_contents_entries'] if str(e.get('disposition', '')).startswith('held')]
    results = []
    for e in held:
        det = e.get('held_detail') or {}
        title = e['exact_selected_contents_text']
        ctitle = compact(title)
        tw = set(words(title))
        want_group = group_of_context(e.get('group_context') or '')
        lo, hi = 0, len(order) - 1
        iv = det.get('expected_interval')
        if isinstance(iv, list) and len(iv) == 2 and iv[0] in index and iv[1] in index:
            lo, hi = index[iv[0]], index[iv[1]]
        heading_hits, text_hits = [], []
        for i in range(lo, hi + 1):
            rid = order[i]
            r = regions[rid]
            for h in r['headings']:
                c = compact(h['text'])
                # strict: the anchor's own text IS the row's title.  A banner
                # anchor (module/unit display lines) is deliberately NOT
                # accepted here: the browser pass adjudicates those rows.
                if c and c == ctitle:
                    heading_hits.append({'id': h['id'], 'region': rid, 'tag': h['tag'], 'text': h['text'][:120]})
            n = phrase_hits(r['text'], ctitle)
            if n:
                off = compact(r['text']).find(ctitle) if ctitle else -1
                text_hits.append({'region': rid, 'occurrences': n, 'offset': off,
                                  'navLabel': r['navLabel'], 'chars': r['chars'],
                                  'isContentsRegion': (r['navLabel'] or '') == 'Contents'})
        # a capture link is precise only when the row's own words *begin* the
        # capture, and only when the capture is not the printed Contents list
        body_hits = [h for h in text_hits if not h['isContentsRegion']]
        if want_group is not None:
            body_hits = [h for h in body_hits if int(regions[h['region']]['groupIndex'] or 0) == want_group]
            heading_hits = [h for h in heading_hits
                            if int(regions[h['region']]['groupIndex'] or 0) == want_group]
        top_hits = [h for h in body_hits if h['offset'] >= 0 and h['offset'] <= 6]
        verdict = ('link_heading' if len(heading_hits) == 1 else
                   'ambiguous_headings' if len(heading_hits) > 1 else
                   'link_region' if len(top_hits) == 1 else
                   'anchor_needed' if len(body_hits) == 1 else
                   'ambiguous_text' if len(body_hits) > 1 else
                   'not_found')
        if heading_hits:
            verdict = 'link_heading' if len(heading_hits) == 1 else 'ambiguous_headings'
        results.append({
            'source_id': e['source_id'], 'title': title,
            'contents_kind': e['contents_kind'], 'group_context': e['group_context'],
            'module_context': e.get('module_context'),
            'held_reason': det.get('reason'),
            'expected_interval': iv,
            'interval_regions': [order[lo], order[hi]] if lo <= hi else None,
            'want_group_index': want_group,
            'want_group_title': group_titles.get(want_group),
            'heading_hits': heading_hits, 'text_hits': text_hits[:6],
            'body_text_hits': body_hits[:6], 'top_hits': top_hits[:3], 'verdict': verdict,
        })
    tally = {}
    for r in results:
        tally[r['verdict']] = tally.get(r['verdict'], 0) + 1

    # Two rows can both "begin" one capture only if one title is a strict prefix
    # of the other ("Gross Profit" vs "Gross Profit Margin").  Only the longer
    # title is genuinely at the top, so the shorter row is demoted.
    by_region = {}
    for r in results:
        if r['verdict'] == 'link_region':
            by_region.setdefault(r['top_hits'][0]['region'], []).append(r)
    demoted = []
    for region, rows in by_region.items():
        if len(rows) < 2:
            continue
        rows.sort(key=lambda r: -len(compact(r['title'])))
        longest = compact(rows[0]['title'])
        for r in rows[1:]:
            if longest.startswith(compact(r['title'])):
                r['verdict'] = 'anchor_needed'
                r['demoted_by'] = rows[0]['source_id']
                demoted.append({'source_id': r['source_id'], 'title': r['title'], 'region': region,
                                'because': rows[0]['title']})
    tally = {}
    for r in results:
        tally[r['verdict']] = tally.get(r['verdict'], 0) + 1
    payload = {'schema': 'book2.step3.held_resolution.v1', 'held_rows': len(results),
               'verdicts': tally, 'demoted_prefix_collisions': demoted, 'rows': results}
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=1)
    print(json.dumps({'held_rows': len(results), 'verdicts': tally, 'out': OUT}, indent=1))
    for r in results:
        if r['verdict'] in ('link_heading', 'anchor_needed'):
            print(' ', r['verdict'], '|', r['title'][:60], '|', r['heading_hits'][:1], r['text_hits'][:1])


if __name__ == '__main__':
    main()
