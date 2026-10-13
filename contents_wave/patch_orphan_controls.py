"""Convert three source-verified orphan labels into real disclosure controls.

Only cases whose body run ends at the figure caption strip (the panel's bottom
edge) are repaired; the bodies are moved verbatim from the following capture
exactly as the corrective wave did for Walmart and Merck.

  TMP-0567 <- TMP-0568 (139 words)   caption: "Figure 2.2-1 Cialdini's ..."
  TMP-0523 <- TMP-0524 (111 words)   caption: "Perfume and cosmetics ..."
  TMP-0575 <- TMP-0576 ( 35 words)   caption: "Consumers are attracted ..."
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
CONTENT_OPEN = '<div class="content">'
GLYPH = re.compile(r"^\s*(?:&#x25BC;|&#x25B8;|▼|▶|\u25bc|\u25b8|\u25b6|\bi\b)\s*$")
TAG = re.compile(r"<[^>]*>")


def elements(body):
    start = body.find('<div class="content">')
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


def text_of(s):
    return " ".join(TAG.sub(" ", s).replace("&amp;", "&").split())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("output")
    ap.add_argument("--plan", required=True)
    ap.add_argument("--report", default="")
    a = ap.parse_args()
    src, out = Path(a.source), Path(a.output)
    plan = json.loads(Path(a.plan).read_text(encoding="utf-8"))["rows"]
    jobs = [p for p in plan if p["decision"] == "REPAIR"]
    if not jobs:
        raise SystemExit("no REPAIR rows in the plan")

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
    edits, checks = {}, []
    for job in jobs:
        cid, did = job["region"], job["donor"]
        for rid in (cid, did):
            if rid not in span:
                raise SystemExit("region %s not found" % rid)
        with src.open("rb") as fh:
            fh.seek(span[cid][0])
            cb = fh.read(span[cid][1] - span[cid][0]).decode("utf-8")
            fh.seek(span[did][0])
            db = fh.read(span[did][1] - span[did][0]).decode("utf-8")

        cens, dens = elements(cb), elements(db)
        li = max(i for i, el in enumerate(cens) if "Extended description" in text_of(el))
        label_el = cens[li]
        label = text_of(label_el)
        label = re.sub(r"^\s*(?:&#x25BC;|&#x25B8;|▼|▶|\u25bc|\u25b8|\u25b6)\s*", "", label).strip()
        glyph_idx = [i for i, el in enumerate(cens) if GLYPH.match(text_of(el))]
        body_self = [cens[i] for i in job["body_self"]]
        body_don = [dens[i] for i in job["body_donor"]]
        body = "".join(body_self + body_don)
        if not body.strip():
            raise SystemExit("%s: empty body" % cid)
        control = ('<details class="disclosure"><summary><span class="b2-desc-label">'
                   + label + '</span></summary><div class="desc-panel">' + body + "</div></details>")

        drop_c = set(glyph_idx) | set(job["body_self"]) | {li}
        parts = []
        for i, el in enumerate(cens):
            if i == li:
                parts.append(control)          # the bare label becomes the control
            elif i in drop_c:
                continue                       # loose UI glyphs and the moved body
            else:
                parts.append(el)
        new_c = "".join(parts)
        new_d = "".join([el for i, el in enumerate(dens) if i not in set(job["body_donor"])])
        edits[cid] = cb[:cb.index(CONTENT_OPEN) + len(CONTENT_OPEN)] + new_c + "</div>"
        edits[did] = db[:db.index(CONTENT_OPEN) + len(CONTENT_OPEN)] + new_d + "</div>"
        checks.append({"control": cid, "donor": did, "label": label[:80],
                       "glyphs_removed": len(glyph_idx),
                       "paragraphs_moved": len(body_self) + len(body_don),
                       "words_moved": len(body.split()),
                       "body_head": text_of(body)[:110],
                       "terminator": job.get("terminator", {}).get("text") if isinstance(
                           job.get("terminator"), dict) else None})

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

    report = {"patch": "OA-007 orphan disclosure repair",
              "source": str(src), "output": str(out),
              "source_bytes": src.stat().st_size, "output_bytes": written,
              "regions_edited": sorted(edits), "controls_created": len(jobs),
              "output_sha256": h.hexdigest(), "checks": checks}
    if a.report:
        Path(a.report).write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "checks"}, indent=1, ensure_ascii=False))
    for c in checks:
        print("   ", c["control"], "<-", c["donor"], "|", c["paragraphs_moved"], "paras |",
              c["words_moved"], "words |", c["label"][:60])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
