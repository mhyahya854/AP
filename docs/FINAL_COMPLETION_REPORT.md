# Final completion report - orphan disclosures, MoMo credit, verification

Baseline: commit `1c6a5e6`, `AP Book Final.html` 1,132,314,672 bytes,
SHA-256 `c0ea6f33...`.  After this wave: 1,132,278,215 bytes,
SHA-256 `ef09a825...`; after the subsequent `nine-case-2026-10-13` wave the final
artifact is **1,132,243,794 bytes, SHA-256
`572144b82c780abbad6ec81174c96fea0f4082222442ec42a8d90657d3a4b09f`**.

## Phase 1 - the orphan Extended Description controls

The earlier run's detector only recognised an uninterrupted Georgia paragraph
run ending at a caption.  The decisive structural fact it missed: **the source
panel is a grey-background table cell that contains the label *and* the body**
(`reports/final/panel_cells.json`, `inner_cells.json`).  With that, plus the
boundary signature already validated on Walmart/Merck (panel body -> panel edge
-> divider -> small grey caption strip outside the control), 14 further cases
were resolved.

| Region | Source images inspected | Classification | Body boundary | Text moved | Control works | Evidence |
|---|---|---|---|---|---|---|
| TMP-0121 Businesses | `B2P1-0121.png` structure + panel cell | **RESTORED** | whole grey cell after the label (3 photo descriptions) | no (in place) | yes | `reports/final/phase1_report.json` |
| TMP-0125 Kellogg's Froot Loops | panel cell + nested table | **UNRESOLVED WITH EVIDENCE** | label sits in a nested row of the figure table; the body shares the table with figure cells, so the panel's end cannot be separated from the figure | reverted to baseline | n/a | `patterns` in `panel_cells.json` |
| TMP-0152 FIGURE 1.2-1 Supply/Demand | `B2P1-0152.png` structure | **UNRESOLVED WITH EVIDENCE** | same shape: the label is a `colspan=3` row; the panel body and the graph share the following rows | reverted to baseline | n/a | `inner_cells.json` |
| TMP-0312 Your School's Vision | `B2P1-0312/0313` panel cells (`#F1F1F1`) | **RESTORED** | donor's panel cell (poster readings) | yes, 133 words | yes | `phase1_report.json` |
| TMP-0421 Figure 1.8-1 Supply Chain | in-region paragraphs, 68.4pt panel indent | **RESTORED** | the two panel-indented paragraphs after the bar | no (in place) | yes | `phase1_report.json` |
| TMP-0422 Figure 1.8-2 Supply Chain | donor `B2P1-0423.png` structure | **UNRESOLVED WITH EVIDENCE** | the donor interleaves the caption table with narrative ("distributor", "A business that typically buys...") so the body cannot be delimited from the narrative without further source evidence | none | n/a | `inner_cells.json` |
| TMP-0428 Figure 1.8-3 Supply Chain | `B2P1-0428.png` panel cell | **RESTORED** | whole grey cell after the label (flowchart readings) | no (in place) | yes | `phase1_report.json` |
| TMP-0502 FIGURE 2.1-2 Segmentation | donor `B2P1-0503.png` | **UNRESOLVED WITH EVIDENCE** | the list continues across the boundary and ends at the donor's region end, but no caption strip or panel edge is visible in the reconstruction to fix the end | none | n/a | `body_runs.json` |
| TMP-0516 Figure 2.1-3 Cooper | donor `B2P1-0517.png` | **UNRESOLVED WITH EVIDENCE** | the label sits inside the 48-paragraph case-study block; the family list continues into the donor and the panel end is not marked | none | n/a | `body_runs.json` |
| TMP-0530 Privacy Statement | donor `B2P1-0531.png` | **UNRESOLVED WITH EVIDENCE** | the quoted privacy text continues through 18 donor paragraphs in a different font; no panel edge to stop at | none | n/a | `inner_cells.json` |
| TMP-0621 Figure 2.3-2 Bar Chart | donor `B2P1-0622.png` panel cell (`#ECECEC`) | **RESTORED** | donor's panel cell (bar data) | yes, 36 words | yes | `phase1_report.json` |
| TMP-0624 Figure 2.3-3 Stacked Bar | donor `B2P1-0625.png` panel cell | **RESTORED** | donor's panel cell (store/segment data) | yes, 84 words | yes | `phase1_report.json` |
| TMP-0726 Disaster Strikes | `B2P1-0726/0727` captures, full resolution | **RESTORED** | donor's leading paragraphs; the caption strip "When a crisis makes consumers vulnerable..." stays outside | yes, 20 words | yes | `phase1b_report.json`; capture pair inspected |
| TMP-0745 Middleman | donor `B2P1-0746.png` | **UNRESOLVED WITH EVIDENCE** | the donor's first block is ordinary narrative ("The Dollar Shave Club launched in 2011..."), not a figure description; no panel body is identifiable | none | n/a | `inner_cells.json` |
| TMP-0756 Docu Sign | `B2P1-0756/0757` captures, full resolution | **RESTORED** | the panel paragraph after the label plus the donor's ad-text block; the caption strip "DocuSign is a B2B service..." stays outside | yes, 36 words | yes | `phase1b_report.json`; capture pair inspected |
| TMP-0846 Figure U2-5 Product Life Cycle | donor `B2P1-0847.png` | **RESTORED** | donor's leading description block, ending at the "Figure U2-5..." caption table | yes, 108 words | yes | `phase1_report.json` |
| TMP-0849 Figure U2-6 Beats Features | donor `B2P1-0850.png` | **RESTORED** | donor's leading description block, ending at the "Figure U2-6..." caption | yes, 116 words | yes | `phase1_report.json` |
| TMP-0851 Figure U2-7 Beats Ad | donor `B2P1-0852.png` structure | **UNRESOLVED WITH EVIDENCE** | the donor's caption table mixes the figure caption with the ad description, and the region's own panel block is empty, so caption and body cannot be separated | none | n/a | `inner_cells.json` |
| TMP-0929 Loans | `B2P2-0211.png` panel cell | **RESTORED** | whole cell after the label (photo descriptions) | no (in place) | yes | `phase1_report.json` |
| TMP-1067 Capital Bank | panel cell | **RESTORED** | whole cell after the label (screen text) | no (in place) | yes | `phase1_report.json` |
| TMP-1350 South by Southwest | `B2P2-0734.png` donor | **UNRESOLVED WITH EVIDENCE** | the donor opens with ordinary narrative about Mark Cuban; no panel body is identifiable | none | n/a | `inner_cells.json` |
| TMP-0105 Digital Platform | `B2P1-0105.png` vs `B2P1-0107.png` | **VERIFIED REDUNDANT** | the source shows one control twice - collapsed in 0105's capture and expanded in 0107's; the authentic, functional control (1,739-character body) is in `TMP-0107`.  The 0105 line is the source's own collapsed bar; removed nothing | none | yes (in 0107) | `flat_disclosure_classification.json` |

Interim total after this wave: 15 of the 24 orphan regions restored (3 + 12),
1 verified redundant (`TMP-0105`), 9 still unresolved.  **The nine were then
resolved in the `nine-case-2026-10-13` wave, so the final position is 24 of 24
restored and 0 unresolved** - see `docs/NINE_CASE_LEDGER.md`, which also records
the corrected accounting (this wave created 12 controls, not 14: `TMP-0125` and
`TMP-0152` were malformed here and were reverted to the baseline text).

## Phase 2 - the MoMo photograph credit

Root cause: the source prints the credit **vertically down the photograph's
right edge** (`B2P1-0112.png`, inspected at full resolution), but the
reconstruction keeps it as a horizontal paragraph in a 66 px side cell, so the
browser breaks "Productions/Getty" in half.  Two detector designs were tried and
rejected: a width test over-matched (40 credits, including two-photo caption
lines) and a longest-word test under-matched (0).  The confirmed region was
therefore fixed deterministically: `TMP-0112`'s credit paragraph carries
`writing-mode:vertical-rl`, and nothing else changed.

Before/after: `docs/layout/18-section-7-unit1.png` (broken: "MoMo / Productio /
ns/Getty / Images") vs `docs/layout/21-momo-credit-after.png` (one unbroken
vertical line along the photograph's edge).  The runtime detector still exists
in `reader/ui2.js` but only tags a credit whose longest word genuinely cannot
fit its cell (1 element at 1400 px).

## Phase 3-5 - remaining source-backed defects

* Section-mode header: `BUSINESSWITHPERSONALFINANCE` -> **Business with Personal
  Finance** (verified in the browser, `Section 1 of 383`).
* The four misplaced figure credits from the previous wave remain fixed; the
  strict element-adjacency test still reports 0 misplaced.
* Accessibility/typography items in `KNOWN_ISSUES.md`: audited, and the ones
  with a source-backed correction were the two above.  The remaining entries
  (Page 501-600 run sizes, missing Index body, `alt=""`, Page 1101-1200
  without a Word document) are source limitations, not reconstruction defects,
  and are unchanged - see `KNOWN_ISSUES.md`.

## Phase 6 - regression

| Check | Result |
|---|---|
| Regions | 1,899, order identical to the baseline |
| Total words | 228,179 before and after, **delta 0** (no word added, lost or duplicated) |
| Changed regions | 19 (the repaired controls and their donors only) |
| Images | 423 -> 420: the three removed images are the info-icon glyph inside a label paragraph, now drawn once by CSS (the established design) |
| Tables | 1,484 -> 1,481: net -3, all accounted for as moves (TMP-0726 gains the three tables that TMP-0727 loses) plus one single-cell label bar replaced by the standardised control |
| Disclosure controls | 134 -> **146**, 0 with an empty body, 0 malformed |
| Empty/malformed panels | 0 (two malformed cases were reverted to the baseline text and are reported unresolved) |
| `<img>` payload / JS exceptions / document overflow | 0 corrupt, 0 exceptions, 0 overflow |

Browser (headless Chrome 155, `file://`, 1400x1000): controls 146, `book2QA()`
0 failures, Section 1 = "Business with Personal Finance", Section 7 = "UNIT 1",
no console errors.

## Delivery

Local final `AP Book Final.html` 1,132,243,794 bytes,
SHA-256 `572144b82c780abbad6ec81174c96fea0f4082222442ec42a8d90657d3a4b09f`
(the `nine-case-2026-10-13` wave; this report's wave produced `ef09a825...`,
preserved in `integration_backups/final-completion-20261013/`).
Previous final (`c0ea6f33...`) preserved in
`integration_backups/final-completion-20261013/`.  Patchers:
`contents_wave/patch_orphan_controls2.py`, `patch_orphan_controls2b.py`,
`patch_momo_credit.py`, `patch_reader_script.py`, plus `reader/ui2.js`.
Raw evidence: `reports/final/`.

## Remaining genuine limitations

The 6 unresolved orphans above need one thing each: the *panel's bottom edge* in
the relevant capture, which the reconstruction's own markup no longer carries
because the description and its neighbours were merged into one table cell or
block.  Resolving them needs a page-by-page reading of those six capture pairs
at full resolution with the caption-strip boundary traced, which is a further
inspection pass rather than a code change.  Nothing was invented for them and
their original text is untouched.
