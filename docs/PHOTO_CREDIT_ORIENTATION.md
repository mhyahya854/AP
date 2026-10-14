# Photo credit orientation: what the source prints, and the correction

Status: applied to `AP Book Final.html` (1,132,261,630 bytes,
SHA-256 `73d175779ae506d9f2b902e83f56438ca313c3d75be4eb1dd0c5cf75c4f645b2`).
Previous accepted artifact `572144b82c780abbad6ec81174c96fea0f4082222442ec42a8d90657d3a4b09f`
(1,132,243,794 bytes) preserved and unchanged.

## The defect

179 credits sit in a photo-side cell of their own. The accepted artifact left them
in `horizontal-tb`, so the words were broken into fragments: measured cell widths
are 21-58 px at 1400 px and 13-34 px at 390 px, while the widest word of the credit
needs 67-133 px. `TMP-0124` (the Kellogg's Froot Loops photograph) is the reported
case: 58 px cell, 110 px word.

## What the source prints

The credit is printed **vertically**, in a narrow column beside the photograph, and
it is **rotated 90 degrees counter-clockwise: it reads bottom-to-top.** Rotating the
source capture 90 degrees clockwise makes the line upright and readable; rotating it
the other way leaves it upside down.

That was verified for every affected region from its own source capture, by OCR of
the capture at three rotations (`reports/credit_sideways_lr/`):

| result | regions |
| --- | --- |
| readable only after rotating the capture clockwise (vertical, reads up) | 178 |
| same, resolved from upscaled tiles the whole-page pass could not read | 4 |
| readable horizontally in the print | 0 |
| readable only after rotating counter-clockwise (vertical, reads down) | 0 |

`credit_regions_before_after.csv` lists all 182 rows: region, credit text, the
accepted cell geometry, the source capture, the evidence stage, and the printed
orientation.

## The rejected first attempt

An earlier change (`9a17a12`, reverted by `4ecafea`) tagged the same 182 paragraphs
with `writing-mode:vertical-rl`. The regions are right, the direction is not:
`vertical-rl` rotates the glyphs clockwise, so the credit reads top-to-bottom, i.e.
upside down against the print. Rendering the same fixture with each style and
rotating the screenshot clockwise reproduces this directly - `sideways-lr` reads
"Mario Tama/Getty Images", `vertical-rl` reads it inverted. The revert restored the
previous artifact on `main` before this correction was written.

## The correction

`AP Book Final.html` only; attribute-only, 182 paragraphs, one property each:

    writing-mode:sideways-lr;text-orientation:mixed;white-space:nowrap;margin:0 auto;line-height:1.15

appended to each credit paragraph's existing `style` attribute. Regions without
source evidence are left untouched, and nothing else in the file changes.

## Verification

Static, region by region over both files (`verify_structure.json`):

* 1,899 regions, identical ids and order, 182 changed
* per-region text identical, 228,459 words in both
* every change is exactly the one injected property, no other byte differs
* identical markup counts: 417 `img`, 1,478 `table`, 155 `details`, 155 `summary`
* 395 in-page links, 0 broken, 0 duplicate region ids
* all bytes outside the 182 regions byte-identical
* all 155 in-book disclosure controls own exactly one summary, have a non-empty
  panel and do not nest (`disclosures_audit.json`)

Fixtures built from the artifact's own CSS and markup (3 regions x 3 styles x 2
viewports), then one bounded headless Chrome 155 pass over the whole staged file
(`regression_full.json`):

* book loaded fully in 21 s, no resource exhaustion
* 0 exceptions, 0 console errors
* 181 of 182 credits measured as computed `sideways-lr`, 17 px single column, 0 cell
  overflow, 0 document overflow (the 182nd, `TMP-1506`, is styled as the byte-level
  check proves; the DOM probe's credit matcher missed its upper-case "GETTY")
* all 197 `details` open, reveal and close; 0 without a summary
* `book2QA()` reports no failures; 390 px pass: no document or main overflow
