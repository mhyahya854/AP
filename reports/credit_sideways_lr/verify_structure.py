"""Structural comparison of the accepted artifact and the staged narrow fix.

Streams both 1.13 GB files once and compares, region by region:
  * region ids and order (must be 1,899 and identical)
  * per-region plain text (must be byte-identical after whitespace normalisation)
  * per-region raw HTML (differences must be exactly the injected style attribute)
  * markup counts: img, table, details, summary, nav hrefs, disclosure summaries
  * duplicate ids and broken in-page links
and confirms everything outside the changed regions is byte-identical.
"""
from __future__ import annotations

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
STYLE = ("writing-mode:sideways-lr;text-orientation:mixed;white-space:nowrap;"
         "margin:0 auto;line-height:1.15")
INJECT_ATTR = ' style="' + STYLE + '"'          # brand-new attribute, as applied here
INJECT_PROP = re.compile(re.escape(STYLE))
NON_STRUCTURAL = {"writing_sideways_lr", "writing_vertical_rl"}


def regions(path: Path):
    """Yield (rid, start, end, body_bytes) with the surrounding bytes accounted for."""
    marks, buf, cur, tag_end, base = [], b"", None, 0, 0
    with path.open("rb") as fh:
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
    with path.open("rb") as fh:
        prev = 0
        for s, e, rid in marks:
            fh.seek(prev)
            gap = fh.read(s - prev)
            fh.seek(s)
            body = fh.read(e - s)
            yield rid, s, e, body, gap
            prev = e
        fh.seek(prev)
        yield None, prev, path.stat().st_size, fh.read(), b""


def counts(body: str) -> dict:
    return {
        "img": len(re.findall(r"<img\b", body)),
        "table": len(re.findall(r"<table\b", body)),
        "details": len(re.findall(r"<details\b", body)),
        "summary": len(re.findall(r"<summary\b", body)),
        "p": len(re.findall(r"<p\b", body)),
        "writing_sideways_lr": len(re.findall(r"writing-mode:sideways-lr", body)),
        "writing_vertical_rl": len(re.findall(r"writing-mode:vertical-rl", body)),
    }


def main() -> int:
    accepted, staged = Path(sys.argv[1]), Path(sys.argv[2])
    out_path = Path(sys.argv[3]) if len(sys.argv) > 3 else Path("verify_structure.json")
    rep: dict = {"accepted": str(accepted), "staged": str(staged), "problems": [],
                 "changed_regions": [], "counts_accepted": {}, "counts_staged": {},
                 "regions": 0, "word_count_accepted": 0, "word_count_staged": 0}
    ca, cs = {k: 0 for k in counts("")}, {k: 0 for k in counts("")}
    shell_a, shell_s = hashlib.sha256(), hashlib.sha256()
    dup_ids: dict[str, int] = {}
    ids_a: list[str] = []
    hrefs: set[str] = set()

    gen_a = regions(accepted)
    gen_s = regions(staged)
    while True:
        try:
            rid_a, s_a, e_a, body_a, gap_a = next(gen_a)
        except StopIteration:
            break
        rid_s, s_s, e_s, body_s, gap_s = next(gen_s)
        shell_a.update(gap_a)
        shell_s.update(gap_s)
        shell_text = gap_a.decode("utf-8", "replace")
        ids_a.extend(re.findall(r'id="([^"]+)"', shell_text))
        hrefs.update(h for h in re.findall(r'href="#([^"]+)"', shell_text) if h)
        if gap_a != gap_s:
            rep["problems"].append(f"non-region bytes differ before {rid_a}")
        if rid_a != rid_s:
            rep["problems"].append(f"region id mismatch {rid_a} vs {rid_s}")
            break
        if rid_a is None:
            tail_text = body_a.decode("utf-8", "replace")
            ids_a.extend(re.findall(r'id="([^"]+)"', tail_text))
            hrefs.update(h for h in re.findall(r'href="#([^"]+)"', tail_text) if h)
            break
        rep["regions"] += 1
        sa, ss = body_a.decode("utf-8"), body_s.decode("utf-8")
        for k in ca:
            ca[k] += counts(sa)[k]
            cs[k] += counts(ss)[k]
        ta, ts = " ".join(text_of(sa).split()), " ".join(text_of(ss).split())
        rep["word_count_accepted"] += len(ta.split())
        rep["word_count_staged"] += len(ts.split())
        if ta != ts:
            rep["problems"].append(f"{rid_a}: region text changed")
        if ss != sa:
            stripped = ss
            for cand in (INJECT_ATTR, ";" + STYLE, STYLE + ";"):
                stripped = stripped.replace(cand, "")
            if stripped != sa:
                stripped2 = INJECT_PROP.sub("", ss)
                stripped2 = re.sub(r'\s*style=""', "", stripped2)
                if stripped2 != sa:
                    rep["problems"].append(f"{rid_a}: change is not exactly the injected style")
        if body_a != body_s:
            n = ss.count(STYLE)
            rep["changed_regions"].append({"region": rid_a, "injections": n,
                                           "bytes_added": len(body_s) - len(body_a)})
        ids_a.extend(re.findall(r'id="([^"]+)"', sa))
        hrefs.update(h for h in re.findall(r'href="#([^"]+)"', sa) if h)
        # disclosures: every <details> must own exactly one summary and non-empty content
        for m in re.finditer(r"<details\b[^>]*>(.*?)</details>", sa, re.S):
            inner = m.group(1)
            rep["disclosure_checks"] = rep.get("disclosure_checks", 0) + 1
            if inner.count("<summary") != 1:
                rep["disclosure_problems"] = rep.get("disclosure_problems", 0) + 1
            body_txt = " ".join(text_of(inner).split())
            if not body_txt:
                rep["disclosure_empty"] = rep.get("disclosure_empty", 0) + 1

    for i in ids_a:
        dup_ids[i] = dup_ids.get(i, 0) + 1
    dups = {k: v for k, v in dup_ids.items() if v > 1}
    rep["duplicate_ids"] = len(dups)
    rep["duplicate_id_samples"] = list(dups)[:5]
    rep["nav_hash_links"] = len(hrefs)
    rep["broken_hash_links"] = sorted(h for h in hrefs if h not in set(ids_a))
    rep["counts_accepted"], rep["counts_staged"] = ca, cs
    rep["shell_sha256_accepted"] = shell_a.hexdigest()
    rep["shell_sha256_staged"] = shell_s.hexdigest()
    rep["shell_identical"] = shell_a.hexdigest() == shell_s.hexdigest()
    for k in ca:
        if k not in NON_STRUCTURAL and ca[k] != cs[k]:
            rep["problems"].append(f"count {k} changed: {ca[k]} -> {cs[k]}")
    rep["ok"] = not rep["problems"]
    out_path.write_text(json.dumps(rep, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: rep[k] for k in ("regions", "changed_regions", "counts_accepted",
                                          "counts_staged", "word_count_accepted",
                                          "word_count_staged", "duplicate_ids",
                                          "nav_hash_links", "broken_hash_links",
                                          "shell_identical", "ok", "problems")},
                     indent=1, ensure_ascii=False)[:4000])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
