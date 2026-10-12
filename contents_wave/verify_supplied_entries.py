"""Verify the promoted final against the supplied numbered Contents list.

Usage: python verify_supplied_entries.py "<book.html>" [out.json]

Checks, on the built artifact itself:
  * the rail row and page-cell counts;
  * that every one of the seven previously missing supplied entries is rendered,
    in the supplied order, with its exact title and printed label;
  * that the six top-level unit rows carry the supplied printed labels;
  * that no supplied entry was linked without a destination that exists;
  * that no disclosure control has an empty body.
"""
from __future__ import annotations

import io
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent))
from user_contents import NUMBERED  # noqa: E402

NAV_OPEN = '<nav id="contents-nav"'
ROW = re.compile(r'<(a|span) class="((?:nav-child|nav-unlinked)[^"]*)"([^>]*)>', re.S)
SUMMARY = re.compile(r'<details class="nav-group"><summary><a([^>]*)>(.*?)</a></summary>', re.S)
PAGE = re.compile(r'<span class="nav-page">([^<]*)</span>')
EMPTY_PANEL = '<div class="desc-panel"></div>'

SUPPLIED_NEW = [
    (1, "About this Book", "FC"),
    (2, "Cover Page", "FC"),
    (4, "Title Page", "i"),
    (5, "Copyright Page", "ii"),
    (11, "Get the most out of your textbook\u2019s . . .", "xiv"),
    (499, "FEP", "EP-1"),
    (500, "Back Cover", "BC"),
]
UNIT_SUMMARIES = {
    "#book-group-02": "2",
    "#book-group-03": "104",
    "#book-group-04": "202",
    "#book-group-05": "236",
    "#book-group-06": "328",
    "#book-group-07": "386",
}


class Rows(HTMLParser):
    """Parse the rail rows: tag, href, page cell, visible text."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[dict] = []
        self.cur = None
        self.text: list[str] = []
        self.in_page = 0
        self.page: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class", "")
        if tag == "span" and cls == "nav-page" and self.cur is not None:
            self.in_page += 1
            self.page = []
            return
        if tag in ("a", "span") and (cls.startswith("nav-child") or cls.startswith("nav-unlinked")):
            self.cur = {"tag": tag, "cls": cls, "href": a.get("href"),
                        "seq": a.get("data-supplied-entry"), "page": None}
            self.text = []

    def handle_data(self, data):
        if self.in_page:
            self.page.append(data)
        elif self.cur is not None:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag == "span" and self.in_page:
            self.in_page -= 1
            if self.cur is not None:
                self.cur["page"] = "".join(self.page).strip()
            return
        if self.cur is not None and tag == self.cur["tag"]:
            self.cur["text"] = " ".join("".join(self.text).split())
            self.rows.append(self.cur)
            self.cur = None
            self.text = []


def main() -> int:
    src = Path(sys.argv[1])
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    data = src.read_bytes()
    i = data.find(NAV_OPEN.encode())
    j = data.find(b"</nav>", i)
    nav = data[i:j + 6].decode("utf-8")

    # every href="#..." in the rail must resolve to a real element of the book
    ids = {m.decode() for m in re.findall(
        rb'id="(TMP-\d{4}|book-heading-\d{4}|book-group-\d{2})"', data)}
    hrefs = re.findall(r'href="(#[^"]+)"', nav)
    missing_hrefs = sorted({h for h in hrefs if h[1:] not in ids})

    p = Rows()
    p.feed(nav)
    rows = p.rows
    summaries = [{"href": m.group(1).split('"')[1], "page": (PAGE.search(m.group(2)) or [None, None])[1],
                  "text": " ".join(PAGE.sub("", m.group(2)).split())} for m in SUMMARY.finditer(nav)]

    supplied = {}
    for seq, title, label in SUPPLIED_NEW:
        hit = [r for r in rows if r["seq"] == str(seq)]
        supplied[str(seq)] = {
            "title": title, "label": label, "found": bool(hit),
            "text": hit[0]["text"] if hit else None,
            "printed": hit[0]["page"] if hit else None,
            "href": hit[0]["href"] if hit else None,
            "linked": bool(hit and hit[0]["href"]),
            "matches": bool(hit and hit[0]["text"] == title and hit[0]["page"] == label),
        }

    units = {s["href"]: s for s in summaries}
    unit_ok = {h: units.get(h, {}).get("page") == lab for h, lab in UNIT_SUMMARIES.items()}

    # rail order: front matter rows then the unit groups then end matter
    order = [r["text"] for r in rows]
    fm_start = order.index("About this Book")
    front_matter = order[fm_start:fm_start + 11]
    expect_fm = ["About this Book", "Cover Page", "Accessibility", "Title Page", "Copyright Page",
                 "Brief Contents", "Contents", "About the Authors", "Content Advisory Board",
                 "Business with Personal Finance", "Get the most out of your textbook\u2019s . . ."]
    tail = order[-8:]

    panels = data.count(b'class="desc-panel"')
    controls = data.count(b'<details class="disclosure"')
    empty = data.count(EMPTY_PANEL.encode())

    report = {
        "file": str(src), "bytes": len(data),
        "rail_rows": len(rows),
        "rail_page_cells": sum(1 for r in rows if r["page"]),
        "rail_unlinked": sum(1 for r in rows if r["tag"] == "span"),
        "nav_groups": len(summaries),
        "supplied_numbered_entries": len(NUMBERED),
        "supplied_rows_checked": supplied,
        "supplied_rows_all_present_and_exact": all(v["matches"] for v in supplied.values()),
        "supplied_rows_linked": sum(1 for v in supplied.values() if v["linked"]),
        "supplied_rows_unlinked": sum(1 for v in supplied.values() if not v["linked"]),
        "unit_top_level_labels": {h: units.get(h, {}).get("page") for h in UNIT_SUMMARIES},
        "unit_top_level_labels_ok": all(unit_ok.values()),
        "front_matter_order": front_matter,
        "front_matter_order_ok": front_matter == expect_fm,
        "end_matter_tail": tail,
        "broken_hrefs": missing_hrefs,
        "disclosure_controls": data.count(b'<details class="disclosure'),
        "desc_panels": panels,
        "empty_desc_panels": empty,
    }
    report["ok"] = (
        report["supplied_rows_all_present_and_exact"]
        and report["unit_top_level_labels_ok"]
        and report["front_matter_order_ok"]
        and not missing_hrefs
        and empty == 0
    )
    if out_path:
        out_path.write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=1, ensure_ascii=False))
    return 0 if report["ok"] else 3


if __name__ == "__main__":
    raise SystemExit(main())
