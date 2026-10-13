"""Task B: exact ordered token-sequence equality per restored group.

Compares the verified previous artifact (ef09a825...) with the current final
(572144b8...) for each logical source group.  Nothing is normalised away except
the documented presentation differences: HTML entities and the disclosure UI
glyphs (the chevron and the information marker), which region_text already
strips in word mode.
"""
import io
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\reader")))
from region_text import text_of, words_only  # noqa: E402

ART = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"[^>]*>')
END = b"</article>"

PREV = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\integration_backups"
            r"\final-completion-20261013\prev-final-AP Book Final.html")
CURR = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\AP Book Final.html")

GROUPS = [
    ["TMP-0125"],
    ["TMP-0152"],
    ["TMP-0422"],
    ["TMP-0502", "TMP-0503", "TMP-0504"],
    ["TMP-0516", "TMP-0517", "TMP-0518"],
    ["TMP-0530", "TMP-0531"],
    ["TMP-0745"],
    ["TMP-0851"],
    ["TMP-1350"],
]


def regions(path, want):
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
                    if cur in want:
                        out[cur] = buf[pos:e].decode("utf-8", "replace")
                    pos = e + len(END)
                    cur = None
            buf = buf[pos:]
            if not c:
                break
    return out


want = {r for g in GROUPS for r in g}
prev, curr = regions(PREV, want), regions(CURR, want)

print("prev artifact:", PREV.name)
print("groups:", len(GROUPS))
all_equal = True
for g in GROUPS:
    tb = " ".join(text_of(prev[r]) for r in g)
    tc = " ".join(text_of(curr[r]) for r in g)
    wb = words_only(tb).split()
    wc = words_only(tc).split()
    equal = (wb == wc)
    all_equal = all_equal and equal
    print("%-28s tokens %5d -> %5d  ORDERED EQUAL: %s" % ("+".join(g), len(wb), len(wc), equal))
    if not equal:
        n = min(len(wb), len(wc))
        i = next((k for k in range(n) if wb[k] != wc[k]), n)
        print("      first divergence at token", i)
        print("      before:", " ".join(wb[max(0, i - 6):i + 6]))
        print("      after :", " ".join(wc[max(0, i - 6):i + 6]))

print("ALL NINE GROUPS ORDERED-EQUAL:", all_equal)
