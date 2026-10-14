"""Step 3: one streaming pass over the 1.13 GB reader, producing an offline
index of everything the Contents audit needs:

  reports/contents_navigation/region_index.json
     per region: opening-tag attributes, plain text, heading anchors (id + tag),
     and the position of every internal fragment target.

The file is never held in memory; 8 MiB blocks are decoded with an incremental
UTF-8 decoder.

usage: python reader/step3_index.py "<artifact.html>" <outJson>
"""
import codecs
import json
import re
import sys

ART = '<article class="book-page" id="TMP-'
ART_END = '</article>'
VOID = {'br', 'img', 'hr', 'meta', 'link', 'input', 'col', 'area', 'base', 'source', 'wbr'}


def blocks(path, size=8 << 20):
    dec = codecs.getincrementaldecoder('utf-8')('replace')
    with open(path, 'rb') as fh:
        while True:
            chunk = fh.read(size)
            if not chunk:
                break
            yield dec.decode(chunk)
    tail = dec.decode(b'', True)
    if tail:
        yield tail


ENT = {'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
       '&nbsp;': ' ', '&#171;': '\u00ab', '&#187;': '\u00bb', '&#8217;': '\u2019',
       '&#8216;': '\u2018', '&#8220;': '\u201c', '&#8221;': '\u201d', '&#8212;': '\u2014',
       '&#8211;': '\u2013', '&#176;': '\u00b0'}


def unescape(s):
    for k, v in ENT.items():
        s = s.replace(k, v)
    return re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), s)


def plain(html):
    html = re.sub(r'<(script|style)\b.*?</\1>', ' ', html, flags=re.S | re.I)
    html = re.sub(r'<[^>]*>', '\u0001', html)
    txt = unescape(html).replace('\u0001', ' ')
    return re.sub(r'\s+', ' ', txt).strip()


def element_text(html, at, limit=20000):
    """text of the element whose opening tag contains offset `at`"""
    lt = html.rfind('<', 0, at)
    if lt < 0:
        return None, None, True
    gt = html.find('>', at)
    if gt < 0:
        return None, None, True
    tag = re.match(r'<\s*([a-zA-Z0-9]+)', html[lt:gt + 1])
    if not tag:
        return None, None, True
    name = tag.group(1).lower()
    if html[gt - 1:gt] == '/' or name in VOID:
        return name, '', False
    pos = gt + 1
    depth = 1
    end = min(len(html), pos + limit)
    for m in re.finditer(r'</?\s*([a-zA-Z0-9]+)[^>]*>', html[pos:end]):
        n = m.group(1).lower()
        if n != name:
            continue
        if html[pos + m.start() + 1] == '/':
            depth -= 1
            if depth == 0:
                return name, plain(html[pos:pos + m.start()]), False
        else:
            depth += 1
    return name, plain(html[pos:end]), True


def main():
    src, out = sys.argv[1], sys.argv[2]
    regions = {}
    order = []
    cur = None
    buf = ''
    carry_mark = 0
    for text in blocks(src):
        buf += text
        while True:
            if cur is None:
                i = buf.find(ART)
                if i < 0:
                    buf = buf[-64:]
                    break
                buf = buf[i:]
                q = buf.find('"', len(ART))
                rid = 'TMP-' + buf[len(ART):q]
                gt = buf.find('>')
                opening = buf[:gt + 1]
                cur = {'id': rid, 'opening': opening, 'body': ''}
                buf = buf[gt + 1:]
                order.append(rid)
                regions[rid] = cur
            e = buf.find(ART_END)
            if e < 0:
                cur['body'] += buf[:-64]
                buf = buf[-64:]
                break
            cur['body'] += buf[:e]
            cur = None
            buf = buf[e + len(ART_END):]
    if cur is not None:
        cur['body'] += buf

    out_regions = {}
    heading_ids = []
    id_counts = {}
    for rid in order:
        r = regions[rid]
        body = r['body']
        opening = r['opening']
        attrs = dict(re.findall(r'([a-zA-Z-]+)="([^"]*)"', opening))
        txt = plain(body)
        heads = []
        for m in re.finditer(r'id="(book-heading-\d+)"', body):
            htag, htext, trunc = element_text(body, m.start())
            heads.append({'id': m.group(1), 'tag': htag, 'text': (htext or '')[:400], 'truncated': trunc})
            heading_ids.append(m.group(1))
        for m in re.finditer(r'id="([^"]+)"', body):
            id_counts[m.group(1)] = id_counts.get(m.group(1), 0) + 1
        for m in re.finditer(r'id="([^"]+)"', opening):
            id_counts[m.group(1)] = id_counts.get(m.group(1), 0) + 1
        out_regions[rid] = {
            'groupIndex': attrs.get('data-group-index'),
            'groupTitle': attrs.get('data-group-title'),
            'navLabel': attrs.get('data-nav-label'),
            'status': attrs.get('data-status'),
            'source': attrs.get('data-source'),
            'chars': len(txt),
            'text': txt,
            'headings': heads,
            'groupAnchors': [m.group(1) for m in re.finditer(r'id="(book-group-\d+)"', body)],
            'otherIds': sorted(set(re.findall(r'id="([^"]+)"', body)) - {h['id'] for h in heads}
                              - set(re.findall(r'id="(book-group-\d+)"', body)))[:40],
            'sectionStarts': [m.group(1) for m in re.finditer(r'data-section-start="([^"]*)"', body)],
        }
    payload = {
        'schema': 'book2.step3.region_index.v1',
        'file': src,
        'order': order,
        'regions': out_regions,
        'headingIds': heading_ids,
        'idCounts': id_counts,
    }
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, ensure_ascii=False)
    print(json.dumps({'regions': len(order), 'headings': len(heading_ids),
                      'duplicateIds': sorted([k for k, v in id_counts.items() if v > 1])[:20],
                      'totalText': sum(v['chars'] for v in out_regions.values()),
                      'out': out}, indent=1))


if __name__ == '__main__':
    main()
