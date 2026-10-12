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
| Print labels assigned | 0 |

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

## Printed page labels - the one gap

The printed Contents pages **in the supplied source carry no page numbers at
all** (verified by OCR and by eye; the entries are indented links only), and
the complete numbered Contents list referred to in the brief was not present
on disk when this wave ran. Rather than invent numbers, the right-aligned
reference cell is implemented, empty, and the sidebar states plainly that no
page references are shown.

To populate it, drop a file at `reader/printed_page_references.json`:

```json
{ "references": { "TMP-0016:4": "4", "TMP-0017:12": "11" } }
```

where each key is a `source_id` from the manifest, and re-run
`reader/patch_wave.py` (or `reader_ui/patch_reader_ui.py`, which already reads
that file). No re-extraction is needed.
