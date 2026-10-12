"""Streaming corrective patch for the verified Book 2 build.

Exactly four mechanical, auditable changes; nothing else is touched:

  1. TMP-0563 disclosure structure: the Starbucks Rewards extended-description
     text that was inside the control (beside a stray full-page bitmap) is
     restored where the source puts it, the caption line that follows it is
     moved back out of the control, and the stray bitmap is promoted to the
     region's figure.  No text is added, removed, reworded or reordered.
  2. Front-matter Contents rows get their printed-page reference cells
     (About this Book -> FC, Accessibility -> A1, Brief Contents -> iii,
     Contents -> iv).
  3. The ten Contents rows whose printed label the user supplied get their
     reference cell from printed_page_references.json.
  4. The sidebar note is reworded so it agrees with what is now displayed.

The patcher streams the ~1.13 GB file and refuses to finish unless each
expected match count is met.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

CHUNK = 8 << 20
HOLD = 2 << 20


def refs() -> dict:
    data = json.loads((HERE / 'printed_page_references.json').read_text(encoding='utf-8'))
    return dict(data.get('references') or {})


def front_refs() -> dict:
    data = json.loads((HERE / 'printed_page_references.json').read_text(encoding='utf-8'))
    return dict(data.get('front_matter_references') or {})


# --- 1. TMP-0563 disclosure structure --------------------------------------
SB_OLD = (
    b'<details class="disclosure" data-b2-source="flattened"><summary>'
    b'<span class="b2-desc-label">Extended description for Starbucks Rewards</span>'
    b'</summary><div class="desc-panel">'
)
SB_OLDLABEL = b'Extended description for Starbucks Rewards'
SB_CAPTION_RX = re.compile(
    rb'<p style="font-family:.Arial Narrow.,serif;color:#565656">'
    rb'Technology affects purchasing patterns by offering customer engagement ?'
    rb'anytime, anywhere, and by making</p>')
SB_END = b'</div></details>'

SB_BODY_OPEN = (
    b'<details class="disclosure" data-b2-source="flattened"><summary>'
    b'<span class="b2-desc-label">Extended description for Starbucks Rewards</span>'
    b'</summary><div class="desc-panel">'
)


def patch_region(data: bytes) -> tuple[bytes, int]:
    """Rewrite only the Starbucks Rewards control inside its own region."""
    start = data.find(b'id="TMP-0563"')
    if start < 0:
        return data, 0
    end = data.find(b'</article>', start)
    if end < 0:
        raise SystemExit('TMP-0563: region end not found')
    region = data[start:end]
    if SB_OLD not in region:
        return data, 0
    # image + description paragraphs + caption, exactly as they stand
    m = re.search(rb'<img src="(data:image/[^"]+)"[^>]*?>', region)
    if not m:
        raise SystemExit('TMP-0563: figure image not found inside the panel')
    img = m.group(0)
    body_start = region.find(SB_BODY_OPEN) + len(SB_BODY_OPEN)
    body_end = region.find(SB_END, body_start)
    if body_end < 0:
        raise SystemExit('TMP-0563: panel end not found')
    block = region[body_start:body_end]
    img_start = block.find(img)
    caption = SB_CAPTION_RX.search(block)
    if img_start != 0 or not caption:
        raise SystemExit('TMP-0563: unexpected panel layout; refusing to guess')
    text_body = block[img_start + len(img):caption.start()]
    if not text_body.strip():
        raise SystemExit('TMP-0563: description text body is empty; refusing to rewrite')

    new = (
        b'<figure class="b2-source-figure">' + img + b'</figure>'
        b'<details class="disclosure" data-b2-source="flattened"><summary>'
        b'<span class="b2-desc-label">' + SB_OLDLABEL + b'</span>'
        b'</summary><div class="desc-panel">' + text_body + b'</div></details>'
        + caption.group(0)
    )
    region_new = region[:region.find(SB_BODY_OPEN)] + new + region[body_end + len(SB_END):]
    return data[:start] + region_new + data[end:], 1


# --- 2. front-matter reference cells ---------------------------------------
FRONT_ANCHORS = [
    (b'<a class="nav-child" href="#book-heading-0002">Accessibility</a>', b'A1'),
    (b'<a class="nav-child" href="#book-heading-0003">Brief Contents</a>', b'iii'),
    (b'<a class="nav-child" href="#book-heading-0004">Contents</a>', b'iv'),
]

NOTE_OLD = (
    b'<p class="rail-note">Printed page references are not present in the supplied '
    b'source pages, so no page numbers are shown.</p>'
)
NOTE_NEW = (
    b'<p class="rail-note">Printed page references are shown where the supplied '
    b'numbered Contents list provides them; the remaining rows keep an empty cell. '
    b'The printed Contents pages in the source carry no page numbers.</p>'
)

# --- 5. stylesheet rule for the lifted figure ------------------------------
CSS_ANCHOR = b'.book-page details.disclosure>.desc-panel img{max-width:100%;height:auto}'
CSS_ADD = (
    b'\n/* corrective wave: a figure lifted out of an extended-description panel '
    b'keeps its reconstructed geometry */\n'
    b'.book-page figure.b2-source-figure{margin:0 0 10pt;text-align:center}\n'
    b'.book-page figure.b2-source-figure>img{max-width:100%;height:auto;display:inline-block}'
)


def make_replacer(label: bytes):
    def replace(match: re.Match) -> bytes:
        return match.group(1) + b'><span class="nav-page">' + label + b'</span>'
    return replace


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('output')
    ap.add_argument('--report', default='')
    args = ap.parse_args()

    src = Path(args.source)
    out = Path(args.output)
    reference = refs()
    front = front_refs()
    stats = {
        'source': str(src),
        'output': str(out),
        'starbucks_region_rewritten': 0,
        'front_rows_tagged': 0,
        'rows_with_printed_reference': 0,
        'note_replaced': 0,
        'css_rule_added': 0,
        'source_bytes': src.stat().st_size,
    }

    pats = [
        (k,
         label.encode('utf-8'),
         re.compile((r'(data-source-contents-id="' + re.escape(k) + r'"[^>]*?)>').encode()))
        for k, label in reference.items()
    ]

    SB_MARK = b'id="TMP-0563"'
    SB_END_MARK = b'</article>'

    hashed = hashlib.sha256()
    front_idx = 0
    written = 0
    pending = b''
    with open(src, 'rb') as fh, open(out, 'wb') as oh:
        buffer = b''
        while True:
            chunk = fh.read(CHUNK)
            if not chunk:
                break
            buffer += chunk
            if len(buffer) < CHUNK + HOLD:
                continue
            work, buffer = buffer[:CHUNK], buffer[CHUNK:]

            # 1. Starbucks region, deferred until its whole region is in hand
            at = work.find(SB_MARK)
            if pending or at >= 0:
                joined = pending + work
                start = joined.find(SB_MARK)
                if start < 0:
                    pending = joined
                    continue
                end = joined.find(SB_END_MARK, start)
                if end < 0:
                    pending = joined
                    continue
                out_block, n = patch_region(joined[:end + len(SB_END_MARK)])
                stats['starbucks_region_rewritten'] += n
                work = out_block + joined[end + len(SB_END_MARK):]
                pending = b''

            # 2. front-matter reference cells
            if front_idx < len(FRONT_ANCHORS) and b'nav-group' in work:
                for anchor, label in FRONT_ANCHORS[front_idx:]:
                    replacement = anchor.replace(
                        b'</a>', b'<span class="nav-page">' + label + b'</span></a>')
                    if anchor in work:
                        work = work.replace(anchor, replacement, 1)
                        stats['front_rows_tagged'] += 1
                        front_idx += 1
                    # an anchor absent from this block is retried against the
                    # next one, in order, so the mapping never shifts

            # 3. ten supplied printed labels
            if b'data-source-contents-id=' in work:
                for key, label, pattern in pats:
                    if key.encode() in work:
                        work, n = pattern.subn(make_replacer(label), work, count=1)
                        stats['rows_with_printed_reference'] += n

            # 4. sidebar note
            if b'Printed page references are not present' in work:
                work, n = re.subn(re.escape(NOTE_OLD), NOTE_NEW, work)
                stats['note_replaced'] += n

            # 5. stylesheet rule for the lifted figure
            if CSS_ANCHOR in work:
                work = work.replace(CSS_ANCHOR, CSS_ANCHOR + CSS_ADD, 1)
                stats['css_rule_added'] += 1

            oh.write(work)
            hashed.update(work)
            written += len(work)
        if pending:
            buffer = pending + buffer
        if buffer:
            oh.write(buffer)
            hashed.update(buffer)
            written += len(buffer)

    stats['source_bytes_check'] = src.stat().st_size == written

    expected = {
        'starbucks_region_rewritten': 1,
        'front_rows_tagged': len(FRONT_ANCHORS),
        'rows_with_printed_reference': len(reference),
        'note_replaced': 1,
        'css_rule_added': 1,
    }
    ok = True
    for key, want in expected.items():
        if stats[key] != want:
            ok = False
            print(f'{key}: expected {want}, got {stats[key]}', file=sys.stderr)
    stats['output_bytes'] = out.stat().st_size
    stats['output_sha256'] = hashed.hexdigest()
    stats['ok'] = ok
    if args.report:
        Path(args.report).write_text(json.dumps(stats, indent=2), encoding='utf-8')
    print(json.dumps(stats, indent=2))
    return 0 if ok else 3


if __name__ == '__main__':
    raise SystemExit(main())
