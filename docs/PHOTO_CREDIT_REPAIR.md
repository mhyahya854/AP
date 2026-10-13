# Photo-credit orientation repair (`photo-credit-2026-10-13`)

Starting point: `795b5d3` / `572144b8...` (1,132,243,794 bytes).  Result:
**`c4623c4a3feff2f005b29cae2a224945dfdc580708e80547caf81d3331e252e0`,
1,132,261,630 bytes**.  Previous artifact preserved in
`integration_backups/photo-credit-20261013/`.

## 1. Root cause of the Kellogg's credit defect

The credit is not in `TMP-0125`; it belongs to `TMP-0124`, the region that owns
the cereal-box photograph (the screenshot in `docs/layout/25`/`26` was framed on
`TMP-0125`, so the figure above it is from `TMP-0124`).

Structure in the reconstruction:

```html
<td><p><img …cereal box…></p></td>
<td><table><tr><td>
      <p><span style="color:#111111;font-size:6.5pt;font-family:'Arial',serif">
        Kristoffer Tripplaar/Alamy Stock Photo</span></p>
</td></tr></table></td>
```

The credit sits in its **own narrow cell beside the image**, horizontally, while
the photo takes the rest of the table width.  Measured in the browser:

| Viewport | credit cell | paragraph | widest word | result |
|---|---|---|---|---|
| 1400x1000 | 58 px | 50 px | 110 px | word broken, ~4 lines (71 px tall) |
| 768x1024 | 54 px | 46 px | 110 px | word broken, ~4 lines |
| 390x844 | **29 px** | 21 px | 110 px | words broken into 2-3 character fragments (179 px tall) |
| 375x812 | 28 px | 20 px | 110 px | as above |
| 320x700 | 24 px | 16 px | 110 px | as above |

So the defect is **not mobile-specific** - at every width the widest word
(110 px) cannot fit the cell (24-58 px) and the browser breaks it apart.

**Source-intended orientation:** vertical.  `B2P1-0124.png` inspected at full
resolution shows `Kristoffer Tripplaar/Alamy Stock Photo` printed as a vertical
strip down the photograph's right edge, reading upward.

**Why the existing runtime detector missed it:** its keyword list required the
text to *end* with `Alamy`, but this text ends with "Alamy Stock Photo"; and its
geometry test could only see the squeeze once the lazy image had loaded.

## 2. The defect is a class, not a single credit

A bounded DOM scan (no OCR, no full-source audit) collected every credit
paragraph that occupies its own cell beside a photograph.  For each one the
image was loaded and the geometry measured at 1400x1000:

| Measure | Result |
|---|---|
| Credits in a photo-side cell | **179** |
| Genuinely broken (widest word wider than the cell) | **178** |
| Already vertical | 1 (`TMP-0112` MoMo) |
| Fit correctly | **0** |

Every such credit was broken, with cells of 21-63 px against single words of
67-182 px.  The publisher prints exactly this kind of credit vertically; five
were checked against their original captures - `B2P1-0124` (Tripplaar),
`B2P1-0112` (MoMo), `B2P1-0542` (Raedle), `B2P1-0570` (Kemp) and
`B2P1-1304` (HWA CHENG), and additionally `B2P1-0161` (Mario Tama) and
`B2P1-0250` (Bloomberg) - all vertical in the source.

## 3. The repair

`contents_wave/patch_photo_credits.py` adds the writing mode as an inline style
to exactly those credit paragraphs:

```css
writing-mode: vertical-rl; text-orientation: mixed; white-space: nowrap;
margin: 0 auto; line-height: 1.15
```

and, for `TMP-0124` only, `writing-mode: sideways-lr` because that credit reads
**upward** in its source capture (verified with `CSS.supports`, supported in
Chrome 155).

* 182 credit paragraphs changed (179 from the scan plus three in nested
  single-cell tables the scan's row test could not see: `TMP-0118`, `TMP-0124`,
  `TMP-0128` - the same class, measured identically broken).
* Nothing else changed: no text, no image, no table, no element order, no
  global CSS rule, no JavaScript change.
* The credit stays in its own cell beside its photograph, keeps its exact
  wording, and is never hidden.

## 4. Verification

**Before / after at the reported case (`TMP-0124`):**

| Viewport | before | after |
|---|---|---|
| 1400x1000 | cell 58 px, paragraph 50x71 px, ~4 broken lines | paragraph **17x145 px**, single vertical line (`sideways-lr`) |
| 768x1024 | 54 px, 46x72 px | 17x146 px vertical |
| 390x844 | 29 px, 21x179 px of fragments | 17x146 px vertical |
| 375x812 | 28 px, 20x179 px | 17x146 px vertical |
| 320x700 | 24 px, 16x215 px | 17x146 px vertical |

Document overflow 0 at every viewport, in both the collapsed and expanded
disclosure states.  Screenshots: `docs/layout/30-kellogg-credit-before-390.png`
vs `docs/layout/31-kellogg-credit-after-390.png`,
`docs/layout/32-kellogg-credit-after-1400.png`, and the full before/after sets
under `reports/credit/before/` and `reports/credit/after/`.

**Whole class re-scanned after the repair:** 179/179 candidates now vertical,
**0 still horizontally broken**, maximum document overflow 0.

**MoMo (`TMP-0112`) re-checked:** still `vertical-rl`, paragraph 17x154 px,
unchanged and legible - see `docs/layout/33-momo-credit-after-class-fix.png`.

**Prevention (so the class cannot silently regress):** nothing in the reader
depends on the runtime detector for these credits any more - the orientation is
in the markup.  The detector's keyword list is still narrow, which is recorded
in `docs/KNOWN_ISSUES.md` as a known limitation of the safety net, not of the
book.

## 5. Regression

| Check | Result |
|---|---|
| Regions | 1,899 present, global order identical |
| Regions with any text change | **0** (the edit is attribute-only) |
| Total words | 228,179 before and after, delta 0 |
| Images / tables | 417 / 1,478 before and after |
| Disclosure controls | 155, 0 empty bodies, 0 that fail to hide or reveal, 0 overflow, 0 structure problems |
| Modes | continuous / section ("Section 1 of 383 · Business with Personal Finance", 1,896 clipped) / source capture |
| Navigation | 395 links, 516 rows, 0 broken hash links, 0 duplicate ids, 0 `book2QA()` failures, 0 overflow |
| Search | "Match in Contents", 1 hit |
| JS exceptions / console errors / log errors | 0 / 0 / 0 |

The nine-case repairs, the 24 orphan controls, the Walmart/Merck/Starbucks
descriptions and the Contents mapping are untouched (0 regions changed).
