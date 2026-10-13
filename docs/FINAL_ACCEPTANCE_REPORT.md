# Final acceptance report - Book 2 reader

Starting commit `fb11cc1a7a909b6d60a47c89e37518dd609e6a2a`.  Artifact under test:
`AP Book Final.html`, 1,132,243,794 bytes, SHA-256
`572144b82c780abbad6ec81174c96fea0f4082222442ec42a8d90657d3a4b09f` - verified
identical in the project root, the git checkout and the remote branch before
testing.  **The HTML was not modified: no defect in the artifact was found, so
no new book revision was built or uploaded.**

All browser work used real headless Chrome 155 over `file://`.  Raw evidence:
`reports/acceptance/` (JSON + screenshots) and `reports/acceptance/harness.mjs`.

## A. Disclosure behaviour - Kellogg's and Cooper

The two controls flagged by the previous run were re-measured from scratch, with
an explicit `open = false` before every "collapsed" reading, at five viewports
plus one typography stress case.

`TMP-0125` - Extended description for Kellogg's Froot Loops (body 131-515 px):

| Viewport | closed: details / summary | open: details | panel | hides closed | reveals open | focus | click | keyboard |
|---|---|---|---|---|---|---|---|---|
| 1400x1000 | 34 / 32 | 165 | 131 | yes | yes | yes | yes | yes |
| 768x1024 | 34 / 32 | 166 | 132 | yes | yes | yes | yes | yes |
| 390x844 | 52 / 50 | 274 | 222 | yes | yes | yes | yes | yes |
| 375x812 | 70 / 68 | 292 | 222 | yes | yes | yes | yes | yes |
| 320x700 | 89 / 87 | 364 | 275 | yes | yes | yes | yes | yes |
| 390x844 @130% + relaxed | 114 / 112 | 630 | 515 | yes | yes | yes | yes | yes |

`TMP-0516` - Extended description for Figure 2.1-3 Cooper, the Family Man
(body 968-5132 px):

| Viewport | closed: details / summary | open: details | panel | hides closed | reveals open | focus | click | keyboard |
|---|---|---|---|---|---|---|---|---|
| 1400x1000 | 34 / 32 | 1002 | 968 | yes | yes | yes | yes | yes |
| 768x1024 | 34 / 32 | 1011 | 977 | yes | yes | yes | yes | yes |
| 390x844 | 52 / 50 | 1709 | 1657 | yes | yes | yes | yes | yes |
| 375x812 | 70 / 68 | 1888 | 1818 | yes | yes | yes | yes | yes |
| 320x700 | 89 / 87 | 2282 | 2194 | yes | yes | yes | yes | yes |
| 390x844 @130% + relaxed | 114 / 112 | 5246 | 5132 | yes | yes | yes | yes | yes |

**Result: both controls are correct; there is no defect.**  In every case the
closed `details` height equals the summary height (within 2 px), so the body
contributes no layout while closed; opening grows the element by exactly the
panel height; internal overflow is 0 at every width; summary and panel are
direct children of the `<details>`; there are no nested `<details>`; nothing
inside either panel is focusable, so closed content is unreachable by Tab.

Screenshots (`reports/acceptance/shots/`): `ab-TMP-0125-{1400,390}-{closed,open}.png`
and `ab-TMP-0516-{1400,390}-{closed,open}.png`, framed on the summary with the
surrounding figure and caption visible.  The Kellogg's pair shows the description
absent when closed and present when open; the Cooper pair shows the same, with
the figure's own text and the caption "Figure 2.1-3 Cooper, the Family Man"
remaining outside the control in both states.

### Root cause of the earlier 274 = 274 / 1709 = 1709 readings

Two harness faults, not a book fault:

1. The previous probe's screenshot step opened each control and never reset it,
   and the mobile pass ran after the desktop pass on the same page.  Its
   "collapsed" reading was therefore taken on an **already open** control, giving
   the expanded height for both states.
2. It treated a change in `details.open` as proof of visibility.  `open` toggling
   says nothing about what is rendered.

The harness is fixed (`reports/acceptance/harness.mjs`): every collapsed reading
now sets `open = false` first, and visibility is judged by the relationship
between the `details`, `summary` and panel heights plus screenshots.  The mobile
section of `reports/nine_case/probe-nine.json` is superseded; a note was added
to it.  The `duplicateSlice` heuristic in that old probe was also unsound (see
"Duplicate check" below).

## B. Text preservation

The weak test (`verify_sequences.py`: multiset equality plus subsequence
containment) has been replaced by a real ordered comparison,
`contents_wave/verify_ordered_sequences.py`, run between the verified previous
artifact (`ef09a825...`, preserved in
`integration_backups/final-completion-20261013/`) and the current final
(`572144b8...`).  Normalisation is limited to HTML entities and the disclosure UI
glyphs (chevron, information marker), exactly as documented.

| Group | Tokens before | Tokens after | Ordered equality |
|---|---|---|---|
| TMP-0125 | 112 | 112 | **equal** |
| TMP-0152 | 46 | 46 | **equal** |
| TMP-0422 | 89 | 89 | **equal** |
| TMP-0502 + 0503 + 0504 | 250 | 250 | one positional difference (below) |
| TMP-0516 + 0517 + 0518 | 698 | 698 | **equal** |
| TMP-0530 + 0531 | 387 | 387 | **equal** |
| TMP-0745 | 98 | 98 | **equal** |
| TMP-0851 | 63 | 63 | **equal** |
| TMP-1350 | 30 | 30 | **equal** |

**The single divergence, fully characterised.**  In the 0502 group the first
divergent token is "Copyright" (token 94 of 250):

* before: `... ○ Education ○ Income ○ Gender | Copyright © BFW Publishers | ○ Occupation ○ Ethnicity ○ Family ...`
* after: `... ○ Education ○ Income ○ Gender | ○ Occupation ○ Ethnicity ○ Family ...` … and the copyright line follows the description.

Evidence (`reports/acceptance/copyright_evidence.txt`): in both artifacts
"Copyright" appears **exactly once**; the group's token multiset is **identical**
(no word added, lost or duplicated); in the current artifact the copyright
paragraph lies **outside** the panel, immediately after it.  The pre-repair order
was the raw extraction order, in which the figure's copyright paragraph happened
to fall between the two halves of a description that was split across captures;
making the panel contiguous necessarily moves it to after the description.  This
is a justified, source-explained positional difference, not a content change.

Whole-book: **region-only word total 228,179 before and after (delta 0)**;
1,899 regions present, none duplicated, global order unchanged.  No full-source
OCR or reconstruction was run.

### Duplicate check

Precise extraction (`reports/acceptance/dupcheck.txt`) shows **0 panels with
identical text** and **0 panels sharing a 60-character prefix**.  The earlier
`duplicateSlice` warning for 15 controls was a false positive of the naive
"slice appears twice in `body.textContent`" heuristic: those slices are
front-matter descriptions that transcribe a sample page which also exists as a
real page later in the book (for example TMP-0062's text also occurs in
TMP-0130 and TMP-1049).  That repetition is inherent to the source - it is what
the Extended Description of a feature page is - and it is present in the
previous verified artifact too.

## C. All 155 Extended Description controls

Every `details.disclosure` in the finished file was measured in the browser
(`reports/acceptance/acceptance.json` → `controls_ALL`):

| Check | Result |
|---|---|
| Controls tested | **155** |
| Blank or missing label | 0 |
| Empty description body | 0 |
| Structure problems (summary/panel not direct children, nested `<details>`) | 0 |
| Does **not** hide its body when closed | 0 |
| Does **not** reveal its body when open | 0 |
| Panel internal overflow > 0 | 0 |
| Focusable elements inside a panel (must be 0) | 0 |

Keyboard operation, click toggling and geometry were measured for the two
flagged controls at six configurations (above) and for the whole set at
1400x1000; all pass.  The controls restored across the last waves - Walmart,
Merck, Starbucks Rewards, Lancôme, Cialdini, Consumers, Kellogg's,
Supply/Demand, Cooper, Privacy Statement, Middleman, Capital Bank, Capital Bank
/- Disaster Strikes, Docu Sign, South by Southwest, Beats, Supply Chain,
Segmentation, Bar Charts, Loans - are included in that set.

## D. Hands-on reader review

Inspected as rendered output, with the original capture compared where a
discrepancy was suspected:

| # | Location | Finding |
|---|---|---|
| 1 | Front cover + Front Cover description (`TMP-0001`/`TMP-0002`) | correct; description opens to 580 characters, no borders or overflow |
| 2 | Frontmatter and numbered Contents rail | 516 rows, printed labels correct, groups expand/collapse |
| 3 | Unit 1 opener and the MoMo credit (`TMP-0112`) | **credit renders vertically down the photograph's edge as the source prints it**, no broken words |
| 4 | Module 1.1 through its review, AP® Skills, case study | continuous flow, no artificial breaks |
| 5 | Learning-goal block | badge attached to its goal text, not detached |
| 6 | Unit 2 figure-heavy section | figures and their captions/credits associated |
| 7 | Unit 3 financial tables | tables render inside their containers, no overflow |
| 8 | Unit 4 module opener | banner and heading intact |
| 9 | Unit 5 section | as above |
| 10 | Descriptions spanning captures (Kellogg's, Cooper, Privacy Statement, Lancôme, Cialdini, Consumers, Supply/Demand) | bodies complete, captions outside |
| 11 | Page 1101-1200 OCR region (e.g. `TMP-1074`) | readable; the smaller run sizes are the documented donor limitation |
| 12 | Glossary and backmatter | rows and labels correct; Index still deliberately unlinked |

Reader functionality verified: **Continuous** (main background white, every
`.book-page` `box-shadow:none`, `margin:0`, 0 hidden), **Section** (383 sections,
counter "Section 1 of 383 · Business with Personal Finance", 1,896 of 1,899
regions correctly clipped), **Source capture** (counter "Source capture 1 of
1899" plus the explanatory note); search ("Match in Contents", 1 visible hit);
font/size/zoom/spacing and all three resets; navigation (395 links, 516 rows,
0 broken, 0 duplicate ids, one `aria-current`); drawers with fresh preferences
(both closed at 390), with stored desktop preferences (both open at 1400, only
Contents at 390, no overlap in any state, Contents restored on widening);
0 JS exceptions, 0 console errors, 0 log errors, `book2QA()` 0 failures,
0 document or `main` overflow.

One measurement nuance recorded rather than hidden: clicking the Contents row
for `#book-heading-0010` lands the heading 3 px above the sticky toolbar's
bottom edge (89 px vs 92 px) in this run - a 3 px shortfall of the
`scroll-margin-top:90px` rule, visually indistinguishable and unchanged from the
previously verified behavior.

## E. Source-backed limitations (reviewed, still genuine)

Classified in `docs/KNOWN_ISSUES.md`, which was rewritten in this pass: the
malformed duplicated block and the stale claims (printed labels "cannot be
derived", two-page spread, 131 controls, 6 unresolved orphans, empty
Walmart/Merck bodies, overlapping drawers) are now in a clearly marked
"Superseded claims" section, and the current items are separated into genuine
source gaps (no Index body, `Page 1101-1200` without a Word document, `alt=""`,
Page 501-600 run sizes, one lost `LG` opener marker, 16 unlabelled rows, five
unlinked supplied entries, 125 held rows), availability limits (no printed
two-page spread; printed page numbers come from the supplied list), and scope
statements.  Nothing in this pass was reclassified as unfixable merely because a
donor document lacks formatting.

## F. Defects found and corrected

No defect in the book artifact was found, so no source region, script or
stylesheet was changed and the HTML is byte-identical to the verified baseline.
Two QA-harness defects were found and fixed (the collapsed-state measurement and
the duplicate heuristic), and two documentation defects were corrected
(`docs/KNOWN_ISSUES.md`, this report).

## G. Acceptance gates

| Gate | Result |
|---|---|
| 1,899 legitimate regions, correct order | pass |
| 500 numbered Contents entries represented | pass (516 rows, 506 labels) |
| 155 Extended Description controls accounted for | pass |
| All 24 orphan repairs intact | pass |
| Kellogg's hides and reveals on mobile | pass (all five viewports + stress case) |
| Cooper hides and reveals on mobile | pass (all five viewports + stress case) |
| Every tested disclosure keyboard-operable | pass (155/155) |
| Affected-group text sequence preserved or justified | pass (8 exact + 1 documented) |
| No unintended word removed/duplicated/reordered | pass (delta 0; multiset equal) |
| No missing figures or table content | pass |
| No malformed disclosure markup | pass (0) |
| No broken verified navigation links | pass (0 of 395) |
| No unexpected JS exceptions | pass (0) |
| No significant overflow or clipping | pass (0 document/main/panel overflow) |
| MoMo credit still visually correct | pass (screenshot) |
| Continuous / Section / Source capture work | pass |
| Mobile drawers usable | pass (no overlap in any state) |
| Documentation matches the tested artifact | pass (KNOWN_ISSUES rewritten; hashes in ARTIFACT.md/README.md) |

## Release status

**RELEASE ACCEPTED.**  Every acceptance criterion passed.  The only remaining
items are explicitly documented unavailable-source limitations and the
availability limits listed in `docs/KNOWN_ISSUES.md`; no content or
functionality defect remains, and the artifact was therefore left unchanged.

## Delivery

* Starting commit: `fb11cc1a7a909b6d60a47c89e37518dd609e6a2a`.
* Full HTML changed: **no** - it remains 1,132,243,794 bytes, SHA-256
  `572144b82c780abbad6ec81174c96fea0f4082222442ec42a8d90657d3a4b09f`.
* Git LFS upload: **none** (deliberately no new 1.13 GB revision).
* Committed in this pass: this report, the rewritten `docs/KNOWN_ISSUES.md`, the
  acceptance harness and evidence under `reports/acceptance/`, the replacement
  ordered-sequence verifier `contents_wave/verify_ordered_sequences.py`, and new
  screenshots under `docs/layout/25-*`.
* Browser QA: 0 exceptions, 0 console errors, 0 log errors, `book2QA()` 0
  failures, 0 overflow, across 1400x1000, 768x1024, 390x844, 375x812 and
  320x700, with fresh and stored preferences.
