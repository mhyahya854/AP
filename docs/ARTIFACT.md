# Final artifact

| Field | Value |
|---|---|
| File | `AP Book Final.html` |
| Bytes | 1,132,311,795 |
| SHA-256 | `ec7a490e53e811b1f433a9311f4bd7152dcb305f0007e306db5b33703691f24b` |
| Self-contained | yes - every figure and table is an inline `data:` URI, the only scripts are three inline scripts, no network access is required |
| Source regions | 1,899 (`TMP-0001` .. `TMP-1899`), unchanged in identity, order and text |

## Wave applied

`continuous-reading-2026-10-12`, `corrective-2026-10-12` and
`printed-contents-2026-10-12`, `supplied-entries-2026-10-12` and
`overnight-audit-2026-10-13`.

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
