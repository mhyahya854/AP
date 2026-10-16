# Book 2 redesign — defect ledger and source mapping

Baseline verified before any change:

- HEAD `4960932d9663ccc02f3f641297f7dac41268131d` (clean worktree)
- `AP Book Final.html` 1,132,306,770 bytes,
  SHA-256 `2bff4ce2e75d767884672a983f470f9fb339d7088e7d9053925d8e3b351c777d`
  (both the repository copy and the project-root copy)

## Shell map (byte offsets in the baseline artifact)

| element | offset |
|---|---|
| `<head>` css | 154 |
| `</head>` | 55,966 |
| `<div class="app" id="b2-app">` | 55,979 |
| `<aside class="left" id="contents-panel" …>` | 56,008 |
| `<nav id="contents-nav">` | 99,104 |
| `<main><div class="toolbar">…` | 188,662 |
| first `<article class="book-page">` | 189,229 |
| last `</article>` | ~1,132,224,150 |
| `<aside class="right" id="reader-controls">` | 1,132,224,215 |
| 5 inline `<script>` blocks | 1,132,226,579 → |
| `</body>` | 1,132,306,756 |

1,899 `<article class="book-page">` regions; nav = 453 anchors (383
`#book-heading-*`, 60 `#TMP-*`, 10 `#book-group-*`) and 73 non-interactive
rows.

## Source-to-DOM mapping for the three reported frontmatter defects

The page column in every supplied capture is x ≈ 928–4 266 of a 5 262 px wide
scrolling screenshot, i.e. the same measure for body text and for the
extended-description panel. The 210 mm `.book-page` surface maps 1 capture
px → 0.1508 css px (the reconstruction's own page mapping), so every source
size below is quoted in that scale.

### W1 — Accessibility / Extended Descriptions page

| source PNG | TMP region | current DOM | source | current render | defect |
|---|---|---|---|---|---|
| `B2P1-0003…0006.png` | `TMP-0003`–`TMP-0006` | `<article id="TMP-0005">` | body = Cambria, ink 84 px = 12.7 css px (≈10 pt), measure 3 338 px = 37.8 em | `font-size:16pt` in 475 px column = 22.3 em | body 1.6× too large, 1.7× too few characters per line |
| same | same | `<span style="font-weight:700;font-size:28pt">Alternative Text</span>` | heading cap 122 px = 18.4 css px → ≈19 pt | 28 pt | heading too large |
| same | same | `<img>` in `TMP-0005` (PNG 275×272) | 217 px square = 32.7 css px, 6.5 % of the measure | 275×272 css px | icon 8.4× too large |
| same | same | inline `margin-bottom:46pt/47pt/27pt/56pt/28pt` | gaps 215/196/163/214/163 px = 32/30/25/32/25 css px | ≈61/63/36/75/37 css px + leading | paragraph gaps ≈2× too large |

### W2 — Publisher title page

| source PNG | TMP region | current DOM | source | defect |
|---|---|---|---|---|
| `B2P1-0007.png` | `TMP-0007` | authors/affiliations centred paragraphs | title cap 141 px = 21.3 css px (≈22 pt), subtitle cap 95 px (≈15 pt), authors ≈9.5 pt, affiliations ≈10.6 pt | 28 pt / 22 pt / 16 pt / 15 pt — everything oversized and inconsistently so |
| `B2P1-0008.png` | `TMP-0008` | `<img>` BFW logo (PNG 1560×510) | logo 962 px wide = 145 css px = 18.3 % of the page | `max-width:100%` renders it 688 px wide (86.7 %) — 4.7× too large |

### W3 — Copyright / acknowledgments page

| source PNG | TMP region | current DOM | defect |
|---|---|---|---|
| `B2P1-0009…0012.png` | `TMP-0010`, `TMP-0011`, `TMP-0012` | inline `font-size` 9–15 pt + `padding-left/right:80pt` + `margin-bottom:27–60pt` | legal text 1.6× too large, measure 1.7× too short, paragraph gaps ≈2× too large |
| `B2P1-0011.png` | `TMP-0011` | `<p>…The <img> is a trademark…</p>` | the inline BFW symbol (PNG 450×510) is laid out `display:block`, so it becomes a 450 × 510 block on its own line instead of a ~1 em inline mark |

### Stale source-absence conclusions found and corrected

`docs/KNOWN_ISSUES.md` and the Contents rail classified **Title Page** and
**Copyright Page** as "source absent". That is wrong for this artifact:

- `TMP-0007` contains the interior title page (`BUSINESS WITH PERSONAL
  FINANCE` / `for the AP® Course` / the four authors and their affiliations).
- `TMP-0008` contains the BFW Publishers mark and `New York · Austin · Boston`.
- `TMP-0010`–`TMP-0012` contain the copyright statement, the ISBN, the
  acknowledgments, the AP® trademark statement, the BFW address, the
  `bfwpub.com/catalog` link, the BFW registered-trademark sentence with the
  inline BFW symbol, and the EU GPSR notice with the Macmillan Dublin address.

Their `source_png/SOURCE_PNG_MANIFEST.csv` `region_nav_label` is
`Accessibility` for all of `TMP-0003`–`TMP-0012` because the manifest labels
come from the supplied Contents list, which folds the whole frontmatter under
one heading. The text itself is present and was audited here.

## Reader-interface defects (workstream 1)

- One floating toolbar rectangle pinned to the right of the reading column
  (`.toolbar`, `main > .toolbar`) with a permanent search field, a
  `Continuous` badge and a `Section n / m · title` counter.
- A visible three-way mode picker (`#mode`: Continuous / Section / Source
  capture) in the right-hand tools panel, plus a whole second script
  (`reader/ui3.js`) whose only purpose is mode resolution and section
  clipping.
- Two permanent 300 px / 260 px side columns; collapsing either removes it
  entirely (`grid-template-columns:0 …`) rather than leaving a rail.
- A right-hand "Reader tools" panel occupying 260 px of reading space.
- No bottom progress bar, no bookmarks, no back action.
