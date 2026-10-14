"""Narrow photo-credit fix: sideways-lr only, only where the source says so.

Same streaming, attribute-only technique as the rejected bulk patch, but:
  * the writing mode is sideways-lr (the source prints these credits rotated
    counter-clockwise, reading bottom to top) instead of vertical-rl, which
    rendered them upside down;
  * the paragraph must belong to a region whose printed credit was recovered
    from its own source capture by credit_fix/ocr_probe.py (see
    source_orientation_sweep.json).  Anything without that evidence is skipped.

Nothing else changes: no text, no elements, no order, no CSS, no JavaScript.
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
WS = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work")
sys.path.insert(0, str(WS / "repo" / "AP" / "reader"))
from region_text import text_of  # noqa: E402

ART = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"[^>]*>')
END = b"</article>"
CREDIT = re.compile(r"(Getty Images|Alamy|Shutterstock|iStock|AP Images|Reuters|Bloomberg|"
                    r"Unsplash|Pexels|Zuma|Newscom|Science Source|The Image Bank|Corbis|"
                    r"Stock Photo|Photographer|AFP|Associated Press|PA Images|Anadolu|"
                    r"picture alliance|Design Pics|Superstock|Nature Picture|"
                    r"Los Angeles Times|Houston Chronicle|Washington Post|"
                    r"Anadolu Agency|The Washington Post|Tribune|Hearst)", re.I)
STYLE = "writing-mode:sideways-lr;text-orientation:mixed;white-space:nowrap;margin:0 auto;line-height:1.15"


def credit_cells(body: str):
    """Cells whose only content is a single credit paragraph, in a row with an image."""
    out = []
    for m in re.finditer(r"<td\b([^>]*)>(.*?)</td>", body, re.S):
        inner = m.group(2)
        ps = re.findall(r"<p\b[^>]*>.*?</p>", inner, re.S)
        if len(ps) != 1:
            continue
        p = ps[0]
        txt = " ".join(text_of(p).split())
        if not txt or len(txt) > 90 or not CREDIT.search(txt):
            continue
        if re.search(r"(Left:|right:|;)", txt):
            continue
        if "<img" in inner:
            continue
        tr_start = body.rfind("<tr", 0, m.start())
        tr_end = body.find("</tr>", m.end())
        if tr_start < 0 or tr_end < 0:
            continue
        if "<img" not in body[tr_start:tr_end]:
            continue
        out.append({"start": m.start(2) + body[m.start(2):m.end(2)].find(p), "p": p, "text": txt})
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("output")
    ap.add_argument("--verified", required=True, help="source_orientation_sweep.json")
    ap.add_argument("--report", default="")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    sweep = json.loads(Path(a.verified).read_text(encoding="utf-8"))["rows"]
    verified = {r["region"] for r in sweep if r["verdict"] == "vertical_up"}
    evidence = {r["region"]: {"credit": r["credit"], "verdict": r["verdict"],
                              "source_png": r["source_png"],
                              "match_rotations": r.get("match_rotations", [])} for r in sweep}
    print(f"source-verified vertical credits: {len(verified)}")
    for r in sweep:
        if r["verdict"] != "vertical_up":
            print(f"  NOT VERIFIED, will be left alone: {r['region']} ({r['verdict']})")

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

    edits, tagged, skipped = {}, [], []
    with src.open("rb") as fh:
        for s, e, rid in marks:
            fh.seek(s)
            body = fh.read(e - s).decode("utf-8")
            cands = credit_cells(body)
            if not cands:
                continue
            if rid not in verified:
                for c in cands:
                    skipped.append({"region": rid, "text": c["text"], "why": "no source evidence"})
                continue
            new_body, changed = body, 0
            for c in sorted(cands, key=lambda c: -c["start"]):
                p = c["p"]
                if "writing-mode" in p:
                    continue
                if 'style="' in p:
                    newp = re.sub(r'style="([^"]*)"',
                                  lambda mm: 'style="%s;%s"' % (mm.group(1), STYLE), p, count=1)
                else:
                    newp = re.sub(r"^<p\b", '<p style="%s"' % STYLE, p, count=1)
                at = new_body.find(p)
                if at < 0:
                    continue
                new_body = new_body[:at] + newp + new_body[at + len(p):]
                changed += 1
                tagged.append({"region": rid, "text": c["text"][:70]})
            if changed:
                edits[rid] = new_body

    print("credits styled:", len(tagged), " regions:", len(edits))
    if a.dry_run:
        if a.report:
            Path(a.report).write_text(json.dumps({"dry_run": True, "tagged": tagged,
                                                  "skipped": skipped}, indent=1,
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
    rep = {"patch": "photo-credit orientation, sideways-lr, source-verified regions only",
           "style": STYLE, "credits_styled": len(tagged), "regions_edited": sorted(edits),
           "verified_regions": len(verified), "skipped_no_evidence": skipped,
           "output_bytes": written, "bytes_delta": written - src.stat().st_size,
           "output_sha256": h.hexdigest(), "source_sha256":
           hashlib.sha256(Path(a.source).read_bytes()).hexdigest() if src.stat().st_size < 1 << 20 else None,
           "tagged": tagged, "evidence": {k: evidence[k] for k in sorted(edits)}}
    if a.report:
        Path(a.report).write_text(json.dumps(rep, indent=1, ensure_ascii=False), encoding="utf-8")
    print("bytes:", written, "delta:", written - src.stat().st_size, "sha256:", h.hexdigest())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
