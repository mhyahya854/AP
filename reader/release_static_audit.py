"""Final release QA: byte-level structural audit of the shipped book.

One streaming pass over the ~1.13 GB artifact plus a bounded read of the head,
producing the file-level evidence for the certification:

* regions, ids, fragments (existence, order, duplicates, resolvability);
* every `<details>` opening tag with the class attribute that produced it, so
  the 145-string-matches vs 155-DOM-controls discrepancy is resolved with data
  rather than by changing either count;
* table, image, Learning Goal, description-label and credit markers;
* entity / mojibake / marker symptoms;
* head stylesheet inventory (rules, !important, fixed widths, data-status rules).

usage: python reader/release_static_audit.py [artifact] [outdir]
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
from collections import Counter

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_BOOK = os.path.join(BASE, 'AP Book Final.html')
DEFAULT_OUT = os.path.join(BASE, 'reports', 'final_release_qa')

ID = re.compile(rb'(?<![-\w])id="([^"]{1,160})"')
FRAG = re.compile(rb'href="#([^"]{1,300})"')
REGION = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"')
DETAILS = re.compile(rb'<details\b[^>]{0,400}>')
IMG_TAG = re.compile(rb'<img\b[^>]{0,600}>')
STYLE_ATTR = re.compile(rb'style="([^"]{0,2000})"')
CHUNK = 8 << 20
CARRY = 2048

MARKERS = (
    ("details_open_tags", b"<details"),
    ("summary_open_tags", b"<summary"),
    ("table_open_tags", b"<table"),
    ("ocr_table_tags", b'class="ocr-table"'),
    ("td_open_tags", b"<td"),
    ("th_open_tags", b"<th"),
    ("img_open_tags", b"<img"),
    ("png_data_uris", b"data:image/png;base64,"),
    ("lg_badge", b"lg-badge"),
    ("desc_label", b"b2-desc-label"),
    ("vcredit", b"b2-vcredit"),
    ("sideways_lr", b"sideways-lr"),
    ("nav_child", b'class="nav-child'),
    ("nav_module_details", b'class="nav-module"'),
    ("nav_unlinked", b"nav-unlinked"),
    ("nav_page_cell", b'class="nav-page"'),
    ("nav_group_header", b"nav-group-header"),
    ("canon_anchor", b'class="canon-anchor"'),
    ("source_contents_id", b"data-source-contents-id="),
    ("region_begin_link", b'data-link-kind="region-begin"'),
    ("b2_nav_offset", b"--b2-nav-offset"),
    ("ui3_layer", b"window.book2Navigation"),
    ("data_status_attr", b"data-status="),
    ("ocr_unclear_marker", b"[OCR unclear]"),
    ("unverified_word", b"UNVERIFIED"),
    ("figure_container", b'class="figure"'),
    ("table_title", b'class="table-title"'),
    ("answer_key", b"ANSWER KEY"),
    ("double_amp_entity", b"&amp;amp;"),
    ("raw_amp_entity", b"&amp;"),
    ("mojibake_a_grave", b"\xc3\x82"),
    ("mojibake_euro", b"\xe2\x80\x9a"),
    ("mojibake_tilde", b"\xc3\x83"),
    ("replacement_char", b"\xef\xbf\xbd"),
    ("ap_symbol", b"AP\xc2\xae"),
    ("inline_style_attr", b'style="'),
)


def head_slice(path: str, limit: int = 3_000_000) -> bytes:
    with open(path, "rb") as handle:
        return handle.read(limit)


def audit(path: str) -> dict:
    digest = hashlib.sha256()
    ids: Counter[bytes] = Counter()
    fragments: Counter[bytes] = Counter()
    region_ids: list[bytes] = []
    counts: Counter[str] = Counter()
    detail_classes: Counter[bytes] = Counter()
    img_srcs: Counter[bytes] = Counter()
    sizes: Counter[int] = Counter()
    color_decls = 0
    size = 0
    started = time.time()

    with open(path, "rb") as handle:
        tail = b""
        while True:
            block = handle.read(CHUNK)
            if not block:
                break
            digest.update(block)
            base = size
            size += len(block)
            buf = tail + block
            buf_base = base - len(tail)

            def fresh(match) -> bool:
                return buf_base + match.end() > base

            for match in ID.finditer(buf):
                if fresh(match):
                    ids[match.group(1)] += 1
            for match in FRAG.finditer(buf):
                if fresh(match):
                    fragments[match.group(1)] += 1
            for match in REGION.finditer(buf):
                if fresh(match):
                    region_ids.append(match.group(1))
            for match in DETAILS.finditer(buf):
                if not fresh(match):
                    continue
                tag = match.group(0)
                cls = re.search(rb'class="([^"]*)"', tag)
                value = cls.group(1) if cls else b"(no class)"
                if b"disclosure" in value or not cls:
                    detail_classes[value] += 1
                else:
                    detail_classes[b"other:" + value.split(b" ")[0]] += 1
            for match in IMG_TAG.finditer(buf):
                if not fresh(match):
                    continue
                tag = match.group(0)
                src = re.search(rb'src="([^"]{0,80})', tag)
                key = (src.group(1)[:40] if src else b"(no src)")
                img_srcs[b"png-data" if key.startswith(b"data:image/png") else key] += 1
                width = re.search(rb'\bwidth="(\d+)"', tag)
                if width:
                    sizes[int(width.group(1))] += 1
            for match in STYLE_ATTR.finditer(buf):
                if not fresh(match):
                    continue
                body = match.group(1)
                color_decls += body.count(b"color:") + body.count(b"color :")
            for key, pattern in MARKERS:
                counts[key] += buf.count(pattern) - tail.count(pattern)
            tail = buf[-(CARRY + 64):]

    head = head_slice(path)
    styles = re.findall(rb"<style[^>]*>(.*?)</style>", head, re.S)
    css = b"\n".join(styles)
    css_text = css.decode("utf-8", "replace")
    css_report = {
        "style_blocks_in_first_3mb": len(styles),
        "css_bytes": len(css),
        "rules": css_text.count("{"),
        "important": css_text.count("!important"),
        "media_queries": css_text.count("@media"),
        "fixed_px_widths": len(re.findall(r"width:\s*\d+px", css_text)),
        "fixed_px_heights": len(re.findall(r"height:\s*\d+px", css_text)),
        "data_status_rules": len(re.findall(r"\[data-status[^\]]*\]", css_text)),
        "uses_sideways_lr": "sideways-lr" in css_text,
        "filter_declarations_on_images": len(re.findall(r"img\s*\{[^}]*filter", css_text)),
        "invert_declarations": css_text.count("invert("),
        "scroll_padding_top_rules": len(re.findall(r"scroll-padding-top", css_text)),
        "custom_properties": len(set(re.findall(r"--[a-z0-9-]+", css_text))),
    }

    duplicate_ids = sorted(k.decode("utf-8", "replace") for k, v in ids.items() if v > 1)
    broken = sorted(f.decode("utf-8", "replace") for f in fragments
                    if not f.startswith(b"file:") and f not in ids)
    regions_expected = ["TMP-%04d" % (i + 1) for i in range(len(region_ids))]

    return {
        "schema": "book2.release.static_audit.v1",
        "path": os.path.abspath(path),
        "bytes": size,
        "sha256": digest.hexdigest(),
        "seconds": round(time.time() - started, 1),
        "regions": len(region_ids),
        "first_region": region_ids[0].decode() if region_ids else None,
        "last_region": region_ids[-1].decode() if region_ids else None,
        "region_ids_sequential": [r.decode() for r in region_ids] == regions_expected,
        "region_id_duplicates": sorted(k for k, v in Counter(region_ids).items() if v > 1),
        "unique_ids": len(ids),
        "duplicate_ids": duplicate_ids,
        "fragment_targets": len(fragments),
        "fragment_total": sum(fragments.values()),
        "broken_fragments": broken,
        "heading_anchors": len([i for i in ids if i.startswith(b"book-heading-")]),
        "group_anchors": len([i for i in ids if i.startswith(b"book-group-")]),
        "details_class_histogram": {
            k.decode("utf-8", "replace"): v for k, v in detail_classes.most_common(40)},
        "details_with_disclosure_class": sum(
            v for k, v in detail_classes.items() if b"disclosure" in k),
        "img_src_histogram": {
            k.decode("utf-8", "replace"): v for k, v in img_srcs.most_common(15)},
        "img_width_attribute_histogram": dict(sizes.most_common(12)),
        "inline_color_declarations": color_decls,
        "counts": dict(sorted(counts.items())),
        "css": css_report,
    }


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BOOK
    outdir = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT
    result = audit(path)
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, 'static_audit.json')
    with open(out, "w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=1, sort_keys=True)
    print(json.dumps({k: v for k, v in result.items()
                      if k not in ('details_class_histogram', 'img_src_histogram')},
                     indent=1, sort_keys=True))
    print("details class histogram:", json.dumps(result["details_class_histogram"], indent=1))
    print("img src histogram:", json.dumps(result["img_src_histogram"], indent=1))
    print("written", out)


if __name__ == "__main__":
    main()
