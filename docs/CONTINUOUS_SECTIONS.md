# Continuous reading sections

## The change

Before this wave the reader showed the book as 1,899 separate white "paper"
cards: each source region was a 210 mm box with its own shadow, its own
20 px gap and its own margins, so a module was visibly chopped into dozens of
pieces even in Continuous mode.

Now the reading column is **one flowing sheet**. In Continuous mode:

* `main` carries the paper colour, and every `.book-page` is transparent with
  no shadow, no border, no radius and no vertical margin
  (`.mode-continuous .book-page`), so consecutive regions run into each other
  with only their own paragraph spacing between them;
* the reading column keeps its 210 mm layout width, so fixed-geometry tables,
  SVG compositions and figures still render at the size they were
  reconstructed for - nothing is squeezed or reflowed;
* the 1,899 regions keep their ids, so every Contents link still lands on its
  exact heading;
* a restrained hairline is drawn **only where a verified module or unit really
  begins** (42 module/unit heading anchors and 9 of the 10 group anchors are
  tagged `data-section-start="1"`), so sections are legible without inventing
  page breaks.

## What a module contains

Module 1.1 is one uninterrupted run from its heading to its case study:

```
Module 1.1 What Is a Business?      (book-heading-0009)
  Businesses Meet Needs ...
  Customers and Consumers
  The Problem-Solution Fit
  Businesses Create Value
  Module 1.1 Review
  Practice Your AP® Skills Questions
  CASE STUDY: Imperfect Foods
Module 1.2 Markets and Competitive Advantage   <- next divider
```

The same rule applies to every module, unit introduction, unit review, case
study, frontmatter section, appendix, references and glossary block.

## Page labels

The internal source ids (`TMP-nnnn`) are still present for reconstruction
auditing but are never shown as printed page numbers, and no printed page
number was invented. See `KNOWN_ISSUES.md` for why the sidebar's printed
page-reference column is empty and how to fill it.

## Verification

* 42 / 42 module and unit anchors tagged, 9 / 9 group anchors tagged.
* 1,899 articles present in order, 0 duplicate ids, 0 broken links.
* computed style in the browser: `main` background `rgb(255,255,255)`,
  `.book-page` `box-shadow: none`, `margin-bottom: 0px`, transparent
  background.
* `book2QA()` 0 layout failures at 1400x1000, 1024x900 and 390x844.
