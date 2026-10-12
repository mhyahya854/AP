# Business with Personal Finance (AP® Course) — reconstructed offline reader

This repository holds one complete, self-contained offline HTML copy of the
reconstructed textbook, together with the presentation layer that shapes it and
the verification evidence behind it.

## Download and open the book

The book is stored with **Git LFS**. A plain download of the file from the
GitHub web UI will give you a small text pointer, not the book, so fetch it
properly:

```bash
git lfs install
git clone https://github.com/mhyahya854/AP.git
cd AP
git lfs pull                 # fetches the ~1.13 GB HTML object
```

Then open `AP Book Final.html` in a modern browser (Chrome, Edge, Firefox).
No server, no network connection and no other file is required: every figure
and table is an inlined `data:` URI and the only scripts are three inline
scripts.

GitHub's source viewer and GitHub Pages do **not** render this file as the
finished interactive textbook. The complete artifact has to be fetched through
Git LFS and opened locally.

| Field | Value |
|---|---|
| File | `AP Book Final.html` |
| Bytes | 1,132,281,148 |
| SHA-256 | `e38a07ca2f09c77deb7dce38993bba41b10b18ba8effd2d7a1d67806b47dfd83` |

Verify after downloading:

```bash
sha256sum "AP Book Final.html"   # or: shasum -a 256, certutil -hashfile ... SHA256
```

## What was reconstructed

* **1,899 source regions** (`TMP-0001` … `TMP-1899`) recovered from page images
  and the Word documents that accompanied them, in verified reading order.
* **502 Contents entries** in the exact wording and hierarchy of the printed
  Contents pages; 376 of them resolve to a verified heading, 125 are shown
  without a link because no source-verified destination exists, and the Index
  entry is kept visible although its body was never supplied.
* **383 heading anchors**, 1,484 tables, 131 Extended Description controls,
  151 learning-goal badges, and the book's figures, captions and credits.

## How the continuous sections work

The whole book is one flowing reading sheet rather than a stack of paper
cards. In Continuous mode every source region is transparent, shadow-free and
margin-free on a single white reading column, so a module runs from its first
heading to its last case study without an artificial page break. A restrained
hairline is drawn only where a verified module or unit actually begins
(42 module/unit headings and 9 group anchors are tagged
`data-section-start="1"`). The 210 mm layout width is preserved, so
fixed-geometry tables, SVG compositions and figures still render at the size
they were reconstructed for.

The reader also offers a single-page view and a two-page spread. Those are
views of the 1,899 reader regions, never of printed pages — no printed page
number is invented anywhere.

## How the Contents navigation works

The left rail is built from the audited manifest
(`reader/manifests/source_contents_navigation_manifest_v2.json`): 10 collapsible
groups, 31 collapsible module blocks, `data-depth` indentation from the source
indents, the current-section highlight, Expand all / Collapse all, and a cover
thumbnail, title and authors. Every linked row points at a unique heading id
(`#book-heading-nnnn`), so repeated titles such as "Practice Your AP® Skills
Questions" resolve inside their own module instead of jumping to the first
matching name in the book.

The right-hand page-reference cell is implemented but empty: the printed
Contents pages in the available source carry no page numbers. Drop a
`reader/printed_page_references.json` file in and the references populate
without re-extracting anything (see `docs/CONTENTS_MAPPING.md`).

## Reader controls

Continuous / single page / two-page spread; Original-Textbook, Georgia,
Times New Roman, Arial and Verdana fonts; text size 70–150 %; line spacing
compact / normal / relaxed; zoom 50–200 %; reset typography; reset view;
search; Contents and Tools toggles; keyboard navigation. Preferences persist
in `localStorage['book2.reader.v1']`.

## What remains uncertain

See [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md). In short: the available
source has no printed page numbers, no Index body, no Word document for
`Page 1101-1200`, and no per-image alt text; 125 Contents entries have no
verified destination; three rebuilt descriptions have empty bodies; and the
Page 501-600 donor document renders without run sizes.

## Repository layout

```
AP Book Final.html        the complete textbook (Git LFS)
docs/                     validation, audit and gap reports
docs/layout/              representative rendered screenshots
reports/                  machine-readable evidence (JSON)
reader/                   the presentation layer and the patchers
reader/manifests/         the audited Contents and section manifests
```

Generated versus source: `AP Book Final.html`, `docs/layout/*.png` and
`reports/*.json` are **generated** (they record what was built). Everything
under `reader/` is **source** — the stylesheet, the scripts and the patchers.

## Reproducing the output

From a checkout of the original project directory:

```bash
python _master_work/build_reader.py                 # deterministic rebuild of the draft
python _master_work/reader_ui/patch_reader_ui.py  _master_work/Book-2-unverified-draft.html  staged.html
python _master_work/wave/build_sections.py staged.html
python _master_work/wave/patch_wave.py staged.html "AP Book Final.html"
```

`patch_wave.py` streams the ~1.13 GB file, refuses to finish unless it tagged
42 module/unit headings, 9 group anchors and all 128 in-place disclosure
controls, and never rewrites article text. `promote.py` performs the guarded
atomic promotion. The evidence files under `reports/` are the output of the
audits described in `docs/VALIDATION_SUMMARY.md`.

## Rights

The textbook content belongs to its publisher and authors. This repository is
a private reconstruction exercise; the owner is responsible for confirming any
rights needed before the content is redistributed publicly.
