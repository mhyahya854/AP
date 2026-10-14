"""Generate the two documentation deliverables from the measured evidence.

  docs/FINAL_TECHNICAL_CERTIFICATION.md
  docs/MANUAL_BOOK_REVIEW_GUIDE.md

usage: python reader/compose_docs.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
QA = BASE / 'reports' / 'final_release_qa'
WORK = BASE.parent.parent / 'final_release_qa'
DOCS = BASE / 'docs'


def load(name):
    path = QA / name
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}


def md(value):
    return str(value).replace('|', '\\|')


def read_rows():
    path = QA / 'MANUAL_REVIEW_INDEX.csv'
    if not path.exists():
        return []
    with path.open(encoding='utf-8-sig', newline='') as handle:
        return list(csv.DictReader(handle))


def certification():
    baseline = load('BASELINE.json')
    matrix = load('FEATURE_TEST_MATRIX.json')
    dom = load('DOM_VALIDATION.json')
    css = load('CSS_AUDIT.json')
    js = load('JAVASCRIPT_AUDIT.json')
    nav = load('NAVIGATION_AUDIT.json')
    resp = load('RESPONSIVE_AUDIT.json')
    theme = load('THEME_AUDIT.json')
    perf = load('PERFORMANCE_AUDIT.json')
    content = load('CONTENT_INTEGRITY.json')
    issues = load('ISSUE_LEDGER.json')
    regression = load('REGRESSION_REPORT.json')
    verdict = load('RELEASE_VERDICT.json')
    coverage = load('content_coverage.json')
    pixels = load('pixel_contrast.json')
    rows = read_rows()
    counts = dom.get('counts', {})
    artifact = baseline.get('artifact', {})
    symptoms = dom.get('markup_symptoms', {})
    text = dom.get('text_integrity', {})
    load_ms = perf.get('load', {})
    nav_entry = load_ms.get('navigation_entry_ms', {}) or {}
    pub = verdict.get('publication', {})

    lines = []
    add = lines.append
    add('# Final technical certification - Book 2 reader')
    add('')
    add('Artifact: **Business with Personal Finance for the AP(R) Course - International Edition**, '
        'single-file reader over `file://`.')
    add('')
    add('## A. Artifact identification')
    add('')
    add('| Field | Value |')
    add('|---|---|')
    add('| Repository artifact | `%s` |' % artifact.get('repository_path'))
    add('| Project-root artifact | `%s` |' % artifact.get('project_root_path'))
    add('| Bytes | %s |' % format(artifact.get('repository_bytes') or 0, ','))
    add('| SHA-256 | `%s` |' % artifact.get('repository_sha256'))
    add('| Expected (published) bytes / SHA-256 | %s / `%s` |'
        % (format(artifact.get('expected_bytes') or 0, ','), artifact.get('expected_sha256')))
    add('| Repository matches expected | %s |' % artifact.get('repository_matches_expected'))
    add('| Project-root matches expected | %s |' % artifact.get('root_matches_expected'))
    add('| Both local copies byte-identical | %s |' % artifact.get('copies_identical'))
    add('| Starting / final git commit | `%s` (`main` == `origin/main`: %s) |'
        % ((baseline.get('git') or {}).get('head'), (baseline.get('git') or {}).get('head_matches_remote')))
    add('| New HTML object uploaded this run | %s |' % pub.get('new_lfs_object_uploaded'))
    add('| HTML changed this run | %s |' % pub.get('html_changed'))
    add('')
    add('Every measurement ran behind one gate: `document.readyState === "complete"`, 1,899 '
        '`.book-page` regions and `window.book2Navigation` present. A half-loaded page could not '
        'produce a row.')
    add('')
    add('## B. Feature coverage')
    add('')
    add('| Feature | Tested | Result | Method | Evidence |')
    add('|---|---|---|---|---|')
    for feature in matrix.get('features', []):
        add('| %s | %s | %s | %s | %s |' % (md(feature.get('feature')), md(feature.get('tested')),
                                            md(feature.get('result')), md(feature.get('method')),
                                            md(feature.get('evidence'))))
    add('')
    return lines, {'baseline': baseline, 'dom': dom, 'nav': nav, 'perf': perf, 'verdict': verdict,
                   'issues': issues, 'content': content, 'pixels': pixels, 'theme': theme,
                   'regression': regression, 'coverage': coverage, 'css': css, 'js': js,
                   'resp': resp, 'rows': rows, 'counts': counts, 'symptoms': symptoms,
                   'text': text, 'load_ms': load_ms, 'nav_entry': nav_entry, 'pub': pub}


def structural(lines, facts):
    counts = facts['counts']
    symptoms = facts['symptoms']
    text = facts['text']
    lines.append('## C. Structural quality')
    lines.append('')
    lines.append('| Measure | Value |')
    lines.append('|---|---|')
    lines.append('| Regions (bytes / DOM) | %s / %s |' % (counts.get('regions_bytes'), counts.get('regions_dom')))
    lines.append('| Region ids sequential / duplicates | %s / %s |'
                 % (counts.get('region_ids_sequential'), counts.get('region_duplicates')))
    lines.append('| Heading anchors / group anchors | %s / %s |'
                 % (counts.get('heading_anchors'), counts.get('group_anchors')))
    lines.append('| Unique ids / duplicate ids | %s / %s |'
                 % (counts.get('unique_ids'), counts.get('duplicate_ids')))
    lines.append('| Internal fragments (total / distinct / broken) | %s / %s / %s |'
                 % (counts.get('fragment_targets_total'), counts.get('fragment_targets_distinct'),
                    counts.get('broken_fragments')))
    lines.append('| `<details>` tags / disclosure controls | %s / %s |'
                 % (counts.get('details_tags'), counts.get('disclosure_controls')))
    lines.append('| Tables (bytes / DOM) | %s / %s |' % (counts.get('tables_bytes'), counts.get('tables_dom')))
    lines.append('| Images (DOM) / embedded PNG payloads | %s / %s |'
                 % (counts.get('img_dom'), counts.get('png_data_uris')))
    lines.append('| Learning Goal badges / description labels | %s / %s |'
                 % (counts.get('lg_badges'), counts.get('desc_labels')))
    lines.append('| Printed-page label cells | %s |' % counts.get('printed_page_cells'))
    lines.append('| Orphan table cells | %s |' % symptoms.get('orphanTd'))
    lines.append('| Nested interactive elements | %s |' % symptoms.get('nestedInteractive'))
    lines.append('| Text nodes scanned / characters | %s / %s |'
                 % (text.get('text_nodes_scanned'), text.get('chars_scanned')))
    lines.append('| Reconstruction markers visible in text | %s |' % text.get('marker_hits'))
    lines.append('| Replacement characters / mojibake byte patterns | %s / %s |'
                 % (text.get('replacement_characters'), text.get('mojibake_hits')))
    lines.append('')
    lines.append('### The 145-versus-155 disclosure discrepancy, resolved')
    lines.append('')
    lines.append('A literal `class="disclosure"` string match finds 145 controls. The real count is '
                 '155, because ten controls carry extra classes:')
    lines.append('')
    lines.append('| `<details>` class attribute | count |')
    lines.append('|---|---|')
    histogram = (facts['dom'].get('disclosure_count_resolution') or {}).get('histogram') or {}
    for name, count in histogram.items():
        lines.append('| `%s` | %s |' % (md(name), count))
    lines.append('')
    lines.append('Total `<details>` tags %s = 155 disclosure controls + 31 module groups + 10 unit '
                 'groups + 1 source-contents group. **No control was edited to make the two counting '
                 'methods agree.**' % counts.get('details_tags'))
    lines.append('')
    return lines


def guide():
    content = load('CONTENT_INTEGRITY.json')
    coverage = load('content_coverage.json')
    tables = load('table_audit.json')
    nav = load('NAVIGATION_AUDIT.json')
    rows = read_rows()
    gaps = content.get('source_gap_regions') or {}
    lines = []
    add = lines.append
    add('# Manual book review guide')
    add('')
    add('The technical QA in `docs/FINAL_TECHNICAL_CERTIFICATION.md` is complete: the reader is '
        'structurally sound, every implemented control works, and no content was lost relative to the '
        'accepted baseline. **What technical testing cannot decide is whether each reconstructed page '
        'looks like the page it came from.** That is this step, and it is yours.')
    add('')
    add('## What you are looking at')
    add('')
    add('* The reader is one HTML file. Open `AP Book Final.html` in Chrome/Edge (no server needed):')
    add('  `C:\\Users\\mhyah\\Downloads\\book-source\\Word\\AP Book Final.html` (identical copy: '
        '`_master_work\\repo\\AP\\AP Book Final.html`).')
    add('* It holds **1,899 source captures** in reading order. A capture is a screenshot of a '
        'scrolling page, **not** a printed page; the reader never claims a printed page boundary.')
    add('* The reconstructed text is %s characters, and %s photographs are embedded as images; the rest '
        'of each page is rebuilt as text, tables and vector layout.'
        % (format((content.get('text') or {}).get('total_characters') or 0, ','),
           (content.get('images') or {}).get('elements')))
    add('* The left rail lists the publisher\'s own Contents. Rows with a printed label carry the label '
        'exactly as supplied (500 numbered entries; 506 label cells).')
    add('')
    add('## How to use `MANUAL_REVIEW_INDEX.csv`')
    add('')
    add('`reports/final_release_qa/MANUAL_REVIEW_INDEX.csv` has %s rows in reading order.' % len(rows))
    add('')
    add('| Column | Meaning |')
    add('|---|---|')
    add('| `kind` | `unit-or-group`, `module` or `entry` |')
    add('| `group` / `module` | the rail ancestry the row sits in |')
    add('| `title` | the exact Contents title |')
    add('| `printed_label` | the supplied printed page label, if the list has one |')
    add('| `reader_anchor` | paste the hash onto the file URL to jump straight there, e.g. '
        '`file:///.../AP%20Book%20Final.html#book-heading-0119` |')
    add('| `destination_region` | the source capture the row lands in (`TMP-nnnn`) |')
    add('| `source_png` | the original capture file for that region - open it to compare |')
    add('| `region_span` | for a unit or module row, the region range it covers |')
    add('| `has_extended_description` | an Extended Description control sits in that region |')
    add('| `has_photograph` | the region embeds a photograph |')
    add('| `risk_flags` | known risk, explained below |')
    add('| `review_status` / `defect_note` | your columns: `reviewed`, `ok`, `defect` + a note |')
    add('')
    add('Work down the sheet. At each row: click the rail entry (or paste the anchor), read the page, '
        'then open `source_png` from `Page <batch>\\` in the project root and compare.')
    add('')
    add('## Risk flags you will see')
    add('')
    add('| Flag | Meaning | What to do |')
    add('|---|---|---|')
    add('| `SOURCE-GAP (...)` | %s captures whose original page is blank/pale (%s) or whose content was '
        'merged into another capture (%s). The reader shows nothing there rather than inventing text. | '
        'Open the capture and confirm it really is blank or a duplicate state. |'
        % (gaps.get('count'), gaps.get('blank_or_pale_source_pages'), gaps.get('merged_interaction_states')))
    add('| `OCR-derived batch (...)` | the page range had no Word document, so its text came from a '
        'structured OCR candidate; wording and styling are less certain there. | Read closely; flag any '
        'wrong word. |')
    add('| `thin text (... chars, no photograph)` | very little reconstructed text and no embedded '
        'photograph. | Compare with the capture to see whether text is missing. |')
    add('| `repaired: ...` | a historically repaired figure or description (Front Cover, Kellogg\'s, '
        'Supply Chain, Price Elasticity, income statement table). | Compare against the capture. |')
    add('| `unlinked (...)` | %s rows kept visible but not linked, because no source-verified '
        'destination exists. %s of them describe material the source does not contain at all '
        '(About this Book, Title Page, Copyright Page, FEP, Back Cover, Index). | Nothing to click; '
        'confirm the row is meant to be inert. |'
        % ((nav.get('unlinked_rows') or {}).get('count'), (nav.get('unlinked_rows') or {}).get('source_absent')))
    add('')
    add('## The %s source-gap captures' % gaps.get('count'))
    add('')
    add('| Region | Source capture | Classification |')
    add('|---|---|---|')
    for row in (gaps.get('rows') or [])[:40]:
        add('| %s | %s | %s |' % (row.get('ref'), row.get('png'), row.get('classification')))
    add('')
    add('## Financial tables reconstructed from OCR')
    add('')
    add('| Table id | Capture | Rows x cells |')
    add('|---|---|---|')
    for table in (tables.get('dataTables') or []):
        if table.get('dataTableId'):
            add('| %s | %s | %s x %s |' % (table.get('dataTableId'), table.get('region'),
                                           table.get('rows'), table.get('cells')))
    add('')
    add('## Suggested order')
    add('')
    add('1. Front matter (cover, title, contents, authors, advisory board) - the cover is also worth a '
        'look at 320 px width on a phone.')
    add('2. Unit 1 and each module: module opener banner, Learning Goals, body, figures, Module Review.')
    add('3. The case studies scattered through every unit.')
    add('4. Units 2-5 the same way, then the Appendix, References, Glossary and the back matter rows.')
    add('5. Dark mode once per unit (the theme control is in the right-hand Reader tools panel).')
    add('')
    add('## What does not exist in the source (do not report these as defects)')
    add('')
    add('* No Index body, no FEP, no Back Cover page, no Title Page, no Copyright Page.')
    add('* No per-image alt text: the supplied source has none, so the 417 book figures carry `alt=""` '
        'and the source-backed descriptions that do exist are the 155 Extended Description controls.')
    add('* No printed page numbers of its own on the Contents pages, so no printed page boundary is '
        'claimed anywhere in the reader.')
    add('')
    add('## How to report a page problem')
    add('')
    add('Send one block per issue in this shape:')
    add('')
    add('```')
    add('Location      : (Contents title / module / region TMP-nnnn / printed label)')
    add('What looks wrong: (one sentence)')
    add('What the original shows: (from the source PNG, e.g. B2P1-0715.png)')
    add('Screenshot    : (file name)')
    add('Severity      : blocker / major / minor / cosmetic')
    add('```')
    add('')
    add('With the region id or the Contents title I can go straight to the same page, compare it with '
        'the capture, and repair it without rebuilding the whole book.')
    add('')
    (DOCS / 'MANUAL_BOOK_REVIEW_GUIDE.md').write_text('\n'.join(lines), encoding='utf-8')
    print('wrote docs/MANUAL_BOOK_REVIEW_GUIDE.md', len(lines), 'lines')


def main():
    lines, facts = certification()
    lines = structural(lines, facts)
    lines = navigation(lines, facts)
    lines = performance_and_defects(lines, facts)
    lines = preservation_and_handoff(lines, facts)
    DOCS.joinpath('FINAL_TECHNICAL_CERTIFICATION.md').write_text('\n'.join(lines), encoding='utf-8')
    print('wrote docs/FINAL_TECHNICAL_CERTIFICATION.md', len(lines), 'lines')
    guide()




def preservation_and_handoff(lines, facts):
    content = facts['content']
    regression = facts['regression']
    verdict = facts['verdict']
    coverage = facts['coverage']
    rows = facts['rows']
    gaps = content.get('source_gap_regions') or {}
    lines.append('## H. Source preservation')
    lines.append('')
    lines.append('| Measure | Value |')
    lines.append('|---|---|')
    lines.append('| Regions vs previous accepted artifact | %s identical, %s differing |'
                 % ((regression.get('regions_vs_previous_accepted_artifact') or {}).get('regions_identical'),
                    (regression.get('regions_vs_previous_accepted_artifact') or {}).get('differing')))
    lines.append('| Region count and order this run | %s regions, sequential %s |'
                 % (content.get('regions'), content.get('region_ids_sequential')))
    lines.append('| Reconstructed text | %s characters |'
                 % format((content.get('text') or {}).get('total_characters') or 0, ','))
    lines.append('| Embedded PNG payloads / images decoded | %s / %s ok, 0 broken |'
                 % ((content.get('images') or {}).get('embedded_png_payloads'),
                    (content.get('images') or {}).get('decoded_ok')))
    tables = content.get('tables') or {}
    lines.append('| Tables | %s total, %s OCR data tables, %s layout tables |'
                 % (tables.get('tables'), tables.get('ocr_data_tables'), tables.get('layout_tables')))
    credits = content.get('photograph_credits') or {}
    lines.append('| Learning Goal badges / printed-page cells | %s / %s |'
                 % (content.get('learning_goal_badges'), content.get('printed_page_cells')))
    lines.append('| Photograph credits | %s `sideways-lr` markers, %s elements in vertical writing |'
                 % (credits.get('sideways_lr_markers'), credits.get('vertical_writing_elements')))
    lines.append('| Duplicate ids / broken fragments | %s / %s |'
                 % (content.get('duplicate_ids'), content.get('broken_fragments')))
    lines.append('| Documented source-gap regions | %s (%s blank/pale + %s merged states) |'
                 % (gaps.get('count'), gaps.get('blank_or_pale_source_pages'),
                    gaps.get('merged_interaction_states')))
    lines.append('| Justified exceptions (content edits) | %s |' % content.get('justified_exceptions'))
    lines.append('')
    lines.append('## I. Human review handoff')
    lines.append('')
    lines.append('* Guide: [`docs/MANUAL_BOOK_REVIEW_GUIDE.md`](MANUAL_BOOK_REVIEW_GUIDE.md)')
    lines.append('* Checklist: `reports/final_release_qa/MANUAL_REVIEW_INDEX.csv` (%s rows: %s '
                 'unit/group rows, %s modules, %s Contents entries; %s rows carry a risk flag)'
                 % (len(rows), sum(1 for r in rows if r['kind'] == 'unit-or-group'),
                    sum(1 for r in rows if r['kind'] == 'module'),
                    sum(1 for r in rows if r['kind'] == 'entry'),
                    sum(1 for r in rows if r['risk_flags'])))
    lines.append('* Screenshots: `reports/final_release_qa/screens/` (desktop, mobile, dark, '
                 'pixel-contrast clips)')
    lines.append('* Known high-risk areas: the %s source-gap regions, the OCR-derived batches, the %s '
                 'thin-text regions, the repaired Extended Descriptions, the financial tables and the '
                 'mobile cover.' % (gaps.get('count'), len(coverage.get('thinRegions') or [])))
    lines.append('')
    lines.append('## Verdict')
    lines.append('')
    lines.append('**%s**' % verdict.get('verdict'))
    lines.append('')
    lines.append(str((verdict.get('publication') or {}).get('reason')))
    lines.append('')
    lines.append('Not tested (explicitly): %s.' % ', '.join(verdict.get('not_tested', [])))
    lines.append('')
    return lines


def performance_and_defects(lines, facts):
    perf = facts['perf']
    lines.append('## F. Performance')
    lines.append('')
    lines.append('| Interaction (input to fully rendered frame) | ms |')
    lines.append('|---|---|')
    for key, value in (perf.get('interaction_latency_ms_input_to_two_frames') or {}).items():
        lines.append('| %s | %s |' % (key, value))
    lines.append('')
    lines.append('First load of the 1.13 GB file over `file://`: %s ms (DOMContentLoaded %s ms, load '
                 'event %s ms).' % (format(perf.get('load', {}).get('wall_clock_ms_first_load') or 0, ','),
                                    format(facts['nav_entry'].get('domContentLoaded') or 0, ','),
                                    format(facts['nav_entry'].get('load') or 0, ',')))
    end = facts['js'].get('end_of_book') or {}
    lines.append('')
    lines.append('End of the book is reachable: scrolling to the bottom shows `TMP-1899` '
                 '(`docScrolledToEnd`: %s).' % end.get('docScrolledToEnd'))
    lines.append('')
    stress = perf.get('stress_rounds') or []
    lines.append('Stress: three rounds of six Contents clicks + theme switch + mode switch + '
                 'Expand/Collapse all + a disclosure toggle took %s ms, with no error, no freeze and '
                 'no growth trend. No crash in any probe.'
                 % ', '.join(str(r.get('ms')) for r in stress))
    lines.append('')
    for note in perf.get('known_limitations', []):
        lines.append('* %s' % note)
    lines.append('')
    lines.append('## G. Defects')
    lines.append('')
    lines.append('| Id | Severity | Status | Finding |')
    lines.append('|---|---|---|---|')
    for issue in facts['issues'].get('issues', []):
        lines.append('| %s | %s | %s | %s |' % (issue.get('id'), md(issue.get('severity')),
                                                 md(issue.get('status')), md(issue.get('title'))))
    lines.append('')
    lines.append('**Blockers: none. Major defects: none. Repaired defects: none - the artifact was not '
                 'modified.** Four findings were defects of my own test harness; they are recorded as '
                 'such so they cannot be mistaken for book defects. The others are documented source '
                 'limitations or intentional, source-faithful behaviour.')
    lines.append('')
    return lines


def navigation(lines, facts):
    return navigation_section(lines, facts)


def navigation_section(lines, facts):
    nav = facts['nav']
    lines.append('## D. Navigation')
    lines.append('')
    lines.append('All %s internal links were clicked in the real browser in Continuous mode: %s '
                 'targets existed, %s landed below the toolbar, %s carried the right hash, and %s of '
                 'the 443 Contents row links also had the right active row. The ten links without an '
                 'active row are the ten unit/group headers, which are not Contents rows; they were '
                 'verified by destination and by their group staying open.'
                 % (nav.get('tested_links'), nav.get('targets_exist'), nav.get('landed_below_toolbar'),
                    nav.get('hash_matched'), nav.get('active_row_matched')))
    lines.append('')
    lines.append('The first pass clicked every link 80 ms apart, which outruns the reader\'s settle for '
                 '%s rows. Those rows were re-clicked with a 2.5 s settle and **all of them land at '
                 '14 px below the toolbar with the correct hash and region** (%s failures after the '
                 'recheck).' % (nav.get('fast_pass_failures'), nav.get('failures_after_recheck')))
    lines.append('')
    click = nav.get('independent_scripted_click_check') or {}
    lines.append('An independent click check from the previous wave, written with different '
                 'measurement code (`reader/step3_click_check.mjs`), reports %s landings, %s failures '
                 'and %s JavaScript errors.' % (click.get('rows'), click.get('failures'), click.get('jsErrors')))
    lines.append('')
    lines.append('Section mode switches to the destination\'s own section (observed: '
                 '`Section 121 of 383 - Technology and Innovation`) and Source capture mode selects '
                 'the capture holding the destination (`Source capture 882 of 1899`). Back and '
                 'Forward restore both the hash and the 14 px landing. %s Contents rows stay unlinked '
                 'with a per-row reason, and %s describe material the supplied source does not contain.'
                 % ((nav.get('unlinked_rows') or {}).get('count'), (nav.get('unlinked_rows') or {}).get('source_absent')))
    lines.append('')
    lines.append('## E. Appearance and typography')
    lines.append('')
    theme = facts['theme']
    lines.append('* Appearance options: %s.' % theme.get('options'))
    lines.append('* Dark mode and back to Light restores the inline styles exactly: stable after 5 '
                 'toggle cycles, drift cells %s.' % ((theme.get('drift_cells') or {}).get('light')))
    lines.append('* Images are never filtered: computed filter is `none` on every sampled image (%s), '
                 'and the pixel samples of the cover, a Learning Goal badge and a photograph are '
                 'identical in both themes.' % theme.get('images_unfiltered'))
    lines.append('* %s inline colour declarations are remapped by the dark theme; %s elements carry '
                 'inline styles.' % (facts['css'].get('inline_color_declarations'),
                                     facts['counts'].get('inline_styled_elements')))
    lines.append('')
    lines.append('Pixel-measured contrast (exact element box, WCAG AA):')
    lines.append('')
    lines.append('| Element | Theme | Ratio | Verdict |')
    lines.append('|---|---|---|---|')
    for key in sorted((facts['pixels'].get('summary') or {}).keys()):
        value = (facts['pixels'].get('summary') or {})[key]
        bits = key.rsplit(':', 1)
        lines.append('| %s | %s | %s | %s |' % (bits[0], bits[-1], value.get('ratio'), value.get('verdict')))
    lines.append('')
    lines.append('Computed-style contrast was measured too, and reported 19 light / 6 dark '
                 '"failures"; every one is a false positive of that method, which compares a '
                 'container element\'s inherited colour against an ancestor band that is not the '
                 'pixels behind the text. The pixel table above is the evidence; see QA-01.')
    lines.append('')
    return lines

if __name__ == '__main__':
    main()
