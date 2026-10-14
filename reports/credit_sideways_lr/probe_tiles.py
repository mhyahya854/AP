"""Second-stage probe: OCR overlapping, upscaled tiles of a source capture.

Used for the credits that whole-page OCR could not read.  A tile is accepted only
if it recovers at least two distinctive words of the credit (or the one long
distinctive word), so a stray match cannot decide the orientation.
"""
from __future__ import annotations

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

from ocr_probe import HERE, MANIFEST, WS, fuzzy_contains, norm, ocr, tokens


def tiles(src: Path, out_dir: Path, cols: int = 3, rows: int = 2, overlap: float = 0.12,
          upscale: float = 2.0) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    out = []
    with Image.open(src) as im:
        w, h = im.size
        for r in range(rows):
            for c in range(cols):
                x0 = max(0, int((c / cols - overlap / 2) * w))
                x1 = min(w, int(((c + 1) / cols + overlap / 2) * w))
                y0 = max(0, int((r / rows - overlap / 2) * h))
                y1 = min(h, int(((r + 1) / rows + overlap / 2) * h))
                t = im.convert("RGB").crop((x0, y0, x1, y1))
                t = t.resize((round(t.width * upscale), round(t.height * upscale)), Image.LANCZOS)
                p = out_dir / f"tile-{r}-{c}.png"
                t.save(p)
                out.append({"path": p, "row": r, "col": c, "box": [x0, y0, x1, y1]})
    return out


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    regions = sys.argv[1:]
    tmp = HERE / "tmp"
    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    by_tmp = {c["tmp_identifier"]: c for c in man["captures"]}
    scan = json.loads((WS / "credit" / "scan.json").read_text(encoding="utf-8"))
    full_text = {r["region"]: r["text"] for r in scan["results"]}
    sweep = {r["region"]: r for r in json.loads(
        (HERE / "source_orientation_sweep.json").read_text(encoding="utf-8"))["rows"]}

    results = []
    for rid in regions:
        cap = by_tmp[rid]
        credit = sweep[rid]["credit"] or full_text.get(rid, "")
        toks = tokens(credit)
        png = WS / "repo" / "AP" / cap["repo_path"].replace("/", "\\")
        tdir = tmp / f"{rid}-tiles"
        tile_defs = tiles(png, tdir)
        found: dict[str, list[dict]] = {"as_is": [], "rot_cw": [], "rot_ccw": []}

        def run(td: dict):
            tile = td["path"]
            local = {}
            for label, deg in (("as_is", 0), ("rot_cw", -90), ("rot_ccw", 90)):
                img = tile
                if deg:
                    rot = tile.with_name(tile.stem + f"-{label}.png")
                    with Image.open(tile) as im:
                        im.rotate(deg, expand=True).save(rot)
                    img = rot
                try:
                    blob = norm(ocr(img))
                except Exception:  # noqa: BLE001
                    continue
                local[label] = [t for t in toks if fuzzy_contains(blob, t)]
            return td, local

        with ThreadPoolExecutor(max_workers=3) as pool:
            for td, local in pool.map(run, tile_defs):
                for label, hits in local.items():
                    if len(hits) >= 2 or any(len(t) >= 8 for t in hits):
                        found[label].append({"tile": str(td["path"]), "row": td["row"],
                                             "col": td["col"], "box": td["box"], "words": hits})
        verdict = "not_found"
        if len([k for k, v in found.items() if v]) == 1:
            only = [k for k, v in found.items() if v][0]
            verdict = {"as_is": "horizontal", "rot_cw": "vertical_up",
                       "rot_ccw": "vertical_down"}[only]
        elif len([k for k, v in found.items() if v]) > 1:
            verdict = "ambiguous"
        rec = {"region": rid, "credit": credit, "needles": toks, "tile_hits": found,
               "verdict_tiles": verdict}
        print(f"{rid}  {verdict:14s} {credit[:50]}  hits={ {k: len(v) for k, v in found.items()} }",
              flush=True)
        results.append(rec)
    out = HERE / "source_orientation_tiles.json"
    out.write_text(json.dumps(results, indent=1, ensure_ascii=False), encoding="utf-8")
    print("wrote", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
