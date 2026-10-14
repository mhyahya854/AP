"""Step 3: independent byte-level audit of the published artifact.

The rest of the step-3 evidence was produced by the wave's own instruments
(headless Chrome census, patcher assertions, region digest).  This script is a
second, independent reading of the promoted file: it streams the whole 1.1 GB
document once and counts the structure the report claims, so those claims do
not rest on the wave's own tooling.

It measures, from the bytes only:

* every ``<article class="book-page" id="TMP-nnnn">`` region, in file order;
* every ``id="..."`` attribute (real ids, not ``data-table-id``/``data-id``),
  with a duplicate report;
* every internal ``href="#..."`` fragment, checked against that id set;
* the marker counts quoted in the report (headings, group anchors, disclosure
  controls, nav rows, printed-page cells, source-contents bindings).

usage: python reader/step3_independent_audit.py [artifact] [out.json]
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
DEFAULT_OUT = os.path.join(BASE, 'reports', 'contents_navigation',
                           'published_artifact_audit.json')

# ``(?<![-\w])`` keeps data-id / data-table-id / data-source-contents-id out of
# the id set: those are not element ids and must not be counted as duplicates.
ID = re.compile(rb'(?<![-\w])id="([^"]{1,120})"')
FRAG = re.compile(rb'href="#([^"]{1,300})"')
REGION = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"')
CHUNK = 8 << 20
CARRY = 1024

MARKERS = (
    ("tables", b"<table"),
    ("ocr_tables", b'class="ocr-table"'),
    ("images", b"<img"),
    ("png_data_uris", b"data:image/png;base64,"),
    ("details", b"<details"),
    ("disclosure_details", b'class="disclosure"'),
    ("nav_child", b'class="nav-child'),
    ("nav_module_details", b'class="nav-module"'),
    ("nav_unlinked", b"nav-unlinked"),
    ("nav_page_cells", b'class="nav-page"'),
    ("canon_anchor", b'class="canon-anchor"'),
    ("lg_badge", b"lg-badge"),
    ("desc_label", b"b2-desc-label"),
    ("vcredit", b"b2-vcredit"),
    ("source_contents_id", b"data-source-contents-id="),
    ("region_begin_links", b'data-link-kind="region-begin"'),
    ("b2_nav_offset", b"--b2-nav-offset"),
    ("ui3_layer", b"window.book2Navigation"),
)


def audit(path: str) -> dict:
    digest = hashlib.sha256()
    ids: Counter[bytes] = Counter()
    fragments: Counter[bytes] = Counter()
    region_ids: list[bytes] = []
    counts: Counter[str] = Counter()
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
            # ``tail`` is the last kilobyte of the previous block: it is scanned
            # again so that a match spanning the chunk boundary is still seen,
            # matches that end at or before ``base`` were already counted, and
            # the byte-pattern counts subtract the re-scanned tail.
            buf = tail + block
            buf_base = base - len(tail)
            for match in ID.finditer(buf):
                if buf_base + match.end() <= base:
                    continue
                ids[match.group(1)] += 1
            for match in FRAG.finditer(buf):
                if buf_base + match.end() <= base:
                    continue
                fragments[match.group(1)] += 1
            for match in REGION.finditer(buf):
                if buf_base + match.end() <= base:
                    continue
                region_ids.append(match.group(1))
            for key, pattern in MARKERS:
                counts[key] += buf.count(pattern) - tail.count(pattern)
            tail = buf[-(CARRY + 64):]

    duplicate_ids = sorted(k.decode("utf-8", "replace") for k, v in ids.items() if v > 1)
    broken = sorted(f.decode("utf-8", "replace") for f in fragments
                    if not f.startswith(b"file:") and f not in ids)

    return {
        "schema": "book2.step3.independent_artifact_audit.v1",
        "path": os.path.abspath(path),
        "bytes": size,
        "sha256": digest.hexdigest(),
        "seconds": round(time.time() - started, 1),
        "regions": len(region_ids),
        "first_region": region_ids[0].decode() if region_ids else None,
        "last_region": region_ids[-1].decode() if region_ids else None,
        "region_ids_in_file_order": [r.decode() for r in region_ids] == [
            "TMP-%04d" % (i + 1) for i in range(len(region_ids))],
        "heading_anchors": len([i for i in ids if i.startswith(b"book-heading-")]),
        "group_anchors": len([i for i in ids if i.startswith(b"book-group-")]),
        "unique_ids": len(ids),
        "duplicate_ids": duplicate_ids,
        "fragment_targets": len(fragments),
        "fragment_total": sum(fragments.values()),
        "broken_fragments": broken,
        "counts": dict(sorted(counts.items())),
    }


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BOOK
    out = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT
    result = audit(path)
    with open(out, "w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=1, sort_keys=True)
    print(json.dumps(result, indent=1, sort_keys=True))
    print("written", out)


if __name__ == "__main__":
    main()
