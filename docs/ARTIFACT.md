# Final artifact

| Field | Value |
|---|---|
| File | `AP Book Final.html` |
| Bytes | 1,132,289,645 |
| SHA-256 | `ba63e34f36d7a9b35fc174b2fef6f15a0c70e9d6ab1063aa4451110eae18ff74` |
| Self-contained | yes - every figure and table is an inline `data:` URI, the only scripts are four inline scripts, no network access is required |
| Source regions | 1,899 (`TMP-0001` .. `TMP-1899`), unchanged in identity, order and text |

## Wave applied

`continuous-reading-2026-10-12`, `corrective-2026-10-12` and
`printed-contents-2026-10-12`, `supplied-entries-2026-10-12`,
`overnight-audit-2026-10-13`, `orphan-repair-2026-10-13`,
`final-completion-2026-10-13`, `nine-case-2026-10-13` and
`photo-credit-orientation-2026-10-14`, `sidebar-2026-10-14`,
`toolbar-appearance-2026-10-14`.

* The toolbar-appearance wave of 2026-10-14 moved the whole toolbar group to
  the top-right of the reading column as a compact group (619 px instead of a
  full 210 mm bar) and added a **Light / Dark / System** appearance control at
  the top of the Reader Tools panel.  It changed two blocks and one piece of
  shell markup - the reader-UI stylesheet, the reader-UI script (which now also
  maps the reconstruction's 15 309 inline Word colours in dark mode) and the
  inserted `Appearance` control - and nothing else: the 1,132,034,986 bytes
  between the first article region and the tools panel are byte-identical, all
  1,899 regions hash identically, every marker in the census is unchanged
  (502 Contents rows, 506 printed-page cells, 155 Extended Description
  controls, 151 LG badges, 423 embedded PNGs, 383 headings, 395 links with
  0 broken, 182 vertical photo credits, 0 duplicate ids), and 0 of the 418
  photographs carry any CSS filter in dark mode.  The accepted sidebar
  behaviour is untouched: the reading line is preserved exactly when the theme
  changes or a sidebar is toggled (tested at scroll offset 558 025 px deep in
  the book).  Evidence and the requirement-by-requirement report:
  `docs/DARK_MODE_AND_TOOLBAR_REPORT.md`, `reports/step2_wave/`,
  `docs/layout/46-59`.

* The sidebar wave of 2026-10-14 gave each sidebar its own always-visible
  collapse button at the top of the panel, gave both controls of a panel the
  same `aria-expanded` state and a visible focus ring, kept the toolbar toggles
  that reopen a hidden panel, stopped the transient phone drawer from
  overwriting the stored desktop preference, and made a sidebar toggle keep the
  reader exactly where it was (the reading line and the panel's own scroll
  offset are restored after the re-layout instead of jumping).  It changed the
  stylesheet, the two additive scripts, four shell attributes and the two
  collapse buttons - nothing else: the 1,132,034,986 bytes between the first
  article region and the tools panel are byte-identical, and all 1,899 regions
  hash identically to the previous artifact.  Evidence and the full
  requirement-by-requirement report: `docs/SIDEBAR_WAVE.md`,
  `reports/sidebar_wave/`.

* The corrective wave changed one source region (`TMP-0563`, the Starbucks
  Rewards control, whose description text was stranded beside a bitmap inside
  the panel) and added one stylesheet rule.
* The printed-contents wave wrote the printed page labels of the supplied
  numbered Contents list into 493 sidebar reference cells, and rewrote the
  sidebar note. It touched nothing inside a source region.
* The supplied-entries wave rendered the seven supplied Contents entries that
  had no row, put the supplied printed label on the six top-level unit rows,
  repaired the one navigation label that had lost its spaces, and re-ordered
  the front-matter and glossary rows into the supplied order (sidebar only, no
  source region touched), then restored the Walmart and Merck Extended
  Description bodies that the capture boundary had cut away from their
  controls.
* The overnight-audit wave audited all 1,899 captures and all 1,898 capture
  transitions, then applied two presentation corrections: it replaced the
  printed-page vocabulary with an honest **Section** / **Source capture** model
  (the printed-spread claim is withdrawn because no printed page boundary
  exists), and it stopped the two mobile drawers from overlapping on a narrow
  viewport.  It also moved four misplaced figure credits to directly after
  their photographs.
* The three repair waves turned all **24** orphan `Extended description for …`
  labels into real grey-bar `<details>` controls (3 + 12 + 9), each with its
  complete source-backed body, its figure caption left outside the panel and
  the loose UI glyphs removed; `TMP-0105` was proven a redundant remnant of the
  control in `TMP-0107`.  The `final-completion` wave also rendered the
  source-vertical `MoMo Productions/Getty Images` credit vertically instead of
  letting the browser break the word in half.  Disclosure controls in the book:
  155, none empty.  Ledger: `docs/NINE_CASE_LEDGER.md`.

* The photo-credit wave of 2026-10-14 gave all **182** photo-side credits their
  printed orientation.  Each one was recovered from its own source capture: they
  are printed vertically in a narrow column beside the photograph and read
  bottom-to-top, so the rule is `writing-mode:sideways-lr`, applied as one extra
  property on the credit paragraph's existing `style` attribute.  The first
  attempt at this (`9a17a12`, `writing-mode:vertical-rl` on the same paragraphs)
  was wrong by 180 degrees - it made the credits read top-to-bottom, upside down
  against the page - and was reverted in `4ecafea` before this correction was
  written.  Evidence and the rejected-direction proof:
  `docs/PHOTO_CREDIT_ORIENTATION.md`,
  `reports/credit_sideways_lr/credit_regions_before_after.csv`,
  `docs/layout/34-credit-sideways-lr-match.png`,
  `docs/layout/35-credit-vertical-rl-inverted.png`.

Of the **1,899** regions, **1,895** are byte-identical to the artifact before
the supplied-entries wave and **4** changed - `TMP-0542`, `TMP-0543`,
`TMP-0585`, `TMP-0586` - because the Walmart and Merck description bodies were
relocated into their controls.  The overnight-audit wave changed **no word** in
any region: 0 regions with a changed text fingerprint, 0 with changed words,
and the file's total region text is still 1,444,347 characters
(`reports/overnight_audit/REGRESSION_REPORT.json`).

## Previous artifact (preserved)

| Field | Value |
|---|---|
| File | `_master_work/integration_backups/step2-20261014/prev-final-AP Book Final.html` (also the parent of the `toolbar-appearance-2026-10-14` commit) |
| Bytes | 1,132,269,052 |
| SHA-256 | `db07ab804bed45df6dd7b27a70dea2e86f259707d047b9b307d19e71108e35df` |

The artifact before that (the sidebar-wave final) is preserved as
`_master_work/integration_backups/sidebar-20261014/prev-final-AP Book Final.html`,
1,132,261,630 bytes, SHA-256
`73d175779ae506d9f2b902e83f56438ca313c3d75be4eb1dd0c5cf75c4f645b2`.

The artifact before that (the supplied-entries final) is preserved as
`_master_work/integration_backups/supplied-entries-20261012/prev-final-AP Book Final.html`,
1,132,297,657 bytes, SHA-256
`f606cdc8bf3af4451ed1a092e047fca77bc506244c163dc5ec9bb5531f63346d`;
the overnight-audit final is preserved as
`_master_work/integration_backups/overnight-audit-20261013/prev-final-AP Book Final.html`,
1,132,298,830 bytes, SHA-256
`1f935d1ac2595b9c84ec81354c0b963867abda7c3d5506272a36941c4bd8a83b`.

The earlier wave backups (`contents-wave-20261012` - the `f606cdc8` build -
`corrective-wave-20261012` - the `e38a07ca` build -
`continuous-wave-20261012`, `reader-a11y-20261011`, `reader-a11y-wave2-20261011`,
`reader-controls-20261011`, `navigation-v2-20261011`, `reader-ui-20261012`,
`reading-order-20261012`) are all still present.
