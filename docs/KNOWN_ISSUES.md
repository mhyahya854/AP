# Known issues in the current release

Verified against `AP Book Final.html`, 1,132,261,630 bytes, SHA-256
`73d175779ae506d9f2b902e83f56438ca313c3d75be4eb1dd0c5cf75c4f645b2`
(GitHub `dcae5e5`) by the acceptance run reported in
`docs/FINAL_ACCEPTANCE_REPORT.md` plus the photo-credit wave of 2026-10-14
(`docs/PHOTO_CREDIT_ORIENTATION.md`).  Each item says whether it is a genuine
source gap, an availability limit, a scope statement, or something already
fixed.  Earlier wording that contradicts this file is listed under
"Superseded claims" at the end, and the raw snapshots are preserved under
`reports/`.

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
7. **Five supplied entries are visible but unlinked.** `About this Book`,
   `Title Page`, `Copyright Page`, `FEP` and `Back Cover` have no body anywhere
   in the supplied source (a whole-file scan finds none of those words), so
   their rows carry their supplied label and deliberately no link.  `Cover
   Page` and `Get the most out of your textbook's . . .` do have a verified
   destination and are linked.
8. **125 Contents entries are held** (shown, not linked) because no
   source-verified heading target exists for them.

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
