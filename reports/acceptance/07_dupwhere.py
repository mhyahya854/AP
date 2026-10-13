"""Where is the second occurrence of each flagged 60-character slice?"""
import io
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\reader")))
from region_text import text_of  # noqa: E402

BOOK = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\AP Book Final.html")
d = BOOK.read_bytes().decode("utf-8", "replace")

# map character offset -> region id, using the raw body text built from the regions
plain = text_of(d)                     # whole-document plain text
off2region, pos, rid = [], 0, None
for m in re.finditer(r'<article class="book-page" id="(TMP-\d{4})"[^>]*>(.*?)</article>', d, re.S):
    t = text_of(m.group(2))
    off2region.append((pos, pos + len(t), m.group(1)))
    pos += len(t) + 1


def region_at(i):
    for a, b, r in off2region:
        if a <= i < b:
            return r
    return "?"


FLAGGED = ["TMP-0062", "TMP-0063", "TMP-0070", "TMP-0073", "TMP-0080"]
panels = {}
for m in re.finditer(r'<article class="book-page" id="(TMP-\d{4})"[^>]*>(.*?)</article>', d, re.S):
    pan = re.search(r'<div class="desc-panel">(.*?)</div></details>', m.group(2), re.S)
    if pan:
        panels[m.group(1)] = " ".join(text_of(pan.group(1)).split())

for rid in FLAGGED:
    txt = panels.get(rid, "")
    slice60 = txt[:60]
    if not slice60:
        print(rid, "no panel")
        continue
    hits = [m.start() for m in re.finditer(re.escape(slice60), plain)]
    print("%s panel starts: %r" % (rid, slice60[:56]))
    for h in hits:
        print("    occurrence at %7d in region %s" % (h, region_at(h)))
    print("    occurrences: %d" % len(hits))
