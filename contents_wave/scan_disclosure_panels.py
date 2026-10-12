"""Count every disclosure control and report which panels have an empty body."""
import io, re, sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BOOK = Path(sys.argv[1])
panel = re.compile(rb'<div class="desc-panel">(.*?)</div>', re.S)
article = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"')
label = re.compile(rb'<span class="b2-desc-label">([^<]*)</span>')
IMG = re.compile(rb'data:image/[a-z+]+;base64,[A-Za-z0-9+/=]+')

data = BOOK.read_bytes()
n_panel = 0
empty = []
for m in panel.finditer(data):
    n_panel += 1
    inner = IMG.sub(b"", m.group(1)).strip()
    if not inner:
        # locate the enclosing article and the preceding label
        a = None
        for am in article.finditer(data, 0, m.start()):
            a = am
        heads = label.findall(data[:m.start()])
        empty.append((a.group(1).decode() if a else "?", heads[-1].decode("utf-8", "replace") if heads else "?"))
print("desc-panel elements:", n_panel)
print("disclosure details:", data.count(b'<details class="disclosure"'))
print("empty panels:", len(empty))
for rid, lab in empty:
    print("   ", rid, "|", lab)
