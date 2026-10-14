"""Step 3: condense the acceptance probe into a machine-readable summary.
usage: python reader/step3_summary.py
"""
import collections
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ACC = os.path.join(BASE, 'reports/contents_navigation/acceptance/accept-probe.json')
OUT = os.path.join(BASE, 'reports/contents_navigation/acceptance_summary.json')


def main():
    probe = json.load(open(ACC, encoding='utf-8'))
    landings = probe['landings']
    by_viewport = collections.Counter(r['viewport'] for r in landings)
    by_mode = collections.Counter(r['mode'] for r in landings)
    problems, markers, gaps = [], 0, collections.Counter()
    for r in landings:
        t = (r['landing'].get('target') or {})
        if not t:
            problems.append({'case': r['case'], 'mode': r['mode'], 'viewport': r['viewport'],
                             'problem': 'no target measured'})
            continue
        if t.get('tag') == 'SPAN' and not t.get('visible'):
            markers += 1                       # zero-size group-anchor marker
            continue
        if not t.get('visible'):
            problems.append({'case': r['case'], 'mode': r['mode'], 'viewport': r['viewport'],
                             'problem': 'target not visible'})
        elif not t.get('belowToolbar'):
            problems.append({'case': r['case'], 'mode': r['mode'], 'viewport': r['viewport'],
                             'problem': 'target not below the toolbar',
                             'gap': t.get('gapBelowToolbar')})
        else:
            gaps[t.get('gapBelowToolbar')] = gaps.get(t.get('gapBelowToolbar'), 0) + 1
    census = probe['census']
    out = {
        'schema': 'book2.step3.acceptance_summary.v1',
        'artifact': probe['fileUrl'],
        'matrix': probe['matrix'],
        'landings': len(landings),
        'by_viewport': dict(by_viewport),
        'by_mode': dict(by_mode),
        'targets_displayed_below_toolbar': sum(gaps.values()),
        'zero_size_group_markers': markers,
        'problems': problems,
        'gap_histogram': {str(k): v for k, v in sorted(gaps.items(), key=lambda kv: (kv[0] is None, kv[0]))},
        'js_errors': probe['errors'],
        'pin_survival': probe['pinSurvival'],
        'group_header_click': {'href': probe['groupHeader'].get('href'),
                               'open_before': probe['groupHeader'].get('openBefore'),
                               'open_after': probe['groupHeader'].get('openAfter'),
                               'landing_region': ((probe['groupHeader'].get('landing') or {}).get('target') or {}).get('region')},
        'census': {k: census[k] for k in ('regions', 'firstRegion', 'lastRegion', 'headingCount', 'railRows',
                                          'hrefCount', 'duplicateIds', 'labelledCells', 'groups', 'modules',
                                          'sourceContentsGroups', 'disclosureControls', 'descLabels', 'lgBadges',
                                          'tables', 'images', 'pngDataUris', 'sectionStarts', 'verticalCredits',
                                          'toolbar')},
        'broken_links': len(census['brokenLinks']),
        'screenshots': probe['screenshots'],
        'deeplink': json.load(open(os.path.join(BASE, 'reports/contents_navigation/deeplink.json'), encoding='utf-8'))['loads'],
    }
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print(json.dumps({k: out[k] for k in ('landings', 'by_viewport', 'by_mode',
                                          'targets_displayed_below_toolbar', 'zero_size_group_markers',
                                          'problems', 'gap_histogram', 'js_errors', 'pin_survival',
                                          'group_header_click')}, ensure_ascii=False, indent=1))
    print('written', OUT)


if __name__ == '__main__':
    main()
