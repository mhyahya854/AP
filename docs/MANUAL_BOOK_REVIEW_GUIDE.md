# Manual book review guide

The technical QA in `docs/FINAL_TECHNICAL_CERTIFICATION.md` is complete: the reader is structurally sound, every implemented control works, and no content was lost relative to the accepted baseline. **What technical testing cannot decide is whether each reconstructed page looks like the page it came from.** That is this step, and it is yours.

## What you are looking at

* The reader is one HTML file. Open `AP Book Final.html` in Chrome/Edge (no server needed):
  `C:\Users\mhyah\Downloads\book-source\Word\AP Book Final.html` (identical copy: `_master_work\repo\AP\AP Book Final.html`).
* It holds **1,899 source captures** in reading order. A capture is a screenshot of a scrolling page, **not** a printed page; the reader never claims a printed page boundary.
* The reconstructed text is 1,426,177 characters, and 418 photographs are embedded as images; the rest of each page is rebuilt as text, tables and vector layout.
* The left rail lists the publisher's own Contents. Rows with a printed label carry the label exactly as supplied (500 numbered entries; 506 label cells).

## How to use `MANUAL_REVIEW_INDEX.csv`

`reports/final_release_qa/MANUAL_REVIEW_INDEX.csv` has 528 rows in reading order.

| Column | Meaning |
|---|---|
| `kind` | `unit-or-group`, `module` or `entry` |
| `group` / `module` | the rail ancestry the row sits in |
| `title` | the exact Contents title |
| `printed_label` | the supplied printed page label, if the list has one |
| `reader_anchor` | paste the hash onto the file URL to jump straight there, e.g. `file:///.../AP%20Book%20Final.html#book-heading-0119` |
| `destination_region` | the source capture the row lands in (`TMP-nnnn`) |
| `source_png` | the original capture file for that region - open it to compare |
| `region_span` | for a unit or module row, the region range it covers |
| `has_extended_description` | an Extended Description control sits in that region |
| `has_photograph` | the region embeds a photograph |
| `risk_flags` | known risk, explained below |
| `review_status` / `defect_note` | your columns: `reviewed`, `ok`, `defect` + a note |

Work down the sheet. At each row: click the rail entry (or paste the anchor), read the page, then open `source_png` from `Page <batch>\` in the project root and compare.

## Risk flags you will see

| Flag | Meaning | What to do |
|---|---|---|
| `SOURCE-GAP (...)` | 33 captures whose original page is blank/pale (30) or whose content was merged into another capture (3). The reader shows nothing there rather than inventing text. | Open the capture and confirm it really is blank or a duplicate state. |
| `OCR-derived batch (...)` | the page range had no Word document, so its text came from a structured OCR candidate; wording and styling are less certain there. | Read closely; flag any wrong word. |
| `thin text (... chars, no photograph)` | very little reconstructed text and no embedded photograph. | Compare with the capture to see whether text is missing. |
| `repaired: ...` | a historically repaired figure or description (Front Cover, Kellogg's, Supply Chain, Price Elasticity, income statement table). | Compare against the capture. |
| `unlinked (...)` | 73 rows kept visible but not linked, because no source-verified destination exists. 6 of them describe material the source does not contain at all (About this Book, Title Page, Copyright Page, FEP, Back Cover, Index). | Nothing to click; confirm the row is meant to be inert. |

## The 33 source-gap captures

| Region | Source capture | Classification |
|---|---|---|
| TMP-0053 | B2P1-0053.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0055 | B2P1-0055.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0106 | B2P1-0106.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0108 | B2P1-0108.png | MERGED_INTERACTION_STATE_REFERENCE |
| TMP-0109 | B2P1-0109.png | MERGED_INTERACTION_STATE_REFERENCE |
| TMP-0110 | B2P1-0110.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0129 | B2P1-0129.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0231 | B2P1-0231.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0434 | B2P1-0434.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0478 | B2P1-0478.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0666 | B2P1-0666.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0708 | B2P1-0708.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0771 | B2P1-0771.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0862 | B2P1-0862.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0922 | B2P2-0059.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0969 | B2P2-0106.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0970 | B2P2-0107.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0977 | B2P2-0114.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-0993 | B2P2-0130.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1112 | B2P2-0249.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1156 | B2P2-0293.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1174 | B2P2-0311.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1205 | B2P2-0342.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1208 | B2P2-0345.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1298 | B2P2-0435.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1305 | B2P2-0442.png | MERGED_INTERACTION_STATE_REFERENCE |
| TMP-1306 | B2P2-0443.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1414 | B2P2-0551.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1444 | B2P2-0581.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1521 | B2P2-0658.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1577 | B2P2-0714.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1599 | B2P2-0736.png | BLANK_OR_PALE_BACKGROUND_ONLY |
| TMP-1670 | B2P2-0807.png | BLANK_OR_PALE_BACKGROUND_ONLY |

## Financial tables reconstructed from OCR

| Table id | Capture | Rows x cells |
|---|---|---|
| table-income-statement-0244-0245 | TMP-1107 | 11 x 21 |
| table-budget-0268-0270 | TMP-1131 | 2 x 4 |
| table-yeti-income-0288-0289 | TMP-1151 | 7 x 32 |
| table-yeti-income-0288-0289 | TMP-1152 | 5 x 25 |
| table-sprinkles-city-0314-0315 | TMP-1177 | 10 x 34 |
| table-sprinkles-city-0314-0315 | TMP-1178 | 8 x 21 |
| table-toms-tires-0333-0334 | TMP-1196 | 2 x 4 |
| table-toms-tires-0333-0334 | TMP-1197 | 10 x 36 |
| table-household-0335 | TMP-1198 | 8 x 30 |

## Suggested order

1. Front matter (cover, title, contents, authors, advisory board) - the cover is also worth a look at 320 px width on a phone.
2. Unit 1 and each module: module opener banner, Learning Goals, body, figures, Module Review.
3. The case studies scattered through every unit.
4. Units 2-5 the same way, then the Appendix, References, Glossary and the back matter rows.
5. Dark mode once per unit (the theme control is in the right-hand Reader tools panel).

## What does not exist in the source (do not report these as defects)

* No Index body, no FEP, no Back Cover page, no Title Page, no Copyright Page.
* No per-image alt text: the supplied source has none, so the 417 book figures carry `alt=""` and the source-backed descriptions that do exist are the 155 Extended Description controls.
* No printed page numbers of its own on the Contents pages, so no printed page boundary is claimed anywhere in the reader.

## How to report a page problem

Send one block per issue in this shape:

```
Location      : (Contents title / module / region TMP-nnnn / printed label)
What looks wrong: (one sentence)
What the original shows: (from the source PNG, e.g. B2P1-0715.png)
Screenshot    : (file name)
Severity      : blocker / major / minor / cosmetic
```

With the region id or the Contents title I can go straight to the same page, compare it with the capture, and repair it without rebuilding the whole book.
