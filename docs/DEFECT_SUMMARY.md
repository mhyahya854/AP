# Corrected-defect summary

Each item below was reproduced on the previous final, corrected in the wave,
and re-checked on the promoted artifact.

| # | Defect | Fix | Evidence |
|---|---|---|---|
| 1 | The book was drawn as 1,899 separate paper cards even in Continuous mode, so every module was broken into dozens of visual pages | Continuous mode is now one flowing sheet: transparent, shadow-free, margin-free regions on a white reading column, with a hairline only where a verified module or unit begins | computed style probe; 51 section marks; screenshots `05`, `08` |
| 2 | 128 disclosure bars looked different from each other; the triangle and information icon were literal text characters or stray images | One shared bar: light-grey background, subtle grey border, CSS triangle, exact label, CSS-drawn black circular `i` | `DISCLOSURE_AUDIT.md`; screenshot `02` |
| 3 | The expanded description inherited 72 pt / 53 pt Word indents and was squeezed into a narrow column (reported on the cover) | Panel and its direct children get the full reading width: 680 px of a 682 px host, 0 px inner overflow | browser measurement; screenshot `02` |
| 4 | 3 descriptions were flat paragraphs (`▼` / label / invisible `i`) and could not be opened at all | Rebuilt as real `<details>` controls with the shared bar | `patch_wave_report.json` -> `flattened_disclosures_rebuilt: 3`; screenshot `07` |
| 5 | 130 `LG` badges were white invisible text in a fake rectangle; 7 more were invisible white paragraphs | Rebuilt into the badge component; the rectangle boxes were removed | `LG_AUDIT.md`; screenshots `04`, `05`, `06` |
| 6 | Badge geometry was wrong (63x42 and 70x45 rectangles with a 6 pt radius instead of the source stadium) | Single geometry: 24 pt tall, 2.3 : 1, fully rounded, source fill `#a61f66` | computed style: 73.6 x 32 px, radius 16 px, `rgb(166,31,102)` |
| 7 | Goal text varied between 13, 10.5, 9.5 and 7 pt | One reading: 12.5 pt bold `#565656`, and the source's plum rules above and below | screenshots `05`, `06` |
| 8 | The font control changed the badge, the disclosure bar and their labels (source artwork distortion) | Badge, strip, bar and label are anchored to the app id and always Arial | probe: badge/summary/label `Arial, Helvetica, sans-serif` while body is Georgia |
| 9 | Every table cell had a border, so ordinary text, headings, the cover and the badge rows were drawn inside stray boxes | A `<td>` is borderless by default; a grid is drawn only for a genuinely tabular nested table (2+ rows) and for the audited `ocr-table` set | screenshots `05`, `08`; `book2QA()` 0 failures |
| 10 | The front cover had stray borders and the title inherited the reading serif, breaking "PERSONAL" across two lines | Cover scoped rules: no borders or padding, sans title that fits its column at every width, author line on one line | `book2QA()` 0 failures; screenshot `01`; mobile cover overflow 0 |
| 11 | Headings in the OCR-recovered regions rendered at body size (e.g. "The Anatomy of an Income Statement") | Headings that carry no run formatting of their own are marked from their verified manifest level and given the book's heading presentation | 58 headings marked; screenshots `07`, `08` |
| 12 | The text-size control moved the base size only, so paragraphs with their own inline sizes did not respond | Text size now scales the reading surface as well, so every text node responds | probe: 100 % -> 130 % changes body size and surface zoom |
| 13 | The seven supplied Contents entries `About this Book`, `Cover Page`, `Title Page`, `Copyright Page`, `Get the most out of your textbook's . . .`, `FEP` and `Back Cover` had no sidebar row | Rendered as their own rows, in the supplied order, with the exact supplied title and printed label; linked only where a verified source region exists | `reports/supplied_entries_verification.json`; screenshot `10` |
| 14 | The six top-level unit rows showed no printed page number - the label sat only on the nested copy of the same entry | The supplied label is on the group header itself (2 / 104 / 202 / 236 / 328 / 386) | browser rail probe; screenshot `14` |
| 15 | The front-matter navigation label rendered as `BUSINESSWITHPERSONALFINANCE` (the cover title is four stacked lines) | Repaired to the supplied wording `Business with Personal Finance`; the cover region's `data-nav-label` too | `CONTENTS_MAPPING.md`; screenshot `05` |
| 16 | The Walmart (`TMP-0542`) and Merck (`TMP-0585`) Extended Descriptions opened to an empty panel | Both bodies exist at the top of the following capture; the exact paragraphs were relocated into the controls and the figure captions left outside | `docs/WALMART_MERCK_FORENSICS.md`; screenshots `11`, `12`; 0 of 131 panels now empty |

## What was deliberately not changed

* No source text, figure, table value, caption, credit or description body was
  edited, re-ordered or removed (proved word-for-word over all 1,899 regions).
  The Walmart and Merck description bodies were *relocated* - the same bytes,
  moved from the following region into the control - which is why each pair's
  concatenated text still hashes identically and the whole-book region text is
  unchanged at 1,444,347 characters.
* No printed page number, Index entry body or missing page content was
  invented.
* The genuine source variants (plate/colour differences between the Word
  donor documents, the magenta module-opener `LG` marker, teal vs plum
  headings) were left as they are.
