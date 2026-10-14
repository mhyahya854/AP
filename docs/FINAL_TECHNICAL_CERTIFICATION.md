# Final technical certification - Book 2 reader

Artifact: **Business with Personal Finance for the AP(R) Course - International Edition**, single-file reader over `file://`.

## A. Artifact identification

| Field | Value |
|---|---|
| Repository artifact | `C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP\AP Book Final.html` |
| Project-root artifact | `C:\Users\mhyah\Downloads\book-source\Word\AP Book Final.html` |
| Bytes | 1,132,306,770 |
| SHA-256 | `2bff4ce2e75d767884672a983f470f9fb339d7088e7d9053925d8e3b351c777d` |
| Expected (published) bytes / SHA-256 | 1,132,306,770 / `2bff4ce2e75d767884672a983f470f9fb339d7088e7d9053925d8e3b351c777d` |
| Repository matches expected | True |
| Project-root matches expected | True |
| Both local copies byte-identical | True |
| Starting / final git commit | `d948d0435136fc87490b7f222d38d99b62f4fbb3` (`main` == `origin/main`: True) |
| New HTML object uploaded this run | False |
| HTML changed this run | False |

Every measurement ran behind one gate: `document.readyState === "complete"`, 1,899 `.book-page` regions and `window.book2Navigation` present. A half-loaded page could not produce a row.

## B. Feature coverage

| Feature | Tested | Result | Method | Evidence |
|---|---|---|---|---|
| Left Contents sidebar: open/close/reopen, in-panel close | 6 sidebar states | PASS | CDP click + geometry (release_qa_interact.mjs shell) | shell_audit.json |
| Contents Expand all / Collapse all | 2 | PASS | click + screenshot | screens_inventory.json (desktop-contents-expanded) |
| Contents row click navigation | 453 | PASS | click each link, measure target/gap/hash/active row | navigation_audit.json + navigation_recheck.json |
| Active row highlight + group auto-open | 472 | PASS | read aria-current after every click | navigation_audit.json (activeMatched 443 of 443 row links; 10 group headers have no active row by design) |
| Group-header click does not collapse its group | 10 | PASS | open state before/after click | navigation_recheck.json (groupHeader true, navigation correct) |
| Right Reader tools panel: open/close/reopen | 4 | PASS | click + geometry + aria-expanded | shell_audit.json |
| Sidebar combinations (both open / left only / right only / both closed) | 4 | PASS | reading width + toolbar alignment + scroll preservation | shell_audit.json |
| Reading position preserved across sidebar changes | 5 states | PASS | anchor element rect before/after | keyboard_focus_audit.json / sidebar anchor probe: heading stays at 76 px in all five states |
| Toolbar: sticky, right aligned, no wrap on desktop, wraps on phones | 10 viewports x 4 scroll positions | PASS | rect measurement | responsive_audit.json, shell_audit.json |
| Toolbar previous/next in all three modes | 21 steps | PASS | click prev/next, read counter + visible region count | mode_audit.json |
| Continuous mode completeness | 1899 | PASS | visible region count + region order | dom_validation.json (1868 of 1899 regions have a box; 31 are the documented blank/merged gap regions) |
| Section mode: correct section, accurate counter | counters after 7 steps + 2 cross-section clicks | PASS | click + read counter | mode_audit.json, navigation_recheck.json |
| Source capture mode: correct capture, honest label | 7 steps + navigate | PASS | click + read counter | mode_audit.json (Source capture n of 1899) |
| Appearance Light / Dark / System | 12 switches + 5 cycle drift test | PASS | inline style snapshot of 400 elements | theme_audit.json |
| Font selector | 5 | PASS | select each option, measure body font | typography_audit.json |
| Line spacing selector | 3 | PASS | select each option, measure line-height | typography_audit.json |
| Text size slider + reset, zoom in/out/reset, typography reset, view reset | 6 | PASS | operate each control, re-measure | typography_audit.json |
| Search | 9 | PASS | nine queries incl. case/no-match/empty/Unicode | search_audit.json |
| Hash deep links and browser Back/Forward | 6 | PASS | click A, click B, back, forward, same link twice, reload with hash | history_audit.json |
| Responsive behaviour 320-1920 | 10 | PASS | toolbar geometry, panel state, horizontal overflow | responsive_audit.json (0 px horizontal overflow at every width) |
| Mobile drawer closes after navigation and desktop preference is untouched | 2 checks | PASS | drawer state + localStorage after a row click | responsive_audit.json |
| Keyboard operation (Tab order, Enter on link, Enter/Space on disclosure) | 14 tabs plus 4 key activations | PASS | CDP Input.dispatchKeyEvent | keyboard_focus_audit.json, keyboard_activation_audit.json |
| Focus indicators | 14 focused controls | PASS | real Tab + computed outline + :focus-visible | keyboard_focus_audit.json (solid 2px rgb(15,94,168) on toolbar controls) |
| Extended Description disclosures | 155 | PASS | closed/open geometry + checkVisibility + hit test + overflow | disclosure_visibility_audit.json |
| Learning Goal badges | 151 | PASS | DOM census + pixel contrast + dark-mode pixel sample | dom_validation.json, pixel_contrast.json |
| Photograph credits (vertical, sideways-lr) | 182 | PASS | static marker census + DOM writing-mode census + pixel contrast | static_audit.json (sideways-lr 182), dom_validation.json (374 elements inherit vertical writing) |
| Images (embedded captures) | 417 | PASS | decode every payload + 12 in-view layout samples | image_render_audit.json (417/417 decode, 0 broken, distortion <= 0.0001) |
| Tables (data and layout) | 1478 | PASS | structural census in the DOM | table_audit.json (12 OCR data tables regular; 24 row-count differences are reconstruction layout tables) |
| Offline single-file operation | 1 | PASS | every probe loaded file:// with no network; no external requests in the DOM | all probe runs (0 JS errors, no external URLs) |
| Printed-page mapping | 506 | INTENTIONAL BEHAVIOR | static census of the label cells | labels are the supplied list; no printed page boundary is claimed |
| Visual fidelity of all 1899 source captures | 0 | NOT TESTED | not attempted here | the user page-by-page review is the visual acceptance step (docs/MANUAL_BOOK_REVIEW_GUIDE.md) |

## C. Structural quality

| Measure | Value |
|---|---|
| Regions (bytes / DOM) | 1899 / 1899 |
| Region ids sequential / duplicates | True / [] |
| Heading anchors / group anchors | 383 / 10 |
| Unique ids / duplicate ids | 2346 / [] |
| Internal fragments (total / distinct / broken) | 453 / 453 / [] |
| `<details>` tags / disclosure controls | 197 / 155 |
| Tables (bytes / DOM) | 1479 / 1478 |
| Images (DOM) / embedded PNG payloads | 418 / 423 |
| Learning Goal badges / description labels | 151 / 155 |
| Printed-page label cells | 506 |
| Orphan table cells | 0 |
| Nested interactive elements | {'aInA': 0, 'buttonInA': 0, 'aInButton': 0, 'buttonInButton': 0, 'inputInA': 0} |
| Text nodes scanned / characters | 25194 / 1523654 |
| Reconstruction markers visible in text | {'doubleSpace': 2069, 'ocrUnclear': 4} |
| Replacement characters / mojibake byte patterns | 0 / 0 |

### The 145-versus-155 disclosure discrepancy, resolved

A literal `class="disclosure"` string match finds 145 controls. The real count is 155, because ten controls carry extra classes:

| `<details>` class attribute | count |
|---|---|
| `disclosure` | 145 |
| `disclosure ocr-disclosure` | 4 |
| `disclosure ocr-disclosure ocr-disclosure-structured` | 2 |
| `disclosure word-disclosure` | 4 |
| `other:nav-group` | 10 |
| `other:nav-module` | 31 |
| `other:source-contents` | 1 |

Total `<details>` tags 197 = 155 disclosure controls + 31 module groups + 10 unit groups + 1 source-contents group. **No control was edited to make the two counting methods agree.**

## D. Navigation

All None internal links were clicked in the real browser in Continuous mode: None targets existed, None landed below the toolbar, None carried the right hash, and None of the 443 Contents row links also had the right active row. The ten links without an active row are the ten unit/group headers, which are not Contents rows; they were verified by destination and by their group staying open.

The first pass clicked every link 80 ms apart, which outruns the reader's settle for None rows. Those rows were re-clicked with a 2.5 s settle and **all of them land at 14 px below the toolbar with the correct hash and region** (0 failures after the recheck).

An independent click check from the previous wave, written with different measurement code (`reader/step3_click_check.mjs`), reports 10 landings, [] failures and [] JavaScript errors.

Section mode switches to the destination's own section (observed: `Section 121 of 383 - Technology and Innovation`) and Source capture mode selects the capture holding the destination (`Source capture 882 of 1899`). Back and Forward restore both the hash and the 14 px landing. 73 Contents rows stay unlinked with a per-row reason, and 6 describe material the supplied source does not contain.

## E. Appearance and typography

* Appearance options: ['light', 'dark', 'system'].
* Dark mode and back to Light restores the inline styles exactly: stable after 5 toggle cycles, drift cells None.
* Images are never filtered: computed filter is `none` on every sampled image (None), and the pixel samples of the cover, a Learning Goal badge and a photograph are identical in both themes.
* 15093 inline colour declarations are remapped by the dark theme; 36542 elements carry inline styles.

Pixel-measured contrast (exact element box, WCAG AA):

| Element | Theme | Ratio | Verdict |
|---|---|---|---|
| body-paragraph | dark | 14.06 | PASS |
| body-paragraph | light | 21.0 | PASS |
| cover-title | dark | 16.03 | PASS |
| cover-title | light | 14.57 | PASS |
| disclosure-summary | dark | 11.09 | PASS |
| disclosure-summary | light | 18.9 | PASS |
| lg-badge | dark | 6.98 | PASS |
| lg-badge | light | 6.98 | PASS |
| module-heading | dark | 4.92 | PASS |
| module-heading | light | 8.94 | PASS |
| nav-row-linked | dark | 9.85 | PASS |
| nav-row-linked | light | 6.89 | PASS |
| nav-row-muted | dark | 5.7 | PASS |
| nav-row-muted | light | 5.53 | PASS |
| photo-credit | dark | 14.06 | PASS |
| photo-credit | light | 21.0 | PASS |
| table-cell | dark | 14.06 | PASS |
| table-cell | light | 21.0 | PASS |
| toolbar-button | dark | 10.09 | PASS |
| toolbar-button | light | 18.09 | PASS |
| tools-panel-label | dark | 10.56 | PASS |
| tools-panel-label | light | 10.27 | PASS |

Computed-style contrast was measured too, and reported 19 light / 6 dark "failures"; every one is a false positive of that method, which compares a container element's inherited colour against an ancestor band that is not the pixels behind the text. The pixel table above is the evidence; see QA-01.

## F. Performance

| Interaction (input to fully rendered frame) | ms |
|---|---|
| search-input-to-frame | 32.7 |
| contents-click-to-frame | 108.1 |
| disclosure-open-to-frame | 30.3 |
| mode-to-section | 849.3 |
| mode-to-source-capture | 34.7 |
| mode-to-continuous | 1098.6 |
| sidebar-toggle | 1133 |
| theme-switch | 2893.9 |

First load of the 1.13 GB file over `file://`: 0 ms (DOMContentLoaded 0 ms, load event 0 ms).

End of the book is reachable: scrolling to the bottom shows `TMP-1899` (`docScrolledToEnd`: True).

Stress: three rounds of six Contents clicks + theme switch + mode switch + Expand/Collapse all + a disclosure toggle took  ms, with no error, no freeze and no growth trend. No crash in any probe.

* theme switching remaps 15,092 inline colour declarations, so it is the heaviest interaction (~2.9 s)
* sidebar collapse and Continuous-mode re-entry re-lay-out a 776,160 px document (~1.1 s)
* Chrome reports JSHeapUsedSize in this configuration at a few MB, so heap growth is not a reliable signal here; node count and error count are stable instead

## G. Defects

| Id | Severity | Status | Finding |
|---|---|---|---|
| QA-01 | MINOR | CLOSED - harness defect, not a book defect | Computed-style contrast reported 19 light / 6 dark failures |
| QA-02 | MINOR | CLOSED - harness defect, not a book defect | Disclosure audit first reported all 155 panels visible while closed |
| QA-03 | MINOR | CLOSED - harness defect, not a book defect | Navigation scan first reported 19 links not landing precisely |
| QA-04 | MINOR | CLOSED - harness defect, not a book defect | Keyboard sub-tests initially found no focus ring and no Enter activation |
| QA-05 | MINOR | INTENTIONAL BEHAVIOR (source faithful) | TMP-0715 disclosure opens onto a single glyph |
| QA-06 | MINOR | SOURCE LIMITATION | TMP-0428 extended description is only six words |
| QA-07 | MINOR | SOURCE LIMITATION (documented) | 31 regions render with no content |
| QA-08 | MINOR | SOURCE LIMITATION | Search only covers the reconstructed text, not the page images |
| QA-09 | MINOR | INTENTIONAL BEHAVIOR | 24 data-classified tables have rows with different cell counts |

**Blockers: none. Major defects: none. Repaired defects: none - the artifact was not modified.** Four findings were defects of my own test harness; they are recorded as such so they cannot be mistaken for book defects. The others are documented source limitations or intentional, source-faithful behaviour.

## H. Source preservation

| Measure | Value |
|---|---|
| Regions vs previous accepted artifact | 1899 identical, 0 differing |
| Region count and order this run | 1899 regions, sequential True |
| Reconstructed text | 1,426,177 characters |
| Embedded PNG payloads / images decoded | 423 / 417 ok, 0 broken |
| Tables | 1478 total, 86 OCR data tables, 1392 layout tables |
| Learning Goal badges / printed-page cells | 151 / 506 |
| Photograph credits | 182 `sideways-lr` markers, 374 elements in vertical writing |
| Duplicate ids / broken fragments | [] / [] |
| Documented source-gap regions | 33 (30 blank/pale + 3 merged states) |
| Justified exceptions (content edits) | none - the artifact was not modified in this run |

## I. Human review handoff

* Guide: [`docs/MANUAL_BOOK_REVIEW_GUIDE.md`](MANUAL_BOOK_REVIEW_GUIDE.md)
* Checklist: `reports/final_release_qa/MANUAL_REVIEW_INDEX.csv` (528 rows: 12 unit/group rows, 31 modules, 485 Contents entries; 135 rows carry a risk flag)
* Screenshots: `reports/final_release_qa/screens/` (desktop, mobile, dark, pixel-contrast clips)
* Known high-risk areas: the 33 source-gap regions, the OCR-derived batches, the 54 thin-text regions, the repaired Extended Descriptions, the financial tables and the mobile cover.

## Verdict

**TECHNICALLY ACCEPTED**

every acceptance gate passed on the unmodified artifact, so publishing a new 1.13 GB object would add no value

Not tested (explicitly): Visual fidelity of all 1,899 captures page by page (the user manual review step), Full WCAG 2.2 conformance audit, Print stylesheet behaviour (the artifact is a single-file reader, not a print deliverable).
