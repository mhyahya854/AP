# Contents mapping report

## Source of the list

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
| Print labels assigned | 9 (only the labels the user actually supplied) |
| Front-matter cells assigned | 3 (`Accessibility` A1, `Brief Contents` iii, `Contents` iv) |
| Entries remaining uncertain | 493 |

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

## Printed page labels - what is shown, and what is still missing

The printed Contents pages **in the supplied source carry no page numbers at
all** (verified by eye on `B2P1-0016.png` and `B2P1-0017.png` at full
resolution; the OCR record for `B2P1-0016.png` holds the entry text only).
The page-number authority is therefore the **user-supplied numbered Contents
list**, and only the rows quoted in the brief could be filled:

| Sidebar row | Printed label |
|---|---|
| Module 1.1 What Is a Business? | 4 |
| Businesses Create Value | 6 |
| Module 1.1 Review | 9 |
| Module 1.2 Markets and Competitive Advantage | 11 |
| Unit 2 Marketing | 104 |
| Unit 3/Part 1 Personal Saving and Borrowing | 202 |
| Unit 4 Management and Strategy | 328 |
| Unit 5 Personal Goals, Budgeting, and Investing | 386 |
| Index | 456 |
| Accessibility (front matter) | A1 |
| Brief Contents (front matter) | iii |
| Contents (front matter) | iv |

Nothing was inferred: not from the TMP names, the capture order, the region
numbers, the Word pagination, the neighbouring headings, the next or previous
entry, or any counter. Every other row keeps an **empty** reference cell and is
listed, with its exact text and hierarchy, in
`reports/contents_printed_page_match_report.json` (493 rows under
`uncertain`). The list entry `About this Book (FC)` has no sidebar row in this
build, so it is reported rather than invented.

**Showing a printed label is not a navigation change.** The 376 linked rows
keep exactly the targets they had; the 126 held rows keep no destination; the
Index row stays visible and unlinked because no Index body exists. No
destination was invented to make a label look linked.

To fill more labels, drop the real list into `reader/printed_page_references.json`:

```json
{ "references": { "TMP-0016:4": "4", "TMP-0017:12": "11" } }
```

where each key is a `source_id` from the manifest, and re-run
`corrective_wave/patch_corrective_wave.py` (or `reader/patch_reader_ui.py`,
which reads the same file). No re-extraction is needed.
