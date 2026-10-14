# Contents navigation — step 3 report

Wave: `contents-navigation-2026-10-14`.

Scope: make the left Table of Contents a precise navigation system for all
three reading modes.  No change to the accepted dark mode, toolbar design,
sidebar appearance, textbook typography, source content, figures or disclosure
design.

| Field | Value |
|---|---|
| Starting commit | `e99d26d0a4794119dc0b8a7be55744c7f99fd195` |
| Starting artifact | `AP Book Final.html`, 1,132,289,645 bytes, SHA-256 `ba63e34f36d7a9b35fc174b2fef6f15a0c70e9d6ab1063aa4451110eae18ff74` |
| Staged candidate | `reader/AP-Book-Final-step3-staged.html` |
| Mechanism | `reader/ui3.css` + `reader/ui3.js` (new, additive), four additive hooks in `reader/ui2.js`, and 58 verified sidebar rows turned into links |
| Source regions changed | **none** — all 1,899 regions are byte-identical, in the same order |

## 1. What was wrong

The audit did not stop at "does the `href` resolve".  Every one of the 395
existing internal links resolved to an element that existed, and the row-by-row
static audit found 0 wrong targets and 0 broken links — yet a real browser
showed that **clicking a Contents entry did the wrong thing in two of the three
reading modes, and left the wrong row highlighted in all three**.

Measured on the accepted artifact (`reports/contents_navigation/probe/baseline-probe.json`,
8 representative destinations × 3 modes × 2 viewports):

| Defect | Evidence on the accepted artifact |
|---|---|
| **D1 — Section mode did nothing.** A Contents link whose heading lives in another section had no visible destination, so the reader stayed on whatever section was displayed. | every one of the 8 destinations in Section mode: `visible=false`, `gap=-62px`, counter still `Section 1 of 383 · Business with Personal Finance` |
| **D2 — On a phone the click was undone.** Clicking a row closes the narrow Contents drawer, and the drawer's own position-restore put the reader back where they were. | all 8 destinations at 390×844 in Continuous mode: the target ended up 0.3–1.9 million pixels away from the reading line, counter unchanged |
| **D3 — The clicked row did not stay active.** `highlightRow()` picks the *last* Contents row inside the current capture, so a capture holding several rows highlighted a different row from the one clicked. | clicked `#book-heading-0013`, active row became `#book-heading-0012` |
| **D4 — A fixed landing offset.** The heading offset was a hard-coded `scroll-margin-top:90px` while the sticky toolbar is 44 px on a desktop and taller when it wraps on a phone. | toolbar height 44 px with a 90 px margin at 1400 px; the same margin under a wrapped phone toolbar |
| **D5 — Mode switches lost the reader.** Switching modes re-showed the reader's stale idea of the section/capture. | Continuous→Section landed on section 1 of 383; Section→Source capture landed on capture 1898; Source capture→Continuous landed ~429,000 px away |
| **D6 — Forward did not reposition.** After Back/Forward the hash was right but the scroll was not. | `hash=#book-heading-0013` with the heading 10,944 px below the toolbar |
| **D7 — A group header collapsed itself.** A `<summary>` link navigated *and* toggled its own disclosure group. | reproduced in the fixture run of the fix (see §4) |
| **D8 — The reader's own scroll-sync threw the reader out of the section or capture it had just been sent to.** `reader/ui.js` installs a mode guard by reassigning `queueScrollSync`, but the scroll listener was registered with the *original* function object, so the raw sync kept running in Section and Source capture mode. Its binary search over region positions assumes every region is laid out; with one capture shown, every hidden region reports the same stale position, the search lands on the **last** capture, and the reader is snapped to capture 1899. | stack-instrumented reproduction: clicking any Contents row changed the display, and within ~6 ms `syncVisiblePage` called `setCurrent(1898)`, which the reader then saw instead of the destination (`Source capture 1898 of 1899`) |

The D8 mechanism is the reason several symptoms looked inconsistent: whether a
click "worked" depended on how many times the sync happened to run before the
measurement.  It is fixed at the source (the guard is applied to
`syncVisiblePage` itself, which the original `queueScrollSync` resolves by name
at call time), so both non-continuous modes are stable.

## 2. What changed

`reader/ui3.js` is a single additive navigation layer.  It never rewrites
`reader/ui.js` or `reader/ui2.js`, and it never touches content.

1. **Measured landing offset.** The layer measures the sticky toolbar and
   publishes `--b2-nav-offset` (toolbar bottom − reading-column top + a 14 px
   gap), which `reader/ui3.css` feeds to `main{scroll-padding-top}`.  The
   target's own `scroll-margin-top` is reset to 0, because Chrome adds the
   target margin to the container padding and the old 90 px would have doubled
   the offset.  The offset follows the toolbar as it wraps, on any viewport.
2. **One landing path.** Every rail click resolves the destination and then
   positions it with a single instant scroll of the reading container
   (`scrollTop += target.top − wanted`), followed by a bounded settle that
   re-asserts the position if the shell re-lays-out — and gives up the moment
   the reader scrolls or presses a key.
3. **Section mode.** The click resolves the destination's verified section
   (`book2Semantics.sectionForElement`, derived from the same heading order
   `showSection` uses), shows that section, and *then* positions the heading.
   Section mode is preserved; the mode never silently becomes Continuous.
4. **Source capture mode.** The click selects the capture that contains the
   destination before positioning the heading inside it.  The mode keeps its
   honest name.
5. **Active row.** The clicked row is marked active and *stays* active while the
   reader is on that destination; its unit and module groups are opened and the
   rail reveals it.  The pin is released by real reader intent (scroll, key,
   search, new click, mode switch).
6. **Hash navigation.** A stored `#book-heading-nnnn` link is honoured on load
   and on Back/Forward in all three modes, with the same precise landing.
7. **Mode switches** keep the reader's logical location: switching *to* Section
   corrects the section index *before* `ui2.js` shows it (capture-phase listener),
   and switching to a capture or back to Continuous restores the same element.
8. **Group headers** are navigated by the layer, so a `<summary>` link can no
   longer collapse the group it lives in.

## 3. Navigation coverage

Full row-by-row ledger of all 526 rail entries (516 rows + 10 group headers):
`reports/contents_navigation/navigation_ledger_before.json` (accepted artifact)
and `..._final.json` (candidate).

| Measure | Accepted artifact | Final candidate |
|---|---|---|
| Rail entries (516 rows + 10 group headers) | 526 | 526 |
| User-supplied numbered entries represented | 500 of 500 | 500 of 500 |
| Printed-page cells rendered | 506 | 506 |
| Internal links | 395 | **453** (+58) |
| Unlinked rows | 131 | **73** (−58) |
| EXACT HEADING (row title = verified heading anchor) | 383 | 383 |
| EXACT SOURCE LOCATION (verified capture or group anchor) | 12 | **70** |
| WRONG TARGET | 0 | **0** |
| UNVERIFIED | 0 | **0** |
| SOURCE-ABSENT (no body in the supplied source) | 6 | 6 |
| SOURCE-BACKED BUT UNLINKED (held, with reason) | 125 | **67** |
| Broken fragment links | 0 | 0 |
| Duplicate ids | 0 | 0 |

The 6 SOURCE-ABSENT rows are the five supplied entries whose text exists nowhere
in the 1,899 captures (`About this Book`, `Title Page`, `Copyright Page`, `FEP`,
`Back Cover`) and the `Index` row, whose body was never supplied.  They stay
visible and unlinked, as before.

### Task D — the 125 held rows, investigated

`reader/step3_holds.py` searched each held row **only inside the source interval
the book itself places it in**, in the reconstructed text of the artifact
(`reports/contents_navigation/region_index.json`), and required a match in the
row's own unit:

| Verdict | Rows | Meaning |
|---|---|---|
| **link to the capture** | **58** | the row's own words *begin* a source capture, inside the row's unit, and occur in exactly one body capture of the book |
| phrase inside a capture but not at its start | 14 | a new anchor would be needed inside a region; left unlinked this step |
| phrase occurs in more than one body capture | 17 | ambiguous without an anchor; left unlinked |
| phrase not present in the reconstructed body | 36 | kept visible and unlinked |
| (a longer row title begins the same capture) | 1 | `Gross Profit` demoted behind `Gross Profit Margin` |

The 58 newly linked rows use elements that **already exist** — the destination
is the capture article itself (`#TMP-nnnn`), whose first words *are* the row's
title — so no region, no word and no image changed.  Each row keeps its exact
printed label, its text and its position in the rail; it merely stops being a
`<span>` and becomes an `<a href="#TMP-nnnn" data-link-kind="region-begin">`.

## 4. Reading modes

No mode was added, removed or renamed: Continuous, Section and Source capture
behave as before, with a precise landing.

| Mode | Result |
|---|---|
| Continuous | the heading is placed 14 px below the toolbar at every viewport and stays there; the clicked row stays active |
| Section | the click switches to the destination's verified section (`Section i of 383 · <heading>`), keeps Section mode, and shows the heading below the toolbar |
| Source capture | the click selects the capture holding the destination (`Source capture i of 1899`) and reveals the heading inside it |
| Deep link (`file://…html#book-heading-nnnn`) | honoured on load in all three modes, hash preserved |
| Back / Forward | the hash and the precise position are both restored on every traversal |

## 5. Visual acceptance

`reports/contents_navigation/acceptance/accept-probe.json` plus screenshots, one
bounded session, real headless Chrome 155 over `file://`, six viewports
(1920×1080, 1400×1000, 1024×768, 768×1024, 390×844, 320×700) × three modes ×
31 destinations (front matter, Unit 1 opener, a Module 1.1 subsection, a module
review, a repeated `Practice Your AP® Skills` row, a case study, Units 2–5, the
Appendix, the Glossary, after a search, after a theme change, after a font-size
change, with both sidebars collapsed, immediately after expanding a disclosure,
three of the newly linked held rows, the last linked entry, and fixtures spread
across the book).

`reports/contents_navigation/acceptance_summary.json` (raw probe:
`reports/contents_navigation/acceptance/accept-probe.json`):

| Measure | Result |
|---|---|
| Landings measured | **433** (6 viewports × 3 modes × up to 31 destinations, plus the edge-case blocks) |
| Landings per viewport | 1920×1080 72 · 1400×1000 73 · 1024×768 72 · 768×1024 72 · 390×844 72 · 320×700 72 |
| Content targets displayed **below** the toolbar | **373 of 373** — no failures |
| Zero-size group-anchor markers (no box by design) | 60 |
| Landing gap below the toolbar | 194 landings at exactly 14 px, 71 at 12 px, 4 at 13 px; the rest 35–978 px where the shown section or capture is shorter than the viewport and cannot be scrolled further. **No landing was under the toolbar.** |
| JavaScript errors in the whole run | **0** |
| Clicked row still active after the reader's own scroll-sync settled (2.6 s later) | **3 of 3** sampled rows |
| Group-header click | group stayed open (`openBefore=true → openAfter=true`), landed on the front-matter capture |
| Same link clicked twice | identical landing both times (no drift, no duplicate history noise) |
| After a search · after a theme change · after a font-size change · with both sidebars collapsed · immediately after expanding a disclosure | all landed with a 14 px gap, visible, with the clicked row active |
| Deep link on load (`#book-heading-0200`), stored mode Continuous / Section / Source capture | Continuous: gap 14, `Section 4 / 10 · Unit 3 / Part 1 Personal Saving and Borrowing`; Section: **mode stayed Section**, `Section 200 of 383 · Other Incentives to Save`, gap 12; Source capture: **mode stayed Source capture**, `Source capture 880 of 1899`, gap 55 — all three with the destination visible and the linked row active (`reports/contents_navigation/deeplink.json`) |
| Back / Forward | Back restored the earlier entry, Forward restored `#book-heading-0192` with the heading visible and active |
| Mode round-trip (Continuous → Section → Source capture → Continuous) | stayed on the same logical destination (capture `TMP-0820`, `Section 192 of 383 · CASE STUDY GEICO and the Gecko`) |
| Mobile drawer after a Contents click (390×844, 320×700, 768×1024) | closed on **216 of 216** landings, and the desktop sidebar preference was untouched (1024 wide kept it open) |
| Light and dark themes | the dark-mode pass landed identically (gap 14, active row correct), and the inline-colour mapping count is unchanged |

## 6. Preservation

`reports/contents_navigation/region_digest.json` compares the accepted artifact
with the candidate region by region:

| Measure | Result |
|---|---|
| Regions | 1,899 → 1,899, first `TMP-0001`, last `TMP-1899` |
| Regions byte-identical | **1,899 of 1,899** |
| Regions differing | 0 |
| Reading order preserved | yes |
| Source text | unchanged (a region digest change would have shown it) |
| Images / embedded PNGs | 423 / 418 — unchanged |
| Tables | 1,479 — unchanged |
| Heading anchors | 383 — unchanged |
| Group anchors / nav groups | 10 / 10 — unchanged |
| Disclosure controls / description labels | 145 / 155 — unchanged |
| Learning-goal badges | 151 — unchanged |
| Printed-page cells | 506 — unchanged, same strings |
| Internal links | 395 → 453 (the 58 verified additions, nothing re-pointed) |
| Duplicate ids | 0 |

Everything the wave touched lives outside the article regions: the head
stylesheet (one appended block), 58 sidebar rows in the left rail, the inline
`reader/ui2.js` script, and one appended `<script>` element.

## 7. Delivery

| Field | Value |
|---|---|
| Full HTML changed | yes (shell only) |
| Size | 1,132,289,645 → 1,132,305,709 bytes (+16,064) |
| SHA-256 | `28c0de55191655bfe63dbdf9fc68277fb5fac99ed610e2fe06cfadcd734c1af4` |
| Remote verification | see `reports/contents_navigation/remote_verification.json` |

## 8. Remaining source limitations

* 67 held Contents rows remain unlinked, each with its measured reason in
  `reports/contents_navigation/held_resolution.json`.
* 6 rows describe material the supplied source does not contain at all.
* In Section mode a short section can be shorter than the viewport, so the
  destination sits below the toolbar rather than at it; the heading is always
  visible and never under the toolbar.
* Printed page numbers remain the labels of the user-supplied Contents list;
  no printed page boundary has been invented, and no capture is advertised as a
  printed page.
