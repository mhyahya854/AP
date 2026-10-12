# Walmart and Merck: cross-capture Extended Description forensics

Wave: `supplied-entries-2026-10-12`. This supersedes the two "panel
legitimately empty" conclusions in `EXTENDED_DESCRIPTION_AUDIT.md` and
`DISCLOSURE_AUDIT.md`, which were reached from the control's *own* capture
only.

## What was wrong with the earlier conclusion

Both controls were inspected inside a single capture:

| Control | Region | Own capture | Earlier finding |
|---|---|---|---|
| `Extended description for Walmart` | `TMP-0542` | `B2P1-0542.png` | "grey panel below the label completely empty" |
| `Extended description for Merck` | `TMP-0585` | `B2P1-0585.png` | "grey panel below it is empty" |

The captures are 5262 x 3607 views of one continuously scrolling page, and for
both controls the **page boundary falls inside the description panel**. The
panel is empty at the foot of its own capture and its body stands at the very
top of the *next* capture. Reading only the control's own capture therefore
cannot see the body.

## Evidence

Full-resolution crops are in `docs/layout/` and the whole-capture views were
read at 5262 x 3607. Every observation below is a direct reading of the source
image.

### Walmart - `TMP-0542`, `B2P1-0542.png` -> `B2P1-0543.png`

* `B2P1-0542.png`: `CASE STUDY Walmart`, the photograph with its vertical
  `Joe Raedle/Getty Images` credit, then the grey panel carrying the label and
  the black circled `i`. The panel's left and right rules run from the label
  down to the bottom edge of the capture with no text in them.
* `B2P1-0543.png`: the **same** grey panel continues from the top edge, with
  the same left and right rules at the same x positions, and now holds the
  description text. Below it there is a horizontal divider, then a smaller grey
  caption strip, and only then the ordinary two-column case-study body
  ("Today, companies of all sizes collect and analyze volumes of data...").
* Ordinary body text in the source is **not** drawn inside a bordered panel, so
  the panel geometry identifies the text unambiguously.

Restored description (17 words, exactly as printed):

> Additional registers are open and checking out customers. Long lines extend
> from each of the three registers.

The caption strip that stays outside the control (Arial, `#555555`):

> While you are checking out, Walmart is checking you out, collecting data on
> your spending habits and shopping preferences.

### Merck - `TMP-0585`, `B2P1-0585.png` -> `B2P1-0586.png`

* `B2P1-0585.png`: `CASE STUDY Merck's Pharmaceutical Marketing`, the
  photograph with its `Timon Schneider/Alamy Stock Photo` credit, then the grey
  panel with the label and the circled `i`, empty down to the bottom edge.
* `B2P1-0586.png`: the same panel continues from the top edge - identical left
  and right rules at identical x positions - holding three paragraphs of
  description, then the divider, then the caption strip, then the ordinary body
  ("We've discussed factors that influence consumer behavior...").

Restored description (79 words, exactly as printed):

> The phone screen displays a screenshot from a web page for Merck, which
> reads, Our areas of focus. We focus on scientific innovation to deliver
> medicines and vaccines that may help millions of people around the world. A
> photo from an electron microscope shows a cluster of three cells.
>
> **Oncology.** We work to deliver innovations that extend and improve the
> lives of people with cancer. **Learn about oncology** (hyperlink).
>
> Behind the phone, a signboard reads, MERCK with its logo.

The caption strip that stays outside the control (Arial, `#777777`):

> Businesses like Merck try to develop products that consumers need or want.
> Whether those products are popular depends on consumer behavior.

## Structural evidence

* `Page 501-600/_terra_work/B2P1-0542.json` records the whole capture's OCR as
  exactly two lines (`CASE STUDY Walmart`, `v Extended description for
  Walmart`) - i.e. text, image, then the collapsed control; the panel body is
  not in that capture.
* `B2P1-0543.json` begins with the panel body and then the case-study prose.
* `B2P1-0585.json` ends with `v Extended description for Merck`; `B2P1-0586.json`
  begins with the three description paragraphs.
* In the reconstruction the same words were present but **outside** the
  control: they were the first paragraphs of `TMP-0543` / `TMP-0586`. Nothing
  was missing from the book; the disclosure had been split from its trigger.

## Determination: Outcome 1 (body exists across captures)

Both bodies were restored into the `<details>` element of the region that owns
the control, and the very same paragraph elements were removed from the
following region - a pure relocation, not a re-write:

| | Walmart | Merck |
|---|---|---|
| Control region | `TMP-0542` | `TMP-0585` |
| Donor region | `TMP-0543` | `TMP-0586` |
| Paragraphs moved | 2 | 11 |
| Characters moved | 222 | 1,092 |
| Words moved | 17 | 79 |
| Caption kept outside the control | yes | yes |
| Body still absent anywhere | no | no |

Proof of the move (`_master_work/final_wave/compare_region_text.py`):

* whole-book region text is unchanged at **1,444,347 characters** (delta 0);
* exactly **4** regions have a different per-region text fingerprint -
  `TMP-0542`, `TMP-0543`, `TMP-0585`, `TMP-0586`;
* the concatenated text of each pair is **byte-identical** before and after
  (sha256 `96ad4ce8...` / `da7815d7...` unchanged), and the word-only
  fingerprint of each pair is unchanged;
* each pair's character total is unchanged, so no word was added, dropped or
  duplicated.

## Remaining uncertainty

None for these two controls: the body, the divider and the caption are all
visible in the supplied captures and the relocation is arithmetic. What is
*not* claimed: that the panel's typography matches the printed book exactly.
The moved paragraphs keep their source inline styles
(`font-family:'Georgia',serif;color:#000000` for Walmart,
`font-family:'Georgia',serif;color:#1B1B26` for Merck), which is the same
convention the corrective wave used for the Starbucks Rewards panel.

## Controls that are still empty

After this wave, `scan_panels.py` reports **0** of the 131 disclosure controls
with an empty `.desc-panel`. (Before the wave: 2 - Walmart and Merck.)
The Starbucks Rewards body (157 characters) and the Front Cover body (580
characters) are unchanged; see `VALIDATION_SUMMARY.md` section 8.
