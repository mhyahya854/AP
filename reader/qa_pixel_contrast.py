"""Read the two dominant colours out of each contrast clip and score WCAG.

The clip is the exact bounding box of one text element, so the most common
colour is the surface the glyphs sit on and the extreme colour (far end of the
luminance range from the surface) is the ink.  Antialiased edge pixels are
excluded by requiring a minimum distance from both cluster centres.

usage: python reader/qa_pixel_contrast.py
"""

from __future__ import annotations

import json
import os
from collections import Counter

from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLES = os.path.join(BASE, 'reports', 'final_release_qa', 'pixel_contrast_samples.json')
OUT = os.path.join(BASE, 'reports', 'final_release_qa', 'pixel_contrast.json')
SCREENS = os.path.join(BASE, 'reports', 'final_release_qa')


def luminance(rgb):
    parts = []
    for value in rgb:
        channel = value / 255
        parts.append(channel / 12.92 if channel <= 0.03928 else ((channel + 0.055) / 1.055) ** 2.4)
    return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2]


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def dominant(colours):
    """Median of the most common colour cluster, ignoring antialias blends."""
    return max(colours, key=lambda key: colours[key])


def analyse(path):
    image = Image.open(path).convert('RGB')
    counts = Counter(image.getdata())
    total = sum(counts.values())
    surface = dominant(counts)
    surface_lum = luminance(surface)
    ink = None
    best = 0.0
    for colour, n in counts.items():
        if n < max(3, total * 0.0008):
            continue
        delta = abs(luminance(colour) - surface_lum)
        if delta > best:
            best, ink = delta, colour
    if ink is None or best < 0.12:
        return {'surface': surface, 'ink': ink, 'ratio': None,
                'note': 'single colour or ink not separable from surface', 'pixels': total}
    return {
        'surface': list(surface),
        'ink': list(ink),
        'ratio': round(contrast(surface, ink), 2),
        'surfaceShare': round(counts[surface] / total, 4),
        'pixels': total,
    }


def main() -> None:
    samples = json.load(open(SAMPLES, encoding='utf-8'))
    rows = []
    for sample in samples:
        if sample.get('skipped'):
            rows.append({**sample, 'ratio': None, 'note': 'no measuring box'})
            continue
        path = os.path.join(SCREENS, sample['file'].split('final_release_qa/')[-1])
        result = analyse(path)
        font_px = float(sample.get('clip', {}).get('fontPx') or 0)
        weight = str(sample.get('clip', {}).get('weight') or '400')
        large = font_px >= 24 or (font_px >= 18.66 and weight.isdigit() and int(weight) >= 700)
        required = 3.0 if large else 4.5
        verdict = 'n/a'
        if result.get('ratio') is not None:
            verdict = 'PASS' if result['ratio'] >= required else 'FAIL'
        rows.append({
            'name': sample['name'], 'theme': sample['theme'], 'selector': sample['selector'],
            'text': sample.get('clip', {}).get('text'), 'fontPx': font_px, 'weight': weight,
            'largeText': large, 'required': required, 'verdict': verdict,
            'file': sample['file'], **result,
        })
    summary = {}
    for row in rows:
        key = row['name'] + ':' + row['theme']
        summary[key] = {'ratio': row.get('ratio'), 'required': row.get('required'),
                        'verdict': row.get('verdict'), 'note': row.get('note')}
    with open(OUT, 'w', encoding='utf-8') as handle:
        json.dump({'schema': 'book2.release.pixel_contrast.v1', 'rows': rows, 'summary': summary},
                  handle, indent=1)
    for row in rows:
        print(f"{row['name']:20s} {row['theme']:5s} ratio={row.get('ratio')} req={row.get('required')} "
              f"{row.get('verdict')} surface={row.get('surface')} ink={row.get('ink')} :: {str(row.get('text'))[:40]}")
    print('written', OUT)


if __name__ == '__main__':
    main()
