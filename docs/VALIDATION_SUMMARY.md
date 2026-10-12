# Validation summary - continuous-reading wave

Everything below was measured on the built candidate and then re-checked on the
promoted `AP Book Final.html`. Sections 1-7 describe the
`printed-contents-2026-10-12` artifact, `f606cdc8...`, 1,132,297,657 bytes,
compared against the previously promoted `1d270d0b...`, 1,132,281,938 bytes.
**Section 8 is the current final**: `1f935d1a...`, 1,132,298,830 bytes.

## 1. Content preservation (the strongest test)

The build was split into its 1,899 source regions and each region's text was
extracted (tags removed, whitespace collapsed) and hashed in both the previous
final and the new one.

| Measure | Result |
|---|---|
| Regions | 1,899 before, 1,899 after |
| Region order / ids | identical |
| Regions with byte-identical text | **1,899** (unchanged) |
| Regions differing only by disclosure UI glyphs | 0 (that normalisation was the previous wave) |
| Regions differing in **words** | **0** |

The corrective wave rewrote exactly one source region - `TMP-0563`, the
Starbucks Rewards control - and even there the region's text fingerprint is
unchanged: the words were already present, they were simply in the wrong place
inside the control. The printed-contents wave that followed touched **nothing**
inside a source region: a region-by-region byte comparison of the previous
artifact and the current one shows **1,899 of 1,899 regions byte-identical**,
0 regions with a text change and 0 regions with a word change
(`contents_wave/region_preservation.json`).

## 2. Assets

| Measure | Before | After |
|---|---|---|
| `<img>` in the article region | 448 | 424 |
| embedded `data:image` payloads | 453 | 429 |
| `<td>` | 4,256 | 4,252 |
| `<table>` | 1,488 | 1,485 |

Every one of the 24 removed images was the information-icon glyph sitting
**inside a `<details><summary>`**; it is replaced by the single CSS-drawn
`.disclosure > summary::after` icon. `verify_lost_imgs.py` counted the images
inside summaries per region in the source build and matched them one-for-one
against the removed images (24 / 24, no exception). No figure, photograph,
diagram, chart or credit was removed.

The 4 removed `<td>` and 3 removed `<table>` elements are the one-cell layout
boxes that only existed to draw the lost badge rectangle; the badge component
replaces them. No table row, cell value or caption was lost.

## 3. Structure

| Check | Result |
|---|---|
| Source regions in order | 1,899 / 1,899 |
| Heading anchors | 383 (383 carry `role="heading"`) |
| Duplicate element ids | 0 |
| Broken in-document links | 0 of 393 |
| Contents rows | 502 (376 linked / 126 unlinked: 125 held + the Index row) |
| Module / unit starts tagged for the reading dividers | 42 headings + 9 group anchors |
| `<details>` controls | 173 |
| Learning-goal badges | 151, none with zero size |
| Scripts | 3, all pass `node --check` |

## 4. Browser (real headless Chrome 155 over `file://`)

| Check | Result |
|---|---|
| `book2QA()` layout failures | **0** |
| Console errors / exceptions from the file | 0 / 0 |
| Desktop 1400x1000 document overflow | 0 |
| Mobile 390x844 document overflow | 0 |
| Cover region overflow at 1400x1000 and 390x844 | 0 |
| Continuous sheet | main background white, every `.book-page` `box-shadow:none`, `margin:0`, transparent - one sheet, not 1,899 cards |
| Disclosure bar | `#f2f3f4` background, 1 px border, flex, triangle 6.05 px, info icon from an inline SVG |
| Expanded description | panel 680 px of a 682 px host, 0 px internal overflow, 0 left/right padding - no narrow column |
| Collapsed -> expanded | 34 px -> 239 px |
| Contents navigation | `#book-heading-0010`, focus lands on the heading, lands below the toolbar, `aria-current` set |
| Search | hit found, status announced |
| Font control | body switches to the chosen face; badge, disclosure bar and label keep Arial |
| Text size | 100 % -> 130 % changes the body size and the surface scale, readout updates |
| Line spacing / zoom | both change the computed values |

## 5. Honest limits of this verification

* Every one of the 131 disclosure controls was checked structurally (label
  present, control present, body present). **Three** controls were opened and
  measured geometrically (the cover description measured above, plus two more
  in the waves before). The rest were not individually opened by hand - the
  arithmetic proof is that the panel rules are identical for all 131 and that
  the browser reports 0 layout failures.
* Visual screenshots were taken at nine representative positions (cover,
  expanded cover description, printed Contents, module opener, section strip,
  module review, rebuilt flattened disclosure, a long text region, and a
  mobile viewport). The rest of the book was not screenshotted in this wave.
* The per-region word check proves the *text* of all 1,899 regions is intact.
  It does not prove pixel-level equality with the printed book, which remains
  impossible for the source ranges that were never available (see
  `KNOWN_ISSUES.md`).

## 6. Corrective wave re-run (final artifact `1d270d0b...`)

Measured on the promoted final itself with headless Chrome 155 over `file://`
(`corrective_wave/browser_qa_corrected.json`), at desktop 1400x1000, mobile
390x844 and wide 1920x1200:

| Check | Result |
|---|---|
| Regions loaded | 1,899 / 1,899 (`TMP-0001` .. `TMP-1899`) |
| JavaScript exceptions / console errors / log errors | **0 / 0 / 0** |
| `book2QA()` layout failures | **0** at all three viewports |
| Document / `main` horizontal overflow | **0 px** at all three viewports |
| Cover region escapes its section | no, rail open or closed, all three viewports |
| Tables | 1,484 |
| `<details>` / disclosures / labels | 173 / 131 / 131 (0 empty labels) |
| Learning-goal badges | 151 |
| Contents rows / linked / held | 502 / 376 / 126 |
| Printed-page reference cells rendered | 12 (`A1`, `iii`, `iv`, `4`, `6`, `9`, `11`, `104`, `202`, `328`, `386`, `456`) |
| Duplicate element ids | 0 |
| Broken in-document links | 0 of 393 |
| Contents navigation | `#book-heading-0010`, `aria-current` set on one row, heading lands below the toolbar |
| Search | `Match in Contents` |
| Disclosure keyboard operation | summary focusable; opens and closes |
| Starbucks Rewards description | collapsed 34 px -> expanded 128 px, body present, 0 px overflow |
| Front Cover description | collapsed 34 px -> expanded 239 px, 0 px overflow, 0 padding |
| Walmart / Merck descriptions | collapsed 34 px -> expanded 59 px, body legitimately absent in source |

The two stale reports (`reports/browser_qa.json`,
`reports/browser_qa_controls.json`) are reconciled in
`BROWSER_QA_RECONCILIATION.md`: the first records an exception raised by a
development fixture, the second a bare `Uncaught` string with no evidence and a
cover finding that does not reproduce on either the corrected final or the
previous commit.

## 7. Printed-contents wave re-run (final artifact `f606cdc8...`)

Measured on the promoted final with headless Chrome 155 over `file://`
(`contents_wave/browser_qa_contents.json`), at desktop 1400x1000, mobile
390x844 and wide 1920x1200:

| Check | Result |
|---|---|
| Regions loaded | 1,899 / 1,899 |
| JavaScript exceptions / console errors / log errors | **0 / 0 / 0** |
| `book2QA()` layout failures | **0** at all three viewports |
| Document / `main` horizontal overflow | **0 px** at all three viewports |
| Cover region escapes its section | no |
| Tables / `<details>` / disclosures / labels | 1,484 / 173 / 131 / 131 (0 empty) |
| Learning-goal badges | 151 |
| Images | 424 |
| Contents rows / linked / unlinked | 502 manifest rows (509 sidebar rows) / 383 / 126 |
| Printed-page cells rendered | **493** |
| Label mismatches against the reference file | **0** |
| Rows carrying more than one page cell | 0 |
| Duplicate element ids / broken in-document links | 0 / 0 of 393 |
| Contents navigation | `#book-heading-0010`, one `aria-current` row, lands below the toolbar |
| Search | `Match in Contents` |
| Disclosure keyboard operation | summary focusable; opens and closes |
| Starbucks Rewards description | 34 px collapsed -> 128 px expanded, 157-character body, 0 px overflow |
| Walmart / Merck descriptions | expand correctly; bodies legitimately absent in the source |
| Region-by-region content comparison | 1,899 byte-identical, 0 word changes |

Representative visual inspection for this wave: the sidebar at desktop width
with the Front matter and Unit 1 groups expanded, checking that each row shows
its own printed label (`contents_wave/browser_qa_contents.png`). The rest of
the book was not re-screenshotted; its text and assets are covered by the
region-by-region comparison above.

## 8. Supplied-entries wave re-run (final artifact `1f935d1a...`)

Two stages, both streaming and surgical: `contents_wave/patch_supplied_entries.py`
rewrites only the `<nav id="contents-nav">` block (plus the cover region's
`data-nav-label`), and `contents_wave/patch_disclosures_crosscapture.py`
rewrites only the four article bodies of the Walmart and Merck pairs. Every
other byte of the book is copied unchanged.

### Contents

| Check | Result |
|---|---|
| Rail rows | 516 (502 manifest + 7 pre-existing front/back-matter rows + 7 new rows) |
| Page cells rendered | 506 (was 493) |
| Unlinked rail rows | 131 (125 held + the Index row + the 5 new rows with no body) |
| Supplied entries represented | **500 / 500** |
| Seven previously missing entries | all present, exact title and label; 2 linked to a verified region, 5 visible and unlinked |
| Six top-level unit rows | 2 / 104 / 202 / 236 / 328 / 386 - on the group header, not only on the nested copy |
| Front-matter order | supplied order (About this Book -> ... -> Get the most out of your textbook's) |
| End-matter order | Appendix -> References -> Glossary -> Glossary/Glosario -> Index -> FEP -> Back Cover |
| Broken in-document links | 0 of 395 |
| Duplicate element ids | 0 |
| Evidence | `reports/supplied_entries_verification.json` (ok: true), `reports/printed_contents_reconciliation.json` |

### Source preservation

| Measure | Result |
|---|---|
| Source regions | 1,899, identities and order unchanged |
| Regions byte-identical (sidebar stage) | 1,899 / 1,899 (`contents_wave/region_preservation_supplied_entries.json`) |
| Regions with a changed text fingerprint (final) | 4 - `TMP-0542`, `TMP-0543`, `TMP-0585`, `TMP-0586` |
| Reason | the Walmart and Merck description bodies were relocated into their controls |
| Whole-book region text | 1,444,347 characters before and after (delta 0) |
| Pair text before vs after | `TMP-0542+TMP-0543` and `TMP-0585+TMP-0586` hash identically; words identical |
| Tables / figures / badges | 1,484 tables, 424 images (0 broken), 151 LG badges (0 zero-size) |

### Disclosures

| Check | Result |
|---|---|
| Controls | 131, all with a non-empty label |
| Empty `.desc-panel` bodies | **0** (was 2) |
| Structurally expandable | 131 / 131; all expand to the full reading width, 0 px internal overflow |
| Walmart | collapsed 34 px -> expanded 102 px, 108-character body restored, 0 px overflow |
| Merck | collapsed 34 px -> expanded 334 px, 465-character body restored, 0 px overflow |
| Starbucks Rewards | unchanged, 157-character body, 0 px overflow |
| Front Cover | unchanged, 580-character body, 0 px overflow |
| Keyboard | summary focusable, toggles by click and by key |

### Browser (real headless Chrome 155 over `file://`)

| Check | Result |
|---|---|
| Load | `readyState complete`, 1,899 sections, 424 images, 0 broken |
| JavaScript exceptions / console errors / log errors | **0 / 0 / 0** |
| `book2QA()` layout failures | **0** at 1400x1000, 390x844 and 1920x1200 |
| Document / `main` horizontal overflow | **0 px** at all three viewports |
| Contents navigation | click lands below the toolbar, one `aria-current` row |
| The two new links | `Cover Page` -> `#TMP-0001` (top 74 px), unit header -> `#book-group-03` (top 89 px) |
| Search | "Match in Contents" |
| View modes | continuous / single (`Page 23 / 1899` -> next `Page 24 / 1899`) / spread (`Pages 24-25 / 1899`) |
| Typography controls | font, text size (100 -> 130 %, `--b2-text` 1.3), zoom, line spacing, resets - all change computed values; the badge, bar and label stay Arial |
| Continuous sheet | `main` white, every `.book-page` `box-shadow:none`, `margin:0`, transparent |
| Screenshots | `docs/layout/10`..`14` (rail with the supplied rows, Walmart and Merck restored and expanded, Starbucks unchanged, mobile) and `_master_work/final_wave/shots_final/` |

### Honest limits of this wave

* The four changed regions change the per-region fingerprint; the relocation
  proof is the pair-level hash, not a byte-identical region.
* 415 of the 424 images are `loading="lazy"` and never decode while off screen;
  0 are broken (`naturalWidth === 0`), which is the check that matters.
* The narrow-screen drawer overlap recorded in `KNOWN_ISSUES.md` item 12b is
  pre-existing and untouched.

## 9. Overnight-audit wave (final artifact `ec7a490e...`)

Baseline for this wave: `1f935d1a...`, 1,132,298,830 bytes.  Waves applied:
`contents_wave/patch_reader_semantics.py` (sidebar-shell mode list + an
additive `reader/ui2.js` script) and `patch_credit_order.py` (four article
bodies).  Everything else is copied byte-for-byte.

### What the audit covered

| Sweep | Extent | Result |
|---|---|---|
| Source captures | 1,899 | file present, SHA-256 and byte count match the manifest, PNG format and pixel size verified |
| Regions | 1,899 | present, in manifest order, no extra, no missing |
| Capture transitions | 1,898 | 0 overlapping/duplicated pairs, 0 empty panels, 4 misplaced credits found |
| Disclosures | 131 | labels present, 0 empty bodies, 0 duplicated panel texts; 25 non-`<details>` labels found (open item) |
| LG badges | 151 in 143 regions | present, 0 zero-size |
| Images | 423 in regions | 0 corrupt payloads, 0 broken in the browser |
| Navigation | 516 rows, 395 links | 0 broken; 500 page cells on rows + 6 on unit headers = 506 |

### Content proof

| Measure | Result |
|---|---|
| Regions with a changed text fingerprint | **0** |
| Regions with changed words | **0** |
| Whole-book region text | 1,444,347 characters before and after |
| Tables / images / details / panels / labels | 1,485 / 424 / 173 / 131 / 132, unchanged |
| New bytes | +12,965 (the additive script and the mode list) |

### Browser (real headless Chrome 155 over `file://`)

| Check | Result |
|---|---|
| Exceptions / console errors | 0 / 0 |
| Mode list | continuous, section, single (the printed spread is gone) |
| Section mode | 383 sections, `Section 7 of 383 · UNIT 1`, clipping hides 1,896 of 1,899 regions, the section heading is visible |
| Source-capture mode | `Source capture i of 1,899` with the explanatory note |
| Discrete mode change (seeded `{left:open,right:open}`) | desktop 1400: both drawers, no overlap; 390 px: one drawer, **no overlap**; back to 1400: both restored |
| Opening a drawer on mobile | the other closes automatically; still no overlap |
| Screenshots | `docs/layout/15`..`18` |

### Honest limits

* 18 whole captures and 20 crops were inspected by eye; the rest were covered by
  the programmatic sweep only — the report never claims otherwise.
* The 24 orphan description controls are **not** fixed; see `docs/OVERNIGHT_AUDIT.md`.
* Four misplaced credits were fixed; a looser detector had claimed 11, of which
  7 were false positives.  The stricter test is the one that was acted on.
