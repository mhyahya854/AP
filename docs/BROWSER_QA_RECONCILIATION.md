# Browser QA reconciliation

The previous repository carried two machine-readable browser reports that
disagreed with the written summary:

* `reports/browser_qa.json` recorded an `Uncaught` JavaScript exception;
* `reports/browser_qa_controls.json` recorded `"exceptions": ["Uncaught"]` and
  one `visible-content-outside-section` finding for the cover region
  `TMP-0001` (a `TABLE`);

while `docs/VALIDATION_SUMMARY.md` reported no exceptions and no layout
failures. This note records what each of the three really is. Nothing was
suppressed or deleted - the raw reports are still in `reports/`.

## 1. `reports/browser_qa.json` - stale fixture exception

The `exceptions[0]` entry names its own file:

```
TypeError: Cannot read properties of null (reading 'closest')
    at file:///C:/Users/mhyah/Downloads/book-source/Word/_master_work/wave/fixture_wave.html:524:192
```

The URL is `_master_work/wave/fixture_wave.html` - the small harness fixture
used to develop the disclosure control, not the book. That same file contains
the `visible-content-outside-section` string this report family emits. The
finding also fails for the wrong reason: the fixture's own script hit a null
node before the page check could run.

**Verdict: stale fixture error.** It describes a development fixture, not the
finished book, and the finished book was never re-checked in that run.

## 2. `reports/browser_qa_controls.json` - unsubstantiated string, and a cover finding that is not reproducible

`"exceptions": ["Uncaught"]` is a bare string with no message, stack, URL or
line - the harness that wrote this file collapsed an exception notification to
its first word. There is no evidence attached to it, so it cannot be traced to
the book. The same report's own data contradicts it: `consoleErrors` is empty
and the document loaded 1,899 regions, 502 Contents rows, 1,899 `.book-page`
elements and 383 headings.

The `structureQA` finding (`TMP-0001`, `TABLE`) was re-tested directly. The
cover region was measured in the finished file with the contents rail open and
with it closed, plus at three viewports:

| Condition | Document overflow | `book2QA()` failures | Cover escapes its section |
|---|---|---|---|
| Desktop 1400x1000, rail open | 0 px | 0 | no (`escapes: []`) |
| Desktop 1400x1000, rail closed | 0 px | 0 | no (`escapes: []`) |
| Mobile 390x844 | 0 px | 0 | no |
| Wide 1920x1200 | 0 px | 0 | no |

The cover tables measure 682-688 px inside a 688 px content box inside a
787-794 px section - fully inside, at both rail states. The same probe run
against the previous commit (`e38a07ca`, the last verified build) gives the
same result: zero failures with the rail open and with the rail closed.

**Verdict: incorrect test-harness report, not a reproducible layout bug.**
The finding does not reproduce on the artifact it claims to describe, at any
state or viewport tested. It is retained as raw evidence and marked stale
rather than deleted.

## 3. The written summary was right, and is now checkable

A fresh instrumented run over `file://` in headless Chrome 155 (the same
engine the earlier wave used) against the corrected final
(`corrective_wave/browser_qa_corrected.json`), repeated after the
printed-contents wave on the current artifact `f606cdc8...`
(`contents_wave/browser_qa_contents.json`), reports:

| Measure | Result |
|---|---|
| `Runtime.exceptionThrown` | **0** |
| console errors | **0** |
| log errors | **0** |
| `book2QA()` failures, desktop / mobile / wide | **0 / 0 / 0** |
| document or `main` horizontal overflow | **0 px** at every viewport |
| regions loading | 1,899 of 1,899 |
| details / disclosures / labels | 173 / 131 / 131 (0 empty labels) |
| Contents rows linked / held | 376 / 126 |
| duplicate element ids | 0 |
| broken in-document links | 0 of 393 |
| printed-page reference cells rendered | **493** (12 at the time of the corrective wave) |
| Contents navigation | `#book-heading-0010`, one `aria-current` row, lands below the toolbar |
| search | `Match in Contents` |
| disclosure keyboard operation | summary focusable, expands and collapses |

The raw machine output now matches the written summary: the two stale reports
are identified as stale, and the current evidence is the run above.

## 4. What this does and does not prove

It proves that the finished file loads cleanly, lays out without overflow at
three viewports, keeps every disclosure and Contents row, and preserves all
1,899 region texts (that last point is the separate region-text fingerprint
comparison). It does **not** prove pixel-level equality with the printed book
for the source ranges that were never supplied, and it does not open all 131
disclosures by hand - see `KNOWN_ISSUES.md`.
