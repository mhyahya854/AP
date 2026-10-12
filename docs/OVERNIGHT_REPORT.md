# Overnight forensic audit - final report (GitHub copy)

Full report: [`OVERNIGHT_AUDIT.md`](OVERNIGHT_AUDIT.md).  Raw evidence:
`reports/overnight_audit/` (21 files: issue ledger, source-coverage CSV for all
1,899 captures, per-region source-to-HTML map, cross-capture audit, blank-region
resolution, disclosure / LG / figure / table / navigation audits, credit
placement, flat-disclosure classification, regression report, browser QA and
screenshots).

## Outcome

| | |
|---|---|
| Baseline audited | `1f935d1a...`, 1,132,298,830 bytes, GitHub `a0a33e3` |
| Corrections applied | honest pagination vocabulary + Section mode; non-overlapping mobile drawers; four misplaced figure credits |
| Final artifact | `ec7a490e53e811b1f433a9311f4bd7152dcb305f0007e306db5b33703691f24b`, 1,132,311,795 bytes |
| Content impact | **0** regions with changed text, **0** with changed words; region text 1,444,347 characters before and after |
| Coverage | 1,899/1,899 captures hash- and size-verified; 1,898/1,898 capture transitions audited; 131/131 disclosures; 151 LG badges; 423 images; 1,484 tables; 395 links, 0 broken |
| Visually inspected | 18 whole captures and 20 crops at full resolution (the remainder by programmatic sweep only - stated, not implied) |

## Severity summary

* **P0 - none.**  The 36 content-free regions were resolved: 29 are captures
  that are blank in the source, 7 are captures whose content was already merged
  into the previous region (verified word-for-word against that region's HTML).
* **P1 - one fixed, one open.**  Fixed: the reader called capture fragments
  "pages" and offered a printed spread that the source cannot support; it now
  offers Continuous / Section (383 verified headings) / Source capture, and says
  why the printed spread is not available.  Fixed: two mobile drawers used to
  overlap at 390 px when a desktop session had stored both open.  **Open: 24
  orphan description controls** - the source has the control, the
  reconstruction has only a bare label, and each body's extent still needs
  per-capture confirmation before any text is moved.
* **P2 - two found, one fixed.**  Four figure credits printed above their
  photograph (fixed; a looser detector had wrongly claimed 11).  The 500 vs 506
  page-cell counts are two correct scopes and are now named.
* **P3 - one fixed.**  Small QA screenshots returned LFS pointers in the GitHub
  UI; `docs/layout/*.png` is now excluded from LFS.  The 1,899 captures and the
  book itself stay in LFS.

## Not done in this run, deliberately

The 24 orphan controls (reason above), and the documented source limitations:
no Index body, no Word document for `Page 1101-1200`, `alt=""` on every image,
and the Page 501-600 donor document's missing run sizes.  `ISS-110` was not
revisited.  No database, service or unrelated system setting was touched.

(started 2026-10-12T20:17:11.918530+00:00)
