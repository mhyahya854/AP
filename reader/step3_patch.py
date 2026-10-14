"""Step 3 patcher: exact Contents navigation.

Four narrowly scoped edits, each asserted before anything is written:

  1. insert reader/ui3.css immediately before the head stylesheet's closing
     </style> (last in the cascade, so it wins every scroll-margin tie);
  2. turn the verified held Contents rows listed in
     reports/contents_navigation/link_additions.json into real links (their
     destination element already exists, so no region is touched);
  3. replace the body of the inline reader/ui2.js script with the new
     reader/ui2.js (which adds the section-lookup hooks);
  4. insert a fifth inline script, reader/ui3.js, immediately before </body>.

No article region, no source word, no image and no other stylesheet rule is
touched.  Pass 1 verifies and locates over the whole file; pass 2 writes the
head from memory (where every sidebar row lives) and streams everything else.
usage: python reader/step3_patch.py <in.html> <out.html> [report.json]
"""
import hashlib
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLOCK = 8 << 20

UI2_MARKER = b'/* ===== Book 2 reader semantics + mobile drawer layer'
UI3_MARKER = b'/* ===== Book 2 step 3: exact Contents navigation'
CSS_MARKER = b'/* ===== Book 2 step 3: exact Contents landing'
STYLE_TAIL = b'.book-page .b2-h[data-b2-level="4"]{font-size:14pt!important;color:#3b3b3b}'
ART = b'<article class="book-page" id="TMP-'
HEAD_WINDOW = 400_000      # the reader shell (styles, sidebars) is < 200 kB


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for blk in iter(lambda: fh.read(BLOCK), b''):
            h.update(blk)
    return h.hexdigest()


def locate(src, pairs):
    """stream the file once and return the byte offsets of the three edits"""
    found = {'style_open': None, 'style_close': None, 'ui2_open': None, 'ui2_close': None,
             'body_close': None}
    counts = {'style_open': 0, 'style_close': 0, 'ui2_script': 0, 'body_close': 0, 'ui2_close': 0,
              'regions': 0, 'ui3_marker': 0, 'ui3_css': 0, 'link_rows': 0}
    pair_hits = [0] * len(pairs)
    pair_offsets = [None] * len(pairs)
    buf = b''
    base = 0
    KEEP = 4096
    with open(src, 'rb') as fh:
        while True:
            chunk = fh.read(BLOCK)
            if not chunk:
                break
            buf += chunk
            limit = max(0, len(buf) - KEEP)
            body = buf[:limit]
            search = 0
            while True:
                i = body.find(b'<style>', search)
                if i < 0:
                    break
                counts['style_open'] += 1
                if found['style_open'] is None:
                    found['style_open'] = base + i
                search = i + 1
            if found['style_open'] is not None and found['style_close'] is None:
                i = body.find(b'</style>', max(0, found['style_open'] - base))
                if i >= 0:
                    counts['style_close'] += 1
                    found['style_close'] = base + i
            search = 0
            while True:
                i = body.find(UI2_MARKER, search)
                if i < 0:
                    break
                counts['ui2_script'] += 1
                if found['ui2_open'] is None:
                    j = body.rfind(b'<script>', 0, i)
                    found['ui2_open'] = base + j + len(b'<script>')
                search = i + 1
            if found['ui2_open'] is not None and found['ui2_close'] is None:
                i = body.find(b'</script>', max(0, found['ui2_open'] - base))
                if i >= 0:
                    counts['ui2_close'] += 1
                    found['ui2_close'] = base + i
            if found['body_close'] is None:
                i = body.find(b'</body>')
                if i >= 0:
                    counts['body_close'] += 1
                    found['body_close'] = base + i
            counts['ui3_marker'] += body.count(UI3_MARKER)
            counts['ui3_css'] += body.count(CSS_MARKER)
            for pi, (old, _new) in enumerate(pairs):
                pos = 0
                while True:
                    j = body.find(old, pos)
                    if j < 0:
                        break
                    pair_hits[pi] += 1
                    if pair_offsets[pi] is None:
                        pair_offsets[pi] = base + j
                    pos = j + 1
            search = 0
            while True:
                i = body.find(ART, search)
                if i < 0:
                    break
                counts['regions'] += 1
                search = i + 1
            base += limit
            buf = buf[limit:]
    # the trailing window (the loop only scanned up to len(buf) - KEEP)
    i = buf.find(b'</style>', max(0, (found['style_open'] or 0) - base))
    if i >= 0:
        counts['style_close'] += 1
        if found['style_close'] is None:
            found['style_close'] = base + i
    i = buf.find(b'</body>')
    if i >= 0:
        counts['body_close'] += 1
        if found['body_close'] is None:
            found['body_close'] = base + i
    if found['ui2_open'] is not None and found['ui2_close'] is None:
        i = buf.find(b'</script>', max(0, found['ui2_open'] - base))
        if i >= 0:
            counts['ui2_close'] += 1
            found['ui2_close'] = base + i
    counts['ui2_script'] += buf.count(UI2_MARKER)
    counts['ui3_marker'] += buf.count(UI3_MARKER)
    counts['ui3_css'] += buf.count(CSS_MARKER)
    counts['regions'] += buf.count(ART)
    for pi, (old, _new) in enumerate(pairs):
        j = buf.find(old)
        if j >= 0:
            pair_hits[pi] += 1
            if pair_offsets[pi] is None:
                pair_offsets[pi] = base + j
    return found, counts, len(buf) + base, pair_hits, pair_offsets


def main():
    src, out = sys.argv[1], sys.argv[2]
    report_path = sys.argv[3] if len(sys.argv) > 3 else os.path.join(
        BASE, 'reports/contents_navigation/patch_report.json')
    ui3_css = open(os.path.join(BASE, 'reader/ui3.css'), 'rb').read()
    ui3_js = open(os.path.join(BASE, 'reader/ui3.js'), 'rb').read()
    ui2_js = open(os.path.join(BASE, 'reader/ui2.js'), 'rb').read()
    adds = json.load(open(os.path.join(BASE, 'reports/contents_navigation/link_additions.json'), encoding='utf-8'))
    pairs = [(a['old'].encode('utf-8'), a['new'].encode('utf-8')) for a in adds['additions']]
    src_bytes = os.path.getsize(src)
    src_sha = sha256(src)

    found, counts, scanned, pair_hits, pair_offsets = locate(src, pairs)
    problems = []
    if counts['regions'] != 1899 and src_bytes > 100_000_000:
        problems.append('expected 1899 article regions, found %d' % counts['regions'])
    if counts['style_open'] < 1 or found['style_close'] is None:
        problems.append('head stylesheet not found')
    if counts['ui2_script'] != 1:
        problems.append('reader/ui2.js marker occurrences: %d' % counts['ui2_script'])
    if counts['ui2_close'] != 1:
        problems.append('ui2 closing tag occurrences: %d' % counts['ui2_close'])
    if counts['body_close'] != 1:
        problems.append('</body> occurrences: %d' % counts['body_close'])
    if counts['ui3_marker'] or counts['ui3_css']:
        problems.append('the step-3 layer is already present')
    for i, h in enumerate(pair_hits):
        if h != 1:
            problems.append('link addition %d (%s) occurs %d times'
                            % (i, adds['additions'][i]['source_id'], h))
    for i, off in enumerate(pair_offsets):
        if off is not None and off >= HEAD_WINDOW:
            problems.append('link addition %d is outside the shell window (%d)' % (i, off))
    if found['style_close'] is not None:
        with open(src, 'rb') as fh:
            fh.seek(found['style_close'] - len(STYLE_TAIL) - 2)
            ctx = fh.read(len(STYLE_TAIL) + 8)
        if STYLE_TAIL not in ctx:
            problems.append('unexpected stylesheet tail: %r' % ctx)
    with open(src, 'rb') as fh:
        fh.seek(found['ui2_open'] if found['ui2_open'] else 0)
        ui2_body_start = found['ui2_open']
        old_ui2 = fh.read(found['ui2_close'] - ui2_body_start)
    old_ui2_sha = hashlib.sha256(old_ui2).hexdigest()
    if not old_ui2.startswith(b'\n'):
        problems.append('ui2 body does not start with a newline: %r' % old_ui2[:20])
    if problems:
        raise SystemExit('refusing to write:\n - ' + '\n - '.join(problems))

    new_ui2 = b'\n' + ui2_js
    new_ui3_block = b'<script>\n' + ui3_js + b'\n</script>\n'
    css_block = b'\n' + ui3_css
    counts['link_rows'] = len(pairs)

    stamps = {
        'style_close': found['style_close'],
        'ui2_open': found['ui2_open'],
        'ui2_close': found['ui2_close'],
        'body_close': found['body_close'],
    }
    applied = 0
    with open(src, 'rb') as fin, open(out, 'wb') as fout:
        head = fin.read(HEAD_WINDOW)
        if len(head) != HEAD_WINDOW:
            raise SystemExit('source shorter than the shell window')
        # 1. the verified held rows become real links
        for a in adds['additions']:
            old = a['old'].encode('utf-8')
            new = a['new'].encode('utf-8')
            if head.count(old) != 1:
                raise SystemExit('link addition %s not uniquely present in the shell'
                                 % a['source_id'])
            head = head.replace(old, new)
            applied += 1
        # 2. the landing stylesheet, last in the cascade
        if head.count(b'</style>') != 1:
            raise SystemExit('expected exactly one </style> in the shell window')
        head = head.replace(b'</style>', css_block + b'</style>')
        fout.write(head)
        # 3. copy the book body through to the ui2 script, untouched
        fin.seek(HEAD_WINDOW)
        remaining = found['ui2_open'] - HEAD_WINDOW
        while remaining > 0:
            blk = fin.read(min(BLOCK, remaining))
            if not blk:
                raise SystemExit('short read copying the book body')
            fout.write(blk)
            remaining -= len(blk)
        # 4. the new reader/ui2.js body
        fin.seek(found['ui2_open'])
        remaining = found['ui2_close'] - found['ui2_open']
        while remaining > 0:
            blk = fin.read(min(BLOCK, remaining))
            if not blk:
                raise SystemExit('short read in the ui2 body')
            remaining -= len(blk)
        fout.write(new_ui2)
        # 5. the fifth script, then the rest of the file
        fin.seek(found['ui2_close'])
        pos = found['ui2_close']
        remaining = found['body_close'] - pos
        while remaining > 0:
            blk = fin.read(min(BLOCK, remaining))
            if not blk:
                raise SystemExit('short read before </body>')
            fout.write(blk)
            remaining -= len(blk)
        fout.write(new_ui3_block)
        fin.seek(found['body_close'])
        while True:
            blk = fin.read(BLOCK)
            if not blk:
                break
            fout.write(blk)
    out_bytes = os.path.getsize(out)
    out_sha = sha256(out)
    report = {
        'schema': 'book2.step3.patch_report.v1',
        'source': src, 'source_bytes': src_bytes, 'source_sha256': src_sha,
        'target': out, 'target_bytes': out_bytes, 'target_sha256': out_sha,
        'offsets': stamps,
        'counts': counts,
        'inserted': {'ui3_css_bytes': len(css_block), 'ui2_body_bytes': len(new_ui2),
                     'old_ui2_body_bytes': len(old_ui2), 'old_ui2_body_sha256': old_ui2_sha,
                     'ui3_script_block_bytes': len(new_ui3_block),
                     'link_rows_linked': applied},
        'expected_size_delta': (len(css_block) + len(new_ui2) - len(old_ui2) + len(new_ui3_block)
                                + sum(len(n) - len(o) for o, n in pairs)),
        'actual_size_delta': out_bytes - src_bytes,
        'link_targets': sorted({a['target_region'] for a in adds['additions']}),
    }
    with open(report_path, 'w', encoding='utf-8') as fh:
        json.dump(report, fh, indent=1)
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
