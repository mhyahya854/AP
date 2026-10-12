"""Apply the reader-UI layer to a reader build, reproducibly.

The patcher only performs exact-match insertions and replacements; it never
rewrites article content.  It:

  1. appends the new stylesheet before `</style>`
  2. unlocks the default panel state (`<div class="app left-closed right-closed">`
     becomes `<div class="app">`; preferences then take over at load)
  3. inserts the sidebar identity block (cover thumbnail, title, authors,
     Expand all / Collapse all) at the top of `aside.left`
  4. gives every Contents row a hierarchy depth and a printed-page-reference
     cell (populated from reader_ui/printed_page_references.json when present)
  5. turns the 31 `nav-module` divs into collapsible `<details>`, keeping the
     verified module links exactly as they are
  6. replaces the reader-tools panel with the view mode / font / text size /
     line spacing / zoom controls
  7. adds a mode badge to the toolbar and appends the UI script

Usage:
  python patch_reader_ui.py <in.html> <out.html> [--report report.json]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK = HERE.parent
ROOT = WORK.parent
MANIFEST = WORK / 'source_contents_navigation_manifest_v2.json'
REFS = HERE / 'printed_page_references.json'

SIDEBAR_OPEN = '<aside class="left" aria-labelledby="contents-heading">'
APP_OPEN = '<div class="app left-closed right-closed">'
TOOLS_PANEL = re.compile(
    r'<aside class="right" id="reader-controls" aria-labelledby="reader-heading">.*?</aside>',
    re.S)
MODULE_DIV = re.compile(
    r'<div class="nav-module"><strong>(?P<title>[^<]*)</strong>'
    r'<a class="nav-child"(?P<attrs>[^>]*)>(?P<text>[^<]*)</a>')
ROW_OPEN = re.compile(r'<(?P<tag>a|span) class="(?P<cls>nav-child[^"]*|nav-unlinked)"'
                      r'(?P<attrs>[^>]*?)data-source-contents-id="(?P<id>[^"]+)"(?P<post>[^>]*)>')


def depth_map():
    """Hierarchy depth per Contents row, from the audited entry kinds."""
    base = {'back_matter': 1, 'introduction': 1, 'unit_or_review': 1,
            'case_study': 2, 'module_or_review': 2, 'topic_or_exercise': 3}
    data = json.loads(MANIFEST.read_text(encoding='utf-8'))
    out = {}
    for row in data['detailed_contents_entries']:
        out[row['source_id']] = base.get(row['contents_kind'], 3)
    return out


def reference_map():
    if REFS.exists():
        data = json.loads(REFS.read_text(encoding='utf-8'))
        return {k: v for k, v in (data.get('references') or {}).items()}
    return {}


def sidecar_html(cover: str, refs_available: bool) -> str:
    note = ('<p class="rail-note">Printed page references are not present in the supplied '
            'source pages, so no page numbers are shown.</p>') if not refs_available else ''
    return (
        '<div class="rail-head">'
        + (f'<img class="rail-cover" src="{cover}" alt="Book cover">' if cover else '')
        + '<p class="rail-title">BUSINESS WITH PERSONAL FINANCE <span style="font-weight:400">for the '
          'AP&reg; Course</span></p>'
        + '<p class="rail-authors">David A. Anderson &#9642; Heidi M. Neck &#9642; '
          'Christopher P. Neck &#9642; Emma L. Murray</p>'
        + '<div class="rail-actions">'
          '<button type="button" id="nav-expand">Expand all</button>'
          '<button type="button" id="nav-collapse">Collapse all</button>'
        + '</div>' + note + '</div>')


TOOLS_HTML = (
    '<aside class="right" id="reader-controls" aria-labelledby="reader-heading">'
    '<button id="right-close" class="drawer-close" aria-label="Close tools">&times;</button>'
    '<h2 id="reader-heading">Reader tools</h2>'
    '<div class="tools">'
    '<div class="ctl"><label for="mode">View mode</label>'
    '<select id="mode"><option value="continuous">Continuous</option>'
    '<option value="single">Single page</option>'
    '<option value="spread">Two-page spread</option></select>'
    '<p class="ctl-note" id="mode-note" role="status"></p></div>'
    '<div class="ctl"><label for="font">Font</label>'
    '<select id="font"><option value="original">Original / Textbook</option>'
    '<option value="georgia">Georgia</option><option value="times">Times New Roman</option>'
    '<option value="arial">Arial</option><option value="verdana">Verdana</option></select></div>'
    '<div class="ctl"><label for="zoom">Text size <span class="val" id="size-val">100%</span></label>'
    '<input id="zoom" type="range" min="70" max="150" step="5" value="100">'
    '<div class="btnrow"><button type="button" id="size-reset">Reset text size</button></div></div>'
    '<div class="ctl"><label for="spacing">Line spacing</label>'
    '<select id="spacing"><option value="compact">Compact</option>'
    '<option value="normal" selected>Normal</option>'
    '<option value="relaxed">Relaxed</option></select></div>'
    '<div class="ctl"><label>Zoom <span class="val" id="zoom-val">100%</span></label>'
    '<div class="btnrow"><button type="button" id="zoom-out" aria-label="Zoom out">&minus;</button>'
    '<button type="button" id="zoom-reset">Reset</button>'
    '<button type="button" id="zoom-in" aria-label="Zoom in">+</button></div></div>'
    '<div class="ctl"><div class="btnrow">'
    '<button type="button" id="font-reset">Reset typography</button>'
    '<button type="button" id="view-reset">Reset view</button></div>'
    '<p class="ctl-note" id="tools-hint"></p></div>'
    '<div class="diag"><button type="button" id="qa">Check layout</button>'
    '<p class="status" id="qa-status">Layout diagnostics for this device.</p></div>'
    '</div></aside>')


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('target')
    ap.add_argument('--report', default=str(HERE / 'patch_report.json'))
    args = ap.parse_args()

    src = Path(args.source)
    out = Path(args.target)
    HEAD_BYTES = 4 << 20
    with src.open('r', encoding='utf-8', newline='') as fh:
        first = fh.read(HEAD_BYTES)
    cut = first.find('<article')
    shell, remainder_head = (first[:cut], first[cut:]) if cut >= 0 else (first, '')
    if '<nav' not in shell or '</nav>' not in shell:
        raise SystemExit('the shell (sidebar and toolbar) was not found in the first 4 MB')
    html = shell
    stats = {}

    css = (HERE / 'ui.css').read_text(encoding='utf-8')
    js = (HERE / 'ui.js').read_text(encoding='utf-8')
    depths = depth_map()
    refs = reference_map()

    # 1. stylesheet
    idx = html.find('</style>')
    if idx < 0:
        raise SystemExit('no </style> found')
    html = html[:idx] + css + '\n' + html[idx:]
    stats['css_injected'] = True

    # 2. default panel state
    if APP_OPEN not in html:
        raise SystemExit('shell open tag not found')
    html = html.replace(APP_OPEN, '<div class="app">', 1)
    stats['app_unlocked'] = True

    # 3. sidebar identity block. The cover thumbnail is a downscaled copy of the
    #    source cover page (Page 1-100/B2P1-0001.png) so it shows the real book
    #    rather than whichever figure happens to come first.
    cover = ''
    cover_src = ROOT / 'Page 1-100' / 'B2P1-0001.png'
    if cover_src.exists():
        try:
            import base64
            import io
            from PIL import Image
            with Image.open(cover_src) as im:
                im = im.convert('RGB')
                w = 260
                im = im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)
                buf = io.BytesIO()
                im.save(buf, format='PNG', optimize=True)
            cover = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
        except Exception as exc:  # noqa: BLE001
            print(f'cover thumbnail unavailable ({exc}); falling back to the first figure')
    if not cover:
        m = re.search(r'<img[^>]+src="(data:image/[^"]+)"', html)
        cover = m.group(1) if m else ''
    if SIDEBAR_OPEN not in html:
        raise SystemExit('sidebar tag not found')
    html = html.replace(SIDEBAR_OPEN, SIDEBAR_OPEN + sidecar_html(cover, bool(refs)), 1)
    stats['cover_embedded'] = bool(cover)

    # 4. row depth + printed-page cell
    holes = []

    def row_sub(match):
        tag = match.group('tag')
        attrs = match.group('attrs') + match.group('post')
        row_id = match.group('id')
        depth = depths.get(row_id, 3)
        ref = refs.get(row_id, '')
        if not ref:
            holes.append(row_id)
        span = f'<span class="nav-page">{ref}</span>' if ref else ''
        cls = match.group('cls')
        if cls != 'nav-unlinked':
            cls = 'nav-child' + (cls[len('nav-child'):] if cls.startswith('nav-child') else '')
        return (f'<{tag} class="{cls}"{match.group("attrs")}'
                f'data-source-contents-id="{row_id}"{match.group("post")} '
                f'data-depth="{depth}">{span}')

    html, n_rows = ROW_OPEN.subn(row_sub, html)
    stats['rows_tagged'] = n_rows
    stats['rows_without_printed_reference'] = len(holes)
    if n_rows != 502:
        raise SystemExit(f'expected 502 Contents rows, tagged {n_rows}')

    # 5. module divs -> collapsible details
    def module_sub(match):
        title = match.group('title')
        if title != match.group('text'):
            return match.group(0)
        return (f'<details class="nav-module" open><summary>'
                f'<a class="nav-child nav-module-link"{match.group("attrs")}>'
                f'{match.group("text")}</a></summary>')

    html, n_mod = MODULE_DIV.subn(module_sub, html)
    stats['modules_converted'] = n_mod
    # close the converted modules: the original close tag is the next </div>
    html = re.sub(r'(<details class="nav-module" open>.*?)</div>', r'\1</details>', html,
                  flags=re.S)
    nav_slice = html[html.find('<nav'):html.find('</nav>')]
    if nav_slice.count('<details') != nav_slice.count('</details>'):
        raise SystemExit('sidebar details tags are unbalanced after module conversion')
    stats['sidebar_details'] = nav_slice.count('<details')

    # 6. tools panel: it sits after </main>, so it is replaced while streaming
    stats['tools_panel_replaced'] = False

    # 7. mode badge + UI script
    if '<span id="counter">' in html:
        html = html.replace('<span id="counter">', '<span id="counter">', 1)
    anchor = '<button id="right-toggle"'
    if anchor in html:
        html = html.replace(anchor, '<span class="mode-badge" id="mode-badge" '
                                    'title="Current view mode">Continuous</span>' + anchor, 1)
        stats['mode_badge'] = True

    # the head is patched; stream the rest unchanged and append the UI script
    # immediately before the reader's closing </script>
    h = hashlib.sha256()
    written = 0
    hold = ''
    KEEP = 1 << 17
    with src.open('r', encoding='utf-8', newline='') as fin, \
            out.open('w', encoding='utf-8', newline='') as fout:
        fin.read(HEAD_BYTES)
        def emit(text):
            nonlocal written
            fout.write(text)
            h.update(text.encode('utf-8'))
            written += len(text)
        emit(html)
        emit(remainder_head)
        while True:
            chunk = fin.read(4 << 20)
            if not chunk:
                break
            hold += chunk
            if not stats['tools_panel_replaced'] and '<aside class="right"' in hold:
                if '</aside>' in hold[hold.index('<aside class="right"'):]:
                    hold, n_tools = TOOLS_PANEL.subn(TOOLS_HTML, hold, count=1)
                    stats['tools_panel_replaced'] = bool(n_tools)
                else:
                    cut = hold.index('<aside class="right"')
                    emit(hold[:cut])
                    hold = hold[cut:]
                    continue
            if len(hold) > KEEP:
                emit(hold[:-KEEP])
                hold = hold[-KEEP:]
        idx = hold.rfind('</script>')
        if idx < 0:
            raise SystemExit('the reader script could not be located in the tail')
        emit(hold[:idx] + '</script><script>' + js + '</script>' + hold[idx + 9:])
        stats['js_appended'] = True
    stats['head_chars'] = len(html)
    stats['total_chars'] = written
    report = {
        'source': str(src), 'source_bytes': src.stat().st_size,
        'target': str(out), 'target_bytes': out.stat().st_size,
        'target_sha256': h.hexdigest(),
        'stats': stats,
        'printed_references_available': len(refs),
    }
    Path(args.report).write_text(json.dumps(report, indent=1), encoding='utf-8')
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
