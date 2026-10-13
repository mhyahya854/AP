"""Phase 2: render the source-vertical MoMo photostud credit vertically.

Sole paragraph touched; the text is byte-identical, only a writing-mode is added,
because the source (B2P1-0112.png) prints this credit down the photograph's edge
and the horizontal rendering breaks "Productions/Getty" in half.
"""
import hashlib
import io
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ART = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"[^>]*>')
END = b"</article>"
REGION = "TMP-0112"
NEEDLE = "MoMo Productions/Getty Images"
STYLE = "writing-mode:vertical-rl;text-orientation:mixed;white-space:nowrap;margin:0 auto;line-height:1.15"


def main() -> int:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    marks, buf, cur, tag_end, base = [], b"", None, 0, 0
    with src.open("rb") as fh:
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
                    tag_end = base + m.end()
                    pos = m.end()
                else:
                    e = buf.find(END, pos)
                    if e < 0:
                        break
                    marks.append((tag_end, base + e, cur))
                    pos = e + len(END)
                    cur = None
            buf = buf[pos:]
            base += pos
            if not c:
                break
    span = {rid: (s, e) for s, e, rid in marks}
    s, e = span[REGION]
    with src.open("rb") as fh:
        fh.seek(s)
        body = fh.read(e - s).decode("utf-8")
    i = body.find(NEEDLE)
    if i < 0:
        raise SystemExit("credit not found")
    p = body.rfind("<p", 0, i)
    gt = body.find(">", p)
    tag = body[p:gt + 1]
    if "writing-mode" in tag:
        raise SystemExit("already styled")
    if 'style="' in tag:
        new_tag = tag[:-1] + ";" + STYLE + '">' if tag.endswith('">') else tag
        new_tag = re.sub(r'style="([^"]*)"', lambda m: 'style="%s;%s"' % (m.group(1), STYLE), tag)
    else:
        new_tag = tag[:-1] + ' style="' + STYLE + '">'
    new_body = body[:p] + new_tag + body[gt + 1:]
    h = hashlib.sha256()
    written = 0
    with src.open("rb") as fh, out.open("wb") as oh:
        prev = 0
        for ms, me, rid in marks:
            if rid != REGION:
                continue
            fh.seek(prev)
            left = ms - prev
            while left > 0:
                c = fh.read(min(16 << 20, left))
                oh.write(c)
                h.update(c)
                written += len(c)
                left -= len(c)
            data = new_body.encode("utf-8")
            oh.write(data)
            h.update(data)
            written += len(data)
            prev = me
        fh.seek(prev)
        while True:
            c = fh.read(16 << 20)
            if not c:
                break
            oh.write(c)
            h.update(c)
            written += len(c)
    print("old tag:", tag)
    print("new tag:", new_tag)
    print("bytes:", written, "sha256:", h.hexdigest())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
