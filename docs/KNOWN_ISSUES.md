# Known issues in the current release

Latest wave: the **final-reader redesign and frontmatter repair** of 2026-10-16
(`docs/FINAL_READER_REDESIGN_AND_FRONTMATTER_REPAIR.md`).  It replaces the
application shell only - a new header, collapsible Contents rail, continuous
reading, search/typography/bookmark popovers and a bottom progress bar - and
corrects the Accessibility, publisher title and copyright/acknowledgments
frontmatter pages with **scoped CSS**, so all 1,899 `<article>` regions remain
byte-identical to the previously accepted artifact
(`reports/final_reader_redesign/region_digest.json`).  It also links the
`Title Page` and `Copyright Page` rows to `#TMP-0007` and `#TMP-0009`, which
corrects the stale source-absence claim below.  Current artifact:
1,132,308,257 bytes, SHA-256
`9ffd6bb53c1e68b17d766519c2dc65cb61f4eafccadd2e0cb4b52e732cfbc64c`.

Verified against `AP Book Final.html`, 1,132,289,645 bytes, SHA-256
`2bff4ce2e75d767884672a983f470f9fb339d7088e7d9053925d8e3b351c777d`
(1,132,306,770 bytes) by the contents-navigation wave of 2026-10-14
(`docs/CONTENTS_NAVIGATION_FINAL_REPORT.md`), which changed only the reader
shell — one appended stylesheet block, four additive hooks in `reader/ui2.js`,
one appended inline script and 58 verified Contents rows turned into links — and
left every article region byte-identical.  The earlier evidence is the
acceptance run reported in
`docs/FINAL_ACCEPTANCE_REPORT.md` plus the photo-credit wave of 2026-10-14
(`docs/PHOTO_CREDIT_ORIENTATION.md`), the sidebar wave of 2026-10-14
(`docs/SIDEBAR_WAVE.md`, which changed only the two sidebar controls and
preserved every source region byte for byte) and the toolbar-appearance wave of
2026-10-14 (`docs/DARK_MODE_AND_TOOLBAR_REPORT.md`, which changed only the
reader-UI stylesheet, the reader-UI script and one inserted `Appearance`
control, and preserved every source region byte for byte as well).  Each item
says whether it is a genuine
source gap, an availability limit, a scope statement, or something already
fixed.  Earlier wording that contradicts this file is listed under
"Superseded claims" at the end, and the raw snapshots are preserved under
`reports/`.

## Reader-presentation scope statements

1. **Dark mode keeps source artwork on its own surfaces.** Photographs,
   embedded PNGs and the publisher's reconstructed HTML/SVG figures and
   diagrams are never filtered, inverted or re-coloured, so a dark reader page
   shows a white MBA-style canvas or chart exactly as the publisher printed it.
   This is deliberate: recolouring a source figure would destroy its colour
   coding and is explicitly out of scope.  `filter` is applied to nothing
   (verified: 0 of 418 images have any filter in dark mode) and no image byte
   is altered (verified: every source region hashes identically).
2. **Dark mode mirrors the inline Word colours it must.** The reconstruction
   carries 15 309 inline colour declarations from the source documents.  Dark
   mode mirrors their lightness and keeps their hue, which preserves the
   contrast the publisher printed (dark ink on white becomes light ink on
   dark) and keeps the source's teal links, magenta accents, plum rules and red
   module headings recognisable.  A handful of source colours therefore appear
   lighter or darker than in Light mode; none changes hue.
3. **On a narrow phone viewport an open drawer floats over the toolbar.** That
   is the pre-existing, accepted mobile drawer behaviour (the drawer is fixed,
   `z-index: 8`, and the toolbar is inside the reading column).  The drawer
   always carries its own visible `Collapse contents` / `Collapse tools` button
   as its first element, so closing it is one tap away; both controls were
   re-checked in this wave.

## Source gaps - content genuinely absent from the supplied source

1. **No Index body.** The `Index` Contents entry is kept visible and
   deliberately not linked: the Index text does not exist anywhere in the
   1,899-region sequence or in the supplied PNG captures.
2. **`Page 1101-1200` has no Word document.** That range is carried by a
   structured OCR candidate; its headings kept no run formatting.
3. **All images carry `alt=""`.** The supplied source provides no per-image
   descriptions and inventing them is not permitted.  The information that
   *is* source-backed is already exposed through the 155 Extended Description
   controls, which describe the figures they belong to.
4. **The Page 501-600 donor document renders its paragraphs without run
   sizes**, so those regions read at the reader's base size while other batches
   carry their own sizes.  Making them uniform would be a fidelity change to
   the source, so it was not done.
5. **Some module-opener banners in the Page 501-600 batch lost their coloured
   band** in extraction.  Two banner lines were white-on-white and now have a
   teal band; one module in that batch lost its `LG` marker entirely and cannot
   be reconstructed.
6. **16 Contents rows have no printed label.** The sidebar shows the printed
   labels of the user-supplied numbered Contents list (506 cells: 486 manifest
   rows, 7 pre-existing front/back-matter rows, the 7 new rows and the 6 unit
   group headers).  Sixteen manifest rows - the six unit/module openers and the
   ten `AP® Skills Workshop …` / `Business Canvas Project Application` rows -
   have no entry in that list and keep an empty cell.  Nothing was inferred from
   position, adjacency or the source images.  All 500 supplied entries are
   represented.
7. **Three supplied entries are visible but unlinked.** `About this Book`,
   `FEP` and `Back Cover` have no body anywhere in the supplied source (a
   whole-file scan finds none of those words), so their rows carry their
   supplied label and deliberately no link.  `Cover Page`, `Get the most out of
   your textbook's . . .`, and - corrected on 2026-10-16 - `Title Page` and
   `Copyright Page` do have verified destinations and are linked (`#TMP-0007`
   and `#TMP-0009`).  The earlier claim that the title and copyright pages are
   source-absent was wrong: `B2P1-0007.png` carries the interior title page and
   `B2P1-0009…0012.png` carry the credits, the `Copyright © 2026` statement,
   the ISBN, the acknowledgments, the AP® statement, the BFW address and
   website, the EU GPSR notice and the Macmillan Dublin address.  The manifest
   labels all of `TMP-0003`–`TMP-0012` as `Accessibility` only because the
   supplied Contents list folds the whole frontmatter under one heading.
8. **70 Contents entries are held** (shown, not linked) because no
   source-verified destination could be established for them: 36 have no
   occurrence of their own wording anywhere in the reconstructed body, 17 occur
   in more than one body capture (ambiguous without an anchor), 14 occur inside
   a capture but not at its beginning (a new anchor would be needed).  The
   contents-navigation wave of 2026-10-14 linked the other 58 held rows, each to
   the source capture whose first words are that row's own title.
   The final-reader wave of 2026-10-16 re-checked every held row twice: against
   the whole reconstructed text (one streaming pass, recorded in
   `reports/final_reader_redesign/unlinked_rows_evidence.json`) and against the
   383 verified heading anchors
   (`reports/final_reader_redesign/unlinked_heading_match.json`).  No held row's
   wording matches a verified heading anchor, and the rows whose wording *does*
   appear in the source do so as incidental mentions inside body text rather
   than at an audited heading (`Gross Profit` in `TMP-1105…1148`, `Debt
   Financing` in `TMP-1065…`, and so on).  Connecting them needs a new anchor
   created at each exact source heading and verified row by row, because the
   repeated titles (`Practice Your AP® Skills Questions`, `Terms to Know`) occur
   in roughly thirty modules each; that work is not done, so those rows stay
   non-interactive rather than mis-linked.

## Reader-interface scope statements (final-reader wave, 2026-10-16)

9.  **Continuous reading only.**  The three-way mode picker, the `Continuous`
    badge, the `Section n / m` counter, the floating toolbar and the 260 px
    `Reader tools` panel were removed.  The whole book is one flowing document;
    no part of it is hidden by a mode class, and the regions are byte-identical
    to the previously accepted artifact.
10. **The reading reference is a nearest verified printed reference, never an
    inferred page number.**  The footer shows the printed label of the supplied
    numbered Contents list for the last verified destination at or above the
    reading line (or `—` when there is none).  No total page count is displayed,
    because the supplied list does not establish one, and source capture
    numbers are never shown as page numbers.
11. **Frontmatter repairs are scoped CSS.**  The Accessibility, title and
    copyright pages are corrected with stylesheet rules limited to
    `TMP-0003…TMP-0012`; no source region byte changed anywhere in the book.
12. **Dark mode still never filters source artwork.**  Photographs, embedded
    PNGs and the publisher's figures keep their own colours on their own
    surfaces, and no image byte is read or rewritten.

## Availability limits - deliberately not offered

9. **No printed two-page spread.** The available source contains no printed
   page boundary - each capture is a screenshot of a scrolling page - so a
   printed spread could not be drawn honestly and the mode was withdrawn.  The
   reader offers **Continuous**, **Section** (the book's own 383 verified
   headings) and **Source capture** (labelled as captures), and states the
   reason in the Tools panel.
10. **Printed page numbers are absent from the source pages**, so the reader's
    page-reference cells are the labels of the user-supplied numbered Contents
    list (the list is the authority); they are display-only and are never
    treated as printed page boundaries.  All 506 rendered cells come from that
    list.

## Verification scope

11. **Pixel-level equality with the printed book was not attempted** for the
    whole book; it is impossible for source ranges that were never supplied.
    What *was* done: region-by-region word equality against the previous
    verified artifact, exact ordered token-sequence equality per repaired group,
    a browser pass over all 155 disclosure controls, and representative visual
    inspection (see `docs/FINAL_ACCEPTANCE_REPORT.md`).
12. **Structural and browser coverage is complete for the disclosures; visual
    inspection by hand covers a sample.** All 155 controls are checked in the
    browser for structure, collapsed/expanded geometry, hidden-when-closed and
    keyboard operation; the controls repaired across the last waves, plus the
    Walmart, Merck, Starbucks, Lancôme, Cialdini, Consumers, Kellogg's,
    Supply/Demand, Cooper, Privacy Statement and MoMo cases, were additionally
    inspected against their captures.
13. **Two drawer panels are never both open on a narrow screen** (fixed): on a
    narrow viewport the reader keeps Contents, closes the other drawer when one
    is opened, and restores the stored desktop preference when the window
    widens.

## Outside the book

14. `ISS-110` from an earlier session (a stray worker installing database
    engines outside the project) still awaits the user's decision.  Nothing was
    deleted.

## Superseded claims (kept for history, not current)

These appeared in earlier revisions of this file and are no longer true.  The
superseded evidence snapshots remain under `reports/overnight_audit/`,
`reports/repair/` and `reports/final/`:

* "The printed label column cannot be derived at all" - superseded by
  `printed-contents-2026-10-12`: the labels are the user-supplied list and 506
  cells are rendered.
* "Two-page mode remains a two-page view of reader regions" - superseded by
  `overnight-audit-2026-10-13`: the printed-spread claim was withdrawn and
  Section/Source capture took its place.
* "There are 131 disclosure controls" / "0 of 131 have an empty body" - the
  count is **155**, none empty.
* "24 orphan description controls, 3/12/21 or 17-of-24 restored, 6 unresolved" -
  the three repair waves restored **24 of 24** (3 + 12 + 9); see
  `docs/NINE_CASE_LEDGER.md`.
* "Walmart and Merck have genuinely empty descriptions" - both bodies existed
  across the capture boundary and are restored; see
  `docs/WALMART_MERCK_FORENSICS.md`.
* "The two mobile drawers overlap" - fixed in the overnight-audit wave.
* "The MoMo credit is squeezed" - fixed in the final-completion wave; the credit
  is rendered vertically as the source prints it.
