"""Evidence for every Contents row that carries no destination.

One streaming pass over the artifact: for each unlinked row's wording it reports
how many regions contain it, split into the printed-Contents pages (which simply
list the title) and the body regions (where the section itself would be).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

BOOK = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\AP Book Final.html")
ROWS = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\redesign\unlinked_rows.json")
OUT = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work\redesign\reports\unlinked_evidence.json")

ART = re.compile(rb'<article class="book-page" id="(TMP-\d{4})"')
TAG = re.compile(rb"<[^>]*>")
IMG = re.compile(rb"<img\b[^>]*>")
WS = re.compile(r"\s+")


def plain(markup: bytes) -> str:
    body = IMG.sub(b" ", markup)
    body = TAG.sub(b" ", body)
    body = (body.replace(b"&nbsp;", b" ").replace(b"&amp;", b"&").replace(b"&#x27;", b"'")
                .replace(b"&quot;", b'"').replace(b"&#174;", b"\xc2\xae"))
    return WS.sub(" ", body.decode("utf-8", "replace")).strip().lower()


def main() -> int:
    rows = json.loads(ROWS.read_text(encoding="utf-8"))
    needles = {}
    for r in rows:
        t = re.sub(r"\s+", " ", r["label"]).strip().lower()
        t = re.sub(r"^[0-9a-z]+\s+", "", t)          # drop the printed label prefix
        t = re.sub(r"\.\.\.$", "", t)
        if len(t) >= 6 and not t.startswith("ap "):
            needles.setdefault(t, []).append(r["page"])
    print("needles", len(needles))

    hits = {k: [] for k in needles}
    with BOOK.open("rb") as fh:
        buf = b""
        eof = False
        cur = None
        while True:
            if cur is None:
                m = ART.search(buf)
                if not m:
                    if eof:
                        break
                    buf = buf[-8192:]
                    chunk = fh.read(8 << 20)
                    eof = not chunk
                    buf += chunk
                    continue
                cur = m.group(1).decode()
                buf = buf[m.end():]
            e = buf.find(b"</article>")
            while e < 0 and not eof:
                chunk = fh.read(8 << 20)
                eof = not chunk
                buf += chunk
                e = buf.find(b"</article>")
            if e < 0:
                break
            body = plain(buf[:e])
            for k in needles:
                if k in body:
                    hits[k].append(cur)
            buf = buf[e + 10:]
            cur = None

    report = []
    for k, pages in needles.items():
        report.append({"label": k, "printed_rows": pages,
                       "body_regions": hits[k], "found": bool(hits[k])})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    for r in report:
        print(("FOUND " if r["found"] else "ABSENT") + "  " + r["label"][:64] +
              ("  -> " + ",".join(r["body_regions"][:6]) if r["found"] else ""))
    print("written", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
