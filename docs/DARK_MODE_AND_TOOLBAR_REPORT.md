# Step 2 — compact top-right toolbar + Light/Dark/System appearance

Artifact under test: `AP Book Final.html`

| | Before (accepted) | After (this wave) |
|---|---|---|
| Bytes | 1,132,269,052 | 1,132,289,645 |
| SHA-256 | `db07ab804bed45df6dd7b27a70dea2e86f259707d047b9b307d19e71108e35df` | `ba63e34f36d7a9b35fc174b2fef6f15a0c70e9d6ab1063aa4451110eae18ff74` |
| Delta | — | +20,593 bytes |

The wave changes **two injected blocks and one piece of shell markup**: the
reader-UI stylesheet (`reader/ui.css`), the reader-UI script (`reader/ui.js`) and
one inserted `Appearance` control in the Reader Tools panel.  Every byte between
the first article region and the tools panel is streamed through untouched, so
no article region, disclosure body, table cell or embedded PNG was read or
written.  Nothing in this wave touches the Table of Contents destinations
(Step 3).

Patch tool: `reader/patch_step2.mjs` (streaming, exact-match, hash-guarded;
`--fixture` relaxes only the whole-artifact guard).  Raw evidence:
`reports/step2_wave/`.

---

## 1. Task A — the toolbar is now a compact group at the top-right

### What changed

```css
main>.toolbar{ width:max-content; max-width:100%; margin:0 0 12px auto;
               justify-content:flex-end; flex-wrap:wrap; }
main>.toolbar #search{ flex:0 1 200px; width:200px; min-width:130px; }
main>.toolbar #counter{ max-width:170px; }
```

The toolbar is a child of `<main>`, so it already lived inside the reading
column.  It used to be a **210 mm (794 px) bar centred in that column**; it is
now only as wide as its controls and is pushed against the column's right edge.
No control was added, removed, duplicated or reordered, no second toolbar was
created, and the shell's `position:sticky; top:0` and its background, border and
padding are kept.

### Before / after geometry (same browser, same reader shell, real regions)

| Viewport | Panels | Width before | Width after | Right gap before | Right gap after | Rows before | Rows after | Search before | Search after |
|---|---|---|---|---|---|---|---|---|---|
| 1920×1080 | both open | 794 | **590** | 273 | **15** | 1 | 1 | 404 | **200** |
| 1920×1080 | both closed | 794 | **590** | 553 | **15** | 1 | 1 | 404 | **200** |
| 1920×1080 | left only | 794 | **590** | 403 | **15** | 1 | 1 | 404 | **200** |
| 1920×1080 | right only | 794 | **590** | 423 | **15** | 1 | 1 | 404 | **200** |
| 1400×1000 | both open | 789 | **590** | 15 | **15** | 1 | 1 | 399 | **200** |
| 1400×1000 | both closed | 794 | **590** | 293 | **15** | 1 | 1 | 404 | **200** |
| 1024×768 | both open | 463 | 463 | 15 | 15 | 2 | 2 | 221 | 200 |
| 1024×768 | both closed | 794 | **590** | 105 | **15** | 1 | 1 | 404 | **200** |
| 390×844 | both closed | 351 | 351 | 15 | 15 | 2 | 2 | 179 | 253 |
| 320×700 | both closed | 281 | 281 | 15 | 15 | **3** | **2** | 177 | 183 |

"Right gap 15 px" is the reading column's reserved scrollbar gutter
(`scrollbar-gutter:stable`), i.e. the group's right edge is exactly the column's
content edge.  The group is never full-width at a desktop width where its
controls fit on one line, and `width:max-content` means it grows and shrinks
with the column, so it *follows* the column's right edge when a sidebar is
collapsed or reopened (measured for all four panel combinations at 1920, 1400
and 1024).

### Full-book geometry (the promoted artifact, bounded run)

| Viewport | Panels | Width | Rows | Right gap | Inside column | All controls visible | Outside column | Overlaps right panel | Doc overflow |
|---|---|---|---|---|---|---|---|---|---|
| 1920×1080 | all four combos | **619** | 1 | 15 | yes | yes | none | no | 0 |
| 1400×1000 | all four combos | **619** | 1 | 15 | yes | yes | none | no | 0 |

(The full book's counter text is longer than the fixture's, hence 619 px vs
590 px.)  Full-book evidence: `reports/step2_wave/browser_full.json`.

### Mobile behaviour

At ≤ 600 px the toolbar becomes a deliberate **two-row** grid, in the same
reading order:

```
row 1:  ☰   ‹   counter   ›   Controls
row 2:  search …………………………………  mode badge
row 3:  search status (only while a search is running / has a result)
```

Every control stays reachable, nothing is clipped, and there is no horizontal
page overflow at 390×844, 375×812 or 320×700 (`docOverflow = 0`).  The shell
injects a `role="status"` live region *inside* the toolbar; it is placed on its
own full-width row and collapses to zero height while it is empty
(`[role="status"]:empty{display:none}`), so it can never collide with the mode
badge.  At 320 px the old layout needed three rows; the new one needs two.

### Sticky behaviour, anchors and content

* After scrolling 5,891 px into the fixture and 558,025 px into the full book,
  the toolbar is still at the top of the reading column
  (`top:18, bottom:62`, `position:sticky`) and inside the column.
* Clicking a Contents link (`#book-heading-0012`) lands the heading at
  `top = 90 px` with the toolbar bottom at `62 px` — the heading is **not**
  hidden behind the toolbar (the shell's existing `scroll-margin-top:90px`
  still clears the now shorter bar).
* The toolbar stays in the flow at the top of the column, so it never covers
  the beginning of the textbook; only content scrolled underneath passes behind
  its compact box.
* The live search still works from its new bounded 200 px box: typing `profit`
  produced `Match in TMP-0137`, one `.search-hit`, no overflow, in the old
  search flow (`search.oninput` in the shell script, untouched).

### Screenshots

| What | File |
|---|---|
| Compact toolbar, both sidebars open (full book, 1920×1080) | `docs/layout/46-toolbar-top-right-both-open.png` |
| Compact toolbar, both sidebars closed (full book, 1920×1080) | `docs/layout/47-toolbar-top-right-both-closed.png` |
| Wrapped toolbar, both sidebars open, 1024×768 | `docs/layout/48-toolbar-wrapped-1024-both-open.png` |
| Mobile toolbar, two rows, 390×844 | `docs/layout/49-toolbar-mobile390-two-rows.png` |

---

## 2. Task B — Light / Dark / System appearance

### The control

An `Appearance` select is the **first** control in the Reader Tools panel:

```html
<div class="ctl"><label for="theme">Appearance</label><select id="theme">
  <option value="light">Light</option><option value="dark">Dark</option>
  <option value="system">System</option></select>
  <p class="ctl-note theme-hint" id="theme-hint" role="status"></p></div>
```

* Labelled (`<label for="theme">`), native, and keyboard-operable: a real
  `Tab` walk reaches it (43 tabs in the fixture, ending on `#theme`) with a
  visible focus ring (`outline: 2px solid`, `:focus-visible` true), and
  `ArrowDown` on the focused select changes the theme immediately.
* **Light is the default.**  The choice is stored in the existing reader
  preference record under `localStorage["book2.reader.v1"].theme`, so it
  survives reopening the file and cannot collide with the other settings.
* `System` follows `prefers-color-scheme` through a `matchMedia` listener and
  re-resolves live when the operating system preference changes.
* The theme is **not** reset by: switching reader modes, collapsing or
  reopening a sidebar, resizing the window, changing font / text size /
  spacing / zoom, `Reset text size`, `Reset typography` or `Reset view`
  (verified for each case; both reset buttons were explicitly taught to keep the
  appearance and panel choices).
* A change is applied immediately, synchronously, with no reload and no scroll
  jump.

### Implementation

Two halves, both driven by the stored choice:

1. `data-theme="light|dark"` on `<html>` selects the palette in
   `reader/ui.css` (plus `color-scheme`, so form controls and scrollbars follow).
2. The reconstruction carries **15,309 inline Word colour declarations**
   (`<span style="color:#202020">…`).  A stylesheet cannot mirror those, so
   `reader/ui.js` rewrites each one **once**, in place, when dark is selected:
   lightness is mirrored, hue and saturation are kept
   (`color`: `l ← clamp(1-l, 0.60, 0.94)`, near-white text ≥ 0.86 is left alone
   because it is the source's way of printing on a coloured band;
   `background`/`background-color`: kept if `l ≤ 0.45`, otherwise
   `l ← clamp(1-l, 0.10, 0.40)`).  Because a grey `v` maps to `255-v`, the
   contrast ratio the publisher printed is preserved almost exactly (e.g.
   `#8a8a8a` on white = 3.5:1 becomes `#a8a8a8` on `#1c2229` = 3.5:1, and the
   legibility floor lifts the darkest greys).

Skipped entirely, and **never** filtered, inverted, re-coloured or re-encoded:
`img`, `svg`, `figure.b2-source-figure`, `.mobile-diagram-scroll`, `.swot-0605`
and the five `.source-composition-*` publisher figures.  Measured on the full
book in dark mode: **0 of 418 images** have any CSS `filter` on themselves or
any ancestor.  The transform is reversible — switching back to Light restores
every original `style` attribute byte for byte — and it preserves any runtime
`display` this reader set (Section mode hides blocks through the same
attribute).

Cost on the real book: the first switch to dark maps 15,309 elements in
**202 ms** (index build) + **305 ms** (apply); later switches reuse the index
and cost **68 ms**.  The measured end-to-end change (click → painted) was
**924 ms** including the harness's own 600 ms settle delay.

### Palette

| Element | Dark appearance |
|---|---|
| Application background | `#111418` |
| Reading surface (`.book-page`, continuous column) | `#1c2229` |
| Left and right sidebars | `#171c22` |
| Panel header strip | `#1b2128` |
| Expanded description / table fill | `#1b2128` |
| Toolbar, disclosure bar | `#232a33` |
| Primary body text | `#e6e9ed` |
| Labels, controls, credits | `#c3ccd7` |
| Secondary text (page labels, hints) | `#8d99a6` |
| Links, contents rows | `#9ec9f0` |
| Accent (focus ring, selection edge) | `#8ab8ea` |
| Selected Contents row | `#26364a` with a `#8ab8ea` inset edge |
| Borders, table grid | `#39424d` / `#5c6773` |
| Learning-goal ink | `#d4dae1` |
| Magenta LG badge fill | `#a61f66` — **unchanged source value** |
| Plum learning-goal rule | `#b286af` — **unchanged source value** |
| Source diagram surfaces | unchanged (white) — source artwork |

What the palette covers: application background, the central reading surface,
paragraphs, headings and subheadings, both sidebars, the toolbar, the search
field and its placeholder, buttons, selects, hover / active / selected /
`:focus-visible` states, printed page labels, the sidebar notice, module
headings and dividers, genuine textual tables (cell fills and text), the
Extended Description bar and its expanded panel, captions and photo credits.

Two source components needed explicit care in dark mode:

* the black-circle / white-`i` information icon keeps its published design and
  gains a 1 px light ring so its edge stays visible on a dark bar;
* the two banner paragraphs that wave.css gives their lost band back keep a
  dark teal band (`#1b4a52`) with their white text.

### Screenshots

| What | File |
|---|---|
| Light — Module 1.1 (full book) | `docs/layout/50-light-module-1-1.png` |
| Dark — Module 1.1 (full book) | `docs/layout/51-dark-module-1-1.png` |
| Dark — Learning Goal strip (LG badge + plum rules) | `docs/layout/52-dark-learning-goal.png` |
| Dark — expanded Extended Description | `docs/layout/53-dark-extended-description.png` |
| Dark — financial table (YETI income statement) | `docs/layout/54-dark-financial-table.png` |
| Dark — source figure with its published colours preserved | `docs/layout/55-dark-source-figure-preserved.png` |
| Dark — figure with vertical source photo credit | `docs/layout/56-dark-figure-photo-credit.png` |
| Dark — search hit | `docs/layout/57-dark-search-hit.png` |
| Dark — mobile 320 toolbar | `docs/layout/58-dark-mobile320-toolbar.png` |
| Appearance control with its keyboard focus ring | `docs/layout/59-appearance-keyboard-focus.png` |

---

## 3. Contrast testing (measured in the browser on rendered pixels)

Computed `color` against the nearest non-transparent ancestor background, per
component, in the real reader (fixture harness; the same components were then
inspected visually in the full book).

| Component | Dark min | Dark median | Dark below 4.5 | Light min (baseline) |
|---|---|---|---|---|
| Cover title text | 5.20 | 13.16 | 0/30 | 3.63 (source cover art) |
| Module opener banner | 4.52 | 5.35 | 0/7 | 5.04 |
| Module 1.1 body text | 11.38 | 13.16 | 0/5 | 7.34 |
| Learning-goal strip | 5.91 | 13.08 | 0/16 | 5.57 |
| Financial table cells | 11.44 | 11.44 | 0/21 | 11.98 |
| Table title | 13.16 | 13.16 | 0/1 | 14.68 |
| Extended Description bar | 11.09 | 11.09 | 0/1 | 9.29 |
| Extended Description body | 14.23 | 14.23 | 0/2 | 20.29 |
| Figure page text | 13.16 | 13.16 | 0/5 | 14.19 |
| Vertical photo credit | 9.88 | 9.88 | 0/1 | 15.91 |
| Contents row | 9.85 | 9.85 | 0/30 | 6.89 |
| Printed page label | 5.70 | 5.70 | 0/30 | 5.53 |
| Contents group | 12.70 | 12.70 | 0/10 | 12.75 |
| Tools label | 10.56 | 10.56 | 0/6 | 10.27 |
| Toolbar button | 10.09 | 12.38 | 0/4 | 18.09 |
| Toolbar counter | 8.92 | 8.92 | 0/1 | 10.62 |

Everything sampled in dark mode meets WCAG AA for ordinary text (≥ 4.5:1), and
the interactive controls meet it with a wide margin.  Two findings were fixed
rather than reported:

* the printed page label inside a *selected* Contents row measured 4.09:1 in
  dark mode (label `#8b96a3` on the selection fill `#26364a`); it now uses
  `#bccbdb` → **5.70:1**;
* in **light** mode the printed page label measured 3.65:1 on the rail
  (`#7b8494` on `#fbfbfc`, introduced by the printed-contents wave) — below AA;
  it is now `#5f6773` → **5.53:1**.  This is the only light-mode colour change
  in this wave; it is a small accessibility correction to a label, not to book
  content.

The cover's own 3.63:1 minimum is the publisher's cover artwork (a light
decorative rule on the cover design) and is deliberately untouched — in dark
mode the same cover text is mirrored and reaches 5.20:1.

---

## 4. Theme test matrix (all cases run)

| Case | Result |
|---|---|
| Light selected | `data-theme=light`, light palette, default on a fresh profile |
| Dark selected | `data-theme=dark`, 15,309 inline colours mapped, 0 images filtered |
| System under simulated light preference | light |
| System under simulated dark preference | dark, and it flips live when the emulated preference changes |
| Theme persistence after reload | dark survived a full reload of the 1.13 GB file (32 s load), `localStorage` shows `theme:"dark"` |
| Theme change while scrolled deep (full book) | page `TMP-1500`, fraction `0.4382`, `scrollTop 558025` before and after `light→dark→light` — unchanged |
| Switching reader modes (continuous / section / single) | theme kept in all three, no overflow |
| Opening / closing sidebars (dark) | position kept (`0.4382` → `0.4375` → `0.4382`, same region) |
| Text size 130 % | theme kept, no overflow |
| Relaxed line spacing | theme kept, no overflow |
| Font change (Georgia) | theme kept, no overflow |
| Zoom −/+ and `Reset` | theme kept |
| `Reset typography` / `Reset view` | theme kept; the panel choice is kept too; the view reset still returns to Continuous at the top |
| Expanded and collapsed descriptions | both render readable (dark bar + dark panel) |
| Keyboard and focus navigation | `Tab` reaches `#theme` with a visible ring; `ArrowDown` changes the theme; the toolbar toggles keep their `aria-expanded` |
| Resize across the 850 px breakpoint in dark | theme kept, drawers re-applied, position restored |

### Sidebar regression results (the accepted sidebar wave must survive)

* Both sidebars still collapse independently from their own in-panel
  `Collapse contents` / `Collapse tools` buttons, and the toolbar toggles still
  reopen them.
* `aria-expanded` still agrees between a panel's button and its toolbar toggle.
* The reading position is still preserved on a toggle: in dark mode the anchor
  region and its fraction stayed `TMP-1500` / `0.4382` (fixture: `0.4` →
  `0.4011` → `0.4`).
* The desktop panel preference is still written only on a desktop width, and
  the phone drawer still cannot overwrite it.
* The panel collapse buttons and the toolbar toggles are still reachable by
  keyboard, and no new console error or exception appeared in any run
  (**0 errors** in both the fixture and the full-book browser runs).

---

## 5. Task D — the accepted book is preserved

### Automated, whole-file checks (not samples)

| Check | Tool | Result |
|---|---|---|
| Per-region identity and bytes | `reader/region_digest.mjs` | **1,899 / 1,899 regions byte-identical**, order preserved, 0 differing (`reports/step2_wave/region_digest_full.json`) |
| Marker census (before vs after) | `reader/marker_counts.mjs` | 1,899 regions, 502 Contents rows, 506 printed-page cells, 145 disclosure controls, 155 description labels, 151 LG badges, 423 embedded PNGs, 418 `<img>`, 1,479 tables, 383 headings, 395 internal links, 10 group anchors — **every structural marker identical**; the only differing marker is the literal string `panel-collapse`, which appears in the new stylesheet (`reports/step2_wave/markers_*.json`) |
| Bytes between first region and tools panel | patcher | copied unchanged (`middle_bytes = 1,132,034,986`) |
| Inline images | patcher + digest | 423 embedded `data:` PNG payloads untouched; no image byte written |
| Vertical photo credits | browser | 182 `writing-mode:sideways-lr` credits still present |
| Browser integrity (full book) | CDP | 1,899 regions, 155 disclosures (none empty), 151 LG badges, 383 headings, **0 broken links**, **0 duplicate ids** |
| Fixture before/after in the browser | `compare_fixtures.mjs` | all counts equal, region digests equal, image digests equal, 0 differing keys |

Nothing in the Table of Contents was touched: no link was rewritten, no
printed-page position invented, no Contents label changed, no heading or
navigation target changed.  Step 3 has not been started.

### Sampled visual inspections (screenshots, not full-book coverage)

Front cover (light + dark), Module 1.1 body, Learning Goal strip, expanded
Extended Description, a figure with a vertical photograph credit, the YETI
financial table, the source-recoloured Business Model Canvas figure, mobile
toolbar, search hit — see the two screenshot tables above.  A separate fixture
carrying 26 real regions (front matter, module openers, LG strips, disclosures,
OCR tables, the YETI frame, photo-credit groups, the reconstructed figures and
the glossary) was used for the styling iterations so the 1.13 GB book was
loaded only for the final bounded run.

---

## 6. Task E — build and delivery

1. Fixture built from the accepted artifact with the real shell, the real
   scripts and 26 real regions (`reader/build_fixture_exact.mjs`).
2. Both features implemented in `reader/ui.css` + `reader/ui.js`, injected by
   `reader/patch_step2.mjs`; the fixture was patched and tested first.
3. One full-book candidate produced from the accepted artifact
   (`--report reports/step2_wave/patch_report_full.json`).
4. Whole-file structural regression (region digest, marker census) + one
   bounded real-browser validation run (two loads of the book, one Chrome).
5. Guarded promotion: the previous artifact was **moved**, never deleted, into
   `_master_work/integration_backups/step2-20261014/prev-final-AP Book Final.html`
   and the staged copy was hash-verified before and after the rename
   (`reports/step2_wave/promotion_report.json`).
6. No source PNG was re-uploaded; only the book object changed.

### Final artifact

| Field | Value |
|---|---|
| File | `AP Book Final.html` |
| Bytes | 1,132,289,645 |
| SHA-256 | `ba63e34f36d7a9b35fc174b2fef6f15a0c70e9d6ab1063aa4451110eae18ff74` |

### Browser errors

None.  `Runtime.exceptionThrown`, `console.error` and `Log` error entries were
collected for the whole fixture run and the whole full-book run: **0 in both**
(`reports/step2_wave/browser_fixture.json`, `reports/step2_wave/browser_full.json`).

### GitHub

See `reports/step2_wave/remote_verification.json` for the pushed commit, the
LFS upload summary and the independent download check (a fresh
`git clone --no-checkout --depth 1` of the remote plus
`git lfs fetch` of the book only, hashed locally).

---

## 7. What is deliberately *not* done in this wave

* Step 3 (Table of Contents navigation) — untouched by design, as instructed.
* No source artwork is recoloured in dark mode.  Photographs, embedded PNGs and
  the publisher's reconstructed HTML/SVG figures keep their published colours
  and stay on white surfaces, which is why a dark reader page still shows a
  white MBA canvas or diagram.  This is a deliberate fidelity decision, listed
  in `docs/KNOWN_ISSUES.md`.
* On a narrow phone viewport an open drawer still floats over the toolbar —
  the pre-existing accepted mobile drawer behaviour.  The drawer's own
  `Collapse contents` / `Collapse tools` button is always its first element and
  stays visible, so closing it is one tap away.
