"""Build small single-region HTML fixtures from the accepted artifact.

The head (all CSS) is copied verbatim so the fixture lays out exactly like the
book; only the three target regions are included.  Three variants are written per
region set: the accepted markup, the bulk patch's vertical-rl style, and the
sideways-lr style the source evidence calls for.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WS = Path(r"C:\Users\mhyah\Downloads\book-source\Word\_master_work")
ACCEPTED = WS.parent / "AP Book Final.html"

STYLE_VRL = "writing-mode:vertical-rl;text-orientation:mixed;white-space:nowrap;margin:0 auto;line-height:1.15"
STYLE_SLR = "writing-mode:sideways-lr;text-orientation:mixed;white-space:nowrap;margin:0 auto;line-height:1.15"

REGIONS = {
    "TMP-0124": "Tripplaar",
    "TMP-0161": "Mario Tama",
    "TMP-0250": "Bloomberg/Getty",
}


def head_of(path: Path) -> str:
    with path.open(encoding="utf-8", errors="replace") as fh:
        head = fh.read(400_000)
    i = head.find("</head>")
    return head[: i + len("</head>")]


def article_of(path: Path, rid: str) -> str:
    """Stream the file and return the whole <article id="rid"> element."""
    open_tag = re.compile(rb'<article class="book-page" id="' + rid.encode() + rb'"[^>]*>')
    collected = bytearray()
    found = False
    carry = b""
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(8 << 20)
            if not chunk:
                break
            if not found:
                buf = carry + chunk
                m = open_tag.search(buf)
                if not m:
                    carry = buf[-64:]
                    continue
                found = True
                collected += buf[m.start():]
            else:
                collected += chunk
            i = collected.find(b"</article>")
            if i >= 0:
                return bytes(collected[: i + len(b"</article>")]).decode("utf-8")
    raise SystemExit(f"region {rid} not closed")


def credit_p_of(article: str, needle: str) -> str:
    for m in re.finditer(r"<p\b[^>]*>.*?</p>", article, re.S):
        if needle in m.group(0):
            return m.group(0)
    raise SystemExit(f"credit paragraph not found for {needle!r}")


def restyle(article: str, needle: str, style: str) -> str:
    p = credit_p_of(article, needle)
    if 'style="' in p:
        new = re.sub(r'style="([^"]*)"', lambda m: f'style="{m.group(1)};{style}"', p, count=1)
    else:
        new = re.sub(r"^<p\b", f'<p style="{style}"', p, count=1)
    return article.replace(p, new, 1)


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    head = head_of(ACCEPTED)
    arts = {rid: article_of(ACCEPTED, rid) for rid in REGIONS}
    for rid, a in arts.items():
        print(f"  {rid}: {len(a)} bytes")

    variants = {"accepted": None, "vrl": STYLE_VRL, "slr": STYLE_SLR}
    written = []
    for name, style in variants.items():
        body = []
        for rid, needle in REGIONS.items():
            art = arts[rid] if style is None else restyle(arts[rid], needle, style)
            body.append(art)
        html = (head + '<body><div class="app left-closed right-closed" id="b2-app">'
                '<main id="b2-main">' + "".join(body) + "</main></div></body></html>")
        out = HERE / f"fixture-{name}.html"
        out.write_text(html, encoding="utf-8")
        written.append(out)
        print(f"wrote {out} ({len(html)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
