# Final reader redesign and frontmatter repair

One controlled changeset, run on 2026-10-16, against
`book-source/Word/_master_work/repo/AP`.

| | value |
|---|---|
| starting commit | `4960932d9663ccc02f3f641297f7dac41268131d` |
| starting artifact | `AP Book Final.html`, 1,132,306,770 bytes, SHA-256 `2bff4ce2e75d767884672a983f470f9fb339d7088e7d9053925d8e3b351c777d` |
| final artifact | `AP Book Final.html`, 1,132,308,257 bytes, SHA-256 `9ffd6bb53c1e68b17d766519c2dc65cb61f4eafccadd2e0cb4b52e732cfbc64c` |
| source regions | 1,899, **byte-identical to the accepted artifact** (`reports/final_reader_redesign/region_digest.json`) |
| evidence | `reports/final_reader_redesign/` (screens, before, comparisons, QA JSON, static audit) |
| defect ledger | `reports/final_reader_redesign/DEFECT_LEDGER.md` |

## 1. What changed

The published book is still one self-contained offline HTML file. Only the
application shell was rewritten; the reconstruction was never rebuilt and no
framework, CDN, remote font, script or icon library was introduced.

| area | before | after |
|---|---|---|
| header | floating toolbar inside the reading column (permanent search field, `Continuous` badge, `Section n / m · title` counter) | one 52 px full-width header: `‹ Back` left, four compact icons right |
| left side | two permanent panels (300 px contents + 260 px tools) that disappear entirely when collapsed | 58 px navigation rail that expands to a 384 px Contents panel (book card, Expand/Collapse all, hierarchical TOC with right-aligned printed labels) |
| reading | three-way mode picker (Continuous / Section / Source capture) and mode-specific clipping code | continuous reading only; one flowing document |
| bottom | nothing | 50 px footer: bookmark control, clickable/draggable/keyboard progress track with a blue marker, `‹ reference ›` controls, `Previous location` chip |
| search | permanent toolbar field | popover, opened from the header magnifier or `/` |
| typography | `Reader tools` panel | `Aa` popover: Light / Dark / System, font, text size, line spacing, reset |
| bookmarks | none | local bookmarks on verified reader anchors, listed and restorable |
| back | none | real reading history (Back button + `Previous location`) |

Removed: `.toolbar`, `#mode`, `.mode-badge`, `#counter`, `#reader-controls`,
`#left-toggle`, `#right-toggle`, `#left-close`, `#right-close`, and the five
legacy inline scripts (`reader/ui.js`, `ui2.js`, `ui3.js`, `wave.js` and the
step-3 navigation layer, ~80 KB). Their behaviour was re-implemented, not
deleted: precise landing with a measured header offset, active-row
pinning, hash/Back/Forward handling, the audited 383 `role="heading"` /
`aria-level` assignments, the dark-mode inline-colour mapping, search and the
layout QA helper.

## 2. Frontmatter repairs

All three repairs are **scoped CSS only**, which is why every one of the 1,899
`<article>` regions is byte-identical and every embedded PNG/JPEG payload is
untouched. Each value was derived by measuring the supplied capture, then
verified by rendering the same page and comparing the two at matched scale
(`reports/final_reader_redesign/comparisons/`).

### Accessibility / Extended Descriptions (`TMP-0003`–`TMP-0006`)

Source measurement (`source_png/Page 1-100/B2P1-0003…0006.png`, 5,262 px wide
page, text measure x 928–4,326 = 3,399 px, first-line indent 85 px):

| item | source | before | after |
|---|---|---|---|
| body | Cambria, ink 84 px ≈ 10 pt | `font-size:16pt` (1.6×) | 10 pt |
| heading | cap 122 px ≈ 19 pt, bold **sans** | 28 pt in the reading **serif** | 17 pt, Arial bold |
| page H1 `Accessibility` | one step larger | 28 pt sans-serif | 20.5 pt |
| line pitch | 173 px (line-height ≈ 1.85) | 1.22 | 1.85 |
| text measure | 3,399 px with 85 px first-line indent | `padding:80pt` each side, no indent | 76.5 pt each side + 9 pt first-line indent |
| information icon | 217 px square = 6.5 % of the measure | **275 × 272 css px** | 40 px (the region's own PNG, inline) |
| block gaps | 163 / 196 / 214 / 215 px | 27–56 pt margins (≈2× too large) | source-derived margins |

Result: every section body now breaks on exactly the source's words
(`…alternative text (which` / `is also known as alt text) … the page` /
`…other assistive` / `technologies. …experts.`) and the `Color Contrast`
paragraph breaks after `…they meet contrast`, as printed.

Only `TMP-0005`'s own icon is resized: the selector is
`#TMP-0005 .content>p>img`. The 155 Extended Description information icons are
untouched.

### Publisher title page (`TMP-0007`, `TMP-0008`)

| item | source | before | after |
|---|---|---|---|
| title | cap 141 px, condensed sans, width 3,283 px | 28 pt, fell back to the reading serif | 24 pt `Arial Narrow` (rendered width 482 px vs source 481 px) |
| subtitle | cap 95 px | 22 pt | 12.5 pt (145 px vs 144 px) |
| authors | ascender ink 63 px | 16 pt | 10 pt (108 px vs 108 px) |
| affiliations | italic, ink 86 px | 15 pt | 9.5 pt (74 px vs 73 px) |
| BFW Publishers mark | 962 px = 18.3 % of the page | `max-width:100%` → 688 px wide (4.7× too large) | 142 px wide, aspect ratio and encoded bytes untouched |
| city labels | one compact centred row 144 px wide | three equal full-width table cells | auto-width centred table |

### Copyright / acknowledgments (`TMP-0009`–`TMP-0012`)

| item | before | after |
|---|---|---|
| legal text | 9 / 11.5 / 12 / 15 pt (inconsistent) | 9.5 pt (the italic acknowledgments paragraph 9 pt, which is what makes it set on two lines as printed) |
| measure | `padding-left:16pt` on the credits, `80pt` on the rest | 76.5 pt measure + 9 pt first-line indent, credits indent 0 + 9 pt first line |
| line pitch | 1.22 | 2.0 (source pitch 179 px) |
| block gaps | 26–60 pt | source-derived (credits 0 pt, blocks 14 pt, addresses 7 pt) |
| inline BFW symbol | `display:block` → a 450 × 510 block on its own line | inline, 1.4 em tall, baseline-aligned |
| website link | working, teal | unchanged, still working |

## 3. Contents

* 455 fragment links, 455 targets, **0 broken** (`static_audit.json`).
* 383 verified heading anchors and 10 group anchors — unchanged.
* The verified `<nav id="contents-nav">` subtree is byte-identical apart from
  the two rows below.

### Stale "source absent" classification corrected

`docs/KNOWN_ISSUES.md` and the rail classified **Title Page** and **Copyright
Page** as source-absent. That is wrong for this artifact:

| row | printed label | now points at | source evidence |
|---|---|---|---|
| Title Page | i | `#TMP-0007` | `B2P1-0007.png`: `BUSINESS WITH PERSONAL FINANCE`, `for the AP® Course`, the four authors and their affiliations |
| Copyright Page | ii | `#TMP-0009` | `B2P1-0009…0012.png`: staff and design credits, `Copyright © 2026 by Bedford, Freeman & Worth`, ISBN, Acknowledgments, the AP® statement, the BFW address and website, the EU GPSR notice and the Macmillan Dublin address |

The manifest labels all of `TMP-0003`–`TMP-0012` as `Accessibility` because the
supplied Contents list folds the whole frontmatter under one heading; the text
itself was verified in the captures.

### Rows still unlinked (70)

Every other row was re-checked against the source in one streaming pass
(`reports/final_reader_redesign/unlinked_rows_evidence.json`) and against the
383 verified heading anchors (`unlinked_heading_match.json`):

* **No unlinked row's wording matches a verified heading anchor.** ("Business
  Canvas Project Application" matches two different anchors, 0098 and 0194 —
  ambiguous, so it stays unlinked.)
* Most rows do occur in the source, but as *incidental mentions* inside body
  text (e.g. `Gross Profit` appears in `TMP-1105…1148`) rather than at an
  audited heading anchor.
* Genuinely absent wording: `About this Book`, `AP® Exam Practice Questions`,
  the `FEP`/`Back Cover` rows.

Linking them safely needs a new anchor created at each exact source heading,
verified row by row (the repeated
`Practice Your AP® Skills Questions` and `Terms to Know` titles appear in ~30
modules each). This changeset did **not** do that: no anchor was invented, no
fragment was fabricated and no row was pointed at unrelated material.

## 4. Interactive testing (real Chrome, full 1.13 GB artifact)

Headless Chrome 155 via CDP, 1,400 × 1,000 unless stated.

| test | result |
|---|---|
| first load | 19.0 s (full book, `file://`) |
| console errors / exceptions | 0 |
| layout QA (`book2QA`) | 0 failures; no horizontal overflow at any tested width |
| header / rail / main / footer | 52 / 58 / 1,342 / 50 px at 1,400 px |
| Contents panel | 384 px, rail hidden while open |
| Expand all / Collapse all | 42 groups open / 0 open |
| Search `Cotopaxi` | opens from the icon, 8 hits listed, jump scrolls to the hit |
| Appearance | Light → Dark → Light; **15,309** inline colours mapped, build 246 ms, apply 368 ms |
| Bookmarks | created with a source-backed anchor and its printed label (`Other Incentives to Save · p. 206`), survived a full reload, and restored to top = 64 px (below the 52 px header) |
| More menu | 5 working actions |
| Progress | 0 → 50 % on scroll; the bar is pointer-draggable and keyboard-operable |
| Previous / Next | land on real verified destinations (`#book-heading-0255`, `#TMP-1079`) |
| Back | returns to the previous reading location |
| Navigation landings | 7 destinations across frontmatter, module, deep and late topics, a region-begin link and the cover: each set its hash, landed below the header, updated the active row and the locator |
| Printed references | taken from the supplied numbered Contents list only; no total and no invented page numbers |
| Legacy chrome | `.toolbar`, `#mode`, `.mode-badge`, `#counter`, `#reader-controls` all absent |

### Viewports (light + dark)

1,920 · 1,400 · 1,024 · 768 · 390 · 320 px, plus `fit-reflow` at ≤ 900 px where
the 210 mm surface becomes fluid. A real defect was found and fixed during this
run: the shell's own `.app main{grid-column:2}` out-specified the new mobile
rule, which created an implicit grid column and collapsed the header and footer
to 20 px at ≤ 900 px. It is now addressed as `.app main`.

## 5. Preservation and integrity

| check | result |
|---|---|
| `region_digest.mjs` (base vs candidate) | 1,899 regions, identical, order preserved, 0 differences |
| duplicate ids | none |
| ids / fragments | 455 links, 455 targets, 0 broken |
| Extended Description controls | 155 |
| LG badges, tables, figures | unchanged (regions byte-identical) |
| sideways photo credits | 182 `sideways-lr` credits intact |
| image payloads | unchanged; no image byte read, rewritten or filtered |
| shell prefix bytes | no invalid-UTF-8 or replacement-character corruption (`prefix_check.py`) |

Because the frontmatter repairs are scoped CSS, **no source text, figure,
table or disclosure body was modified anywhere in the book.**

## 6. Performance notes

* Progress and locator updates are `requestAnimationFrame`-throttled and use a
  binary search over the 1,899 region geometries plus a cached, sorted
  reference index (443 entries) — no full-document scan on scroll.
* Opening a popover or the Contents panel performs no region re-layout: the
  panel toggle measures the reading line once and restores it in the next
  frame.
* The dark-mode inline-colour index is built once, on first use.

## 7. Known limitations

1. The 70 unlinked Contents rows described in §3 — the source wording exists
   for most of them, but connecting them needs per-row anchor creation that
   this changeset did not complete. They are neither invented nor mis-linked.
2. `TMP-0004`'s opening line ("In this book, extended descriptions …") breaks
   one word earlier than the source: the reconstruction's Cambria renders 1.3 %
   wider relative to the measure than the capture's face. The same measure
   reproduces every other measured break, including all four lines of the
   Accessibility body and the two-line italic acknowledgments paragraph, so it
   was kept.
3. The title-page subtitle and the affiliations render ~5 % narrower than the
   capture, because Arial/Cambria have different width profiles from the
   publisher's faces. Their **sizes and leading** match the source; only the
   glyph widths differ.
4. The frontmatter line spacing (1.85–2.0) is looser than the reader's default
   (1.22). That is what the supplied page shows; the type size, measure and
   line breaks are all source-matched, so the page height matches the capture.
5. Legacy reader CSS is still present in the shipped stylesheet (it is simply
   out-specified). It costs ~10 KB of the 1.13 GB file and removes any risk of
   dropping a content-rendering rule; removing it is a separate, riskier
   change.
6. The Index and the `Page 1101-1200` OCR-backed regions are unchanged and
   still carry the limitations recorded in `docs/KNOWN_ISSUES.md`.

## 8. Screenshots

`reports/final_reader_redesign/screens/` — 21 views: light/dark, contents
closed/open, 1,920/1,400/1,024/768/390/320, search, typography, bookmarks,
deep progress, a module, a figure with Extended Description, a financial table,
and the three repaired frontmatter pages in light and dark.

`reports/final_reader_redesign/before/` — the accepted artifact's own rendering
of the same pages, for the before/after pairs.

`reports/final_reader_redesign/comparisons/` — the supplied capture beside the
rendered page at matched scale, plus the isolated rendered clip of each
repaired region.

## 9. How the candidate was assembled

`reader/final_reader/patch_book.py` streams the accepted artifact and rewrites only the
shell: the head stylesheet tail, the header/rail markup inserted after
`<div class="app" id="b2-app">`, the Contents panel wrapper rebuilt around the
byte-identical `<nav id="contents-nav">` subtree, the `<main>` open tag (the
floating toolbar removed), and everything after `</main>`. The 1,899
`<article>` regions are copied through untouched. All edits are byte-level
anchored, and the script fails loudly if an anchor is missing or ambiguous.

The same directory holds the sources that were patched in
(`ui/reader_ui.css`, `ui/reader_ui.js`, `ui/headings.js`, `ui/shell_head.html`,
`ui/shell_tail.html`), the measurement/comparison tools (`tools/`) and the QA
harness used for the run (`qa/`, CDP only, against an isolated headless Chrome
profile - the user's own browser is never touched).

## 10. Publication

| step | result |
|---|---|
| rollback preserved | `_master_work/integration_backups/final-reader-20261016/prev-final-AP Book Final.html` and `prev-root-AP Book Final.html` (both 1,132,306,770 bytes, SHA-256 `2bff4ce2…`), plus the previous artifact in Git LFS |
| commits | `714b0987681f3abafa0526437909b64ea83f59fe` (artifact, docs, evidence) then `92fcc48e7e58da4bf5ca04f58b9997caddba4876` (this report's publication record and `reader/final_reader/`) |
| remote ref | `git ls-remote origin refs/heads/main` = `92fcc48e7e58da4bf5ca04f58b9997caddba4876` |
| remote LFS object | the GitHub LFS batch API returns a download link for `oid 9ffd6bb53c1e68b17d766519c2dc65cb61f4eafccadd2e0cb4b52e732cfbc64c`, `size 1132308257` |
| uploaded LFS objects | 41 (the artifact plus this wave's 48 screenshots); no `source_png/` capture was re-uploaded |
| local synchronisation | project-root `AP Book Final.html` and `_master_work/repo/AP/AP Book Final.html` are both 1,132,308,257 bytes with SHA-256 `9ffd6bb5…` |
| worktree | clean |
