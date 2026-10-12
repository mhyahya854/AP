"""Build the browsable preview gallery for the 1,899 source captures.

For every capture it makes one labelled thumbnail; every 20 consecutive
captures become one contact sheet (in original capture order) so the whole
set stays readable on GitHub.  Every sheet links back to the full-resolution
original under `source_png/`.  The originals are never modified.

Usage: python build_source_previews.py <repo-root> <staging-json>
"""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

THUMB_W = 300
THUMB_H = 240
COLS = 4
ROWS = 5
PER_SHEET = COLS * ROWS
FONT_PATH = r'C:\Windows\Fonts\arial.ttf'


def font(size: int):
    try:
        return ImageFont.truetype(FONT_PATH, size)
    except Exception:  # noqa: BLE001
        return ImageFont.load_default()


def thumb(path: Path) -> Image.Image:
    with Image.open(path) as im:
        im = im.convert('RGB')
        im.thumbnail((THUMB_W, THUMB_H), Image.LANCZOS)
        canvas = Image.new('RGB', (THUMB_W, THUMB_H), 'white')
        canvas.paste(im, ((THUMB_W - im.width) // 2, (THUMB_H - im.height) // 2))
        return canvas


def main() -> int:
    repo = Path(sys.argv[1]).resolve()
    staging = json.loads(Path(sys.argv[2]).read_text(encoding='utf-8'))
    records = staging['records']

    sheets_dir = repo / 'docs' / 'source_previews'
    sheets_dir.mkdir(parents=True, exist_ok=True)
    label_font = font(15)
    id_font = font(14)
    head_font = font(20)

    cell_w = THUMB_W + 12
    cell_h = THUMB_H + 46
    sheets = []
    for start in range(0, len(records), PER_SHEET):
        group = records[start:start + PER_SHEET]
        width = COLS * cell_w
        height = 64 + ROWS * cell_h
        sheet = Image.new('RGB', (width, height), (250, 250, 252))
        draw = ImageDraw.Draw(sheet)
        first, last = group[0], group[-1]
        draw.text((12, 10),
                  f'Source captures {first["ordinal"]}:{last["ordinal"]}  '
                  f'({first["source_batch"]})  -  {len(records)} legitimate Book 2 captures in total',
                  fill=(20, 20, 24), font=head_font)
        draw.text((12, 38),
                  'thumbnail labelled with the real original filename and TMP identifier; '
                  'the full-resolution original stays in source_png/',
                  fill=(90, 96, 106), font=id_font)
        for column, rec in enumerate(group):
            row, col = divmod(column, COLS)
            x = col * cell_w + 6
            y = 64 + row * cell_h
            src = repo / rec['repo_path']
            with Image.open(src) as probe:
                w, h = probe.size
            sheet.paste(thumb(src), (x, y))
            draw.rectangle([x - 1, y - 1, x + THUMB_W, y + THUMB_H], outline=(210, 214, 220))
            draw.text((x, y + THUMB_H + 4), rec['original_filename'],
                      fill=(15, 15, 18), font=label_font)
            draw.text((x, y + THUMB_H + 22),
                      f'{rec["tmp_identifier"]}  {w}x{h}px  {rec["bytes"]/1e6:.2f} MB',
                      fill=(114, 120, 132), font=id_font)
        name = f'sheet-{group[0]["ordinal"]:04d}-{group[-1]["ordinal"]:04d}.jpg'
        out = sheets_dir / name
        sheet.save(out, format='JPEG', quality=82, optimize=True)
        sheets.append({
            'sheet': f'docs/source_previews/{name}',
            'from_ordinal': first['ordinal'],
            'to_ordinal': last['ordinal'],
            'count': len(group),
            'bytes': out.stat().st_size,
        })
        if len(sheets) % 10 == 0:
            print(f'  {len(sheets)} sheets')

    # browsable index
    rows_html = []
    for sheet in sheets:
        group = [r for r in records if sheet['from_ordinal'] <= r['ordinal'] <= sheet['to_ordinal']]
        links = ' &middot; '.join(
            f'<a href="../../{r["repo_path"]}">{r["original_filename"]}</a> ({r["tmp_identifier"]})'
            for r in group[:PER_SHEET])
        rows_html.append(
            '<section class="sheet">'
            f'<h3>Captures {sheet["from_ordinal"]}&ndash;{sheet["to_ordinal"]} '
            f'<span class="src">{group[0]["source_batch"]}</span></h3>'
            f'<a href="{sheet["sheet"].split("/")[-1]}"><img src="{sheet["sheet"].split("/")[-1]}" '
            f'alt="contact sheet {sheet["from_ordinal"]}-{sheet["to_ordinal"]}" loading="lazy"></a>'
            f'<p class="links">{links}</p>'
            '</section>')
    index = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Book 2 source captures - preview index</title><style>'
        'body{font:15px/1.5 Arial,Helvetica,sans-serif;margin:0;padding:28px;background:#f6f7f9;color:#16181d}'
        'h1{margin:0 0 6px;font-size:24px}.lead{margin:0 0 22px;color:#4b525e;max-width:70ch}'
        '.sheet{background:#fff;border:1px solid #e2e5ea;border-radius:8px;padding:16px 18px;margin:0 0 20px}'
        'h3{margin:0 0 10px;font-size:16px}.src{color:#7b8494;font-weight:400;font-size:13px}'
        'img{max-width:100%;height:auto;border:1px solid #e2e5ea;border-radius:4px;display:block}'
        '.links{font-size:12px;color:#5b6371;margin:10px 0 0;word-break:break-word}'
        'a{color:#0b5b8a}</style></head><body>'
        f'<h1>Book 2 &mdash; original source captures</h1>'
        f'<p class="lead">All {len(records)} legitimate original Book 2 PNG captures, in their '
        'verified reconstruction order. Each contact sheet shows '
        f'{PER_SHEET} consecutive captures with their real filenames and TMP identifiers and links '
        'back to the full-resolution original in <code>source_png/</code>. The contact sheets are '
        'previews only; the originals are stored unmodified.</p>'
        + '\n'.join(rows_html) + '</body></html>')
    (repo / 'docs' / 'source_previews' / 'index.html').write_text(index, encoding='utf-8')
    report = {'sheets': sheets, 'sheet_count': len(sheets), 'per_sheet': PER_SHEET,
              'index': 'docs/source_previews/index.html',
              'total_sheet_bytes': sum(s['bytes'] for s in sheets)}
    Path(sys.argv[3]).write_text(json.dumps(report, indent=1), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'sheets'}, indent=2))
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    raise SystemExit(main())
