"""Source-verify the orientation of every credit the bulk patch tagged.

For each region in credit_patch.json, OCR the region's source capture as-is and at
both 90 degree rotations, then record where the credit's own words are readable.
Also records whether the reader's pre-existing runtime credit detector (the
end-anchored keyword rule) would have tagged the same paragraph in the accepted
artifact, so "before" behaviour is explicit.
"""
from __future__ import annotations

import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from ocr_probe import HERE, MANIFEST, WS, classify

PATCH = WS / "credit" / "credit_patch.json"
SCAN = WS / "credit" / "scan.json"
ACCEPTED = WS.parent / "AP Book Final.html"
RUNTIME_RE = re.compile(
    r"(Getty Images|Alamy|Shutterstock|AP Images|Reuters|Bloomberg|Courtesy|Photographer"
    r"|iStock|Unsplash|Pexels)$", re.I)


def runtime_rule(text: str) -> bool:
    return bool(RUNTIME_RE.search(text.strip()))


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    tmp = HERE / "tmp"
    tmp.mkdir(exist_ok=True)
    tagged = json.loads(PATCH.read_text(encoding="utf-8"))["tagged"]
    scan = json.loads(SCAN.read_text(encoding="utf-8"))
    full_text = {r["region"]: r["text"] for r in scan["results"]}
    geometry = {r["region"]: r for r in scan["results"]}
    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    by_tmp = {c["tmp_identifier"]: c for c in man["captures"]}
    seen, items = set(), []
    for t in tagged:
        if t["region"] in seen:
            continue
        seen.add(t["region"])
        items.append({"region": t["region"],
                      "text": full_text.get(t["region"], t["text"])})
    print(f"regions to verify: {len(items)}")

    def work(t: dict) -> dict:
        rid = t["region"]
        cap = by_tmp[rid]
        png = WS / "repo" / "AP" / cap["repo_path"].replace("/", "\\")
        rec = {"region": rid, "credit": t["text"], "source_png": cap["repo_path"],
               "runtime_rule_would_tag": runtime_rule(t["text"])}
        g = geometry.get(rid)
        if g:
            rec["measured_before"] = {k: g[k] for k in
                                      ("cellW", "pW", "pH", "widest", "avail", "lines",
                                       "imgLoaded", "writingMode") if k in g}
        try:
            res = classify(png, t["text"], tmp, quiet=True)
            rec.update(verdict=res["verdict"], needles=res["needle_tokens"],
                       hits={k: v.get("matched", []) for k, v in res["hits"].items()})
        except Exception as exc:  # noqa: BLE001
            rec.update(verdict="error", error=str(exc))
        print(f"  {rid}  {rec['verdict']:16s} {t['text'][:52]}", flush=True)
        return rec

    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(work, items))

    out = HERE / "source_orientation_sweep.json"
    out.write_text(json.dumps({"accepted": str(ACCEPTED), "rows": rows}, indent=1,
                              ensure_ascii=False), encoding="utf-8")
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["verdict"]] = counts.get(r["verdict"], 0) + 1
    print("\nverdict counts:", json.dumps(counts, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
