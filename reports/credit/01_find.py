"""Locate a credit string, the region that owns it and its table structure."""
import io
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
BOOK = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\AP Book Final.html")
needles = [n.encode() for n in (sys.argv[1:] or ["Tripplaar", "Alamy Stock Photo"])]
hits = {n: [] for n in needles}
ART = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"[^>]*>')
CH = 32 << 20
carry = b""
off = 0
cur_region = "?"
reader = BOOK.open("rb")
while True:
    chunk = reader.read(CH)
    if not chunk:
        break
    buf = carry + chunk
    base = off - len(carry)
    for m in ART.finditer(buf):
        cur_region = m.group(1).decode()
        for n in needles:
            pass
    for n in needles:
        s = 0
        while True:
            i = buf.find(n, s)
            if i < 0:
                break
            # the region that owns this offset: last <article ...> before it
            rid = "?"
            for m in ART.finditer(buf, 0, i):
                rid = m.group(1).decode()
            hits[n].append((base + i, rid))
            s = i + 1
    carry = buf[-128:]
    off += len(chunk)
reader.close()

for n in needles:
    print("=== %r ; occurrences: %d" % (n.decode(), len(hits[n])))
    for pos, rid in hits[n][:6]:
        with BOOK.open("rb") as fh:
            fh.seek(max(0, pos - 400))
            ctx = fh.read(700).decode("utf-8", "replace")
        print("  %s @%d" % (rid, pos))
        print("     %s" % re.sub(r"\s+", " ", ctx)[:300])
