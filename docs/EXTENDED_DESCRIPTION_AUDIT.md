# Extended description audit - the three rebuilt controls

> **Corrected by the `supplied-entries-2026-10-12` wave.** The Walmart and
> Merck rows below are wrong. Both controls *do* have a description body: the
> capture boundary falls inside the description panel, so the body stands at
> the top of the following capture (`B2P1-0543.png`, `B2P1-0586.png`), which
> this audit never opened. Both bodies have been restored by relocating the
> exact paragraphs into the control. See `WALMART_MERCK_FORENSICS.md`. The
> Starbucks Rewards row, and the front-cover description, are correct and
> unchanged.

Wave: corrective (2026-10-12). Scope: the three controls whose expanded body
was empty in the previous build. Everything below was checked against the
original Word reconstruction, the saved PNG capture and the structured OCR
records, region by region.

| | Walmart | Starbucks Rewards | Merck |
|---|---|---|---|
| Control label | `Extended description for Walmart` | `Extended description for Starbucks Rewards` | `Extended description for Merck` |
| Reader region | `TMP-0542` | `TMP-0563` | `TMP-0585` |
| Source capture | `B2P1-0542.png` | `B2P1-0563.png` | `B2P1-0585.png` |
| Source batch | `Page 501-600` | `Page 501-600` | `Page 501-600` |
| Structured source record | `_terra_work/B2P1-0542.json`, `_fidelity_qa/542_review.json` | `_terra_work/B2P1-0563.json`, `_fidelity_qa/563_review.json` | `_terra_work/B2P1-0585.json`, `_fidelity_qa/585_review.json` |
| Original body found | **NO** | **YES** | **NO** |
| Body restored | not applicable - none exists | 157 characters restored | not applicable - none exists |
| Final status | panel legitimately empty | **restored and verified** | panel legitimately empty |

## Method

For each control the source PNG was opened at full resolution and the
description panel inspected pixel by pixel; the structured OCR record for the
same capture (`_terra_work/B2P1-05xx.json`) and the audited fidelity review
(`_fidelity_qa/5xx_review.json`) were read for the panel geometry, the
`exclude_text_exact` list and the `structure_elements` list; and the current
reader region was read straight out of `AP Book Final.html`.

## Walmart - `TMP-0542`, `B2P1-0542.png`

**Original body found: NO.** The capture shows the case-study title, the
Walmart photograph with its vertical `Joe Raedle/Getty Images` credit, and the
collapsed description heading at the foot of the page. The OCR record contains
exactly two lines for the whole page - `CASE STUDY Walmart` and
`v Extended description for Walmart` - and the fidelity review records the
panel as one empty grey rectangle (`fill EEEEEE`, 3230 x 753) with the arrow,
the information icon and the label. Opening the PNG at full resolution shows
the grey panel below the label completely empty: the source itself is a
collapsed, bodyless heading.

The prose that follows in the reader (the registers / data-analysis case study)
belongs to `TMP-0543` and `TMP-0544` and is ordinary case-study text. It was
**not** moved into the control: it is not description text, it is the case
study the heading sits above. No duplicate text exists.

## Starbucks Rewards - `TMP-0563`, `B2P1-0563.png`

**Original body found: YES, and it was restored.** This is the defect the
report flagged. The previous build had not lost the words - it had put them in
the wrong place and put a full-page bitmap beside them: the whole page content
(figure, panel text and caption) sat *inside* the `<div class="desc-panel">`.

The source panel holds one three-line paragraph, and the fidelity review
records it explicitly as a styled text body:

> Text on the page reads, FREE COFFEE IS A TAP AWAY. Join now to start earning
> Rewards. Button: Join Now. Or join in the app (hyperlink) for the best
> experience.

It is now inside the control, exactly as written, character for character
(157 characters, `Text on the page reads, ... experience.`). Two things were
set right at the same time, both verified against the source:

* the full-page bitmap was lifted out of the panel and made the region's
  `<figure>` - it is the page's own artwork, not description text;
* the grey caption strip (`Arial Narrow`, `#565656`,
  `Technology affects purchasing patterns by offering customer engagement
  anytime, anywhere, and by making`) was moved back **outside** the control,
  because in the source it sits below the panel divider as the region's caption.

Text preservation: the region's own text fingerprint is unchanged -
`region_text_before.json` and `region_text_after.json` hash the same string for
`TMP-0563`, and the word-level fingerprint is identical for all 1,899 regions.
Every word of the page is still present exactly once.

## Merck - `TMP-0585`, `B2P1-0585.png`

**Original body found: NO.** The capture shows the case-study title, the Merck
photograph with its `Timon Schneider/Alamy Stock Photo` credit, and the
collapsed heading. The OCR record's last line is
`v Extended description for Merck`; the grey panel below it is empty in the
source image, exactly as for Walmart. The following prose (`The phone screen
displays a screenshot from a web page for Merck ...`) is ordinary body text of
`TMP-0586` and its continuation, not a description body, so it was left where
it belongs.

## Verification

Browser check on the finished file (`corrective_wave/browser_qa_corrected.json`,
headless Chrome 155 over `file://`):

| Control | Collapsed | Expanded | Panel text | Panel overflow | Keyboard |
|---|---|---|---|---|---|
| Front Cover | 34 px | 239 px | 580 chars | 0 px | focusable, toggles |
| Starbucks Rewards | 34 px | 128 px | 157 chars (restored) | 0 px | focusable, toggles |
| Walmart | 34 px | 59 px | 0 chars (source has none) | 0 px | focusable, toggles |
| Merck | 34 px | 59 px | 0 chars (source has none) | 0 px | focusable, toggles |

The bar keeps the established interface: light-grey bar (`#f2f3f4`) with a
1 px border, a dark CSS-drawn disclosure triangle that rotates when open, the
exact original label, the black circular information icon with the white
lowercase `i` drawn on `summary::after`, the whole summary row clickable, and
the expanded text at the full reading width (686 px panel inside a 686 px host,
0 px internal overflow, 0 px left/right padding) with no clipping and no
artificial page break.

Controls in the finished book: **131**, all with a non-empty `.b2-desc-label`.
**A control with an empty body is not reported as having a complete
source-backed description.** Walmart and Merck are recorded as *source has no
description body*; they are correct, expandable controls with an empty panel.

## One correction to the previous report

The previous `DISCLOSURE_AUDIT.md` said all three rebuilt controls had no
description body at all. That was wrong for Starbucks Rewards: the text existed
all along, stranded beside the bitmap inside the panel. This audit supersedes
that statement.
