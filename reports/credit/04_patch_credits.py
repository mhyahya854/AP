"""Render every source-vertical photo credit vertically (component-scoped, static).

The source prints a credit that sits in its own narrow cell beside a photograph
vertically down the photo's edge (verified on B2P1-0124, B2P1-0112, B2P1-0542,
B2P1-0570, B2P1-1304).  Horizontally the same credit needs 79-133 px for one
word but its cell is 24-58 px, so the browser breaks the words apart.

This adds the writing mode as an inline style to exactly those paragraphs and
changes nothing else - same words, same elements, same order.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\reader")))
from region_text import text_of  # noqa: E402

ART = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"[^>]*>')
END = b"</article>"
CREDIT = re.compile(r"(Getty Images|Alamy|Shutterstock|iStock|AP Images|Reuters|Bloomberg|"
                    r"Unsplash|Pexels|Zuma|Newscom|Science Source|The Image Bank|Corbis|"
                    r"Stock Photo|Photographer|AFP|Associated Press|PA Images|Anadolu|"
                    r"picture alliance|Design Pics|Superstock|Nature Picture|"
                    r"Los Angeles Times|Houston Chronicle|Washington Post|"
                    r"Anadolu Agency|The Washington Post|Tribune|Hearst)", re.I)
STYLE = "writing-mode:vertical-rl;text-orientation:mixed;white-space:nowrap;margin:0 auto;line-height:1.15"
# in B2P1-0124 the source prints the credit reading upward, so that one credit
# uses the same vertical flow in the opposite direction
STYLE_UP = "writing-mode:sideways-lr;text-orientation:mixed;white-space:nowrap;margin:0 auto;line-height:1.15"


def credit_cells(body: str):
    """Cells whose only content is a single credit paragraph, in a row with an image."""
    out = []
    for m in re.finditer(r"<td\b([^>]*)>(.*?)</td>", body, re.S):
        inner = m.group(2)
        # the cell must hold exactly one paragraph (possibly inside one nested table)
        ps = re.findall(r"<p\b[^>]*>.*?</p>", inner, re.S)
        if len(ps) != 1:
            continue
        p = ps[0]
        txt = " ".join(text_of(p).split())
        if not txt or len(txt) > 90 or not CREDIT.search(txt):
            continue
        if re.search(r"(Left:|right:|;)", txt):          # multi-credit caption line
            continue
        if "<img" in inner:                               # only the credit in this cell
            continue
        # the row must also carry an image in another cell
        tr_start = body.rfind("<tr", 0, m.start())
        tr_end = body.find("</tr>", m.end())
        if tr_start < 0 or tr_end < 0:
            continue
        row = body[tr_start:tr_end]
        if "<img" not in row:
            continue
        out.append({"start": m.start(2) + body[m.start(2):m.end(2)].find(p),
                    "p": p, "text": txt})
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("output")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--upward", default="", help="comma separated regions whose source credit reads upward")
    ap.add_argument("--report", default="")
    a = ap.parse_args()
    upward = {r.strip() for r in a.upward.split(",") if r.strip()}
    src, out = Path(a.source), Path(a.output)

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

    edits, tagged = {}, []
    with src.open("rb") as fh:
        for s, e, rid in marks:
            fh.seek(s)
            body = fh.read(e - s).decode("utf-8")
            cands = credit_cells(body)
            if not cands:
                continue
            new_body, changed = body, 0
            for c in sorted(cands, key=lambda c: -c["start"]):
                p = c["p"]
                if "writing-mode" in p:
                    continue
                style = STYLE_UP if rid in upward else STYLE
                if 'style="' in p:
                    newp = re.sub(r'style="([^"]*)"',
                                  lambda mm: 'style="%s;%s"' % (mm.group(1), style), p, count=1)
                else:
                    newp = re.sub(r"^<p\b", '<p style="%s"' % style, p, count=1)
                at = new_body.find(p)
                if at < 0:
                    continue
                new_body = new_body[:at] + newp + new_body[at + len(p):]
                changed += 1
                tagged.append({"region": rid, "text": c["text"][:60]})
            if changed:
                edits[rid] = new_body

    print("candidate credits:", len(tagged))
    for t in tagged:
        print("   %s  %s" % (t["region"], t["text"]))
    if a.dry_run:
        if a.report:
            Path(a.report).write_text(json.dumps({"dry_run": True, "tagged": tagged}, indent=1,
                                                 ensure_ascii=False), encoding="utf-8")
        return 0

    h = hashlib.sha256()
    written = 0
    with src.open("rb") as fh, out.open("wb") as oh:
        prev = 0
        for s, e, rid in marks:
            if rid not in edits:
                continue
            fh.seek(prev)
            left = s - prev
            while left > 0:
                c = fh.read(min(16 << 20, left))
                oh.write(c)
                h.update(c)
                written += len(c)
                left -= len(c)
            data = edits[rid].encode("utf-8")
            oh.write(data)
            h.update(data)
            written += len(data)
            prev = e
        fh.seek(prev)
        while True:
            c = fh.read(16 << 20)
            if not c:
                break
            oh.write(c)
            h.update(c)
            written += len(c)
    rep = {"patch": "photo-credit orientation (class fix)", "credits_tagged": len(tagged),
           "regions_edited": sorted(edits), "output_bytes": written,
           "bytes_delta": written - src.stat().st_size, "output_sha256": h.hexdigest(),
           "tagged": tagged}
    if a.report:
        Path(a.report).write_text(json.dumps(rep, indent=1, ensure_ascii=False), encoding="utf-8")
    print("bytes:", written, "delta:", written - src.stat().st_size, "sha256:", h.hexdigest())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
