# Learning-Goal (LG) audit

## What the source establishes

Six source pages were inspected at full resolution to fix the intended design
(`B2P2-0242`, `B2P2-0346`, `B2P2-0364`, `B2P2-0446`, `B2P1-0130`,
`B2P1-0740`). The book uses two genuine learning-goal presentations:

1. Section strip - a plum hairline, then a magenta stadium badge reading `LG`
   beside the bold grey goal question, then a second plum hairline, then the
   body text. Sampled from the source: badge fill `#a61f66`, rule `#b286af` at
   about 1.5 pt, goal text `#565656` bold Arial, badge roughly 2.3 : 1 with
   fully rounded ends.
2. Module-opener marker - `LG` as large magenta text beside `LEARNING GOALS` on
   the module opening page. This variant is genuinely different and was left as
   the source drew it.

## What was wrong

* 14 badges existed as `.lg-badge` but with two arbitrary sizes (63x42 pt and
  70x45 pt) taken from layout boxes, a 6 pt corner radius on the 63 pt variant
  (so it was a rectangle, not the source stadium), and the badge font
  re-inherited the reader serif whenever the font control was used.
* 130 `LG` markers had lost their badge fill completely: they were white
  (invisible) text sitting in a plain rectangle, or in a rectangle coloured by
  a cell whose only purpose was to fake the badge.
* 7 further `LG` markers were white paragraphs - not visible at all.
* The goal text next to the badge was 13 pt in one markup, 10.5 pt in another,
  9.5 pt in a third and 7 pt in one - four readings of the same component.
* The layout-table variant inherited the generic `td` border, so the badge and
  goal were drawn as two bordered boxes.

## What it is now

One reusable component for the section strip:

* `.lg-badge` / `.lg-badge--lg-63` / `.lg-badge--lg-70` resolve to a single
  geometry driven by `--lg-h`: 24 pt tall, 2.3 : 1, fully rounded
  (`border-radius: calc(var(--lg-h)/2)`), fill `#a61f66`, white bold Arial.
* the strip (`p.lg-question`, `p:has(> .lg-badge)` and the two table forms) is
  normalised to the source component: plum rule, badge, bold grey goal, plum
  rule.
* a goal text of 12.5 pt bold `#565656` everywhere, including the 7 pt case.
* the badge, the strip and the disclosure bar keep Arial even when the reader
  font is switched (they are anchored to the app id, so no font rule can
  distort a badge).

## Counts

| Measure | Count |
|---|---|
| Learning-goal badges in the finished book | 151 |
| Markers rebuilt into the component | 137 |
| - from a one-cell badge table | 4 |
| - from a badge cell in the goal row | 124 |
| - from a bare white `LG` span | 2 |
| - from a white `LG` paragraph | 7 |
| Badges with zero rendered size | 0 |
| Badges whose font changes with the reader font control | 0 |
| Magenta-text module-opener markers left as the source drew them | 27 |
| Distinct badge geometries after the wave | 1 |

## Verification

All 151 badges were checked for a non-zero rendered box (0 failures). The
component was inspected visually on a module opener, a section page (including
the 7 pt case) and a module review page with two goal rows, and compared
against the corresponding source page images.
