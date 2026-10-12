"""Supplied-entries wave: surgical, streaming rewrite of the Contents rail only.

Everything outside `<nav id="contents-nav">` is copied byte-for-byte.

  * adds the seven supplied numbered Contents entries that had no sidebar row,
    in the supplied order (front matter) and after Index (end matter);
  * puts the supplied printed page label on the six top-level unit rows;
  * repairs the one navigation label whose source text had lost its spaces
    ("BUSINESSWITHPERSONALFINANCE" -> "Business with Personal Finance");
  * re-orders the front-matter and glossary rows into the supplied order.

No href of an existing row is added, removed or re-pointed.  No article content
is touched: the 1,899 source regions stay byte-identical.
"""
from __future__ import annotations

import argparse, hashlib, io, json, re, sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

NAV_OPEN = b'<nav id="contents-nav"'
NAV_CLOSE = b'</nav>'
HEAD_BYTES = 16 << 20

FRONTMATTER_SUMMARY = '<details class="nav-group"><summary><a href="#book-group-01">Front matter</a></summary>'
UNIT_LABELS = {
    "book-group-02": "2",
    "book-group-03": "104",
    "book-group-04": "202",
    "book-group-05": "236",
    "book-group-06": "328",
    "book-group-07": "386",
}
GLOSSARY_PAIR = (
    '<a class="nav-child" data-source-contents-id="TMP-0044:3" href="#book-heading-0383" data-depth="1">'
    '<span class="nav-page">440</span>Glossary/Glosario</a>'
    '<a class="nav-child" href="#book-heading-0382"><span class="nav-page">G-1</span>Glossary</a>'
)
GLOSSARY_PAIR_ORDERED = (
    '<a class="nav-child" href="#book-heading-0382"><span class="nav-page">G-1</span>Glossary</a>'
    '<a class="nav-child" data-source-contents-id="TMP-0044:3" href="#book-heading-0383" data-depth="1">'
    '<span class="nav-page">440</span>Glossary/Glosario</a>'
)
LOST_SPACES = 'data-nav-label="BUSINESSWITHPERSONALFINANCE"'
LOST_SPACES_FIXED = 'data-nav-label="Business with Personal Finance"'


def unlinked(seq: int, label: str, title: str) -> str:
    return ('<span class="nav-child nav-unlinked" data-supplied-entry="%d" '
            'title="No verified destination"><span class="nav-page">%s</span>%s</span>'
            % (seq, label, title))


def linked(seq: int, label: str, title: str, href: str) -> str:
    return ('<a class="nav-child" data-supplied-entry="%d" href="%s">'
            '<span class="nav-page">%s</span>%s</a>' % (seq, href, label, title))


def transform(nav: str) -> tuple[str, dict]:
    steps = {}

    # ---- 1. front matter, rebuilt in the supplied order -------------------
    at = nav.find(FRONTMATTER_SUMMARY)
    if at < 0:
        raise SystemExit("front matter group not found")
    end = nav.find("</details>", at)
    if end < 0:
        raise SystemExit("front matter group is not closed")
    old = nav[at:end + len("</details>")]
    children = [old[len(FRONTMATTER_SUMMARY):-len("</details>")]]
    existing = re.findall(r'<a class="nav-child" href="#(book-heading-\d{4})">'
                          r'<span class="nav-page">([^<]*)</span>([^<]*)</a>', children[0])
    byl = {h: (lab, t) for h, lab, t in existing}
    need = ["book-heading-0001", "book-heading-0002", "book-heading-0003",
            "book-heading-0004", "book-heading-0005", "book-heading-0006"]
    if sorted(byl) != sorted(need):
        raise SystemExit("unexpected front-matter rows: %s" % sorted(byl))
    if "BUSINESSWITHPERSONALFINANCE" not in byl["book-heading-0001"][1]:
        raise SystemExit("lost-spaces label not where it was expected")
    bwp = '<a class="nav-child" href="#book-heading-0001"><span class="nav-page">%s</span>%s</a>' % (
        byl["book-heading-0001"][0], "Business with Personal Finance")

    def anchor(h):
        lab, t = byl[h]
        return '<a class="nav-child" href="#%s"><span class="nav-page">%s</span>%s</a>' % (h, lab, t)

    new_children = (
        unlinked(1, "FC", "About this Book")
        + linked(2, "FC", "Cover Page", "#TMP-0001")
        + anchor("book-heading-0002")                                   # Accessibility  A1
        + unlinked(4, "i", "Title Page")
        + unlinked(5, "ii", "Copyright Page")
        + anchor("book-heading-0003")                                   # Brief Contents iii
        + anchor("book-heading-0004")                                   # Contents       iv
        + anchor("book-heading-0005")                                   # About the Authors x
        + anchor("book-heading-0006")                                   # Content Advisory Board xii
        + bwp                                                           # Business with Personal Finance xiii
        + linked(11, "xiv", "Get the most out of your textbook\u2019s . . .", "#TMP-0056")
    )
    new = FRONTMATTER_SUMMARY + new_children + "</details>"
    nav = nav.replace(old, new, 1)
    steps["front_matter_rows_reordered_and_added"] = 7

    # ---- 2. printed label on the six top-level unit rows ------------------
    for group, label in UNIT_LABELS.items():
        pat = '<summary><a href="#%s">([^<]*)</a></summary>' % group
        hits = re.findall(pat, nav)
        if len(hits) != 1:
            raise SystemExit("unit summary %s matched %d times" % (group, len(hits)))
        nav = re.sub(pat, '<summary><a href="#%s"><span class="nav-page">%s</span>\\1</a></summary>'
                     % (group, label), nav, count=1)
    steps["unit_labels_applied"] = len(UNIT_LABELS)

    # ---- 3. glossary rows in the supplied order ---------------------------
    if nav.count(GLOSSARY_PAIR) != 1:
        raise SystemExit("glossary pair not found exactly once")
    nav = nav.replace(GLOSSARY_PAIR, GLOSSARY_PAIR_ORDERED, 1)
    steps["glossary_rows_reordered"] = 1

    # ---- 4. end matter: FEP and Back Cover after Index --------------------
    if nav.count(">Index</span></details>") != 1:
        raise SystemExit("Index row not found exactly once")
    nav = nav.replace(">Index</span></details>",
                      ">Index</span></details>"
                      + unlinked(499, "EP-1", "FEP")
                      + unlinked(500, "BC", "Back Cover"), 1)
    steps["end_matter_rows_added"] = 2
    return nav, steps


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("output")
    ap.add_argument("--report", default="")
    a = ap.parse_args()
    src, out = Path(a.source), Path(a.output)
    stats = {"source": str(src), "output": str(out), "source_bytes": src.stat().st_size}

    with src.open("rb") as fh:
        head = fh.read(HEAD_BYTES)
        i = head.find(NAV_OPEN)
        j = head.find(NAV_CLOSE, i)
        if i < 0 or j < 0:
            raise SystemExit("contents nav not found in the first block")
        nav_bytes = head[i:j + len(NAV_CLOSE)]
        nav = nav_bytes.decode("utf-8")
        before_rows = nav.count('class="nav-child') + nav.count('class="nav-unlinked')
        pages_before = nav.count('class="nav-page"')
        new_nav, steps = transform(nav)
        stats["steps"] = steps
        stats["rows_before"], stats["rows_after"] = before_rows, (
            new_nav.count('class="nav-child') + new_nav.count('class="nav-unlinked'))
        stats["page_cells_before"] = pages_before
        stats["page_cells_after"] = new_nav.count('class="nav-page"')
        head = head[:i] + new_nav.encode("utf-8") + head[j + len(NAV_CLOSE):]
        # the article-level nav label for the cover region lost its spaces too
        n_lost = head.count(LOST_SPACES.encode("utf-8"))
        head = head.replace(LOST_SPACES.encode("utf-8"), LOST_SPACES_FIXED.encode("utf-8"))
        stats["cover_data_nav_label_fixed"] = n_lost

        h = hashlib.sha256()
        h.update(head)
        total = len(head)
        with out.open("wb") as oh:
            oh.write(head)
            while True:
                chunk = fh.read(8 << 20)
                if not chunk:
                    break
                oh.write(chunk)
                h.update(chunk)
                total += len(chunk)

    stats["output_bytes"] = out.stat().st_size
    stats["output_sha256"] = h.hexdigest()
    stats["bytes_added"] = stats["output_bytes"] - stats["source_bytes"]
    stats["ok"] = 0 < stats["bytes_added"] < 40000 and stats["rows_after"] == stats["rows_before"] + 7
    if a.report:
        Path(a.report).write_text(json.dumps(stats, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(stats, indent=1, ensure_ascii=False))
    return 0 if stats["ok"] else 3


if __name__ == "__main__":
    raise SystemExit(main())
