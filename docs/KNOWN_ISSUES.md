# Known unresolved issues

Reported honestly; none of these was introduced by this wave.

## Source gaps (cannot be fixed without more source)

1. **16 Contents rows have no printed label.** The sidebar shows the printed
   labels of the supplied numbered Contents list (506 cells: 486 manifest rows,
   7 pre-existing front/back-matter rows, the 7 new rows and the 6 unit group
   headers). Sixteen manifest rows - the six unit/module openers and the ten
   `AP® Skills Workshop ...` / `Business Canvas Project Application` rows - have
   no entry in that list and keep an empty cell. Nothing was inferred from
   position, adjacency or the source images. All 500 supplied entries are
   represented. Details in `CONTENTS_MAPPING.md` and
   `reports/printed_contents_reconciliation.json`.
1b. **Five supplied entries are visible but unlinked.** `About this Book`,
   `Title Page`, `Copyright Page`, `FEP` and `Back Cover` have no body anywhere
   in the supplied source (a whole-file scan finds none of those words), so
   their rows carry their supplied label and deliberately no link. `Cover Page`
   and `Get the most out of your textbook's . . .` do have a verified
   destination and are linked.
2. **No Index body.** The `Index` Contents entry is kept visible and
   deliberately not linked. The Index text does not exist in the 1,899-region
   sequence.
3. **125 Contents entries are held** (shown, not linked) because no
   source-verified heading target exists for them.
4. **`Page 1101-1200` has no Word document.** That range is carried by a
   structured OCR candidate; its headings, for example, kept no run
   formatting.
5. **All images carry `alt=""`.** The supplied source provides no per-image
   descriptions, and inventing them is not permitted.
6. **RESOLVED in `supplied-entries-2026-10-12`.** The two "empty" disclosures -
   Walmart (`TMP-0542`) and Merck (`TMP-0585`) - did have bodies: the capture
   boundary cut the description panel in two, and the body stood at the top of
   the *following* capture (`B2P1-0543.png`, `B2P1-0586.png`), which the earlier
   audit never opened. Both were restored by relocating the exact paragraphs
   into the control. No disclosure control now has an empty body (0 of 131).
   See `WALMART_MERCK_FORENSICS.md`.

## Presentation limits

7. **The printed-Contents page numbers are absent from the source pages**, so
   the "printed label" column in the reader cannot be derived at all.
8. **The Page 501-600 donor document renders its paragraphs without run
   sizes**, so those regions read at the reader's base size while other
   batches carry their own sizes. Making them uniform would be a fidelity
   change to the source, so it was not done.
9. **Some module-opener banners in the Page 501-600 batch lost their coloured
   band** in extraction. Two banner lines were white-on-white and are now
   given a teal band; one module in that batch lost its `LG` marker entirely
   and cannot be reconstructed.
10. **Two-page mode remains a two-page view of reader regions**, not of printed
    pages, because no verified printed-page map exists. The reader labels it
    with reader page numbers, never printed ones.

## Verification scope

11. **Pixel-level equality with the printed book was not attempted** for the
    whole book; it is impossible for the source ranges that were never
    supplied. The verification that *was* done is region-by-region word
    equality against the previous verified final, plus representative visual
    inspection (nine positions) and a clean browser run.
12. **Not every one of the 131 disclosure controls was opened by hand**; the
    structural check covers all of them, the geometric check covered a
    sample.
12b. **Two drawer panels can overlap on a narrow screen.** At 390 x 844 a fresh
    load closes both rails (`narrow()` in `reader/ui.js`), but a session that
    stored both rails open on a desktop and then narrowed the window keeps both
    open, and the two fixed drawers overlap. It is a reader-interface state, not
    a source-fidelity defect, and it was left alone;
    `docs/layout/13-mobile-drawers-closed.png` shows the intended narrow-screen
    state. Not introduced by this wave.

## Presentation defects closed in later waves

14. **The six top-level unit rows showed no printed page number** - the supplied
    label had landed only on the nested copy of the same entry. Fixed in
    `supplied-entries-2026-10-12`: the group header now carries the supplied
    label (2 / 104 / 202 / 236 / 328 / 386). The nested row is unchanged.
15. **The navigation label `BUSINESSWITHPERSONALFINANCE` had lost its spaces**
    (the cover title is set as four stacked lines). Fixed to the supplied
    wording `Business with Personal Finance`; the same label on the cover
    region's `data-nav-label` attribute was repaired too, so the search status
    line reads correctly.

## Outside the book

13. `ISS-110` from an earlier session (a stray worker installing database
    engines outside the project) still awaits the user's decision. Nothing was
    deleted.
