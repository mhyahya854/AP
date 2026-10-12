"""Build a source-ordered, selectable HTML candidate from the saved extraction data.

This is a QA artifact until every page passes source text and visual review.
"""
from __future__ import annotations

import argparse
import base64
import html
import hashlib
import json
import mimetypes
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = Path(__file__).resolve().parent
EXTRACT = WORK / 'segments'
INV = json.loads((WORK / 'source_inventory.json').read_text(encoding='utf-8'))

def esc(v): return html.escape(str(v), quote=True)
def b(v):
    if isinstance(v,dict):return b(v.get('val','1'))
    if isinstance(v,bool):return v
    if isinstance(v,(int,float)):return bool(v)
    return isinstance(v,str) and v.lower() not in ('0','false','none','off','')
def color(v):
    if not v or v in ('auto', 'none'): return ''
    return '#' + v if re.fullmatch(r'[0-9a-fA-F]{6}', str(v)) else ''

def inline_style(fmt):
    if not isinstance(fmt, dict): return ''
    out = []
    if b(fmt.get('bold',fmt.get('b'))): out.append('font-weight:700')
    if b(fmt.get('italic',fmt.get('i'))): out.append('font-style:italic')
    if b(fmt.get('underline',fmt.get('u'))): out.append('text-decoration:underline')
    c = color(fmt.get('color') if isinstance(fmt.get('color'),str) else (fmt.get('color') or {}).get('val'))
    if c: out.append('color:'+c)
    sz = fmt.get('size_half_points') or (fmt.get('sz') or {}).get('val')
    try:
        pts = int(sz)/2
        if 4 <= pts <= 60: out.append(f'font-size:{pts:g}pt')
    except (ValueError, TypeError): pass
    font = fmt.get('font_ascii') or (fmt.get('font') or {}).get('ascii') or (fmt.get('rFonts') or {}).get('ascii')
    if font and re.fullmatch(r'[\w ,.-]+',font): out.append(f"font-family:'{font}',serif")
    return ';'.join(out)

def para_style(fmt):
    if not isinstance(fmt, dict): return ''
    out = []
    alignment = fmt.get('alignment') or (fmt.get('jc') or {}).get('val')
    if alignment in ('center','right','left','both','justify'):
        out.append('text-align:' + ('justify' if alignment == 'both' else alignment))
    spacing = fmt.get('spacing_twips') or fmt.get('spacing') or {}
    for key, css in (('before','margin-top'),('after','margin-bottom')):
        try: out.append(f'{css}:{min(int(spacing[key])/20,60):g}pt')
        except (KeyError,ValueError,TypeError): pass
    indent = fmt.get('indents_twips') or fmt.get('ind') or {}
    for key,css in (('left','padding-left'),('right','padding-right'),('firstLine','text-indent')):
        try: out.append(f'{css}:{min(int(indent[key])/20,80):g}pt')
        except (KeyError,ValueError,TypeError): pass
    return ';'.join(out)

class Media:
    def __init__(self, word_path):
        self.word_path = Path(word_path) if word_path else None
        self.zip = zipfile.ZipFile(self.word_path) if self.word_path and self.word_path.exists() else None
        self.cache = {}
    def data(self, part):
        if not part: return ''
        part = part.replace('\\','/').lstrip('/')
        if part.startswith('../'): part = part[3:]
        if not part.startswith('word/'): part = 'word/' + part
        if part not in self.cache:
            if not self.zip or part not in self.zip.namelist(): return ''
            raw = self.zip.read(part)
            mime = mimetypes.guess_type(part)[0] or 'application/octet-stream'
            self.cache[part] = f'data:{mime};base64,' + base64.b64encode(raw).decode('ascii')
        return self.cache[part]
    def close(self):
        if self.zip: self.zip.close()

def image_html(media, part, alt=''):
    uri = media.data(part)
    return f'<img src="{uri}" alt="{esc(alt)}" loading="lazy" decoding="async">' if uri else ''

def source_crop_html(relative_path, vertical_credit=None):
    path=(ROOT/relative_path).resolve()
    if not path.is_relative_to(ROOT.resolve()) or not path.exists():return ''
    mime=mimetypes.guess_type(path.name)[0] or 'image/png'
    uri='data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode('ascii')
    figure_class='source-figure'
    credit_html=''
    if vertical_credit is not None:
        if not isinstance(vertical_credit,str) or not vertical_credit.strip():
            raise ValueError('Invalid vertical photo credit')
        figure_class+=' source-figure--vertical-credit'
        credit_html=f'<figcaption class="source-photo-credit">{esc(vertical_credit)}</figcaption>'
    return f'<figure class="{figure_class}"><img src="{uri}" alt="" loading="lazy" decoding="async">{credit_html}</figure>'

def source_figure_group_html(figures, vertical_credit):
    if not isinstance(figures,list) or len(figures)!=2:
        raise ValueError('Source figure group must contain exactly two figures')
    images=[]
    for expected_role,item in zip(('left','right'),figures):
        if not isinstance(item,dict) or item.get('role')!=expected_role:
            raise ValueError('Invalid source figure group order')
        path=(ROOT/item.get('path','')).resolve()
        if not path.is_relative_to(ROOT.resolve()) or not path.exists():
            raise FileNotFoundError(item.get('path',''))
        raw=path.read_bytes()
        expected_hash=item.get('asset_sha256')
        if expected_hash and hashlib.sha256(raw).hexdigest().lower()!=str(expected_hash).lower():
            raise ValueError('Source figure group asset hash mismatch')
        mime=mimetypes.guess_type(path.name)[0] or 'image/png'
        uri='data:'+mime+';base64,'+base64.b64encode(raw).decode('ascii')
        images.append('<img class="source-photo source-photo--'+expected_role+'" src="'+uri+'" alt="" loading="lazy" decoding="async">')
    if not isinstance(vertical_credit,str) or not vertical_credit.strip():
        raise ValueError('Invalid grouped photo credit')
    return ('<figure class="source-figure source-figure--vertical-credit source-figure--group">'
            '<div class="source-photo-pair">'+''.join(images)+'</div>'
            '<figcaption class="source-photo-credit">'+esc(vertical_credit)+'</figcaption></figure>')

def inline_source_svg(relative_path, source_label, compact=False):
    path=(WORK/relative_path).resolve()
    if not path.is_relative_to(WORK.resolve()):raise ValueError('SVG outside work')
    svg=path.read_text(encoding='utf-8')
    if not svg.lstrip().startswith('<svg ') or '<script' in svg.lower() or 'foreignObject' in svg:
        raise ValueError('Unsafe SVG candidate')
    svg=re.sub(r'<(?:title|desc)\b[^>]*>.*?</(?:title|desc)>','',svg,flags=re.I|re.S)
    svg=re.sub(r'\saria-labelledby="[^"]*"','',svg,count=1)
    svg=svg.replace('<svg ','<svg aria-label="'+esc(source_label)+'" ',1)
    if compact:
        svg=re.sub(r'>\s+<','><',svg).strip()
    return svg

DISCLOSURE_TITLE = re.compile(r'^\s*[▸▶▼v]?\s*extended description for\b', re.I)

def disclosure_table(block, media, render):
    """Convert a one-cell control with a supplied body to a native disclosure."""
    rows=block.get('rows',[])
    if len(rows)!=1:return ''
    cells=rows[0].get('cells',[]) if isinstance(rows[0],dict) else rows[0]
    if len(cells)!=1:return ''
    parts=cells[0].get('blocks',[])
    if len(parts)<2:return ''
    first=parts[0]
    if first.get('type',first.get('kind'))!='paragraph':return ''
    nodes=first.get('nodes',first.get('tokens',first.get('inlines',[])))
    title=first.get('text')
    if title is None:title=''.join(n.get('text','') for n in nodes if isinstance(n,dict))
    if not DISCLOSURE_TITLE.search(title):return ''
    header=render([first],media)
    header=re.sub(r'^<p[^>]*>|</p>$','',header)
    cross_capture=block.get('cross_capture_disclosure') or {}
    if cross_capture.get('trigger_ref')=='TMP-1311':
        # This one Word disclosure has a prose opening followed by two list levels.
        # Fail on source-structure drift instead of flattening or dropping wording.
        from xml.etree import ElementTree as ET
        if (cross_capture.get('word_body_block_count')!=16 or len(parts)!=17 or
                parts[1].get('kind')!='paragraph' or
                parts[1].get('format',{}).get('numPr')):
            raise ValueError('TMP-1311 disclosure body structure changed')
        groups=[]
        for part in parts[2:]:
            if part.get('kind')!='paragraph':
                raise ValueError('TMP-1311 list contains a non-paragraph block')
            num_pr=part.get('format',{}).get('numPr') or ''
            try:
                numbering=ET.fromstring(num_pr)
            except ET.ParseError as exc:
                raise ValueError('TMP-1311 malformed Word numPr') from exc
            word_ns='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            if (numbering.tag!=word_ns+'numPr' or len(numbering)!=2 or
                    [child.tag for child in numbering]!=[word_ns+'ilvl',word_ns+'numId'] or
                    numbering.attrib or
                    any(set(child.attrib)!={word_ns+'val'} for child in numbering)):
                raise ValueError('TMP-1311 Word numPr structure changed')
            level=numbering[0].get(word_ns+'val')
            if level not in ('0','1') or numbering[1].get(word_ns+'val')!='10':
                raise ValueError('TMP-1311 Word list level or numId changed')
            if level=='0':
                groups.append([part,[]])
            elif groups:
                groups[-1][1].append(part)
            else:
                raise ValueError('TMP-1311 nested list has no parent')
        if [len(children) for _,children in groups]!=[3,3,2,3]:
            raise ValueError('TMP-1311 Word list hierarchy changed')
        body=render([parts[1]],media)+'<ul class="word-nested-list">'+''.join(
            '<li>'+render([parent],media)+'<ul>'+''.join(
                '<li>'+render([child],media)+'</li>' for child in children
            )+'</ul></li>' for parent,children in groups
        )+'</ul>'
    else:
        body=render(parts[1:],media)
    if not re.sub(r'<[^>]*>','',body).strip():return ''
    return '<details class="disclosure"><summary>'+header+'</summary><div class="desc-panel">'+body+'</div></details>'

def cell_has_content(value):
    """Do not discard wording or media when a Word merge marker is malformed."""
    if isinstance(value, list):
        return any(cell_has_content(v) for v in value)
    if not isinstance(value, dict):
        return False
    if isinstance(value.get('text'), str) and value['text'].strip():
        return True
    if value.get('media_part') or value.get('part') or value.get('images') or value.get('media'):
        return True
    return any(cell_has_content(v) for k, v in value.items()
               if k not in ('format', 'properties', 'width', 'fill'))

def merged_table_html(rows, render_cell):
    """Keep OOXML vertical merges as real HTML rowspans."""
    rendered = []
    active = {}
    for source_row in rows:
        source_cells = source_row.get('cells', []) if isinstance(source_row, dict) else source_row
        row = []
        next_active = {}
        column = 0
        for cell in source_cells:
            props = cell.get('properties', cell)
            try:
                span = max(1, int(props.get('grid_span') or 1))
            except (ValueError, TypeError):
                span = 1
            merge = props.get('vertical_merge')
            previous = active.get(column)
            if merge and merge != 'restart' and previous is not None and not cell_has_content(cell.get('blocks', [])):
                if all(active.get(c) is previous for c in range(column, column + span)):
                    previous['rowspan'] += 1
                    for c in range(column, column + span):
                        next_active[c] = previous
                    column += span
                    continue
            inner, extra = render_cell(cell)
            item = {'inner': inner, 'extra': extra, 'colspan': span, 'rowspan': 1}
            row.append(item)
            if merge == 'restart':
                for c in range(column, column + span):
                    next_active[c] = item
            column += span
        rendered.append(row)
        active = next_active
    output = []
    for row in rendered:
        cells = []
        for item in row:
            attrs = []
            if item['colspan'] > 1:
                attrs.append(f'colspan="{item["colspan"]}"')
            if item['rowspan'] > 1:
                attrs.append(f'rowspan="{item["rowspan"]}"')
            if item['extra']:
                attrs.append(item['extra'])
            cells.append('<td'+(' '+' '.join(attrs) if attrs else '')+'>'+item['inner']+'</td>')
        output.append('<tr>'+''.join(cells)+'</tr>')
    return '<table>'+''.join(output)+'</table>'

def early_nodes(nodes, media):
    out=[]
    for n in nodes:
        t=n.get('type')
        if t=='text': out.append(f'<span style="{inline_style(n.get("format"))}">{esc(n.get("text",""))}</span>')
        elif t=='break':
            if n.get('kind')=='line': out.append('<br>')
        elif t=='tab': out.append('&#9;')
        elif t=='hyperlink': out.append(early_nodes(n.get('nodes',[]),media))
        elif t=='drawing':
            out.extend(image_html(media,i.get('media_part')) for i in n.get('images',[]))
            out.extend(early_blocks(box,media) for box in n.get('textboxes',[]))
        elif t=='unmapped_text': out.append(esc(n.get('text','')))
    return ''.join(out)

def early_blocks(blocks, media):
    out=[]
    for block in blocks:
        t=block.get('type')
        if t=='paragraph':
            inner=early_nodes(block.get('nodes',[]),media)
            if inner: out.append(f'<p style="{para_style(block.get("format"))}">{inner}</p>')
        elif t=='table':
            disclosure=disclosure_table(block,media,early_blocks)
            if disclosure:
                out.append(disclosure)
                continue
            def render_early_cell(cell):
                fill = color(cell.get('fill'))
                extra = f'style="background:{fill}"' if fill else ''
                return early_blocks(cell.get('blocks',[]),media), extra
            out.append(merged_table_html(block.get('rows',[]),render_early_cell))
        elif t=='source_figure':
            out.append(source_crop_html(block.get('path','')))
        elif t=='source_disclosure':
            icon=image_html(media,block.get('icon_part'),alt='')
            out.append('<details class="disclosure"><summary>'+esc(block.get('summary',''))+icon+
                       '</summary><div class="desc-panel">'+early_blocks(block.get('body_blocks',[]),media)+
                       '</div></details>')
        elif t=='word_disclosure':
            summary_nodes=block['summary_block'].get('nodes',[])
            if summary_nodes and summary_nodes[0].get('text')=='▼':
                heading='<span class="disclosure-chevron">▼</span>'+early_nodes(summary_nodes[1:],media)
            else:
                heading=early_nodes(summary_nodes,media)
            out.append('<details class="disclosure word-disclosure"><summary>'+heading+
                       '</summary><div class="desc-panel">'+
                       early_blocks(block.get('body_blocks',[]),media)+'</div></details>')
    return ''.join(out)

def middle_blocks(blocks,media):
    out=[]
    for block in blocks:
        t=block.get('kind')
        if t=='paragraph':
            pieces=[]
            visual=block.get('visual_role') or {}
            if visual.get('type')=='inline_svg':
                tokens=block.get('tokens',[])
                first,last=visual['text_token_range']
                if (visual['drawing_token_index']!=0 or first!=1 or last!=len(tokens) or
                    tokens[0].get('type')!='drawing' or
                    any(token.get('type')!='text' for token in tokens[first:last])):
                    raise ValueError('SVG drawing or Word label token drift')
                out.append(inline_source_svg(visual['path'],visual['aria_label'],compact=True))
                continue
            imgparts=iter(i.get('media_part') for i in block.get('media',[]) if i.get('media_part'))
            for token_index,token in enumerate(block.get('tokens',[])):
                k=token.get('type')
                if visual and token_index==visual.get('drawing_token_index'):
                    continue
                if visual.get('type')=='lg_badge' and token_index==visual.get('text_token_index'):
                    variant=visual['variant']
                    if variant not in ('lg-63','lg-70'):raise ValueError(variant)
                    pieces.append(f'<span class="lg-badge lg-badge--{variant}">{esc(token.get("text",""))}</span>')
                elif visual.get('type')=='info_icon' and token_index==visual.get('text_token_index'):
                    pieces.append(f'<span class="figure-info-icon">{esc(token.get("text",""))}</span>')
                elif k=='text': pieces.append(f'<span style="{inline_style(token.get("format"))}">{esc(token.get("text",""))}</span>')
                elif k=='line_break': pieces.append('<br>')
                elif k=='tab': pieces.append('&#9;')
                elif k=='drawing': pieces.append(image_html(media,next(imgparts,None)))
            if pieces: out.append(f'<p style="{para_style(block.get("format"))}">{"".join(pieces)}</p>')
        elif t=='table':
            disclosure=disclosure_table(block,media,middle_blocks)
            if disclosure:
                out.append(disclosure)
                continue
            rows=[]
            for row in block.get('rows',[]):
                cells=[]
                for cell in row.get('cells',[]):
                    cells.append('<td>'+middle_blocks(cell.get('blocks',[]),media)+'</td>')
                rows.append('<tr>'+''.join(cells)+'</tr>')
            out.append('<table>'+''.join(rows)+'</table>')
        elif t=='source_figure':
            out.append(source_crop_html(block.get('path','')))
        elif t=='source_disclosure':
            out.append('<details class="disclosure"><summary>'+esc(block.get('summary',''))+
                       '</summary><div class="desc-panel"><p>'+esc(block.get('body',''))+
                       '</p></div></details><p class="figure-caption">'+esc(block.get('caption',''))+'</p>')
    return ''.join(out)

def late_blocks(blocks,media):
    out=[]
    for block in blocks:
        t=block.get('type')
        if t=='paragraph':
            pieces=[]
            for token in block.get('inlines',[]):
                k=token.get('kind')
                if k=='text': pieces.append(f'<span style="{inline_style(token.get("format"))}">{esc(token.get("text",""))}</span>')
                elif k=='line_break': pieces.append('<br>')
                elif k=='tab': pieces.append('&#9;')
                elif k=='image': pieces.append(image_html(media,token.get('part')))
            if pieces: out.append(f'<p style="{para_style(block.get("properties"))}">{"".join(pieces)}</p>')
        elif t=='table':
            disclosure=disclosure_table(block,media,late_blocks)
            if disclosure:
                out.append(disclosure)
                continue
            out.append(merged_table_html(
                block.get('rows',[]),
                lambda cell: (late_blocks(cell.get('blocks',[]),media), '')))
        elif t=='porter_five_forces':
            if block.get('candidate_id')!='SA-PORTER-CANDIDATE-PROPOSAL-0587-001' or block.get('source_ref')!='TMP-LATE-1450':
                raise ValueError('Unexpected Porter structured block')
            fragment=block['fragment_html']
            digest=hashlib.sha256(fragment.encode('utf-8')).hexdigest().upper()
            if digest!='ADB87B4DC21A731AD9E167A56F5FED185549C6CA5DDBC93F648C981B829577FF' or digest!=block.get('fragment_sha256'):
                raise ValueError('Porter fragment changed')
            out.append(fragment)
        elif t=='swot_four_quadrants':
            if block.get('candidate_id')!='SA-LATE-GRAPHIC-0605-001' or block.get('source_ref')!='TMP-LATE-1468':
                raise ValueError('Unexpected SWOT structured block')
            fragment=block['fragment_template_html']
            if hashlib.sha256(fragment.encode('utf-8')).hexdigest()!=block.get('fragment_sha256'):
                raise ValueError('SWOT fragment changed')
            for number in (14,15,16,17):
                marker='{{MEDIA_'+str(number)+'}}'
                if fragment.count(marker)!=1:raise ValueError('SWOT media placeholder count')
                part=block['media_parts'].get(str(number))
                uri=media.data(part)
                if not uri:raise FileNotFoundError(str(part))
                fragment=fragment.replace(marker,uri)
            out.append('<div class="mobile-diagram-scroll">'+fragment+'</div>')
        elif t=='late_source_composition':
            expected={
                'SA-LATE-GRAPHIC-0542-001':('TMP-LATE-1405','B2P2-0542.png','b0874b7e3079b981a85dc5d9f53974128b335358163a22457d53456b9486925c'),
                'SA-LATE-GRAPHIC-0678-001':('TMP-LATE-1541','B2P2-0678.png','00a84123cc6ba5062f5696b2435d994234efcfcaf9a2ebda42a80d7e17d119d5'),
                'SA-LATE-GRAPHIC-0776-001':('TMP-LATE-1639','B2P2-0776.png','7ff614f7a6ee3417e8dd7c53c7c71afb8d219d13d18f29a175d10ee092a7060e'),
                'SA-LATE-GRAPHIC-0783-001':('TMP-LATE-1646','B2P2-0783.png','d85c997129251786952eafe0ce09e7a17b21c8388959ce0cfe747787f5047455'),
                'SA-LATE-GRAPHIC-0837-001':('TMP-LATE-1700','B2P2-0837.png','7e47fde0b98668a75464d5e931fd3f96a4a1e805262c60409233c0964ef53f26'),
                'SA-LATE-GRAPHIC-0844-001':('TMP-LATE-1707','B2P2-0844.png','7f8d681f4b3e80512f9e35b6b7b041825c256f828445455db9efe6c627168fca'),
            }
            identity=(block.get('source_ref'),block.get('source_id'),block.get('proposal_sha256'))
            if identity!=expected.get(block.get('candidate_id')):
                raise ValueError('Unexpected late graphic source identity')
            fragment=block['fragment_template_html']
            if hashlib.sha256(fragment.encode('utf-8')).hexdigest()!=block.get('fragment_sha256'):
                raise ValueError('Late graphic fragment changed')
            for number,part in block.get('media_parts',{}).items():
                marker='{{MEDIA_'+number+'}}'
                if fragment.count(marker)!=1:raise ValueError('Late graphic media placeholder count')
                uri=media.data(part)
                if not uri:raise FileNotFoundError(str(part))
                fragment=fragment.replace(marker,uri)
            if re.search(r'\{\{MEDIA_\d+\}\}',fragment):
                raise ValueError('Unresolved late graphic media placeholder')
            if block.get('candidate_id') in {'SA-LATE-GRAPHIC-0776-001','SA-LATE-GRAPHIC-0844-001'}:
                out.append('<div class="mobile-diagram-scroll">'+fragment+'</div>')
            else:out.append(fragment)
    return ''.join(out)

def fidelity_elements(elements):
    out=[]
    for e in elements:
        t=e.get('type')
        if t=='text':
            sty=[]
            if e.get('bold'):sty.append('font-weight:700')
            if e.get('italic'):sty.append('font-style:italic')
            if e.get('font') and re.fullmatch(r'[\w ,.-]+',e['font']):sty.append(f"font-family:'{e['font']}',serif")
            c=color(e.get('color'))
            if c:sty.append('color:'+c)
            out.append(f'<p style="{";".join(sty)}">{esc(e.get("text",""))}</p>')
        elif t=='table':
            rows=[];cells=e.get('cells',[]);cols=e.get('cols',1)
            for i in range(0,len(cells),cols):
                row=[]
                for c in cells[i:i+cols]:
                    style=f'background:{color(c.get("fill"))};color:{color(c.get("color"))}'
                    row.append(f'<td style="{style}">{esc(c.get("text",""))}</td>')
                rows.append('<tr>'+''.join(row)+'</tr>')
            out.append('<table>'+''.join(rows)+'</table>')
        elif t=='image':
            p=ROOT/'Page 501-600'/e.get('path','')
            if p.exists():
                raw=p.read_bytes();mime=mimetypes.guess_type(p.name)[0] or 'image/png'
                uri='data:'+mime+';base64,'+base64.b64encode(raw).decode('ascii')
                out.append(f'<img src="{uri}" alt="" loading="lazy" decoding="async">')
    return ''.join(out)

def ocr_disclosure_body_html(blocks):
    """Render exact OCR disclosure words in paragraphs and nested list items."""
    if not isinstance(blocks,list) or not blocks:
        raise ValueError('Structured OCR disclosure body must contain blocks')
    def items_html(items):
        if not isinstance(items,list) or not items:
            raise ValueError('Nested OCR disclosure list must contain items')
        rendered=[]
        for item in items:
            if not isinstance(item,dict) or set(item)-{'text','children'}:
                raise ValueError('Invalid nested OCR disclosure item')
            value=item.get('text')
            if not isinstance(value,str) or not value:
                raise ValueError('Nested OCR disclosure item needs exact text')
            children=item.get('children')
            branch=items_html(children) if children is not None else ''
            rendered.append('<li>'+esc(value)+branch+'</li>')
        return '<ul>'+''.join(rendered)+'</ul>'
    rendered=[]
    for part in blocks:
        if not isinstance(part,dict):
            raise ValueError('Invalid structured OCR disclosure block')
        kind=part.get('type')
        if kind=='paragraph' and set(part)=={'type','text'} and isinstance(part['text'],str) and part['text']:
            rendered.append('<p>'+esc(part['text'])+'</p>')
        elif kind=='nested_list' and set(part)=={'type','items'}:
            rendered.append(items_html(part['items']))
        else:
            raise ValueError('Unsupported structured OCR disclosure block')
    return ''.join(rendered)

def validate_ocr_consumed_continuation(block,page):
    """A continuation marker accounts for source lines rendered by an earlier disclosure."""
    if set(block)!={'type','source','source_line_indices','anchor'}:
        raise ValueError('Invalid OCR disclosure continuation marker')
    indices=block['source_line_indices']
    if (block['source']!=page.get('source') or
        not isinstance(block['anchor'],str) or not re.fullmatch(r'TMP-\d{4}',block['anchor']) or
        not isinstance(indices,list) or not indices or
        any(type(i) is not int for i in indices) or
        indices!=list(range(indices[0],indices[-1]+1)) or
        not (0<=indices[0]<=indices[-1]<len(page.get('lines',[])))):
        raise ValueError('Invalid OCR disclosure continuation range')

def redbox_disclosure_body_html(block, page):
    """Render only the two source-confirmed italic film titles at TMP-1181."""
    runs = block.get('body_runs')
    if runs is None:
        return esc(block['body'])
    expected = [
        {'text': 'The kiosk advertises one dollar per night. Additional films displayed include ', 'italic': False},
        {'text': 'Scooby-Doo and the Monster in Mexico', 'italic': True},
        {'text': ' and ', 'italic': False},
        {'text': 'The Last House on the Left', 'italic': True},
        {'text': '.', 'italic': False},
    ]
    if (page.get('temporary_reference') != 'TMP-1181' or
            page.get('source') != 'B2P2-0318.png' or
            block.get('summary') != 'Extended description for Redbox' or
            block.get('source_summary_line') != 10 or
            block.get('source_body_lines') != [11, 12] or
            block.get('source_state') != 'expanded' or
            runs != expected or
            ''.join(run['text'] for run in runs) != block.get('body')):
        raise ValueError('Invalid TMP-1181 Redbox title emphasis')
    return ''.join(('<em>' + esc(run['text']) + '</em>') if run['italic']
                   else esc(run['text']) for run in runs)

def ocr_lines(page):
    if page.get('render_blocks'):
        out=[]
        for block in page['render_blocks']:
            kind=block.get('type')
            if kind=='ocr_line':
                runs=block.get('runs')
                if runs is None:
                    out.append('<p>'+esc(block.get('text',''))+'</p>')
                else:
                    if not isinstance(runs,list) or not runs:raise ValueError('Invalid OCR line runs')
                    plain=[];rendered=[]
                    for run in runs:
                        if not isinstance(run,dict) or set(run)-{'text','italic'}:raise ValueError('Invalid OCR line run')
                        text=run.get('text')
                        italic=run.get('italic',False)
                        if not isinstance(text,str) or not isinstance(italic,bool):raise ValueError('Invalid OCR line run fields')
                        plain.append(text)
                        safe=esc(text)
                        rendered.append('<em>'+safe+'</em>' if italic else safe)
                    if ''.join(plain)!=block.get('text',''):raise ValueError('OCR line runs do not match text')
                    out.append('<p>'+''.join(rendered)+'</p>')
            elif kind=='lg_question':
                if block.get('badge_text')!='LG' or block.get('variant')!='lg-70':
                    raise ValueError('Invalid LG question block')
                out.append('<p class="lg-question"><span class="lg-badge lg-badge--lg-70">LG</span> '+esc(block['question'])+'</p>')
            elif kind=='table_fragment':
                style=block.get('style_metadata') or {}
                title=block.get('title')
                if title:out.append('<p class="table-title">'+esc(title)+'</p>')
                subtitle=block.get('subtitle') or []
                if isinstance(subtitle,str):subtitle=[subtitle]
                subtitle_class='table-subtitle table-subtitle-left' if block['table_id']=='table-sprinkles-city-0314-0315' else 'table-subtitle'
                yeti_masthead=block['table_id']=='table-yeti-income-0288-0289' and bool(subtitle)
                if yeti_masthead:out.append('<div class="ocr-yeti-frame">')
                out.extend('<p class="'+subtitle_class+'">'+esc(line)+'</p>' for line in subtitle)
                widths=style.get('column_widths_percent')
                colgroup=''
                if isinstance(widths,list) and len(widths)==block['columns'] and sum(widths)==100:
                    colgroup='<colgroup>'+''.join(f'<col style="width:{int(w)}%">' for w in widths)+'</colgroup>'
                fill=color(str(style.get('fill_hex') or '').lstrip('#'))
                filled=set(style.get('filled_candidate_rows_0based',[]))
                emphasized=set(style.get('emphasis_rows_0based',[]))
                section=set(style.get('section_rows_0based',[]))
                separators=style.get('separator_before_candidate_rows_0based',[]) if block['table_id']=='table-sprinkles-city-0314-0315' else []
                if block['table_id']=='table-sprinkles-city-0314-0315' and separators!=[7,12]:raise ValueError('Sprinkles source separator metadata drift')
                align=style.get('column_alignment',[])
                rows=[]
                for local_index,row in enumerate(block['rows']):
                    row_index=block['candidate_row_range'][0]+local_index
                    row_styles=[]
                    if fill and row_index in filled:row_styles.append('background:'+fill)
                    if row_index in emphasized or (row_index in section and block['table_id']!='table-budget-0268-0270'):row_styles.append('font-weight:700')
                    if row_index in separators:row_styles.append('border-top:3pt solid #ffe7e5')
                    cells=[]
                    column=0
                    for cell in row:
                        tag='th' if cell.get('header') else 'td'
                        attrs=[]
                        for key in ('colspan','rowspan'):
                            try:
                                span=int(cell.get(key) or 1)
                                if span>1:attrs.append(f'{key}="{span}"')
                            except (TypeError,ValueError):pass
                        if block['table_id']=='table-yeti-income-0288-0289' and row_index in (0,1):
                            cell_align='center'
                        else:
                            cell_align=align[column] if column<len(align) else 'left'
                        if cell_align in ('left','center','right'):attrs.append(f'style="text-align:{cell_align}"')
                        value=cell.get('text','')
                        if (block['table_id']=='table-yeti-income-0288-0289' and
                                column>0 and value.startswith('$ ')):
                            inner='<span class="currency-mark">$ </span>'+esc(value[2:])
                        else:
                            inner=esc(value)
                        cells.append('<'+tag+(' '+' '.join(attrs) if attrs else '')+'>'+
                                     inner+'</'+tag+'>')
                        try:column+=max(1,int(cell.get('colspan') or 1))
                        except (TypeError,ValueError):column+=1
                    attrs=f' data-row-index="{row_index}"'
                    if row_styles:attrs+=' style="'+';'.join(row_styles)+'"'
                    rows.append('<tr'+attrs+'>'+''.join(cells)+'</tr>')
                out.append('<table class="ocr-table" data-table-id="'+esc(block['table_id'])+'">'+
                           colgroup+''.join(rows)+'</table>')
                if yeti_masthead:out.append('</div>')
            elif kind=='inline_svg':
                out.append('<figure class="source-diagram">'+
                           inline_source_svg(block['path'],'Figure 3.7-1 The Balance Sheet')+
                           '</figure>')
            elif kind=='source_figure':
                figure=source_crop_html(block['path'],block.get('vertical_credit'))
                if not figure:raise FileNotFoundError(block['path'])
                out.append(figure)
            elif kind=='source_figure_group':
                if block.get('layout')!='two_columns':
                    raise ValueError('Invalid source figure group layout')
                out.append(source_figure_group_html(block.get('figures'),block.get('vertical_credit')))
            elif kind=='ocr_disclosure':
                icon=block.get('decorative_info_icon')
                icon_html=''
                if icon is not None:
                    if icon!={'text':'i','aria_hidden':True}:
                        raise ValueError('Invalid decorative disclosure information icon')
                    icon_html='<span class="figure-info-icon" aria-hidden="true">i</span>'
                out.append('<details class="disclosure ocr-disclosure"><summary>'+
                           esc(block['summary'])+icon_html+'</summary><div class="desc-panel"><p>'+
                           redbox_disclosure_body_html(block,page)+'</p></div></details>')
            elif kind=='ocr_disclosure_structured':
                if block.get('source_state')!='expanded':
                    raise ValueError('Invalid structured OCR disclosure source state')
                icon=block.get('decorative_info_icon')
                if icon is not None and icon!={'text':'i','aria_hidden':True}:
                    raise ValueError('Invalid structured OCR disclosure information icon')
                icon_html='<span class="figure-info-icon" aria-hidden="true">i</span>' if icon else ''
                body=ocr_disclosure_body_html(block['body_blocks'])
                out.append('<details class="disclosure ocr-disclosure ocr-disclosure-structured" open><summary>'+
                           esc(block['summary'])+icon_html+'</summary><div class="desc-panel">'+
                           body+'</div></details>')
            elif kind=='ocr_continuation_consumed':
                validate_ocr_consumed_continuation(block,page)
        return ''.join(out)
    lines=page.get('lines',[])
    return ''.join(f'<p>{esc(line.get("text",""))}</p>' for line in lines)

def load_batch(batch):
    start,end=batch['range']
    if start==1101:
        selected_0257_0318=EXTRACT/'missing'/'Page_1101-1200_OCR-0257-0318-combined-candidate.json'
        selected_table_style=EXTRACT/'missing'/'Page_1101-1200_OCR-0337-0298-table-style-candidate.json'
        selected_0337_0298=EXTRACT/'missing'/'Page_1101-1200_OCR-0337-0298-candidate.json'
        source_exception_wave=EXTRACT/'missing'/'Page_1101-1200_OCR-source-exceptions-wave-candidate.json'
        source_0242_0250=EXTRACT/'missing'/'Page_1101-1200_OCR-0242-0250-candidate.json'
        photo_0318=EXTRACT/'missing'/'Page_1101-1200_OCR-photo-0318.json'
        table_styled=EXTRACT/'missing'/'Page_1101-1200_OCR-table-styled.json'
        source_corrected=EXTRACT/'missing'/'Page_1101-1200_OCR-source-corrected.json'
        charted=EXTRACT/'missing'/'Page_1101-1200_OCR-charted.json'
        disclosed=EXTRACT/'missing'/'Page_1101-1200_OCR-disclosed.json'
        figured=EXTRACT/'missing'/'Page_1101-1200_OCR-figured.json'
        structured=EXTRACT/'missing'/'Page_1101-1200_OCR-structured.json'
        corrected=EXTRACT/'missing'/'Page_1101-1200_OCR-corrected.json'
        path=selected_0257_0318 if selected_0257_0318.exists() else selected_table_style if selected_table_style.exists() else selected_0337_0298 if selected_0337_0298.exists() else source_exception_wave if source_exception_wave.exists() else source_0242_0250 if source_0242_0250.exists() else photo_0318 if photo_0318.exists() else table_styled if table_styled.exists() else source_corrected if source_corrected.exists() else charted if charted.exists() else disclosed if disclosed.exists() else figured if figured.exists() else structured if structured.exists() else corrected if corrected.exists() else EXTRACT/'missing'/'Page_1101-1200_OCR.json'
        data=json.loads(path.read_text(encoding='utf-8'))
        return 'ocr',data['pages'],''
    if start in (1,401):
        crosscapture=EXTRACT/'early'/f'batch-{start:04d}-{end:04d}-disclosure-crosscapture-candidate.json'
        two_boundaries=EXTRACT/'early'/f'batch-{start:04d}-{end:04d}-boundaries-0026-0050.json'
        boundary=EXTRACT/'early'/f'batch-{start:04d}-{end:04d}-boundary-0049-0050.json'
        disclosed=EXTRACT/'early'/f'batch-{start:04d}-{end:04d}-disclosed.json'
        composited=EXTRACT/'early'/f'batch-{start:04d}-{end:04d}-composited.json'
        formatted=EXTRACT/'early'/f'batch-{start:04d}-{end:04d}-formatted.json'
        transcribed=EXTRACT/'early'/f'batch-{start:04d}-{end:04d}-transcribed.json'
        corrected=EXTRACT/'early'/f'batch-{start:04d}-{end:04d}-corrected.json'
        path=crosscapture if crosscapture.exists() else two_boundaries if start==1 and two_boundaries.exists() else boundary if boundary.exists() else disclosed if disclosed.exists() else composited if composited.exists() else formatted if formatted.exists() else transcribed if transcribed.exists() else corrected if corrected.exists() else EXTRACT/'early'/f'batch-{start:04d}-{end:04d}-provisional.json'
    elif start<=601:
        crosscapture=EXTRACT/'early'/f'batch-{start:04d}-{end:04d}-disclosure-crosscapture-candidate.json'
        corrected=EXTRACT/'early'/f'batch-{start:04d}-{end:04d}-corrected.json'
        path=crosscapture if crosscapture.exists() else corrected if corrected.exists() else EXTRACT/'early'/f'batch-{start:04d}-{end:04d}.json'
    elif start<=1301:
        four_crosscapture_901=EXTRACT/'middle'/'Page-901-1000-four-crosscapture-candidate.json'
        four_crosscapture_1301=EXTRACT/'middle'/'Page-1301-1400-0448-four-crosscapture-candidate.json'
        diagram=EXTRACT/'middle'/'Page-1301-1400-0448-candidate.json'
        vectors=EXTRACT/'middle'/f'Page-{start}-{end}-vectors.json'
        remapped=EXTRACT/'middle'/f'Page-{start}-{end}-remapped.json'
        corrected=EXTRACT/'middle'/f'Page-{start}-{end}-corrected.json'
        path=four_crosscapture_901 if start==901 and four_crosscapture_901.exists() else four_crosscapture_1301 if start==1301 and four_crosscapture_1301.exists() else diagram if start==1301 and diagram.exists() else vectors if vectors.exists() else remapped if remapped.exists() else corrected if corrected.exists() else EXTRACT/'middle'/f'Page-{start}-{end}.json'
    else:
        four_crosscapture_1401=EXTRACT/'late'/'Page_1401-1500-porter-swot-strategy-four-crosscapture-candidate.json'
        strategy=EXTRACT/'late'/'Page_1401-1500-porter-swot-strategy-candidate.json'
        swot=EXTRACT/'late'/'Page_1401-1500-porter-swot-candidate.json'
        porter=EXTRACT/'late'/'Page_1401-1500-porter-candidate.json'
        sales_tax=EXTRACT/'late'/'Page_1501-1600-sales-tax-candidate.json'
        compounding=EXTRACT/'late'/'Page_1601-1700-compounding-candidate.json'
        wave2_1601=EXTRACT/'late'/'Page_1601-1700-compounding-uber-stock-candidate.json'
        wave2_1701=EXTRACT/'late'/'Page_1701-1800-bmw-candidate.json'
        source_corrected_1801=EXTRACT/'late'/'Page_1801-1900-source-corrected-candidate.json'
        path=four_crosscapture_1401 if start==1401 and four_crosscapture_1401.exists() else strategy if start==1401 and strategy.exists() else swot if start==1401 and swot.exists() else porter if start==1401 and porter.exists() else sales_tax if start==1501 and sales_tax.exists() else wave2_1601 if start==1601 and wave2_1601.exists() else compounding if start==1601 and compounding.exists() else wave2_1701 if start==1701 and wave2_1701.exists() else source_corrected_1801 if start==1801 and source_corrected_1801.exists() else EXTRACT/'late'/f'Page_{start}-{end}.json'
    if not path.exists(): return 'missing', [], ''
    data=json.loads(path.read_text(encoding='utf-8'))
    schema='fidelity' if start==501 else 'early' if start<=601 else 'middle' if start<=1301 else 'late'
    doc=data.get('word_path') or data.get('docx') or data.get('word_file') or ''
    if doc and not Path(doc).is_absolute(): doc=str(ROOT/batch['batch']/Path(doc).name)
    return schema,data.get('segments',data.get('pages',[])),doc

CSS='''
*{box-sizing:border-box}body{margin:0;background:#ddd;color:#111;font:14px Arial,sans-serif}
.app{display:grid;grid-template-columns:250px minmax(0,1fr) 220px;height:100vh}
.app.left-closed{grid-template-columns:0 minmax(0,1fr) 220px}.app.right-closed{grid-template-columns:250px minmax(0,1fr) 0}.app.left-closed.right-closed{grid-template-columns:0 minmax(0,1fr) 0}
.app aside.left{grid-column:1}.app main{grid-column:2}.app aside.right{grid-column:3}
aside{overflow:auto;background:#f7f7f7;border-right:1px solid #bbb;padding:16px}aside.right{border-right:0;border-left:1px solid #bbb}
.app.left-closed aside.left,.app.right-closed aside.right{display:none}
main{min-width:0;overflow:auto;padding:clamp(12px,2vw,18px);scroll-behavior:smooth}.toolbar{position:sticky;top:0;z-index:4;display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#fff;padding:8px;border:1px solid #bbb;margin:0 auto 12px;width:min(210mm,100%)}.toolbar #search{flex:1 1 160px;min-width:0}
button,input{font:inherit}button{cursor:pointer}.book-page{width:min(210mm,100%);height:auto;background:white;margin:0 auto 20px;padding:12mm 14mm;box-shadow:0 3px 18px #999;position:relative;overflow:visible;scroll-margin-top:90px}
.book-page .ref{position:absolute;top:4mm;right:7mm;color:#777;font:10px Arial,sans-serif}.book-page .content{font:var(--body-size,11pt)/1.22 Georgia,serif;white-space:normal;overflow-wrap:anywhere}
.book-page p{margin:0 0 5pt;white-space:pre-wrap}.book-page table{border-collapse:collapse;width:100%;margin:3pt 0 7pt;font:inherit}.book-page td,.book-page th{overflow-wrap:anywhere}.book-page td{border:1px solid #777;padding:3pt;vertical-align:top}.book-page td p:last-child{margin-bottom:0}.book-page img{display:block;max-width:100%;height:auto;width:auto;margin:3pt auto;object-fit:contain}
.book-page .source-figure--vertical-credit{display:grid;grid-template-columns:minmax(0,1fr) 5mm;align-items:start;column-gap:1mm;width:100%;margin:3pt 0 6pt}
.book-page .source-figure--vertical-credit img{width:100%;height:auto;max-width:100%;margin:0;object-fit:contain}
.book-page .source-figure--vertical-credit .source-photo-credit{writing-mode:vertical-rl;transform:rotate(180deg);transform-origin:center;justify-self:center;align-self:start;white-space:nowrap;font:7pt/1 Arial,sans-serif;color:#222}
.book-page .source-figure--group .source-photo-pair{display:grid;grid-template-columns:1516fr 1517fr;gap:4mm;align-items:start}
.book-page .source-figure--group .source-photo-pair img{width:100%;height:auto;max-width:100%;margin:0;object-fit:contain}
.book-page svg{display:block;width:100%;height:auto;margin:3pt auto}.book-page .ocr-table{font:10pt/1.15 Arial,sans-serif;table-layout:fixed}.book-page .ocr-table th,.book-page .ocr-table td{border:1px solid #34383b;padding:2.5pt 3pt;vertical-align:top}.book-page .ocr-table th{font-weight:700}.book-page .ocr-table[data-table-id="table-yeti-income-0288-0289"]{border:2px solid #222}.book-page .ocr-table[data-table-id="table-yeti-income-0288-0289"] th,.book-page .ocr-table[data-table-id="table-yeti-income-0288-0289"] td{border-color:#222}.book-page .ocr-table .currency-mark{float:left}.book-page .ocr-table[data-table-id="table-yeti-income-0288-0289"] th{font-weight:400}.book-page .ocr-yeti-frame{border:2px solid #222;background:#f3f3f3;margin:3pt 0 7pt}.book-page .ocr-yeti-frame .table-subtitle{margin:0;padding:7pt 3pt 0;text-align:center}.book-page .ocr-yeti-frame .table-subtitle:last-of-type{padding-bottom:16pt}.book-page .ocr-yeti-frame .ocr-table[data-table-id="table-yeti-income-0288-0289"]{border:0;margin:0}.book-page .ocr-table[data-table-id="table-household-0335"]{background:#f3f3f3}.book-page .table-title{font:700 11pt/1.2 Arial,sans-serif}.book-page .table-subtitle{text-align:center;margin-bottom:2pt;font:10pt/1.15 Arial,sans-serif}.book-page .table-subtitle-left{text-align:left}
.book-page .ocr-table[data-table-id="table-toms-tires-0333-0334"]{background:#f3f3f3}.book-page .ocr-table[data-table-id="table-toms-tires-0333-0334"] th,.book-page .ocr-table[data-table-id="table-toms-tires-0333-0334"] td{border-color:#1b1b26}.book-page .ocr-table[data-table-id="table-toms-tires-0333-0334"] tr[data-row-index="6"] > *,.book-page .ocr-table[data-table-id="table-toms-tires-0333-0334"] tr[data-row-index="9"] > *,.book-page .ocr-table[data-table-id="table-toms-tires-0333-0334"] tr[data-row-index="10"] > *{border-top:5pt double #1b1b26}
.book-page details{margin:6pt 0}.book-page summary{cursor:pointer}.book-page#TMP-1468 details.disclosure summary>img{display:inline-block;vertical-align:middle;width:22px;height:22px;max-width:none;margin:0 0 0 .35em;object-fit:contain}.status{font-size:12px;color:#8b4200}.nav-batch{margin:12px 0}.nav-batch summary{font-weight:700;cursor:pointer}.nav-batch a{display:block;color:#135d88;padding:2px 0;text-decoration:none}
.book-page details.disclosure{position:relative;background:#eee;border:1px solid #d8d8d8;padding:5pt 7pt}.book-page details.disclosure summary{color:#526f77}.book-page details.disclosure .desc-panel{position:static;width:auto;max-height:none;overflow:visible;box-shadow:none;border:0;border-top:1px solid #d8d8d8;background:transparent;padding:7pt 0 0;margin-top:5pt}
.book-page details.word-disclosure summary{list-style:none}.book-page details.word-disclosure summary::-webkit-details-marker{display:none}.book-page details.word-disclosure:not([open]) .disclosure-chevron{display:inline-block;transform:rotate(-90deg)}
.book-page details.ocr-disclosure summary{list-style:none}.book-page details.ocr-disclosure summary::-webkit-details-marker{display:none}.book-page details.ocr-disclosure summary::before{content:'▼';display:inline-block;margin-right:.3em}.book-page details.ocr-disclosure:not([open]) summary::before{transform:rotate(-90deg)}
.book-page details.ocr-disclosure-structured .desc-panel ul{margin:0 0 .35em;padding-left:1.25em}.book-page details.ocr-disclosure-structured .desc-panel li{margin:.12em 0}
.book-page details.disclosure .desc-panel ul.word-nested-list{list-style-type:disc;margin:.5em 0;padding-left:1.5em}.book-page details.disclosure .desc-panel ul.word-nested-list ul{list-style-type:circle;margin:.2em 0 .65em;padding-left:1.5em}
.book-page .lg-badge{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;box-sizing:border-box;background:#A61F66;color:white;font-family:Arial,sans-serif;font-weight:700;line-height:1;white-space:nowrap}.book-page .lg-badge--lg-63{width:63pt;height:42pt;border-radius:6pt;font-size:28pt}.book-page .lg-badge--lg-70{width:70pt;height:45pt;border-radius:13.5pt;font-size:26pt}.book-page .lg-question{display:flex;align-items:center;gap:3pt;font-weight:700}
.book-page .figure-info-icon{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:25pt;height:25pt;border-radius:50%;background:#000;color:#fff;font-family:Arial,sans-serif;font-weight:700;font-size:17pt;line-height:1}
.book-page details.ocr-disclosure summary .figure-info-icon{margin-left:.3em}
.book-page .swot-0605{position:relative;margin:0;width:100%;aspect-ratio:2890/1420;container-type:inline-size;background:#fff;overflow:visible}
.book-page .swot-0605 .factor,.book-page .swot-0605 .card,.book-page .swot-0605 .icon,.book-page .swot-0605 .credit{position:absolute;box-sizing:border-box}
.book-page .swot-0605 .factor{display:flex;align-items:center;justify-content:center;border-radius:2.1cqw;background:#004282;color:#fff;font-weight:700;font-size:3.25cqw;line-height:1}
.book-page .swot-0605 .card{border:.32cqw solid var(--card-color);border-radius:2.1cqw;overflow:hidden;background:#fff}.book-page .swot-0605 .positive{--card-color:#136B61}.book-page .swot-0605 .negative{--card-color:#B82025}
.book-page .swot-0605 .card-head{height:37.2%;display:flex;align-items:center;justify-content:center;flex-direction:column;background:var(--card-color);color:#fff}.book-page .swot-0605 .card-head strong{font-size:6.25cqw;line-height:1;font-weight:700}.book-page .swot-0605 .card-head span{font-size:2.42cqw;line-height:1.2}.book-page .swot-0605 .card-body{height:62.8%;background:#fff}
.book-page .swot-0605 .icon{margin:0;height:auto;z-index:1}.book-page .swot-0605 .credit{left:96.72%;top:50%;transform:translateY(-50%) rotate(180deg);writing-mode:vertical-rl;white-space:nowrap;font-size:1.53cqw;color:#252525}
.book-page .source-composition-0542,.book-page .source-composition-0678{display:block;width:100%;max-width:100%;margin:3pt auto;background:#fff}
.book-page .source-composition-0542 svg,.book-page .source-composition-0678 svg{display:block;width:100%;height:auto;margin:0}
.book-page .source-composition-0542 svg text,.book-page .source-composition-0678 svg text{user-select:text;-webkit-user-select:text}
.book-page .source-composition-0678 .axis-label{font:47px Arial,sans-serif;fill:#2d2d2d}.book-page .source-composition-0678 .state-label{font:47px Arial,sans-serif;fill:#232323}.book-page .source-composition-0678 .publisher-credit{font:45px Arial,sans-serif;fill:#3c3c3c}
.book-page .source-composition-0776{position:relative;container-type:inline-size;width:100%;aspect-ratio:2635/1155;background:#fff;overflow:visible;color:#111;margin:3pt auto}
.book-page .source-composition-0776>*{position:absolute}.book-page .source-composition-0776 .plot{left:11.650854%;top:5.021645%;width:81.138520%;height:68.138528%;display:block;margin:0;max-width:none;object-fit:fill}
.book-page .source-composition-0776 .legend{left:15.370019%;top:7.272727%;width:12.903226%;height:18.441558%;background:#fff;border:.09cqw solid #222;box-shadow:.25cqw .35cqw .55cqw #0005;padding:.5cqw .7cqw;display:flex;flex-direction:column;justify-content:center;gap:.55cqw}
.book-page .source-composition-0776 .legend-row{position:static;display:flex;align-items:center;gap:.65cqw;font:2.3cqw/1 Arial,sans-serif;white-space:nowrap}.book-page .source-composition-0776 .swatch{display:inline-block;flex:none;width:2.1cqw;height:2.1cqw;border:.12cqw solid #222;box-shadow:.1cqw .1cqw .15cqw #0006}
.book-page .source-composition-0776 .y-tick{transform:translate(-100%,-50%);font:2.2cqw/1 Arial,sans-serif;white-space:nowrap}.book-page .source-composition-0776 .x-tick{transform:translate(-50%,0);font:2.2cqw/1 Arial,sans-serif;white-space:nowrap}
.book-page .source-composition-0776 .year{left:52.333966%;top:85.800866%;transform:translateX(-50%);font:700 2.65cqw/1 Arial,sans-serif}.book-page .source-composition-0776 .credit{left:96.850095%;top:30.735931%;transform:translate(-50%,-50%) rotate(-90deg);font:1.95cqw/1 Arial,sans-serif;white-space:nowrap}
.mobile-diagram-scroll{max-width:100%}.drawer-close{display:none}.qa-fail{outline:3px solid #d20}@media print{body{background:white}.app{display:block;height:auto}aside,.toolbar{display:none}main{height:auto;padding:0;overflow:visible}.book-page{width:100%;margin:0;box-shadow:none;break-after:auto}}
@media screen and (max-width:850px){.app{display:block}.app aside{position:fixed;top:0;bottom:0;z-index:8;width:min(82vw,280px);box-shadow:0 0 20px #777}.app aside.right{right:0}.app.left-closed aside.left,.app.right-closed aside.right{display:none}main{height:100vh}.book-page{padding:clamp(16px,4vw,14mm)}.drawer-close{display:block;position:sticky;top:0;float:right;z-index:1;min-width:44px;min-height:44px}.mobile-diagram-scroll{overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain}.mobile-diagram-scroll>.swot-0605,.mobile-diagram-scroll>.source-composition-0776,.mobile-diagram-scroll>.source-composition-0844{min-width:720px}}
'''
JS='''
const app=document.querySelector('.app'),main=document.querySelector('main'),pages=[...document.querySelectorAll('.book-page')];
const counter=document.querySelector('#counter'),search=document.querySelector('#search');
const leftToggle=document.querySelector('#left-toggle'),leftClose=document.querySelector('#left-close');
const rightToggle=document.querySelector('#right-toggle'),rightClose=document.querySelector('#right-close');
function setLeftOpen(open){app.classList.toggle('left-closed',!open);leftToggle.setAttribute('aria-expanded',String(open))}
leftToggle.onclick=()=>setLeftOpen(app.classList.contains('left-closed'));
leftClose.onclick=()=>{setLeftOpen(false);leftToggle.focus()};
function setRightOpen(open){app.classList.toggle('right-closed',!open);rightToggle.setAttribute('aria-expanded',String(open))}
rightToggle.onclick=()=>setRightOpen(app.classList.contains('right-closed'));
rightClose.onclick=()=>{setRightOpen(false);rightToggle.focus()};
let current=0;
function setCurrent(i){current=i;counter.textContent=(current+1)+' / '+pages.length}
let scrollFrame=0,scrollHeld=false,scrollHoldTimer=0;
function queueScrollSync(){if(!scrollFrame)scrollFrame=requestAnimationFrame(syncVisiblePage)}
function syncVisiblePage(){
  scrollFrame=0;if(scrollHeld||!pages.length)return;
  const top=Math.max(main.getBoundingClientRect().top,document.querySelector('.toolbar').getBoundingClientRect().bottom);
  let lo=0,hi=pages.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(pages[mid].getBoundingClientRect().top<=top+1)lo=mid+1;else hi=mid}
  const i=Math.max(0,lo-1);if(i!==current)setCurrent(i);
}
function releaseScrollSync(){if(!scrollHeld)return;scrollHeld=false;clearTimeout(scrollHoldTimer);queueScrollSync()}
function holdScrollSync(){scrollHeld=true;clearTimeout(scrollHoldTimer);scrollHoldTimer=setTimeout(releaseScrollSync,1200)}
main.addEventListener('scroll',queueScrollSync,{passive:true});
main.addEventListener('scrollend',releaseScrollSync);
for(const event of ['wheel','touchstart','pointerdown'])main.addEventListener(event,releaseScrollSync,{passive:true});
function move(n){if(!pages.length)return;setCurrent(Math.max(0,Math.min(pages.length-1,current+n)));holdScrollSync();pages[current].scrollIntoView({block:'start'})}
document.querySelector('#prev').onclick=()=>move(-1);document.querySelector('#next').onclick=()=>move(1);
function indexFromHash(){const id=location.hash.slice(1);return pages.findIndex(p=>p.id===id)}
function syncFromHash(){const i=indexFromHash();if(i>=0){setCurrent(i);holdScrollSync()}}
document.querySelector('nav').addEventListener('click',e=>{const link=e.target.closest('a[href^="#TMP-"]');if(!link)return;const i=pages.findIndex(p=>p.id===link.getAttribute('href').slice(1));if(i>=0){setCurrent(i);holdScrollSync()}if(matchMedia('(max-width:850px)').matches){setLeftOpen(false);if(i>=0){pages[i].setAttribute('tabindex','-1');pages[i].focus({preventScroll:true})}else leftToggle.focus()}});
window.addEventListener('hashchange',syncFromHash);syncFromHash();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!app.classList.contains('right-closed')){setRightOpen(false);rightToggle.focus();return}if(e.key==='Escape'&&!app.classList.contains('left-closed')){setLeftOpen(false);leftToggle.focus();return}if(e.target.matches('input'))return;if(e.key==='ArrowRight')move(1);if(e.key==='ArrowLeft')move(-1)});
const searchStatus=document.createElement('span');searchStatus.setAttribute('role','status');searchStatus.style.fontSize='12px';search.after(searchStatus);
function textContainer(node,page){
  for(let el=node.parentElement;el&&el!==page;el=el.parentElement)
    if(/^(P|LI|TD|TH|DD|DT|H[1-6]|SUMMARY|FIGCAPTION|CAPTION|PRE|BLOCKQUOTE|DETAILS|DIV|SECTION|TEXT|TITLE)$/.test(el.tagName.toUpperCase()))return el;
  return page;
}
function findMatch(page,q){
  const walker=document.createTreeWalker(page,NodeFilter.SHOW_TEXT);let node,container=null,content='';
  while((node=walker.nextNode())){
    const next=textContainer(node,page);
    if(next!==container){if(container&&content.toLocaleLowerCase().includes(q))return container;container=next;content=''}
    content+=node.textContent;
  }
  return container&&content.toLocaleLowerCase().includes(q)?container:null;
}
function revealMatch(match,page){for(let el=match;el&&el!==page;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true}
let searchRun=0;
search.oninput=e=>{
  const q=e.target.value.trim().toLocaleLowerCase(),run=++searchRun;
  if(q.length<2){searchStatus.textContent='';return}
  searchStatus.textContent='Searching…';let i=0;
  function scan(){
    if(run!==searchRun)return;
    const stop=Math.min(i+20,pages.length);
    for(;i<stop;i++){
      const page=pages[i];if(!page.textContent.toLocaleLowerCase().includes(q))continue;
      const match=findMatch(page,q);if(!match)continue;
      revealMatch(match,page);setCurrent(i);move(0);searchStatus.textContent='Match in '+page.id;return;
    }
    if(i<pages.length)setTimeout(scan,0);else searchStatus.textContent='No match';
  }
  scan();
};
document.querySelector('#zoom').oninput=e=>document.documentElement.style.setProperty('--body-size',(11*Number(e.target.value)/100)+'pt');
function qa(){const failures=[];if(document.documentElement.scrollWidth>document.documentElement.clientWidth+1)failures.push({kind:'document-horizontal'});if(main.scrollWidth>main.clientWidth+1)failures.push({kind:'viewer-horizontal'});for(const p of pages){const r=p.getBoundingClientRect();if(p.scrollWidth>p.clientWidth+1)failures.push({id:p.id,kind:'section-horizontal',dx:p.scrollWidth-p.clientWidth});for(const d of p.querySelectorAll('p,table,img,svg,figure,figcaption,details,.desc-panel,.mobile-diagram-scroll')){if(d.closest('.mobile-diagram-scroll')&& !d.classList.contains('mobile-diagram-scroll'))continue;const closed=d.closest('details:not([open])');if(closed&&d!==closed&&!d.closest('summary'))continue;if(d.getClientRects().length===0)continue;const x=d.getBoundingClientRect();if(x.left<r.left-1||x.right>r.right+1||x.top<r.top-1||x.bottom>r.bottom+1){failures.push({id:p.id,kind:'visible-content-outside-section',tag:d.tagName});break}}}return failures}
window.book2QA=qa;document.querySelector('#qa').onclick=()=>{const a=qa();document.querySelector('#qa-status').textContent=a.length?a.length+' layout failures; see console':'No outer-page overflow in checked elements; inspect internal diagrams separately';console.table(a)};
'''

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--output',default=str(WORK/'prototype.html'))
    ap.add_argument('--pages',default='')
    args=ap.parse_args()
    wanted={int(x) for x in args.pages.split(',') if x.strip()}
    outfile=Path(args.output)
    if outfile.resolve() in {(ROOT/'Book-2.html').resolve(), (ROOT/'AP Book Final.html').resolve()}:
        status=json.loads((WORK/'current_status.json').read_text(encoding='utf-8'))
        if status.get('status') != 'COMPLETE_VERIFIED':
            raise SystemExit('Refusing authoritative final HTML: source fidelity, canonical grouping, structural layout, and offline QA remain unverified.')
    outfile.parent.mkdir(parents=True,exist_ok=True)
    with outfile.open('w',encoding='utf-8') as f:
        late_graphic_css=(WORK/'late_graphics_wave2.css').read_text(encoding='utf-8')
        f.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Book 2 candidate reader</title><style>'+CSS+late_graphic_css+'</style></head><body><div class="app left-closed right-closed"><aside class="left"><button id="left-close" class="drawer-close" aria-label="Close contents">×</button><h2>Source order</h2><nav>')
        selected=[]
        ordinal=0
        for batch in INV['batches']:
            schema,segments,doc=load_batch(batch)
            if len(segments)!=batch['source_png_count']:
                print('WARNING missing segments',batch['batch'],len(segments),batch['source_png_count'])
                ordinal+=batch['source_png_count'];continue
            nav=[]
            for seg in segments:
                ordinal+=1
                if wanted and ordinal not in wanted:continue
                nav.append(f'<a href="#TMP-{ordinal:04d}">TMP-{ordinal:04d}</a>')
                selected.append((ordinal,batch,schema,seg,doc))
            if nav:f.write(f'<details class="nav-batch"><summary>{esc(batch["batch"])}</summary>'+''.join(nav)+'</details>')
        f.write('</nav></aside><main><div class="toolbar"><button id="left-toggle" aria-label="Toggle contents" aria-expanded="false">☰</button><button id="prev">‹</button><span id="counter">1 / '+str(len(selected))+'</span><button id="next">›</button><input id="search" type="search" placeholder="Search text"><button id="right-toggle" aria-controls="reader-controls" aria-expanded="false">Controls</button></div>')
        last_doc=None;media=None
        for ordinal,batch,schema,seg,doc in selected:
            if doc!=last_doc:
                if media:media.close()
                media=Media(doc);last_doc=doc
            if schema=='early':inner=early_blocks(seg.get('blocks',[]),media)
            elif schema=='middle':inner=middle_blocks(seg.get('blocks',[]),media)
            elif schema=='late':inner=late_blocks(seg.get('blocks',[]),media)
            elif schema=='fidelity':inner=fidelity_elements(seg.get('elements',[]))
            elif schema=='ocr':inner=ocr_lines(seg)
            else:inner=''
            f.write(f'<article class="book-page" id="TMP-{ordinal:04d}" data-source="{esc(batch["batch"])}" data-status="UNVERIFIED"><span class="ref">TMP-{ordinal:04d}</span><div class="content">{inner}</div></article>')
            if ordinal%100==0:print('wrote',ordinal,flush=True)
        if media:media.close()
        f.write('</main><aside class="right" id="reader-controls"><button id="right-close" class="drawer-close" aria-label="Close controls">×</button><h2>Reader</h2><label>Default text size <input id="zoom" type="range" min="70" max="130" value="100"></label><p><button id="qa">Check layout</button></p><p class="status" id="qa-status">Candidate sections are unverified.</p></aside></div><script>'+JS+'</script></body></html>')
    print(outfile,outfile.stat().st_size,len(selected))

if __name__=='__main__':main()
