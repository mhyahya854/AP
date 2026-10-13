"""Evidence for the single TMP-0502 order difference: the figure copyright line."""
import io
import re
import sys
from collections import Counter
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\reader")))
from region_text import text_of, words_only  # noqa: E402

PREV = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\integration_backups"
            r"\final-completion-20261013\prev-final-AP Book Final.html")
CURR = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\AP Book Final.html")
NEEDLE = 'id="TMP-0502"' 


def body(p: Path) -> str:
    d = p.read_bytes()
    i = d.find(NEEDLE.encode())
    j = d.find(b"</article>", i)
    return d[i:j].decode("utf-8", "replace")


for name, path in (("prev", PREV), ("curr", CURR)):
    b = body(path)
    panel = re.search(r'<div class="desc-panel">(.*?)</div></details>', b, re.S)
    ptxt = text_of(panel.group(1)) if panel else ""
    print("%-4s occurrences of 'Copyright' in region: %d | inside the panel body: %s" % (
        name, b.count("Copyright"), "Copyright" in ptxt))
    idx = b.find("Copyright")
    if panel:
        print("     copyright offset %d | panel spans %d..%d | copyright after the panel: %s" % (
            idx, panel.start(), panel.end(), idx > panel.end()))
        print("     text immediately before the copyright: ...%s" % " ".join(
            text_of(b[max(0, idx - 400):idx]).split())[-70:])
    else:
        print("     (no panel) copyright is at char %d of the region" % idx)

# group-level facts (0502 + 0503 + 0504)
def group_body(p: Path) -> str:
    d = p.read_bytes()
    out = []
    for rid in ("TMP-0502", "TMP-0503", "TMP-0504"):
        i = d.find(('id="%s"' % rid).encode())
        j = d.find(b"</article>", i)
        out.append(d[i:j].decode("utf-8", "replace"))
    return " ".join(out)

gb, gc = group_body(PREV), group_body(CURR)
wb, wc = words_only(text_of(gb)).split(), words_only(text_of(gc)).split()
print("GROUP tokens: %d -> %d | multiset equal: %s | 'Copyright' count %d -> %d" % (
    len(wb), len(wc), Counter(wb) == Counter(wc), wb.count("Copyright"), wc.count("Copyright")))

pb, cb = body(PREV), body(CURR)
wb = words_only(text_of(pb)).split()
wc = words_only(text_of(cb)).split()
print("token counts: %d -> %d | multiset equal: %s" % (
    len(wb), len(wc), Counter(wb) == Counter(wc)))
print("'Copyright' token count: prev %d | curr %d" % (wb.count("Copyright"), wc.count("Copyright")))
