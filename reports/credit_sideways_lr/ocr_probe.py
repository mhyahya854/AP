"""Classify one region's printed credit orientation from its source capture.

Runs Windows OCR over the capture as-is and rotated both ways, then looks for the
words of the credit text.  Verdicts:
  horizontal        - the credit reads left-to-right on the page
  vertical_up       - the credit is printed rotated counter-clockwise (reads bottom to top)
  vertical_down     - the credit is printed rotated clockwise (reads top to bottom)
  not_found         - no rotation recovered the credit (needs a human look)
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
OCR = HERE / "win_ocr.ps1"
WS = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work")
MANIFEST = WS / "repo" / "AP" / "source_png" / "SOURCE_PNG_MANIFEST.json"

# words that carry no photographer identity and appear in very many credits
STOP = {"getty", "gettyimages", "images", "image", "alamy", "stock", "photo", "photos",
        "shutterstock", "shutterstockai", "reuters", "ap", "afp", "istock", "unsplash",
        "pexels", "zuma", "zumapress", "newscom", "pa", "paImages", "corbis", "agency",
        "anadoluagency", "picturealliance", "designpics", "superstock", "science", "source",
        "imagebank", "universalimagesgroup", "naturepicturelibrary", "the", "and", "of",
        "via", "inc", "press", "group", "media", "news", "newspapers", "wire", "rawpixel",
        "photographer", "photography", "limited", "llc", "thepictures", "camera"}


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def fuzzy_contains(blob: str, needle: str, max_mismatch: int = 1) -> bool:
    """True if needle occurs in blob allowing up to max_mismatch substitutions.

    OCR routinely confuses I/l/1 and O/0, so an exact match is too strict for the
    longer words.
    """
    if not needle:
        return False
    if needle in blob:
        return True
    if len(needle) < 7:
        return False
    n = len(needle)
    for i in range(len(blob) - n + 1):
        window = blob[i:i + n]
        if window == needle:
            return True
        mism = 0
        for a, b in zip(window, needle):
            if a != b:
                mism += 1
                if mism > max_mismatch:
                    break
        if mism <= max_mismatch:
            return True
    return False


def tokens(text: str) -> list[str]:
    """Distinctive words of a credit line (not the agency boilerplate).

    Falls back to the whole creator phrase and then to the whole line, so that
    credits whose only distinctive word is short ("Lomb/Shutterstock",
    "Bloomberg/Getty Images") still produce a needle.
    """
    out = []
    for w in re.split(r"[^A-Za-z0-9.'-]+", text):
        n = norm(w)
        if len(n) >= 4 and n not in STOP:
            out.append(n)
    creator = norm(re.split(r"[/|;]| - ", text, 1)[0])
    if len(creator) >= 5:
        out.append(creator)
    whole = norm(text)
    if 5 <= len(whole) <= 46:
        out.append(whole)
    seen, uniq = set(), []
    for n in out:
        if n not in seen:
            seen.add(n)
            uniq.append(n)
    return uniq


def ocr(png: Path) -> str:
    proc = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
                           "-File", str(OCR), "-Path", str(png)],
                          capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode != 0:
        raise RuntimeError(f"ocr failed for {png}: {proc.stderr[:200]}")
    return "\n".join(l for l in proc.stdout.splitlines() if not l.startswith("engine:"))


def rotated(src: Path, out: Path, how: str) -> Path:
    deg = {"cw": -90, "ccw": 90}[how]
    with Image.open(src) as im:
        im.convert("RGB").rotate(deg, expand=True).save(out)
    return out


def classify(png: Path, credit: str, tmp: Path, quiet: bool = False) -> dict:
    toks = tokens(credit)
    primary = max(toks, key=len) if toks else ""
    res = {"credit": credit, "needle_tokens": toks, "primary_needle": primary, "hits": {}}
    for label, how in (("as_is", None), ("rot_cw", "cw"), ("rot_ccw", "ccw")):
        img = png if how is None else rotated(png, tmp / f"{png.stem}-{how}.jpg", how)
        try:
            text = ocr(img)
        except Exception as exc:  # noqa: BLE001
            res["hits"][label] = {"error": str(exc)}
            continue
        blob = norm(text)
        found = [t for t in toks if fuzzy_contains(blob, t)]
        agency = [a for a in ("gettyimages", "alamystockphoto", "shutterstock", "reuters")
                  if a in blob]
        res["hits"][label] = {"matched": found, "n_matched": len(found), "n_tokens": len(toks),
                              "longest_matched": max(found, key=len) if found else "",
                              "primary_hit": bool(primary) and fuzzy_contains(blob, primary),
                              "agency_only": agency if not found else [],
                              "chars": len(text)}
        if not quiet:
            print(f"   {label:7s} matched {len(found)}/{len(toks)} {found}", flush=True)

    scored = {k: v for k, v in res["hits"].items() if "error" not in v}
    # strongest evidence first: the primary (longest) needle, then any long needle,
    # then two shorter needles in the same rotation
    strong = {k: v for k, v in scored.items() if v.get("primary_hit")}
    if not strong:
        strong = {k: v for k, v in scored.items() if len(v.get("longest_matched", "")) >= 6}
    if not strong:
        strong = {k: v for k, v in scored.items() if v["n_matched"] >= 2}
    if not strong:
        # fall back to a lone short needle only if exactly one rotation shows it
        weak = {k: v for k, v in scored.items() if v["n_matched"] >= 1}
        if len(weak) == 1:
            strong = weak
            res["weak_evidence"] = True
    if not strong:
        # last resort: the agency name alone, but only when one rotation shows it
        agency_hits = {k: v for k, v in scored.items() if v.get("agency_only")}
        if len(agency_hits) == 1:
            strong = agency_hits
            res["weak_evidence"] = "agency_only"
    res["match_rotations"] = sorted(strong)
    if not toks or not strong:
        res["verdict"] = "not_found"
    elif len(strong) > 1:
        res["verdict"] = "ambiguous"
    else:
        only = res["match_rotations"][0]
        res["verdict"] = {"as_is": "horizontal", "rot_cw": "vertical_up",
                          "rot_ccw": "vertical_down"}[only]
    return res


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    region, credit = sys.argv[1], sys.argv[2]
    tmp = HERE / "tmp"
    tmp.mkdir(exist_ok=True)
    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    by_tmp = {c["tmp_identifier"]: c for c in man["captures"]}
    cap = by_tmp[region]
    png = WS / "repo" / "AP" / cap["repo_path"].replace("/", "\\")
    print(f"{region}: {png}  ({cap['width_px']}x{cap['height_px']})")
    print(f"credit: {credit}")
    res = classify(png, credit, tmp)
    res.update(region=region, png=str(png))
    print(json.dumps(res, indent=1, ensure_ascii=False))
    (tmp / f"{region}-verdict.json").write_text(json.dumps(res, indent=1, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
