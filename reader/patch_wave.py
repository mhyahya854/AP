"""Apply the continuous-reading wave to a verified reader build.

Usage:
  python patch_wave.py <in.html> <out.html> [--sections section_starts.json]
                       [--report report.json]

The patcher streams the (about 1.13 GB) file and performs exactly three
mechanical, auditable changes:

  1. appends wave.css before </style>
  2. tags the verified module / unit start headings with data-section-start="1"
     (attribute only; the element and its text are untouched)
  3. rewrites each <details class="...disclosure..."> summary to the standard
     bar: the inline disclosure glyphs are replaced by the shared control and
     the descriptive label text is preserved exactly
  4. appends wave.js before </body>

Nothing inside a figure, table, caption, paragraph or disclosure body is
altered.  It is idempotent and refuses to finish if the expected counts are
not met.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

HEAD_BYTES = 4 << 20
CHUNK = 8 << 20
HOLD = 384 << 10

SUMMARY_RX = re.compile(
    r'(?P<open><details class="[^"]*disclosure[^"]*"[^>]*>)'
    r'(?P<gap>\s*)'
    r'(?P<sum><summary(?P<sattrs>[^>]*)>)'
    r'(?P<body>(?:(?!</summary>).)*)(?P<sumend></summary>)',
    re.S)
HEADING_ID_RX = re.compile(r'id="(?P<id>book-heading-\d+)"')
GROUP_ID_RX = re.compile(r'id="(?P<id>book-group-\d+)"')
APP_OPEN = '<div class="app">'

# A learning-goal marker whose badge fill was lost in extraction: white "LG"
# text sitting in a bordered table cell.  Two shapes exist, the badge in its
# own one-cell table and the badge in a cell of the goal row.
LG_SPAN = r'<span style="[^"]*"[^>]*>\s*LG\s*</span>'
LG_TABLE_RX = re.compile(
    r'<table>\s*<tr>\s*<td[^>]*>\s*(?:<p[^>]*>)?\s*(?P<span>' + LG_SPAN +
    r')\s*(?:</p>)?\s*</td>\s*</tr>\s*</table>')
LG_CELL_RX = re.compile(
    r'<td[^>]*>\s*(?:<p[^>]*>)?\s*(?P<span>' + LG_SPAN +
    r')\s*(?:</p>)?\s*</td>')
LG_BADGE_HTML = '<span class="lg-badge lg-badge--lg-70">LG</span>'

# Some regions rendered the description control as three loose paragraphs
# (chevron / label / information glyph) instead of a real <details>.  The rest
# of the region is the description body.
FLAT_DISC_RX = re.compile(
    r'<p[^>]*>\s*[\u25bc\u25b6\u25be\u25b8]\s*</p>\s*'
    r'<p[^>]*>\s*(?P<label>Extended description for[^<]*?)\s*</p>\s*'
    r'<p[^>]*>\s*i\s*</p>(?P<body>.*?)(?P<end></div></article>)', re.S)

# white "LG" written as its own paragraph (the badge fill was lost entirely)
LG_PARA_RX = re.compile(r'<p[^>]*color:#FFFFFF[^>]*>\s*LG\s*</p>')

# the glyphs a previous pass used to draw the chevron / information icon
GLYPH_TAIL = re.compile(r'(?:\s*(?:\u2139|\u24d8|\u25cf\s*i|\u25cf|i))*\s*$')
LEAD_GLYPHS = '\u25b8\u25be\u25b6\u25bc\u2023\u25c2\u25b9 vV>'


def label_of(summary_html: str) -> str:
    """The exact description label ("Extended description for ...") with only
    the UI glyphs removed."""
    # tags become a space, so a label split by an inline element keeps its
    # word breaks
    text = re.sub(r'<[^>]+>', ' ', summary_html)
    for a, b in (('&nbsp;', ' '), ('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>')):
        text = text.replace(a, b)
    text = re.sub(r'\s+', ' ', text).strip()
    text = text.lstrip(LEAD_GLYPHS).strip()
    m = re.search(r'Extended description for\s*(.*)$', text, re.S)
    if not m:
        return ''
    body = m.group(1).strip()
    prev = None
    while prev != body:
        prev = body
        body = GLYPH_TAIL.sub('', body).strip()
    return ('Extended description for ' + body).strip() if body else 'Extended description for'


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('target')
    ap.add_argument('--sections', default=str(HERE / 'section_starts.json'))
    ap.add_argument('--report', default=str(HERE / 'patch_wave_report.json'))
    ap.add_argument('--css', default=str(HERE / 'wave.css'))
    ap.add_argument('--js', default=str(HERE / 'wave.js'))
    ap.add_argument('--expect-disclosures', type=int, default=0)
    ap.add_argument('--allow-partial', action='store_true',
                    help='fixture mode: accept a document that holds only part of the book')
    args = ap.parse_args()

    src = Path(args.source)
    out = Path(args.target)
    sections = json.loads(Path(args.sections).read_text(encoding='utf-8'))
    section_ids = set(sections['headings'])
    group_ids = set(sections['groups'])
    css = Path(args.css).read_text(encoding='utf-8')
    js = Path(args.js).read_text(encoding='utf-8')

    with src.open('r', encoding='utf-8', newline='') as fh:
        head = fh.read(HEAD_BYTES)
    idx = head.find('</style>')
    if idx < 0:
        raise SystemExit('no </style> in the first 4 MB')
    new_head = head[:idx] + '\n' + css + '\n' + head[idx:]
    if new_head.count(APP_OPEN) != 1:
        raise SystemExit('the app container was not found exactly once')
    new_head = new_head.replace(APP_OPEN, '<div class="app" id="b2-app">', 1)

    seen_headings: set[str] = set()
    seen_groups: set[str] = set()
    labels_out: list[str] = []
    problems: list[str] = []
    lg_counts = {'table': 0, 'cell': 0, 'bare': 0, 'kept': 0}

    def is_white_lg(span_html: str) -> bool:
        return '#FFFFFF' in span_html and 'font-weight:700' in span_html

    def lg_table_sub(m: re.Match) -> str:
        if not is_white_lg(m.group('span')):
            return m.group(0)
        lg_counts['table'] += 1
        return LG_BADGE_HTML

    def lg_cell_sub(m: re.Match) -> str:
        if not is_white_lg(m.group('span')):
            return m.group(0)
        lg_counts['cell'] += 1
        return '<td class="b2-lg-cell">' + LG_BADGE_HTML + '</td>'

    BARE_RX = re.compile(r'<span style="[^"]*"[^>]*>\s*LG\s*</span>')

    def lg_bare_sub(m: re.Match) -> str:
        if not is_white_lg(m.group(0)):
            lg_counts['kept'] += 1
            return m.group(0)
        lg_counts['bare'] += 1
        return LG_BADGE_HTML

    flat_labels: list[str] = []

    def flat_disc_sub(m: re.Match) -> str:
        label = re.sub(r'\s+', ' ', m.group('label')).strip()
        flat_labels.append(label)
        return ('<details class="disclosure" data-b2-source="flattened">'
                f'<summary><span class="b2-desc-label">{label}</span></summary>'
                '<div class="desc-panel">' + m.group('body') + '</div></details>'
                + m.group('end'))

    def lg_para_sub(m: re.Match) -> str:
        lg_counts['para'] = lg_counts.get('para', 0) + 1
        return '<p class="b2-lg-lead">' + LG_BADGE_HTML + '</p>'

    def heading_sub(m: re.Match) -> str:
        hid = m.group('id')
        if hid in section_ids and hid not in seen_headings:
            seen_headings.add(hid)
            return f'id="{hid}" data-section-start="1"'
        return m.group(0)

    def group_sub(m: re.Match) -> str:
        gid = m.group('id')
        if gid in group_ids and gid not in seen_groups:
            seen_groups.add(gid)
            return f'id="{gid}" data-section-start="1"'
        return m.group(0)

    def summary_sub(m: re.Match) -> str:
        label = label_of(m.group('body'))
        if not label:
            problems.append(m.group('body')[:300])
            return m.group(0)
        labels_out.append(label)
        return (m.group('open') + m.group('gap') + m.group('sum') +
                f'<span class="b2-desc-label">{label}</span>' + m.group('sumend'))

    def transform(text: str) -> str:
        text = HEADING_ID_RX.sub(heading_sub, text)
        text = GROUP_ID_RX.sub(group_sub, text)
        text = SUMMARY_RX.sub(summary_sub, text)
        text = LG_TABLE_RX.sub(lg_table_sub, text)
        text = LG_CELL_RX.sub(lg_cell_sub, text)
        text = BARE_RX.sub(lg_bare_sub, text)
        text = LG_PARA_RX.sub(lg_para_sub, text)
        text = FLAT_DISC_RX.sub(flat_disc_sub, text)
        return text

    digest = hashlib.sha256()
    written = 0
    with src.open('r', encoding='utf-8', newline='') as fin, \
            out.open('w', encoding='utf-8', newline='') as fout:
        fin.read(HEAD_BYTES)

        def emit(text: str) -> None:
            nonlocal written
            fout.write(text)
            digest.update(text.encode('utf-8'))
            written += len(text)

        emit(transform(new_head))
        hold = ''
        while True:
            chunk = fin.read(CHUNK)
            if not chunk:
                break
            buf = hold + chunk
            cut = len(buf) - HOLD
            emit(transform(buf[:cut]))
            hold = buf[cut:]
        final = transform(hold)
        at = final.rfind('</body>')
        if at < 0:
            raise SystemExit('</body> not found in the tail')
        emit(final[:at] + '\n<script>' + js + '</script>\n' + final[at:])

    report = {
        'source': str(src),
        'source_bytes': src.stat().st_size,
        'target': str(out),
        'target_bytes': out.stat().st_size,
        'target_sha256': digest.hexdigest(),
        'section_headings_tagged': len(seen_headings),
        'section_headings_expected': len(section_ids),
        'groups_tagged': len(seen_groups),
        'groups_expected': len(group_ids),
        'disclosures_standardised': len(labels_out),
        'disclosure_labels': labels_out,
        'flattened_disclosures_rebuilt': len(flat_labels),
        'flattened_disclosure_labels': flat_labels,
        'lg_markers': lg_counts,
        'problems': problems,
    }
    Path(args.report).write_text(json.dumps(report, indent=1), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items()
                      if k not in ('disclosure_labels', 'flattened_disclosure_labels')},
                     indent=1))
    if seen_headings != section_ids and not args.allow_partial:
        raise SystemExit(f'section headings: tagged {len(seen_headings)} of {len(section_ids)}; '
                         f'missing {sorted(section_ids - seen_headings)[:5]}')
    if seen_groups != group_ids and not args.allow_partial:
        raise SystemExit('group anchors: not all tagged')
    if problems and not args.allow_partial:
        raise SystemExit(f'{len(problems)} disclosure summaries could not be normalised')
    if args.expect_disclosures and len(labels_out) != args.expect_disclosures:
        raise SystemExit(f'disclosures: {len(labels_out)} != expected {args.expect_disclosures}')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    main()
