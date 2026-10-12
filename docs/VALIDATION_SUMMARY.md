# Validation summary - continuous-reading wave

Everything below was measured on the built candidate and then re-checked on the
promoted `AP Book Final.html` (`e38a07ca...`, 1,132,281,148 bytes).

## 1. Content preservation (the strongest test)

The build was split into its 1,899 source regions and each region's text was
extracted (tags removed, whitespace collapsed) and hashed in both the previous
final and the new one.

| Measure | Result |
|---|---|
| Regions | 1,899 before, 1,899 after |
| Region order / ids | identical |
| Regions with byte-identical text | **1,772** |
| Regions differing only by disclosure UI glyphs | 127 (delta -2 to -6 characters each) |
| Regions differing in **words** | **0** |

The only text differences are the removal of the `▼` / `▶` chevron and the
`ℹ` / `ⓘ` / `● i` information glyph that used to be written into the summary
label, now drawn once by the shared control. `show_diff.py` and
`verify_glyphs.py` reproduce this; the raw evidence is
`region_text_before.json`, `region_text_after.json`, `region_text_diffs.json`.

## 2. Assets

| Measure | Before | After |
|---|---|---|
| `<img>` in the article region | 448 | 424 |
| embedded `data:image` payloads | 453 | 429 |
| `<td>` | 4,256 | 4,252 |
| `<table>` | 1,488 | 1,485 |

Every one of the 24 removed images was the information-icon glyph sitting
**inside a `<details><summary>`**; it is replaced by the single CSS-drawn
`.disclosure > summary::after` icon. `verify_lost_imgs.py` counted the images
inside summaries per region in the source build and matched them one-for-one
against the removed images (24 / 24, no exception). No figure, photograph,
diagram, chart or credit was removed.

The 4 removed `<td>` and 3 removed `<table>` elements are the one-cell layout
boxes that only existed to draw the lost badge rectangle; the badge component
replaces them. No table row, cell value or caption was lost.

## 3. Structure

| Check | Result |
|---|---|
| Source regions in order | 1,899 / 1,899 |
| Heading anchors | 383 (383 carry `role="heading"`) |
| Duplicate element ids | 0 |
| Broken in-document links | 0 of 393 |
| Contents rows | 502 (376 linked / 126 unlinked: 125 held + the Index row) |
| Module / unit starts tagged for the reading dividers | 42 headings + 9 group anchors |
| `<details>` controls | 173 |
| Learning-goal badges | 151, none with zero size |
| Scripts | 3, all pass `node --check` |

## 4. Browser (real headless Chrome 155 over `file://`)

| Check | Result |
|---|---|
| `book2QA()` layout failures | **0** |
| Console errors / exceptions from the file | 0 / 0 |
| Desktop 1400x1000 document overflow | 0 |
| Mobile 390x844 document overflow | 0 |
| Cover region overflow at 1400x1000 and 390x844 | 0 |
| Continuous sheet | main background white, every `.book-page` `box-shadow:none`, `margin:0`, transparent - one sheet, not 1,899 cards |
| Disclosure bar | `#f2f3f4` background, 1 px border, flex, triangle 6.05 px, info icon from an inline SVG |
| Expanded description | panel 680 px of a 682 px host, 0 px internal overflow, 0 left/right padding - no narrow column |
| Collapsed -> expanded | 34 px -> 239 px |
| Contents navigation | `#book-heading-0010`, focus lands on the heading, lands below the toolbar, `aria-current` set |
| Search | hit found, status announced |
| Font control | body switches to the chosen face; badge, disclosure bar and label keep Arial |
| Text size | 100 % -> 130 % changes the body size and the surface scale, readout updates |
| Line spacing / zoom | both change the computed values |

## 5. Honest limits of this verification

* Every one of the 131 disclosure controls was checked structurally (label
  present, control present, body present). **Three** controls were opened and
  measured geometrically (the cover description measured above, plus two more
  in the waves before). The rest were not individually opened by hand - the
  arithmetic proof is that the panel rules are identical for all 131 and that
  the browser reports 0 layout failures.
* Visual screenshots were taken at nine representative positions (cover,
  expanded cover description, printed Contents, module opener, section strip,
  module review, rebuilt flattened disclosure, a long text region, and a
  mobile viewport). The rest of the book was not screenshotted in this wave.
* The per-region word check proves the *text* of all 1,899 regions is intact.
  It does not prove pixel-level equality with the printed book, which remains
  impossible for the source ranges that were never available (see
  `KNOWN_ISSUES.md`).
