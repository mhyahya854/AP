# Nine-case source repair - evidence ledger

Baseline `95ac7e0` / `ef09a825...` (155-control candidate `572144b8...`).
The nine regions below were the last description controls still rendered as bare
labels.  Each was resolved from its own structure: the label's own panel
container holds the body, or the body starts in the region and continues into
one or two following captures and stops where the source's caption strip begins.
An exact normalized token-sequence test (multiset equality **and**
original-order containment of the panel body) passes for all nine.

| Region | Source evidence inspected | Outcome | Exact body boundary | Text moved | Control works | Evidence |
|---|---|---|---|---|---|---|
| `TMP-0125` Kellogg's Froot Loops | region markup: grey `#EEEEEE` panel cell; `B2P1-0125.png` panel | **RESTORED** | the panel cell's own paragraph after its nested label table ("Text on the box reads, …") | no - in place (35 words) | yes | `reports/nine_case/nine_report.json` |
| `TMP-0152` FIGURE 1.2-1 Supply/Demand | `#EEEEEE` panel cell; label wraps over two rows | **RESTORED** | the panel cell's graph-description paragraph after the label rows; label joined to "…Supply and Demand" | no - in place (33 words) | yes | same |
| `TMP-0422` Figure 1.8-2 Supply Chain | label row + `colspan=2` body row of one table | **RESTORED** | the whole second row ("The illustration reads as follows: …") | no - in place (57 words) | yes | same |
| `TMP-0502` FIGURE 2.1-2 Segmentation | region + `B2P1-0503/0504.png`; caption found in 0504 | **RESTORED** | region list + all of 0503 + 0504 rows 0-1; the bold caption "Figure 2.1-2 Four Main Types of Market Segmentation" stays outside | yes - 0503 emptied, 0504 trimmed | yes | same |
| `TMP-0516` Figure 2.1-3 Cooper | `B2P1-0518/0519.png` boundary viewed: panel edge, divider and the caption "Figure 2.1-3 Cooper, the Family Man" | **RESTORED** | region paragraphs + all of 0517 + 0518 rows 0-13; the caption (0518 element 14) stays outside | yes - 0517 emptied, 0518 keeps its caption | yes | same + `case-0516-boundary.png` |
| `TMP-0530` Privacy Statement | region + donor; the caption in `TMP-0532` | **RESTORED** | region paragraphs 17-20 + all of 0531; the caption "This privacy statement from technology company Oracle…" in 0532 stays outside | yes - 0531 emptied | yes | same |
| `TMP-0745` Middleman | label row + body row of one table | **RESTORED** | the body row ("Posed on the desk in front of the man are Dollar Shave Club products…") | no - in place (60 words) | yes | same |
| `TMP-0851` Figure U 2-7 Beats Ad | outer cell holding the nested label table + the body paragraph | **RESTORED** | the paragraph after the nested label table ("An image accompanying the description The King…") | no - in place (51 words) | yes | same |
| `TMP-1350` South by Southwest | label row + body row inside the case-study opener table | **RESTORED** | the body row ("A large screen shows Cuban to the audience in a packed auditorium.") - the credited photograph above the table stays outside | no - in place (12 words) | yes | same |

## Verification

* **Exact sequence preservation** (`contents_wave/verify_sequences.py`): for each
  group the normalized token multiset is identical before and after, and every
  panel-body token appears in the same relative order as in the original text -
  all nine pass.  Book-wide word total 228,179 before and after, delta 0.
* **Structure**: 155 `<details class="disclosure">` controls, 0 with an empty
  body, 0 malformed, 0 stray `<td>` inside a panel.
* **Browser** (headless Chrome 155, `file://`, 1400x1000 with a cleared reader
  preference; also 390x844): all nine controls expand (collapsed 34 px ->
  80-1002 px), are focusable, toggle by click and by keyboard, and have 0 px
  internal overflow; 155 controls, 0 empty bodies, 0 document overflow,
  `book2QA()` 0 failures, 0 exceptions, 0 console errors on desktop and mobile.
* **Illustrative screenshots**: `docs/layout/23-orphan-0125-expanded.png`,
  `docs/layout/24-orphan-0516-expanded.png`.

## Accounting correction (supersedes the earlier waves' wording)

The 24 orphan regions were repaired 3 + 12 + 9 across three waves - not 14 in
one wave.  The `final-completion` wave created **12** controls (two of its first
attempts, `TMP-0125` and `TMP-0152`, were malformed and reverted to the baseline
text, which is why 146 = 134 + 12).  `TMP-0105` is a separate redundant remnant,
not one of the 24.  Final control count: **155**.

## Remaining genuine source limitations

None of the 24 remains unresolved.  The standing source limitations are
unchanged and unrelated to the disclosures: no Index body, no Word document for
`Page 1101-1200`, `alt=""` on every image, and the Page 501-600 donor document
rendering without run sizes.
