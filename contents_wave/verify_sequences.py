"""Exact normalized text-sequence preservation per affected group, plus structure checks."""
import io
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\reader")))
from region_text import text_of, words_only  # noqa: E402

ART = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"[^>]*>')
END = b"</article>"

GROUPS = {
    "TMP-0125": ["TMP-0125"],
    "TMP-0152": ["TMP-0152"],
    "TMP-0422": ["TMP-0422"],
    "TMP-0851": ["TMP-0851"],
    "TMP-0745": ["TMP-0745"],
    "TMP-1350": ["TMP-1350"],
    "TMP-0502": ["TMP-0502", "TMP-0503", "TMP-0504"],
    "TMP-0516": ["TMP-0516", "TMP-0517", "TMP-0518"],
    "TMP-0530": ["TMP-0530", "TMP-0531"],
}


def regions(path):
    out, buf, cur = {}, b"", None
    with path.open("rb") as fh:
        while True:
            c = fh.read(16 << 20)
            if not c and not buf:
                break
            buf += c
            pos = 0
            while True:
                if cur is None:
                    m = ART.search(buf, pos)
                    if not m:
                        break
                    cur = m.group(1).decode()
                    pos = m.end()
                else:
                    e = buf.find(END, pos)
                    if e < 0:
                        break
                    out[cur] = buf[pos:e].decode("utf-8", "replace")
                    pos = e + len(END)
                    cur = None
            buf = buf[pos:]
            if not c:
                break
    return out


base = regions(Path(sys.argv[1]))
cand = regions(Path(sys.argv[2]))

print("== structure ==")
for name, d in (("baseline", Path(sys.argv[1])), ("candidate", Path(sys.argv[2]))):
    raw = d.read_bytes()
    print("  %s: controls=%d labels=%d empty_panels=%d open_panels=%d closed=%d malformed=%d" % (
        name, len(re.findall(rb'<details class=.disclosure', raw)), raw.count(b"b2-desc-label"),
        raw.count(b'<div class="desc-panel"></div>'), raw.count(b'class="desc-panel"'),
        len(re.findall(rb"</div></details>", raw)),
        raw.count(b'<div class="desc-panel"></td>')))

print("== normalized token sequence per affected group ==")
ok = True
for label, ids in GROUPS.items():
    tb = " ".join(text_of(base[i]) for i in ids)
    tc = " ".join(text_of(cand[i]) for i in ids)
    wb = words_only(tb).split()
    wc = words_only(tc).split()
    same_multiset = Counter(wb) == Counter(wc)
    # panel body tokens must appear as a contiguous run of the original sequence
    body = re.search(r"<div class=\"desc-panel\">(.*?)</div></details>", cand[label], re.S)
    bt = words_only(text_of(body.group(1))).split() if body else []
    joined = " ".join(wc)
    contiguous = (" " + " ".join(bt) + " ") in (" " + joined + " ") if bt else False
    order_ok = True
    pos = 0
    for tok in bt:
        try:
            pos = wb.index(tok, pos) + 1
        except ValueError:
            order_ok = False
            break
    ok = ok and same_multiset and order_ok
    print("  %-9s tokens %4d -> %4d | multiset equal %s | body %3d tokens in original order %s" % (
        label, len(wb), len(wc), same_multiset, len(bt), order_ok))
print("SEQUENCE PRESERVATION OK:", ok)
