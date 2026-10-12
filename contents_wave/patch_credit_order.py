"""PATCH-3: move a misplaced figure credit to immediately after its photograph.

Four regions render a credit paragraph immediately before the <img> it belongs
to, so the credit prints above the picture; every other credit in the book
(the 6 element-adjacent ones and the rest) follows its image.  The move is
byte-identical: the same <p> element, in a different position.
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
ART = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"[^>]*>')
END = b"</article>"
IMG = re.compile(r'<img\b[^>]*>')
P = re.compile(r'<p\b[^>]*>.*?</p>', re.S)


def elements(body):
    """Top-level children of the region's .content div, as raw strings."""
    start = body.find('<div class="content">')
    if start < 0:
        return []
    inner = body[start + len('<div class="content">'):]
    if inner.endswith("</div>"):
        inner = inner[: -len("</div>")]
    out, i = [], 0
    finder = re.compile(r"<([a-z]+)([^>]*)>")
    while i < len(inner):
        m = finder.search(inner, i)
        if not m:
            break
        tag = m.group(1)
        if tag in ("img", "br", "hr"):
            out.append(inner[m.start():m.end()])
            i = m.end()
            continue
        depth, j = 1, m.end()
        pat = re.compile(r"<%s\b[^>]*>|</%s>" % (tag, tag))
        while depth and j < len(inner):
            mm = pat.search(inner, j)
            if not mm:
                break
            depth += -1 if mm.group(0).startswith("</") else 1
            j = mm.end()
        out.append(inner[m.start():j])
        i = j
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("output")
    ap.add_argument("--regions", required=True, help="comma separated TMP ids")
    ap.add_argument("--report", default="")
    a = ap.parse_args()
    src, out = Path(a.source), Path(a.output)
    targets = set(a.regions.split(","))

    marks, buf, cur, tag_end = [], b"", None, 0
    base = 0
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

    body_at = {rid: (s, e) for s, e, rid in marks}
    edits, moved = {}, []
    with src.open("rb") as fh:
        for rid in targets:
            s, e = body_at[rid]
            fh.seek(s)
            body = fh.read(e - s).decode("utf-8")
            els = elements(body)
            idx = None
            for i, el in enumerate(els):
                if not el.startswith("<p"):
                    continue
                if i + 1 >= len(els) or not els[i + 1].startswith("<img"):
                    continue
                if re.search(r"(Getty|Alamy|Shutterstock|AP Images|Reuters|Bloomberg|"
                             r"Courtesy|iStock|Unsplash|Pexels)\b", el, re.I):
                    idx = i
                    break
            if idx is None:
                raise SystemExit("%s: no credit paragraph immediately before an image" % rid)
            p_html, img_html = els[idx], els[idx + 1]
            if not img_html.startswith("<img") or not img_html.endswith(">"):
                raise SystemExit("%s: image element not parsed cleanly" % rid)
            old = p_html + img_html
            new = img_html + p_html
            if body.count(old) != 1:
                raise SystemExit("%s: the credit/image pair is not unique" % rid)
            edits[rid] = body.replace(old, new, 1)
            moved.append({"region": rid, "credit": " ".join(re.sub(r"<[^>]*>", " ", p_html).split())[:90],
                          "bytes_moved": len(p_html)})

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

    report = {"patch": "PATCH-3 credit order", "source": str(src), "output": str(out),
              "source_bytes": src.stat().st_size, "output_bytes": written,
              "bytes_added": written - src.stat().st_size,
              "output_sha256": h.hexdigest(), "regions_edited": sorted(edits), "moved": moved}
    if a.report:
        Path(a.report).write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "moved"}, indent=1, ensure_ascii=False))
    for m in moved:
        print("   ", m["region"], "|", m["credit"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
