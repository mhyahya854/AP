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
and table is an inlined `data:` URI and the only scripts are four inline
scripts.

GitHub's source viewer and GitHub Pages do **not** render this file as the
finished interactive textbook. The complete artifact has to be fetched through
Git LFS and opened locally.

| Field | Value |
|---|---|
| File | `AP Book Final.html` |
| Bytes | 1,132,269,052 |
| SHA-256 | `db07ab804bed45df6dd7b27a70dea2e86f259707d047b9b307d19e71108e35df` |

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

The right-hand page-reference cell shows the printed labels of the
user-supplied numbered Contents list (500 numbered entries): **506 cells**, for
example `Module 1.1 What Is a Business?` 4, `Unit 2 Marketing` 104,
`Index` 456, `Back Cover` BC and the front-matter roman numerals. Labels are
strings exactly as supplied, so `103A`, `201A`, `327A`, `327B`, `385A`, `429A`,
`G-1` and `EP-1` keep their real form.

The printed Contents pages in the available source carry no page numbers of
their own, so the supplied list is the only authority; nothing was inferred
from position, adjacency, the source images or a counter. Sixteen manifest rows
have no entry in that list and keep an empty cell; they are listed in
`reports/printed_contents_reconciliation.json`. See
`docs/CONTENTS_MAPPING.md` for the full mapping and the exact normalizations
used (`Case Study X` = `CASE STUDY: X`, `Practice Your AP® Skills` = `... 
Skills Questions`, and three similar variants).

All **500** supplied entries are represented in the rail. The seven that the
manifest did not carry - `About this Book` (FC), `Cover Page` (FC),
`Title Page` (i), `Copyright Page` (ii), `Get the most out of your textbook's
. . .` (xiv), `FEP` (EP-1) and `Back Cover` (BC) - are rendered as their own
rows with their supplied labels. `Cover Page` and `Get the most out of your
textbook's . . .` link to a verified source region; the other five are visible
and deliberately unlinked because the available source has no body for them.
The six top-level unit rows carry the supplied printed labels (2, 104, 202,
236, 328, 386) on the group header itself, not only on the nested copy of the
entry.

Showing a label is not a navigation change: the held rows and the Index row
stay unlinked and no `href` was added or re-pointed.

## Source images

Everything the book was reconstructed from is in this same repository, so the
source can be compared with the result:

* `source_png/` - all **1,899 legitimate original Book 2 PNG captures**, in
  their original batch folders (`Page 1-100`, ..., `Page 1801-1900`), as
  individual files with original names and original bytes, tracked by Git LFS.
* `source_png/SOURCE_PNG_MANIFEST.csv` and `.json` - one record per capture
  with its ordinal, original filename, repository path, source batch, TMP
  identifier, pixel dimensions, byte size, SHA-256, verification status and
  section/module association.
* `docs/source_previews/` - 95 labelled contact sheets and a browsable
  `index.html` covering every capture. Each thumbnail carries the real
  filename and TMP identifier and links back to the full-resolution original.

The two captures `B2P3-0034.png` and `B2P3-0035.png` belong to a different book
and are deliberately excluded (and were left untouched on the source machine).
A TMP identifier is an internal reconstruction id - it is not a printed page
number, and a capture may cover only part of a printed page.

## Reader controls

**Continuous** (default) reads the whole book as one flowing sheet.
**Section** pages through the book's own 383 verified headings — a real unit of
the book — and reports `Section i of 383 · <heading>`.  **Source capture** steps
through the 1,899 page images the book was rebuilt from and says so: a capture
is a screenshot of a scrolling page, not a printed page.

A two-page *printed* spread is deliberately **not** offered: the available
source contains no printed page boundary, so a printed spread could not be drawn
honestly.  The Tools panel states this where the choice would have been.

Also: Original-Textbook, Georgia, Times New Roman, Arial and Verdana fonts;
text size 70–150 %; line spacing compact / normal / relaxed; zoom 50–200 %;
reset typography; reset view; search; Contents and Tools toggles; keyboard
navigation.  Preferences persist in `localStorage['book2.reader.v1']`.  On a
narrow viewport the two drawers never overlap: opening one closes the other,
and the stored desktop preference is restored when the window widens.

## What remains uncertain

See [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md). In short: the available
source has no printed page numbers of its own, no Index body, no Word document
for `Page 1101-1200`, and no per-image alt text; 16 Contents rows have no label
in the supplied numbered list; 126 rows have no verified destination (125 held
+ the Index row, plus the 5 new rows whose source has no body); and the
Page 501-600 donor document renders without run sizes. Two older
machine-readable browser reports are stale and are reconciled in
`docs/BROWSER_QA_RECONCILIATION.md`.

The two Extended Descriptions that were reported as having no body - Walmart
and Merck - were **not** empty: the capture boundary cut the description panel
in two and their bodies stand at the top of the following capture. Both are now
restored inside their controls (`docs/WALMART_MERCK_FORENSICS.md`), and no
disclosure control has an empty body.

The overnight forensic audit and its corrections are written up in
[`docs/OVERNIGHT_AUDIT.md`](docs/OVERNIGHT_AUDIT.md), with the raw evidence in
`reports/overnight_audit/`.  Its headline open item is the **24 orphan
description controls** (`OA-007`): the source has a control, the reconstruction
has only a bare label, and the body's extent still has to be confirmed against
each capture before the text can be moved — so it was left untouched rather
than guessed.

## Repository layout

```
AP Book Final.html        the complete textbook (Git LFS)
source_png/               the 1,899 original source captures (Git LFS) + manifest
docs/                     validation, audit and gap reports
docs/layout/              representative rendered screenshots
docs/source_previews/     labelled contact sheets + browsable index
reports/                  machine-readable evidence (JSON)
reader/                   the presentation layer and the patchers
reader/manifests/         the audited Contents and section manifests
corrective_wave/          the corrective-wave patcher and its raw evidence
contents_wave/            the printed-contents mapper, patcher and its evidence
                          (incl. the supplied-entries and cross-capture patchers)
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
python corrective_wave/patch_corrective_wave.py "AP Book Final.html" staged-corrected.html
python contents_wave/patch_contents_labels.py "staged-corrected.html" staged-labelled.html
python contents_wave/patch_supplied_entries.py staged-labelled.html staged-supplied.html
python contents_wave/patch_disclosures_crosscapture.py staged-supplied.html "AP Book Final.html"
```

`patch_wave.py` streams the ~1.13 GB file, refuses to finish unless it tagged
42 module/unit headings, 9 group anchors and all 128 in-place disclosure
controls, and never rewrites article text. `corrective_wave/patch_corrective_wave.py`
then streams the result again and makes exactly four auditable changes
(the Starbucks Rewards control structure, the printed-page reference cells, the
sidebar note and one stylesheet rule), refusing to finish unless each expected
match count is met. `contents_wave/patch_contents_labels.py` writes the printed
page labels into the rail, `contents_wave/patch_supplied_entries.py` renders the
seven supplied entries that had no row, fixes the top-level unit labels and the
one lost-space label, and re-orders the front and back matter into the supplied
order, and `contents_wave/patch_disclosures_crosscapture.py` moves the Walmart
and Merck description bodies into their controls. Each script asserts an exact
match count for every edit and refuses to write a partial result.
`reader/promote.py` performs the guarded atomic promotion. The evidence files
under `reports/` are the output of the audits described in
`docs/VALIDATION_SUMMARY.md`; `contents_wave/verify_supplied_entries.py`
re-checks the built artifact against the supplied list.

## Rights

The textbook content belongs to its publisher and authors. This repository is
a private reconstruction exercise; the owner is responsible for confirming any
rights needed before the content is redistributed publicly.
