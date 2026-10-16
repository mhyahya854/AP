// For every Contents row that carries no destination, look for a verified
// heading anchor whose own text matches the row's wording.  Read-only.
//   node heading_match.mjs <file-url> <out.json>
import { writeFileSync } from 'node:fs';
import { attach, evaluate, goto, wait } from './cdp.mjs';

const url = process.argv[2];
const outFile = process.argv[3];
const cdp = await attach('9361');
await goto(cdp, url, 4000);
await wait(500);

const result = await evaluate(cdp, `(() => {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const heads = [];
  document.querySelectorAll('[id^="book-heading-"]').forEach((el) => {
    heads.push({ id: el.id, text: norm(el.textContent), region: (el.closest('.book-page') || {}).id || null });
  });
  const byText = {};
  heads.forEach((h) => { (byText[h.text] = byText[h.text] || []).push(h); });
  const rows = [];
  document.querySelectorAll('#contents-nav .nav-child').forEach((el) => {
    if (el.tagName === 'A') return;
    const label = norm(el.textContent);
    const hit = byText[label] || [];
    rows.push({ label: el.textContent.replace(/\\s+/g, ' ').trim(), norm: label,
                matches: hit.map((h) => h.id + '@' + h.region) });
  });
  // also worth knowing: labels that are a prefix of exactly one heading
  const near = rows.filter((r) => !r.matches.length).map((r) => {
    const cands = heads.filter((h) => h.text.indexOf(r.norm) >= 0);
    return { label: r.label, candidates: cands.slice(0, 4).map((h) => h.id + '@' + h.region + ' :: ' + h.text.slice(0, 60)) };
  });
  return { rows, near, heads: heads.length };
})()`);
writeFileSync(outFile, JSON.stringify(result, null, 1));
const exact = result.rows.filter((r) => r.matches.length === 1);
const multi = result.rows.filter((r) => r.matches.length > 1);
console.log('unlinked rows:', result.rows.length, 'verified headings:', result.heads);
console.log('exact unique matches:', exact.length);
console.log(JSON.stringify(exact, null, 1));
console.log('ambiguous:', multi.length, JSON.stringify(multi.map((m) => m.label + ' -> ' + m.matches.join(',')), null, 1));
cdp.close();
