# AP Business with Personal Finance — v4.1 verification record

Status: candidate verified and ready for guarded promotion; historical audit remains OPEN.

## Baseline

- Repository: `C:\Users\mhyah\Downloads\book-source\Word\_master_work\repo\AP`
- Branch: `main`
- Baseline commit: `d5c317efe8c6fdbb97d617c3a58e0a72dea744ba`
- Baseline file: `AP Book Final.html`
- Baseline bytes: `1,132,308,257`
- Baseline SHA-256: `9ffd6bb53c1e68b17d766519c2dc65cb61f4eafccadd2e0cb4b52e732cfbc64c`

## Final candidate

- Candidate: `C:\Users\mhyah\Downloads\book-source\Word\_master_work\repair_v41\candidate\AP Book Final (v4.1 candidate).html`
- Candidate bytes: `1,132,549,711`
- Candidate SHA-256: `5b0d8bbe09e21a84c96057cf1795778f4990ee21ec6644cbf9f449bb7a1a69b9`
- Numeric TMP regions: 1,899 in original order
- Final content region: `INDEX`
- Total book-page regions: 1,900
- Disclosures: 155
- Disclosures statically open: 0
- LG badges: 151
- Image elements inside book regions: 409; all source identities unchanged
- Static embedded PNG data URIs: 423
- `<img>` tags in full artifact: 418
- Sideways-LR credit declarations: 182
- Tables: 1479
- Unique IDs: 2368; duplicate IDs: 0
- Broken fragment targets: 0

## Conservation audit

PASS. The independent candidate audit found zero unexpected and zero missing baseline text-token kinds after subtracting the authorized end-matter additions. Link targets/text and image source hashes are unchanged. The changed regions were separately fingerprint-checked before and after every node move.

## Authorized end matter

### Glossary

- Raw lines: 667
- Raw SHA-256: `408f59e24dd02ef9a071b8efaf7c3bee287e1ecc4d89a466fcf684a7e8eba298`
- Four-field records: 164
- Lowercase dividers: 11
- Lexical field order and values: PASS

### Index

- Raw lines: 2113
- Raw SHA-256: `a78344cb149dc6df7fe9b58b06224dac60c2e005596c7236e2f08f57db33e0ca`
- Nonblank rendered source lines: 2110
- First data line: `37 signals, 360–361`
- Last line: `Zwillinger, Joey, 36`
- Exact rendered sequence: PASS
- Final order: Appendix → Glossary → Index

## Appendix / Figure 5.1-1

- Sales-tax description records: 51 (50 states plus District of Columbia)
- Leaked sales-tax text while collapsed: 0
- Appendix banner: one pale-green group containing both title lines
- Numbered business-model components: 9
- Mapping bullets: 4
- Uber and BMW disclosure leakage: PASS
- Continuous phrases `digital map technology`, `perspective and learn new approaches`, `for the life of the car`, and `captures and delivers value`: PASS

## Formula / layout checks

- Gross, operating, and net-profit-margin fractions: PASS
- Percentage-change numerator/denominator and `x 100` placement: PASS
- Formula DOM count: seven fraction blocks
- No horizontal overflow in tested viewports
- Household net-worth table 3.7-2: UNVERIFIED because the selected source nodes omit the `Home` row label

## Runtime matrix

PASS on the bounded candidate fixture:

- 1440×1000 light
- 1024×900 light
- 768×1024 dark
- 390×844 light
- 320×720 light
- 140% text size
- Mobile contents drawer
- Search: 12 fixture matches
- Uber disclosure closed and open
- Zero document/main horizontal overflow in every spec

Full-book smoke on the actual 1.13 GB candidate: PASS

- `document.readyState = complete`
- mode: continuous
- 1,900 book regions
- 155 disclosures, 0 open
- 151 LG badges
- last region `INDEX`
- sidebar Index link present
- no horizontal overflow

## Unresolved / UNVERIFIED

1. Table 3.7-2 household net-worth rows remain in their current form because the `Home` row label is absent from the selected source nodes.
2. Historical issue descriptions 009–072 and 073–081 were not present in the local master register; their status remains UNVERIFIED.
3. The global audit remains OPEN. Only named, tested components are marked PASS.
4. No original comparison screenshots were supplied, so no pixel-parity claim is made.
5. AMC+, consumer-affairs, Dollar Shave Club, and other historical media-specific cases were not individually rebuilt or pixel-certified in this wave.

## Release state

Promoted on 2026-10-18 to both `AP Book Final.html` mirrors after staged hash verification. Four baseline backups have SHA-256 `9ffd6bb53c1e68b17d766519c2dc65cb61f4eafccadd2e0cb4b52e732cfbc64c`; the promoted artifact SHA-256 is `5b0d8bbe09e21a84c96057cf1795778f4990ee21ec6644cbf9f449bb7a1a69b9`. The complete issue register is projected separately in `ISSUE_STATUS_001_262.csv` and remains append-only.
