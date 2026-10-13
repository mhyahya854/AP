"""Phase 1b: TMP-0726 and TMP-0756, whose boundaries were confirmed on the captures.

Both panels end above a caption strip, so the caption stays outside the control.
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
    need = ["TMP-0726", "TMP-0727", "TMP-0756", "TMP-0757"]
    bodies = {}
    with src.open("rb") as fh:
        for rid in need:
            s, e = span[rid]
            fh.seek(s)
            bodies[rid] = fh.read(e - s).decode("utf-8")

    edits, checks = {}, []

    # ---- TMP-0726: body is the donor's leading paragraphs, caption stays -----
    d = bodies["TMP-0727"]
    cap_at = d.index("When a crisis makes consumers vulnerable")
    cap_p = d.rfind("<p", 0, cap_at)
    cstart = d.find(CONTENT) + len(CONTENT)
    body726 = d[cstart:cap_p]
    label_p = re.search(r"<p\b[^>]*>(?:(?!</p>).)*?Extended description for Disaster Strikes.*?</p>",
                        bodies["TMP-0726"], re.S)
    if not label_p:
        raise SystemExit("0726 label paragraph not found")
    edits["TMP-0726"] = (bodies["TMP-0726"][:label_p.start()]
                         + control("Extended description for Disaster Strikes", body726)
                         + bodies["TMP-0726"][label_p.end():])
    edits["TMP-0727"] = d[:cap_p] + d[cap_p:]
    edits["TMP-0727"] = d[:cstart] + d[cap_p:]          # keep only the caption strip
    checks.append({"control": "TMP-0726", "donor": "TMP-0727", "words_moved":
                   len(words_only(text_of(body726)).split()),
                   "body_head": " ".join(text_of(body726).split())[:90],
                   "caption_left": " ".join(text_of(d[cap_p:]).split())[:80]})

    # ---- TMP-0756: panel body sits after the inner label table ---------------
    r = bodies["TMP-0756"]
    lab_tbl = re.search(r"<table><tr><td><p[^>]*>(?:(?!</table>).)*?Extended description for Docu Sign"
                        r".*?</table>", r, re.S)
    if not lab_tbl:
        raise SystemExit("0756 label table not found")
    t0 = r.index(">Text on the screen reads")
    p_start = r.rfind("<p", 0, t0)
    cell_end = r.index("</td></tr></table>", t0)
    body756_self = r[p_start:cell_end]
    dl = bodies["TMP-0757"]
    dels = re.findall(r"<table\b.*?</table>|</?p[^>]*>", dl, re.S)
    d_body = re.search(r"<table\b[^>]*><tr><td>(?:(?!</table>).)*?Free\. The eSignature solution.*?</table>",
                       dl, re.S)
    if not d_body:
        raise SystemExit("0757 body table not found")
    body756 = body756_self + d_body.group(0)
    new756 = (r[:lab_tbl.start()]
              + control("Extended description for Docu Sign", body756)
              + r[lab_tbl.end():p_start]
              + r[cell_end:])
    new757 = dl.replace(d_body.group(0), "", 1)
    edits["TMP-0756"] = new756
    edits["TMP-0757"] = new757
    checks.append({"control": "TMP-0756", "donor": "TMP-0757", "words_moved":
                   len(words_only(text_of(body756)).split()),
                   "body_head": " ".join(text_of(body756).split())[:90],
                   "caption_left": " ".join(text_of(new757[new757.find(CONTENT):]).split())[:80]})

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

    rep = {"patch": "Phase 1b (0726, 0756)", "regions_edited": sorted(edits),
           "output_bytes": written, "bytes_delta": written - src.stat().st_size,
           "output_sha256": h.hexdigest(), "checks": checks}
    if a.report:
        Path(a.report).write_text(json.dumps(rep, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in rep.items() if k != "checks"}, indent=1, ensure_ascii=False))
    for c in checks:
        print("  %s <- %s words=%d | %s" % (c["control"], c["donor"], c["words_moved"], c["body_head"]))
        print("      caption kept: %s" % c["caption_left"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
