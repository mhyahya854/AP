# Known unresolved issues

Reported honestly; none of these was introduced by this wave.

## Source gaps (cannot be fixed without more source)

1. **Printed page numbers are only partly available.** The Contents pages in
   the supplied source carry none, and the complete numbered Contents list
   referenced in the brief was not present on disk. The nine labels quoted in
   the brief (plus three front-matter roman/A1 labels) are now shown in the
   sidebar; the remaining 493 rows keep an empty reference cell and are listed
   in `reports/contents_printed_page_match_report.json`. Nothing was inferred.
   The real list can be dropped in later (see `CONTENTS_MAPPING.md`).
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
6. **Two rebuilt disclosures have empty bodies** because the source has no
   description text for them - Walmart (`TMP-0542`) and Merck (`TMP-0585`).
   The third one previously listed here, Starbucks Rewards, did have a body:
   it was restored in the corrective wave
   (`EXTENDED_DESCRIPTION_AUDIT.md`).

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

## Outside the book

13. `ISS-110` from an earlier session (a stray worker installing database
    engines outside the project) still awaits the user's decision. Nothing was
    deleted.
