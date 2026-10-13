"""Investigate the 15 controls whose first 60 panel characters occur twice in the book."""
import io
import re
import sys
from collections import Counter
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\reader")))
from region_text import text_of, words_only  # noqa: E402

BOOK = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\AP Book Final.html")
d = BOOK.read_bytes().decode("utf-8", "replace")

panels = []
for m in re.finditer(r'<details class="[^"]*disclosure[^"]*"[^>]*>.*?</details>', d, re.S):
    blk = m.group(0)
    lab = re.search(r'<span class="b2-desc-label">(.*?)</span>', blk, re.S)
    pan = re.search(r'<div class="desc-panel">(.*?)</div></details>', blk, re.S)
    reg = None
    for a in re.finditer(r'id="(TMP-\d{4})"', d[:m.start()]):
        reg = a.group(1)
    panels.append({
        "region": reg,
        "label": " ".join(text_of(lab.group(1)).split()) if lab else None,
        "text": " ".join(text_of(pan.group(1)).split()) if pan else "",
    })

print("panels parsed:", len(panels))
full = Counter(p["text"] for p in panels if p["text"])
dupe_full = {t: c for t, c in full.items() if c > 1}
print("panels with identical FULL text:", len(dupe_full))

print("\nfirst-60-char collisions:")
prefix = Counter(p["text"][:60] for p in panels if len(p["text"]) > 40)
for pre, c in prefix.items():
    if c > 1:
        hits = [p for p in panels if p["text"][:60] == pre]
        print("  x%d %-34s %r" % (c, ",".join(h["region"] or "?" for h in hits), pre[:70]))
        # do the panels share a longer prefix?
        texts = [h["text"] for h in hits]
        common = 0
        while common < min(len(t) for t in texts) and len({t[common] for t in texts}) == 1:
            common += 1
        print("      shared prefix length: %d chars of %s.." % (common, min(len(t) for t in texts)))

print("\nwhole-book word checks:")
body = text_of(d)
print("  total words:", len(words_only(body).split()))
