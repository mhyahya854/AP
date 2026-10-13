"""Phase 1: convert the remaining orphan labels into real disclosure controls.

Four mechanisms, each driven by the measured structure rather than a font guess:
  cell       the grey panel cell already holds label *and* body -> control in place
  donor      the body is the leading element(s) of the next capture's panel cell
  self       the body is the region's own panel-indented paragraphs after the bar
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
GLYPH = "&#x25BC;|&#x25B8;|▼|▶|►|\u25bc|\u25b8|\u25b6|\u2b07"

SPECS = [
    {"region": "TMP-0121", "mode": "cell", "bg": "#EEEEEE"},
    {"region": "TMP-0125", "mode": "cell", "bg": "#EEEEEE"},
    {"region": "TMP-0152", "mode": "cell", "bg": "#FFFFFF"},
    {"region": "TMP-0428", "mode": "cell", "bg": "#EEEEEE"},
    {"region": "TMP-0929", "mode": "cell"},
    {"region": "TMP-1067", "mode": "cell"},
    {"region": "TMP-0621", "mode": "donor", "donor": "TMP-0622", "d_idx": [0]},
    {"region": "TMP-0624", "mode": "donor", "donor": "TMP-0625", "d_idx": [0]},
    {"region": "TMP-0312", "mode": "donor", "donor": "TMP-0313", "d_idx": [0]},
    {"region": "TMP-0846", "mode": "donor", "donor": "TMP-0847", "d_idx": [0]},
    {"region": "TMP-0849", "mode": "donor", "donor": "TMP-0850", "d_idx": [0]},
    {"region": "TMP-0421", "mode": "self", "s_idx": [3, 4], "bar_idx": 1},
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


def find_cell(html, idx, bg=None):
    """(start, end, inner_start, inner_end) of the innermost td containing idx."""
    best = None
    for m in re.finditer(r"<td\b([^>]*)>", html):
        if m.start() > idx:
            break
        if bg and not re.search(r"background:\s*%s" % re.escape(bg), m.group(1), re.I):
            continue
        depth, j = 1, m.end()
        pat = re.compile(r"<td\b[^>]*>|</td>")
        while depth and j < len(html):
            mm = pat.search(html, j)
            if not mm:
                break
            depth += -1 if mm.group(0).startswith("</") else 1
            j = mm.end()
        if j > idx:
            cand = (m.start(), j, m.end(), j - len("</td>"))
            if best is None or cand[2] > best[2]:      # innermost = latest inner start
                best = cand
    return best


def label_from(text_after, stop_at_glyph=True):
    t = " ".join(text_after.split())
    t = re.sub(r"^\s*(?:%s)\s*" % GLYPH, "", t)
    t = re.sub(r"\s*(?:&#x24D8;|ⓘ|\u2139|\bi\b)\s*$", "", t).strip()
    return t


def build_control(label, body):
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
        if sp.get("donor"):
            need.add(sp["donor"])
    bodies = {}
    with src.open("rb") as fh:
        for rid in need:
            s, e = span[rid]
            fh.seek(s)
            bodies[rid] = fh.read(e - s).decode("utf-8")

    edits, checks = {}, []
    for sp in SPECS:
        rid = sp["region"]
        body_html = bodies[rid]
        mode = sp["mode"]
        idx = body_html.find("Extended description for")
        if idx < 0:
            raise SystemExit("%s: label not found" % rid)
        if mode in ("cell", "donor"):
            cell = find_cell(body_html, idx, sp.get("bg"))
            if not cell:
                raise SystemExit("%s: label cell not found" % rid)
            cs, ce, is_, ie = cell
            inner = body_html[is_:ie]
            li = inner.find("Extended description for")
            p_open = inner.rfind("<p", 0, li)
            p_close = inner.find("</p>", li)
            if p_open < 0 or p_close < 0:
                raise SystemExit("%s: label paragraph not delimited" % rid)
            label = label_from(text_of(inner[p_open:inner.find(">", p_open)] + inner[inner.find(">", p_open) + 1:p_close])) if False else \
                label_from(text_of(inner[p_open:p_close + 4]))
            rest = inner[p_close + 4:]
            if mode == "cell":
                body = rest
                # keep whatever the cell held before the label paragraph
                # (figures, earlier rows) - only the label becomes the control
                new_inner = inner[:p_open] + build_control(label, body)
                new_html = body_html[:is_] + new_inner + body_html[ie:]
                moved_words = len(words_only(text_of(body)).split())
                donor = None
            else:
                donor = sp["donor"]
                dels, dinner = els(bodies[donor])
                body = "".join(dels[i] for i in sp["d_idx"])
                new_inner = build_control(label, body)
                new_html = body_html[:is_] + inner[:p_open] + new_inner + inner[p_close + 4:] + body_html[ie:]
                moved_words = len(words_only(text_of(body)).split())
                keep = "".join(el for i, el in enumerate(dels) if i not in set(sp["d_idx"]))
                edits[donor] = bodies[donor][:bodies[donor].find(CONTENT) + len(CONTENT)] + keep + "</div>"
        else:  # self
            top, inner = els(body_html)
            bar = top[sp["bar_idx"]]
            label = label_from(text_of(bar))
            body = "".join(top[i] for i in sp["s_idx"])
            drop = set(sp["s_idx"])
            parts = []
            for i, el in enumerate(top):
                if i == sp["bar_idx"]:
                    parts.append(build_control(label, body))
                elif i in drop:
                    continue
                else:
                    parts.append(el)
            new_html = body_html[:body_html.find(CONTENT) + len(CONTENT)] + "".join(parts) + "</div>"
            moved_words = len(words_only(text_of(body)).split())
            donor = None
        edits[rid] = new_html
        checks.append({"control": rid, "mode": mode, "donor": donor, "label": label[:80],
                       "words_moved": moved_words,
                       "body_head": " ".join(text_of(body).split())[:100]})

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

    rep = {"patch": "Phase 1 orphan disclosures (round 2)", "controls": len(SPECS),
           "regions_edited": sorted(edits), "source_bytes": src.stat().st_size,
           "output_bytes": written, "bytes_delta": written - src.stat().st_size,
           "output_sha256": h.hexdigest(), "checks": checks}
    if a.report:
        Path(a.report).write_text(json.dumps(rep, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in rep.items() if k != "checks"}, indent=1, ensure_ascii=False))
    for c in checks:
        print("  %s [%s] donor=%s words=%d | %s" % (c["control"], c["mode"], c["donor"],
                                                    c["words_moved"], c["label"][:60]))
        print("      body: %s" % c["body_head"][:90])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
