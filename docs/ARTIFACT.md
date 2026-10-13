# Final artifact

| Field | Value |
|---|---|
| File | `AP Book Final.html` |
| Bytes | 1,132,261,630 |
| SHA-256 | `c4623c4a3feff2f005b29cae2a224945dfdc580708e80547caf81d3331e252e0` |
| Self-contained | yes - every figure and table is an inline `data:` URI, the only scripts are three inline scripts, no network access is required |
| Source regions | 1,899 (`TMP-0001` .. `TMP-1899`), unchanged in identity, order and text |

## Wave applied

`continuous-reading-2026-10-12`, `corrective-2026-10-12` and
`printed-contents-2026-10-12`, `supplied-entries-2026-10-12`,
`overnight-audit-2026-10-13`, `orphan-repair-2026-10-13`,
`final-completion-2026-10-13`, `nine-case-2026-10-13` and
`photo-credit-2026-10-13`.

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
* The photo-credit wave rendered every credit that sits in its own narrow cell
  beside a photograph vertically, as the publisher prints it: 182 credits,
  including the Kellogg's credit in `TMP-0124` (which reads upward in its
  source, so it uses the opposite vertical flow).  Before the repair those cells
  were 21-63 px wide against single words of 67-182 px, so the browser broke the
  words apart at every viewport.  Attribute-only change: no text, image, table
  or element order changed.  See `docs/PHOTO_CREDIT_REPAIR.md`.

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
| File | `_master_work/integration_backups/supplied-entries-20261012/prev-final-AP Book Final.html` |
| Bytes | 1,132,297,657 |
| SHA-256 | `f606cdc8bf3af4451ed1a092e047fca77bc506244c163dc5ec9bb5531f63346d` |

The immediately previous artifact (the supplied-entries final) is preserved as
`_master_work/integration_backups/overnight-audit-20261013/prev-final-AP Book Final.html`,
1,132,298,830 bytes, SHA-256
`1f935d1ac2595b9c84ec81354c0b963867abda7c3d5506272a36941c4bd8a83b`.

The earlier wave backups (`contents-wave-20261012` - the `f606cdc8` build -
`corrective-wave-20261012` - the `e38a07ca` build -
`continuous-wave-20261012`, `reader-a11y-20261011`, `reader-a11y-wave2-20261011`,
`reader-controls-20261011`, `navigation-v2-20261011`, `reader-ui-20261012`,
`reading-order-20261012`) are all still present.
