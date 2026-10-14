# Sidebar wave — independent, clearly collapsible sidebars (2026-10-14)

Scope of this wave: **the two sidebars only**.  No dark mode, no Contents
destination changes, no book rebuild, no source re-audit.  The corrected
artifact is `AP Book Final.html`, 1,132,269,052 bytes, SHA-256
`db07ab804bed45df6dd7b27a70dea2e86f259707d047b9b307d19e71108e35df`.
The previous artifact (1,132,261,630 bytes,
`73d175779ae506d9f2b902e83f56438ca313c3d75be4eb1dd0c5cf75c4f645b2`) is preserved
as `_master_work/integration_backups/sidebar-20261014/prev-final-AP Book Final.html`
and in the repository history.

## 1. What already existed, and what was actually missing

The reader shipped with two toolbar toggles — `#left-toggle` (☰) and
`#right-toggle` (Controls) — that already collapsed and reopened their panel
independently, already carried `aria-expanded`, and already persisted both
panel states in `localStorage['book2.reader.v1']`.  The two sidebars also had
their own in-panel buttons (`#left-close`, `#right-close`), but on a desktop
width those were `display:none` (the shell stylesheet only shows them as a
phone drawer's close button) and their label was a bare `×`.

So the genuine gaps were:

* no visible collapse control **inside** either sidebar on a desktop width;
* the panel buttons had no `aria-expanded`, no `aria-controls`, no visible text,
  and (because they were hidden) never appeared in the tab order;
* toggling a sidebar **moved the reader**: the reading column rescales to the
  new width, and the old code re-laid out without compensating, so the same
  words did not stay under the same point of the viewport (measured: the
  continuous reading position drifted by ~9 % of a region, e.g. 0.5169 →
  0.4236 down the region);
* the *mobile* drawer was persisted: opening a drawer on a phone overwrote the
  stored desktop preference with the transient phone state;
* a collapsed panel could not be reopened from the keyboard, because its own
  button was unreachable and the toolbar toggle was reached only after 30+ Tab
  presses through the Contents rail.

Everything else the brief asks for was already there and was **kept**: the
toolbar toggles, the independent per-panel state, the grid that gives the space
back to the reading column, the persisted preferences, and the mutually
exclusive mobile drawers.

## 2. The change (four files, seven edits inside the artifact)

| # | Where | Edit |
|---|---|---|
| 1 | `reader/ui.css` | styles for the two in-panel collapse buttons (visible at every width, sticky at the top of the panel, touch-sized on a phone), a state tint on the toolbar toggles driven by `aria-expanded`, and a `:focus-visible` ring for every reader control |
| 2 | artifact head | `aside.left` gains `id="contents-panel"`; both sidebars' collapse buttons gain a visible label (`Collapse contents` / `Collapse tools`), `type="button"`, `aria-label`, `aria-controls` and `aria-expanded="true"` |
| 3 | artifact head | the Contents collapse button **moves** to the top of the left panel (its old copy below the cover block is removed — the button was moved, not duplicated) |
| 4 | artifact head | `#left-toggle` now points at `aria-controls="contents-panel"` (the panel it controls) and is named “Toggle contents sidebar” |
| 5 | `reader/ui.js` | toggling a panel now (a) anchors the reading line and restores it after the re-layout, (b) restores the panel's own scroll offset, (c) persists the panel state **only on a desktop width**, (d) keeps both controls' `aria-expanded` in step, and (e) does the same anchoring across a resize / breakpoint change |
| 6 | `reader/ui2.js` | the mobile drawer keeps the in-panel button's `aria-expanded` in step with the transient drawer state |
| 7 | `reader/patch_sidebar.mjs` | the streaming, exact-match patcher that applies the above and refuses to write unless every guard matches |

No new control was added: the artifact now has exactly the same four controls
it always had (two in the panels, two in the toolbar), each with one clear job.

## 3. Requirement by requirement

| # | Requirement | Result |
|---|---|---|
| 1 | Obvious collapse button near the top of the **left** sidebar | `#left-close` — “« Collapse contents”, pinned to the top of the panel, visible at every width (verified visible at 1400, 1024, 390 and 320 px) |
| 2 | Obvious collapse button near the top of the **right** sidebar | `#right-close` — “» Collapse tools”, same behaviour |
| 3 | Visible toolbar buttons that reopen a hidden sidebar | `#left-toggle` (☰) and `#right-toggle` (Controls) are visible in all four desktop combinations and in both mobile drawer states; they are tinted while their panel is open |
| 4 | Collapse either side independently, or both at once, on desktop | all four combinations measured: reading column 840 / 1140 / 1100 / 1400 px with left+right / right / left / neither open |
| 5 | The middle reading area expands into the freed space | 300 px and 260 px of column are given back to `main` on every collapse (grid columns, measured, not animated) |
| 6 | Reopened panel returns to its own width and place, never covering the reading content on desktop | widths restored to 300 / 260 px; `leftOverlapsReading` and `rightOverlapsReading` are `false` in every measured state |
| 7 | Desktop sidebar preferences remembered on reopen | `left`/`right` are stored in `localStorage['book2.reader.v1']`; 4/4 reload cases restored the exact combination (1400 px and 1024 px) |
| 8 | Mobile keeps the mutually exclusive drawers **and** preserves the desktop preference | at 390 and 320 px the two drawers were never visible together (0 overlaps in 8 transitions) and the stored preference was byte-identical before and after the phone session; resizing back to 1400 px restored it |
| 9 | Reading position and active section maintained while toggling | the region under the reading top and the current region are unchanged by every toggle and by reopening; the position *inside* the region drifts by ≤ 0.0005 region (sub-pixel) instead of the ~0.09 of the old code |
| 10 | Accessible labels, `aria-expanded`, keyboard operation, visible focus | labels + `aria-controls` + `aria-expanded` on all four controls; Tab reaches “Collapse contents” with `outline: solid 2px rgb(15,94,168)`; Enter collapses it (focus moves to `#left-toggle`), Enter reopens it, Escape closes an open panel and returns focus to its toggle; both toggles are reachable in the first Tab presses |
| 11 | No unnecessary animation, layout jumps, clipping or horizontal overflow | no transition or animation was added; `document.documentElement.scrollWidth == clientWidth` and `main.scrollWidth == clientWidth` in every measured state; `book2QA()` reports 0 layout failures |

## 4. Test matrix and evidence

Harness: headless Chrome 155 over CDP against a `file://` URL; every state is
measured in the page (rectangles, computed style, ARIA attributes, storage) and
screenshotted.  Raw results: `reports/sidebar_wave/browser_full.json` (the real
1.13 GB artifact) and `reports/sidebar_wave/browser_fixture.json` (the small
fixture), produced by `reader/sidebar_probe.mjs`.

| Case | Artifact | Result |
|---|---|---|
| Left open / right open | both | reading column 840 px, no overlap, `book2QA()` 0 |
| Left closed / right open | both | column 1140 px, panel returns to 300 px on reopen |
| Left open / right closed | both | column 1100 px, panel returns to 260 px on reopen |
| Both closed | both | column 1400 px (full width), both toolbar toggles still visible |
| Both reopened | both | exactly the starting geometry (840 / 300 / 260) |
| Persisted preferences after reopening | both | `left-closed`, `both-open`, `both-closed`, and left-closed at 1024 px: 4/4 restored |
| Desktop → mobile → desktop resize | both | 390 and 320 px behave as drawers, and the stored desktop preference returns at 1400 px |
| Mobile 390 px | both | drawer loads as Contents only; right opens and closes the left; left reopens and closes the right; never both |
| Mobile 320 px | fixture | same behaviour at the narrower width |
| Section mode | both | position, current region, visible region set and counter preserved; widths restored |
| Continuous mode | both | scroll position kept across a deep jump (e.g. scrollTop 328,410 → 331,236 for the same reading line at the same anchor) |
| Single / Source-capture mode | fixture | position and current page preserved, widths restored |

Screenshots (real artifact): `reports/sidebar_wave/shots/` and the catalogued
copies — `docs/layout/36-sidebar-left-open-right-open.png`,
`37-sidebar-left-closed-right-open.png`, `38-sidebar-left-open-right-closed.png`,
`39-sidebar-both-closed.png`, `40-sidebar-mobile390-contents-drawer.png`,
`41-sidebar-mobile390-tools-drawer.png`,
`42-sidebar-continuous-both-closed.png`,
`43-sidebar-section-both-closed.png`,
`44-sidebar-previous-no-collapse-button.png` (the previous artifact, whose panel
buttons were hidden on a desktop width) and
`45-sidebar-mobile320-tools-drawer.png` (320 px, from the fixture).

## 5. Preservation evidence

* **All 1,899 source regions are byte-identical and in order.**  Every region's
  markup (opening tag included) was hashed in the previous and the corrected
  artifact: 1,899 compared, 0 differing (`reports/sidebar_wave/region_digest.json`).
* **The 1.132 GB between the first region and the tools panel was copied
  byte for byte** — hash-identical in both files
  (`reports/sidebar_wave/verify_patch.json`), and reverting the seven edits from
  the corrected file reproduces the previous file exactly, so nothing else moved.
* **Marker census unchanged** (`reports/sidebar_wave/marker_counts.json`),
  measured as raw text in both files and, independently, in the DOM of the
  corrected artifact:

| Item | Previous | Corrected | In the built DOM |
|---|---|---|---|
| Source regions | 1,899 | 1,899 | 1,899 (`TMP-0001` … `TMP-1899`) |
| Contents rows (`data-source-contents-id`) | 502 | 502 | 502 |
| Rendered page-reference cells (`.nav-page`) | 506 | 506 | 506, none empty |
| Extended Description controls | 155 | 155 | 155, **0 with an empty body** |
| Learning-goal badges | 151 | 151 | 151 |
| Embedded PNG instances | 423 | 423 | 418 `<img>` elements, all `data:image/png` |
| Tables | 1,479 | 1,479 | 1,478 |
| Heading anchors / `role="heading"` | 383 | 383 | 383 / 383 |
| Internal links | 395 | 395 | 395, **0 broken** |
| Duplicate element ids | 0 | 0 | 0 |
| Original source PNGs | untouched | untouched | — (no `source_png/` file was read or written) |

The only difference in the census is the intended one: the new
`panel-collapse` class (11 occurrences: 2 buttons and 9 stylesheet mentions).

## 6. Honest limits

1. The brief's “500 numbered Contents entries” is the number of *supplied list
   entries*; the sidebar renders **506** page-reference cells (486 audited
   manifest rows, 7 pre-existing front/back-matter rows, the 7 supplied rows and
   the 6 unit group headers) and 16 manifest rows keep an empty cell, exactly as
   `docs/KNOWN_ISSUES.md` §6 already documents.  This wave changed none of them.
2. The screenshots for the two-page-style measurements (Section, Single) and the
   320 px drawer width come from the **fixture**, not the full artifact: the
   full-book run covers the four desktop combinations, the persistence cases,
   Continuous and Section mode, and the 390 px drawer.  The fixture is the real
   shell, stylesheet and scripts with 18 real regions, so it exercises the same
   code; the full-book run is the authority for the artifact.
3. Taller-than-viewport panels still scroll internally (unchanged); a collapsed
   panel is `display:none`, so its internal scroll offset is restored when it is
   reopened rather than being visible meanwhile.
4. Nothing was done about dark mode, the Contents destinations, the source gaps
   listed in `docs/KNOWN_ISSUES.md`, or the missing Index body.

## 7. Reproducing this wave

```bash
# 1. patch the artifact (streaming, exact-match, guarded)
node reader/patch_sidebar.mjs "AP Book Final.html" staged-sidebar.html --report reports/sidebar_wave/patch_report.json

# 2. prove that only the intended edits differ, and that every region survived
node reader/verify_sidebar_patch.mjs "AP Book Final.html" staged-sidebar.html
node reader/region_digest.mjs  "AP Book Final.html" staged-sidebar.html
node reader/marker_counts.mjs  "AP Book Final.html" reports/sidebar_wave/accepted_counts.json
node reader/marker_counts.mjs  staged-sidebar.html  reports/sidebar_wave/staged_counts.json

# 3. exercise it in a browser (small fixture first, then the whole book)
node reader/build_fixture_exact.mjs "AP Book Final.html" fixture.html
node reader/patch_sidebar.mjs fixture.html fixture-patched.html --fixture
node reader/sidebar_probe.mjs "file:///.../fixture-patched.html" shots/fixture --label fixture
node reader/sidebar_probe.mjs "file:///.../staged-sidebar.html" shots/book --label book --full

# 4. promote behind hashes (previous artifact is moved, never deleted)
node reader/promote_sidebar.mjs --source staged-sidebar.html --target "AP Book Final.html" \
  --expect-source-sha <staged sha256> --expect-target-sha <previous sha256> \
  --backup-dir _master_work/integration_backups/sidebar-20261014 \
  --report reports/sidebar_wave/promotion_report.json
```
