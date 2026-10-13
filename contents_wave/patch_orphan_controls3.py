"""Restore the nine remaining orphan description controls.

Two mechanisms, both driven by the measured structure:
  cell_split  the label's ancestor panel cell holds the nested label table and,
              after it, the body - the control replaces the nested table
  row_split   the label's own table holds the body in the rows after the label
              row - the control replaces the label paragraph, the body rows move
  self_chain  the body starts in the region and continues into one or two
              following captures, ending where the source's caption strip begins
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
from region_text import text_of, words_only  # noqa: E402

ART = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"[^>]*>')
END = b"</article>"
CONTENT = '<div class="content">'
GLYPH = "&#x25BC;|&#x25B8;|▼|▶|\u25bc|\u25b8|\u25b6"

SPECS = [
    {"region": "TMP-0125", "mode": "cell_split", "bg": "#EEEEEE"},
    {"region": "TMP-0152", "mode": "cell_split", "bg": "#EEEEEE"},
    {"region": "TMP-0851", "mode": "cell_split"},
    {"region": "TMP-0422", "mode": "row_split"},
    {"region": "TMP-0745", "mode": "row_split"},
    {"region": "TMP-1350", "mode": "row_split"},
    {"region": "TMP-0502", "mode": "self_chain", "self_idx": [3, 4, 5],
     "donors": [("TMP-0503", [0, 1, 2, 3, 4]), ("TMP-0504", [0, 1])]},
    {"region": "TMP-0516", "mode": "self_chain", "self_idx": [45, 46, 47, 48],
     "donors": [("TMP-0517", list(range(19))), ("TMP-0518", list(range(14)))]},
    {"region": "TMP-0530", "mode": "self_chain", "self_idx": [17, 18, 19, 20],
     "donors": [("TMP-0531", list(range(18)))]},
]


def els(body):
    start = body.find(CONTENT)
    inner = body[start + len(CONTENT):]
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
    return out, inner


def span_of(html, start, tag):
    """End index just past the element starting at `start`."""
    m = re.match(r"<%s\b[^>]*>" % tag, html[start:])
    depth, j = 1, html.index(">", start) + 1
    pat = re.compile(r"<%s\b[^>]*>|</%s>" % (tag, tag))
    while depth and j < len(html):
        mm = pat.search(html, j)
        if not mm:
            break
        depth += -1 if mm.group(0).startswith("</") else 1
        j = mm.end()
    return j


def clean_label(text):
    t = " ".join(text.split())
    t = re.sub(r"^\s*(?:%s)\s*" % GLYPH, "", t).strip()
    t = re.sub(r"\s*(?:&#x24D8;|ⓘ|\u2139)\s*$", "", t).strip()
    return t


def control(label, body):
    return ('<details class="disclosure"><summary><span class="b2-desc-label">'
            + label + '</span></summary><div class="desc-panel">' + body + "</div></details>")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("output")
    ap.add_argument("--report", default="")
    a = ap.parse_args()
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
    span = {rid: (s, e) for s, e, rid in marks}

    need = set()
    for sp in SPECS:
        need.add(sp["region"])
        for d, _ in sp.get("donors", []):
            need.add(d)
    bodies = {}
    with src.open("rb") as fh:
        for rid in need:
            s, e = span[rid]
            fh.seek(s)
            bodies[rid] = fh.read(e - s).decode("utf-8")

    edits, checks = {}, []
    for sp in SPECS:
        rid, mode = sp["region"], sp["mode"]
        html = bodies[rid]
        idx = html.find("Extended description for")
        if idx < 0:
            raise SystemExit("%s: label not found" % rid)

        if mode == "cell_split":
            # every cell containing the label, innermost first; take the first
            # one that actually carries the body after its nested label table
            cands = []
            for m in re.finditer(r"<td\b([^>]*)>", html):
                if m.start() > idx:
                    break
                j = span_of(html, m.start(), "td")
                if j > idx:
                    cands.append((m.start(), j, m.end(), m.group(1)))
            cands.sort(key=lambda c: -c[2])
            chosen = None
            for cs, ce, is_, attrs in cands:
                inner = html[is_:ce - len("</td>")]
                li2 = inner.find("Extended description for")
                tstart = inner.rfind("<table", 0, li2) if li2 >= 0 else -1
                if tstart < 0:
                    continue
                tend = span_of(inner, tstart, "table")
                body = inner[tend:]
                if body.strip():
                    chosen = (cs, ce, is_, inner, tstart, tend, body)
                    break
            if not chosen:
                raise SystemExit("%s: panel cell with body not found" % rid)
            cs, ce, is_, inner, tstart, tend, body = chosen
            label = clean_label(text_of(inner[tstart:tend]))
            new_html = html[:is_] + control(label, body) + html[ce - len("</td>"):]
            moved = 0

        elif mode == "row_split":
            tstart = html.rfind("<table", 0, idx)
            tend = span_of(html, tstart, "table")
            table = html[tstart:tend]
            # the label paragraph inside that table
            li = table.find("Extended description for")
            p_open = table.rfind("<p", 0, li)
            p_close = table.find("</p>", li) + 4
            label = clean_label(text_of(table[p_open:p_close]))
            # body = the rows after the label's own row
            rows = [(m.start(), span_of(table, m.start(), "tr"))
                    for m in re.finditer(r"<tr\b", table)]
            label_row = [r for r in rows if r[0] <= p_open < r[1]][0]
            later = [r for r in rows if r[0] >= label_row[1]]
            body = "".join(table[r[0]:r[1]] for r in later)
            # strip the row/cell wrappers: a <td> inside the panel <div> is
            # invalid HTML and the browser would drop the whole cell content
            body = re.sub(r"</?t[dhr]\b[^>]*>", "", body)
            if later:
                trimmed = (table[:p_open] + control(label, body)
                           + table[p_close:later[0][0]] + table[later[-1][1]:])
            else:
                trimmed = table[:p_open] + control(label, body) + table[p_close:]
            new_html = html[:tstart] + trimmed + html[tend:]
            moved = 0

        else:  # self_chain
            top, inner = els(html)
            li = max(i for i, el in enumerate(top) if "Extended description for" in text_of(el))
            label = clean_label(text_of(top[li]))
            body = "".join(top[i] for i in sp["self_idx"])
            parts = []
            for i, el in enumerate(top):
                if i == li:
                    parts.append(control(label, body))
                elif i in set(sp["self_idx"]) or (el.startswith("<p") and
                                                  not text_of(el).strip() and i == li + 1):
                    continue
                else:
                    parts.append(el)
            new_html = html[:html.find(CONTENT) + len(CONTENT)] + "".join(parts) + "</div>"
            moved = len(sp["self_idx"])
            for donor, idxs in sp["donors"]:
                dtops, dinner = els(bodies[donor])
                drop = set(idxs)
                dbody = "".join(dtops[i] for i in idxs)
                # append the donor content to this region's panel
                new_html = new_html.replace("</div></details>",
                                            dbody + "</div></details>", 1)
                dkeep = "".join(el for i, el in enumerate(dtops) if i not in drop)
                edits[donor] = (bodies[donor][:bodies[donor].find(CONTENT) + len(CONTENT)]
                                + dkeep + "</div>")
                moved += len(idxs)
        edits[rid] = new_html
        checks.append({"control": rid, "mode": mode, "label": label[:80],
                       "elements_moved": moved,
                       "words": len(words_only(text_of(body)).split()),
                       "body_head": " ".join(text_of(body).split())[:90]})

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

    rep = {"patch": "nine-case source repair", "controls_created": len(SPECS),
           "regions_edited": sorted(edits), "output_bytes": written,
           "bytes_delta": written - src.stat().st_size,
           "output_sha256": h.hexdigest(), "checks": checks}
    if a.report:
        Path(a.report).write_text(json.dumps(rep, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in rep.items() if k != "checks"}, indent=1, ensure_ascii=False))
    for c in checks:
        print("  %s [%s] elems=%d words=%d | %s" % (c["control"], c["mode"], c["elements_moved"],
                                                    c["words"], c["label"][:62]))
        print("      %s" % c["body_head"][:92])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
