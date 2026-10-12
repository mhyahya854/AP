# Contents mapping report

Waves: `printed-contents-2026-10-12` (every supplied printed label) and
`supplied-entries-2026-10-12` (the seven entries that had no row, the six
top-level unit labels, one lost-space navigation label, supplied ordering).

## Printed page labels (waves `printed-contents-2026-10-12`, `supplied-entries-2026-10-12`)

The page numbers shown in the reader are the printed labels of the
**user-supplied numbered Contents list, verbatim**: 500 numbered entries
followed by two reader UI controls (`Open/Close Margin`, `Bookmark page`) that
are deliberately *not* treated as Contents rows.

| Measure | Value |
|---|---|
| Numbered entries supplied | 500 |
| Reader UI controls excluded | 2 |
| Reader manifest rows | 502 |
| Manifest rows that received a label | **486** |
| Manifest rows with no entry in the supplied list | **16** (empty cell, listed below) |
| Numbered entries with no manifest row | **14** |
| ... of those, attached to an existing non-manifest sidebar row | 7 |
| ... of those, rendered as a new sidebar row by this wave | 7 |
| Page cells rendered in the sidebar | **506** |
| Numbered entries represented in the sidebar | **500 of 500** |
| Label mismatches after rendering | **0** |
| Distinct printed labels | 321 |

Every label is a string, exactly as supplied: `FC`, `A1`, `i`, `ii`, `iii`,
`iv`, `x`, `xii`, `xiii`, `xiv`, `103A`, `201A`, `327A`, `327B`, `385A`,
`429A`, `G-1`, `EP-1`, `BC`. None is converted to an integer.

Reconciliation evidence: `reports/printed_contents_reconciliation.json`
(every paired and unpaired entry, with the normalization applied and the
parent group/module) and `reports/printed_contents_qa.json` (the rendered
sidebar, the 1,899-region preservation proof and the browser run).

### How the two lists were matched

The supplied list and the manifest are **not** index-aligned, and matching was
never done on title alone. The two lists were aligned in original order with a
sequence alignment over normalized titles, and a pair was accepted only when
the normalized titles were equal. Four normalizations were needed, each
recorded per row in the ledger:

| Normalization | Example | Rows |
|---|---|---|
| `Case Study X` ↔ `CASE STUDY: X` | `Case Study Imperfect Foods` = `CASE STUDY: Imperfect Foods` | 31 |
| `Practice Your AP® Skills` ↔ `... Skills Questions` | short/long form of the same row | 31 |
| `Unit N AP® Exam Practice Questions` ↔ `AP® Exam Practice Questions` | the unit prefix is dropped in the source text | 5 |
| singular/plural, spaces, slashes, colons | `Unit 1 Business, ...` = `Unit 1 Businesses, ...`; `Unit 3 Part 1 ...` = `Unit 3/Part 1 ...`; `Appendix: The Business Model Canvas` = `Appendix The Business Model Canvas` | 4 |

Repeated titles (`Practice Your AP® Skills`, `Case Study ...`, `Module N.N
Practice`, `Terms to Know`) were only accepted when they fell at the same
position in the ordered alignment inside the same parent module, which is how
each of the 31 `Practice Your AP® Skills` / `Practice Your AP® Skills
Questions` rows keeps the printed label of its own module.

### 16 manifest rows keep an empty cell

These rows exist in the printed Contents and in the reader, but the supplied
numbered list has no entry for them, so no label was invented:

`TMP-0016:3` Case Study Cotopaxi · `TMP-0022:14` Case Study Intuit ·
`TMP-0029:4` Introduction: Personal Finance · `TMP-0031:5` Case Study Solana
Street Food · `TMP-0036:12` Case Study AMD · `TMP-0040:11` Introduction:
Not-So-Easy Come, Easy Go · and the ten `AP® Skills Workshop ...` /
`Business Canvas Project Application` rows that follow each unit review
(`TMP-0022:11-12`, `TMP-0029:1-2`, `TMP-0036:9-10`, `TMP-0040:8-9`,
`TMP-0043:17-18`).

### The 7 supplied entries that had no sidebar row (fixed in this wave)

`About this Book` (FC), `Cover Page` (FC), `Title Page` (i),
`Copyright Page` (ii), `Get the most out of your textbook's . . .` (xiv),
`FEP` (EP-1) and `Back Cover` (BC) had no row in the 502-row manifest. The
`supplied-entries-2026-10-12` wave renders all seven as **new sidebar rows**, in
the supplied order, with the exact supplied title and printed label:

| # | Entry | Label | Destination |
|---|---|---|---|
| 1 | About this Book | FC | none - the supplied source has no body for it, so the row is visible and **unlinked** |
| 2 | Cover Page | FC | `#TMP-0001`, the front-cover region (verified) |
| 4 | Title Page | i | none - no body in the supplied source |
| 5 | Copyright Page | ii | none - no body in the supplied source |
| 11 | Get the most out of your textbook’s . . . | xiv | `#TMP-0056`, the region whose first element is that heading (verified) |
| 499 | FEP | EP-1 | none - no body in the supplied source |
| 500 | Back Cover | BC | none - no body in the supplied source |

An entry is linked only when its source-backed destination was verified; the
other five stay visible and unlinked rather than being pointed at a guess. The
other 7 unpaired entries (`Accessibility` A1, `Brief Contents` iii, `Contents`
iv, `About the Authors` x, `Content Advisory Board` xii, `Business with
Personal Finance` xiii, `Glossary` G-1) already had sidebar rows and carry their
labels.

The seven new rows are placed in the supplied order, which re-orders the front
and back matter rows: front matter is now `About this Book` → `Cover Page` →
`Accessibility` → `Title Page` → `Copyright Page` → `Brief Contents` →
`Contents` → `About the Authors` → `Content Advisory Board` → `Business with
Personal Finance` → `Get the most out of your textbook's . . .`, and the end
matter is `Appendix` → `References` → `Glossary` → `Glossary/Glosario` →
`Index` → `FEP` → `Back Cover`. All rows keep their links and labels; only the
display order changed.

### The six top-level unit rows carry their printed label

The rail's unit rows are the collapsible group headers, and they previously
showed no page number - the label had landed only on the nested copy of the
same entry inside the group. Each group header now shows the supplied label
itself:

| Top-level row | Printed label |
|---|---|
| Unit 1 Businesses, Competition, and New Ideas | 2 |
| Unit 2 Marketing | 104 |
| Unit 3 / Part 1 Personal Saving and Borrowing | 202 |
| Unit 3 / Part 2 Business Finance and Accounting | 236 |
| Unit 4 Management and Strategy | 328 |
| Unit 5 Personal Goals, Budgeting, and Investing | 386 |

The unit's own Contents row inside the group is unchanged - it is one of the
502 manifest rows - so the header and that row describe the same supplied
entry; no extra Contents row was created. The wording differences the brief
allows (`Business` vs `Businesses`, `Unit 3 Part 1` vs `Unit 3 / Part 1`) are
the source's own; the supplied wording is never rewritten to match them.

### One navigation label had lost its spaces

The front-matter row for `Business with Personal Finance` was rendered as
`BUSINESSWITHPERSONALFINANCE`: the cover title is set as four lines
(`BUSINESS / WITH / PERSONAL / FINANCE`) and the label had been built by
concatenating them. The row now reads `Business with Personal Finance`, the
supplied title, which is a label repair - no source wording was changed.

### Navigation was not touched

No `href` was added, removed or re-pointed. The 126 held/Index rows stay
unlinked - a printed label is display-only and is not evidence of a
destination. `Index - 456` is shown on its unlinked row.

## Source of the Contents list

The Contents used by the reader is the **exact wording of the printed Contents
pages in the supplied source**, captured block by block with its original
indentation:

* `source_contents_navigation_manifest_v2.json` - 502 detailed entries, each
  carrying `source_tmp`, `source_png`, `source_block_path`,
  `exact_selected_contents_text`, `selected_contents_indent_twips`,
  `contents_kind`, `group_context`, `module_context` and its proposed target.
* `provisional_major_groups.json` - the 10 contiguous source-backed groups.

Both files are included under `reader/manifests/`.

## Counts

| Measure | Value |
|---|---|
| Contents entries displayed | 502 |
| Entries with a verified heading target (linked) | 376 |
| Entries held back (no verified destination) | 125 |
| Index row | 1 (kept visible, deliberately not linked - no Index body exists) |
| Top-level groups | 10 |
| Hierarchy depth levels | 1-4 |
| Entries missing or dropped | 0 |
| Print labels assigned | 506 cells (486 manifest rows + 7 pre-existing anchor rows + 7 new rows + 6 unit group headers) |
| Supplied entries represented | **500 of 500** |
| Entries remaining without a supplied label | 16 manifest rows (no entry in the list) |
| Sidebar rows in total | 516 (502 manifest rows + 7 pre-existing anchor rows + 7 new rows) |

## Hierarchy and navigation

* the 10 source-backed groups are collapsible, and the 31 module blocks are
  real collapsible `<details>` whose summary is the verified module link;
* each row carries `data-depth` 1-4 derived from the audited entry kinds, with
  matching indentation;
* repeated names such as "Practice Your AP® Skills Questions" resolve inside
  their own parent module, because every row links to a unique heading id
  (`#book-heading-nnnn`) rather than to a first match by name;
* the current section is highlighted and its group auto-expanded, and the rail
  scrolls independently.

## Why the source pages alone could not supply the numbers

The printed Contents pages **in the supplied source carry no page numbers at
all** (verified by eye on `B2P1-0016.png` and `B2P1-0017.png` at full
resolution; the OCR record for `B2P1-0016.png` holds the entry text only).
The page-number authority is therefore the user-supplied numbered Contents
list, and the reader takes its labels from `reader/printed_page_references.json`.

That file is generated from the supplied list by
`contents_wave/build_references.py` and applied to the book by
`contents_wave/patch_contents_labels.py`; the matching is done by
`contents_wave/align_contents.py` and the result is checked by
`contents_wave/verify_labels.py`. Re-running the two scripts re-derives the
whole mapping from the list with no re-extraction.
