# Overnight forensic audit (2026-10-12/13)

Read-only forensic audit of the complete reconstruction, then a targeted
correction wave.  Baseline: `AP Book Final.html`, 1,132,298,830 bytes,
SHA-256 `1f935d1a...`, GitHub `a0a33e3`.

Machine-readable evidence: `reports/overnight_audit/` (ledger, coverage CSV,
per-region source map, cross-capture audit, disclosure/LG/figure/table/
navigation audits, regression report, browser QA, screenshots).

## 1. Coverage actually achieved

| Sweep | Extent | Result |
|---|---|---|
| Source captures audited | **1,899 / 1,899** | file present, SHA-256 + byte count match the manifest, PNG format and exact pixel size verified |
| Regions compared | **1,899 / 1,899** | present, in the manifest's global order, no extra, no missing |
| Region text | 1,444,347 characters | unchanged from the baseline |
| Consecutive capture transitions | **1,898 / 1,898** | audited for duplicated, stranded or detached content |
| Disclosure controls | **131 / 131** | label present, non-empty body, no duplicated panel text |
| LG badges | **151**, in 143 regions | present, non-zero size in the browser |
| Images | 423 in regions (+1 rail thumbnail) | 0 bad payloads, 0 broken |
| `<table>` tags | 1,484 in regions | structure counted; ragged-table check clean |
| Navigation | 516 rail rows, 395 internal links | **0 broken** |

Original images **visually inspected at full resolution** in this run: the four
Walmart/Merck captures, the AMD and balance-sheet captures, the Cialdini
capture pair, three credit-order captures, and the blank captures listed below
— 18 whole captures plus 20 crops.  The remaining captures were covered by the
programmatic sweep above (existence, hash, size, region mapping, order, text
and asset counting), **not** by eye.  This report never treats the programmatic
sweep as visual verification.

## 2. Findings, by severity

### P0 — none

No missing material, no duplication, no wrong-book content, no reading-order
break.  In particular, the **36 regions that render no content** were resolved:

* **29** are captures whose own image is effectively blank (0.0000 non-white
  pixels; one is a pink sliver) — preserving them preserves the source;
* **7** (`TMP-0108`, `-0109`, `-0708`, `-1121`, `-1162`, `-1305`, `-1312`) show
  a panel/table that was **already merged into the previous region**: every word
  visible in those captures is rendered in `TMP-0107`, `TMP-1120`, `TMP-1161`
  or `TMP-1304`.  Verified by reading the HTML text of the merge target against
  the capture (`blank_region_resolution.json`, `orphan_body_map.json`).

### P1 — one class found and fixed, one class left open

**Fixed: the printed-page vocabulary (`OA-001`).** The single/two-page modes
presented the 1,899 capture fragments as "Page n / 1899" and offered a
two-page *printed* spread.  There is no printed page boundary anywhere in the
available source (`record_kind` says so per capture).  Now:

* **Continuous** (default) is unchanged;
* **Section** (new) pages through the book's own 383 verified heading anchors —
  a real unit of the book — and reports `Section i of 383 · <heading>`;
* the old single mode is renamed **Source capture** and says
  `Source capture i of 1,899`, with a note that a capture is a screenshot of a
  scrolling page, not a printed page;
* the printed-spread claim is **withdrawn**: no printed page boundaries exist,
  so a printed spread cannot be offered.  The withdrawal is stated in the UI
  note (`reader/ui2.js`), here, and in `KNOWN_ISSUES.md`.

**Fixed: overlapping mobile drawers (`OA-002`).** With both drawers stored open
from a desktop session, a 390 px window showed two 280 px fixed drawers on top
of each other.  On a narrow viewport the reader now keeps the Contents drawer,
closes the other when one is opened, and restores the stored desktop
preference when the window widens.  The stored preference is never overwritten
by the narrow-screen adjustment.  Verified in the browser for: seeded
`{left:open,right:open}` at 390 px (no overlap), opening Tools (Contents
closes), and resizing back to 1400 px (both restored).

**Left open: 24 orphan description labels (`OA-007`).** 25 places carry an
"Extended description for …" label that is **not** inside a `<details>`
control, so it is not expandable and the label renders as an ordinary line.
One is a redundant remnant (`TMP-0105`, whose real control is in `TMP-0107`);
the other **24 are orphans** — the source has the control, the reconstruction
does not.  Visual proof of the class: `TMP-0567` ends with the control bar and
an empty panel while `B2P1-0568.png` begins with that panel's body, exactly the
Walmart/Merck pattern; several others (e.g. `TMP-0421`, `TMP-0523`, `TMP-0575`)
carry the body as ordinary paragraphs immediately after the label.

This was **not** patched in this run.  Deciding how far each body extends, and
which of the 24 need a cross-capture move, requires per-region source
verification, and moving text on proximity alone is exactly what the brief
forbids.  Per-region locations are recorded in
`reports/overnight_audit/orphan_body_map.json` so the fix is mechanical once
each boundary is confirmed against its capture.

### P2 — two found, one fixed

* **Figure credit above the photograph instead of after it** (`OA-003`).  A
  first, loose detector flagged 11 regions; the strict element-adjacency test
  reduced that to **4** (`TMP-0570`, `-0575`, `-0592`, `-0598`) — the rest were
  false positives, two of them credits that correctly follow their own image.
  Fixed; each credit `<p>` is byte-identical, only its position changed.
* **Two page-cell counts reported without a scope note** (`OA-005`).  Both are
  correct: 500 cells sit on the classed rail rows, 506 includes the six unit
  group headers.  Now stated explicitly wherever the numbers appear.

### P3 — one found, fixed

* **Small QA screenshots returned LFS pointers in the GitHub UI** (`OA-006`).
  `docs/layout/*.png` is now excluded from LFS and stored as ordinary blobs;
  the 1,899 original captures and the book stay in LFS.

## 3. Attacks that failed to break the reconstruction

| Attack | Result |
|---|---|
| Do consecutive captures duplicate content? | 0 overlapping pairs among 1,898 transitions |
| Are there description panels with no body? | 0 (the Walmart/Merck fix holds) |
| Do two controls share identical panel text? | 0 |
| Are any source captures missing or altered? | 0 of 1,899 (hash and byte count) |
| Is any region out of order or duplicated? | 0 |
| Do any rail links dangle? | 0 of 395 |
| Are any image payloads corrupt? | 0 of 423 |
| Do the counts in the reports agree with the file? | yes, once the two page-cell scopes were named |
| Did the wave change any word? | no: 0 regions with changed text, 0 with changed words, 1,444,347 characters before and after |

## 4. What this run did **not** do

* It did not inspect every capture by eye, and does not claim to.
* It did not repair the 24 orphan description controls (reason above).
* It did not touch the documented source limitations: the missing Index body,
  `Page 1101-1200` without a Word document, `alt=""` on every image, and the
  Page 501-600 donor document rendering without run sizes.
* It did not revisit `ISS-110`.
* It did not run a fresh end-to-end rebuild from the Word donor documents; the
  wave is a verified, additive presentation patch over the audited artifact.
