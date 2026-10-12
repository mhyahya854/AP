# Extended Description audit

## What was wrong

Every "Extended description" control in the reconstruction was a native
`<details>`, but they were drawn four different ways and three of them were
broken:

* the disclosure triangle was written as a literal character (`▼`) inside the
  label span in 117 controls, and as a `<span class="disclosure-chevron">` in 4;
* the information icon was a literal `ℹ` in 14, a literal `ⓘ` in 5, the text
  `● i` in 2, an `<img>` in 24, and missing altogether in the rest;
* every label carried its own inline colour and size, so the bar looked
  different on every page;
* three controls were not `<details>` at all - they had been flattened into
  three loose paragraphs (`▼` / `Extended description for X` / an invisible
  white `i`), so they were not expandable and their bodies were not reachable;
* the expanded panel inherited the source paragraph's 72 pt / 53 pt Word
  indents, which squeezed the description into a narrow column (the defect the
  user reported on the cover).

## What it is now

One control, one appearance, for all of them:

* a native `<details class="disclosure">` / `<summary>` pair, so it is
  keyboard operable and screen-reader announced for free;
* a light-grey rectangular bar (`#f2f3f4`) with a 1 px subtle grey border;
* a dark disclosure triangle drawn by CSS, rotating 90° when open;
* the exact original label, for example `Extended description for Front Cover`;
* a black circular information icon with a white lowercase `i`, drawn as an
  inline SVG background image on `summary::after` (decorative, so it is never
  announced by assistive technology);
* an expanded panel that uses the full reading width, grows naturally, never
  clips, and no longer inherits the Word indents.

## Counts

| Measure | Count |
|---|---|
| Disclosure controls in the finished book | 131 |
| Standardised in place (`<details>` rewritten to the shared bar) | 128 |
| Rebuilt from flattened paragraphs into real `<details>` | 3 |
| Controls whose summary has no label | 0 |
| Controls whose extracted label is empty | 0 |
| Distinct bar variants after the wave | 1 |

Labels are preserved exactly (for example
`Extended description for Front Cover`,
`Extended description for Figure 4.4-2 SWOT Analysis`,
`Extended description for Walmart`,
`Extended description for Organization (continued)`).

## Verification

* structural: 131 of 131 controls carry a `.b2-desc-label`; 0 have an empty
  label; 0 non-standard summaries (`scan_disclosures.py` reports 0 summaries
  still containing `ℹ`, `ⓘ` or a `figure-info-icon`).
* geometric: the cover description was opened in the browser and measured -
  panel 680 px wide inside a 682 px host, 0 px internal overflow, 0 px
  left/right padding, 34 px collapsed to 239 px expanded.
* `book2QA()` reports no element escaping its section.

## Corrected by the 2026-10-12 corrective wave

The sentence above was wrong for Starbucks Rewards. Its description text did
exist: the previous build had left it inside the panel beside a stray
full-page bitmap, and this audit read the panel as empty. The corrective wave
put the 157-character body back inside the control, lifted the bitmap out to be
the region's figure, and moved the caption strip below the panel back outside
the control. See `EXTENDED_DESCRIPTION_AUDIT.md`.

## Bodies that genuinely do not exist

Two rebuilt controls - **Walmart** (`TMP-0542`) and **Merck** (`TMP-0585`) -
have no description body anywhere in the supplied source. The PNG capture shows
the grey panel below the label empty, and the structured fidelity record for
each page lists no panel text at all. They remain correct, expandable controls
with an empty panel rather than a body that does not exist. Inventing that text
is not permitted; the gap is recorded here and in
`EXTENDED_DESCRIPTION_AUDIT.md`.
