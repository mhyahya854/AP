// Structural before/after comparison of the accepted fixture and the step-2
// fixture, measured in the same browser: counts, ids, and per-region text.
import { writeFileSync } from 'node:fs';

const ENDPOINT = `http://127.0.0.1:${process.argv[2] || 9341}`;
const files = process.argv.slice(3);
const list = await (await fetch(`${ENDPOINT}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const send = (method, params = {}) => new Promise((res, rej) => {
  const myId = ++id;
  const t = setTimeout(() => rej(new Error('timeout ' + method)), 900000);
  const onMsg = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id === myId) { ws.removeEventListener('message', onMsg); clearTimeout(t); res(m); }
  };
  ws.addEventListener('message', onMsg);
  ws.send(JSON.stringify({ id: myId, method, params }));
});
await send('Runtime.enable');
await send('Page.enable');
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const COUNTS = `(() => {
  const pages = [...document.querySelectorAll('.book-page')];
  const links = [...document.querySelectorAll('a[href^="#"]')];
  const numbered = [...document.querySelectorAll('.nav-page')].filter((s) => (s.textContent || '').trim().length > 0);
  const disclosures = [...document.querySelectorAll('.book-page details.disclosure')];
  return {
    regions: pages.length, firstRegion: pages[0] && pages[0].id, lastRegion: pages[pages.length - 1] && pages[pages.length - 1].id,
    navRows: document.querySelectorAll('[data-source-contents-id]').length,
    numberedEntries: numbered.length, printedLabels: numbered.map((s) => s.textContent.trim()),
    navGroups: document.querySelectorAll('#contents-nav details.nav-group').length,
    navModules: document.querySelectorAll('#contents-nav details.nav-module').length,
    disclosures: disclosures.length,
    descLabels: document.querySelectorAll('.b2-desc-label').length,
    lgBadges: document.querySelectorAll('.lg-badge').length,
    imgs: document.querySelectorAll('img').length,
    tables: document.querySelectorAll('table').length,
    headings: document.querySelectorAll('[id^="book-heading-"]').length,
    links: links.length,
    brokenLinks: links.filter((a) => { const h = a.getAttribute('href').slice(1); return h && !document.getElementById(decodeURIComponent(h)); }).length,
    duplicateIds: (() => { const seen = new Set(); let d = 0; for (const e of document.querySelectorAll('[id]')) { if (seen.has(e.id)) d++; else seen.add(e.id); } return d; })(),
    regionsDigest: pages.reduce((s, p) => s + p.id + ':' + p.innerHTML.length + ',', ''),
    imageDigest: [...document.querySelectorAll('img')].reduce((s, i) => s + i.getAttribute('src').length + ':' + i.getAttribute('src').slice(0, 60) + '|', ''),
  };
})()`;

const out = {};
for (const file of files) {
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(400);
  await send('Page.navigate', { url: file });
  const started = Date.now();
  for (;;) {
    const rs = await evalJs('document.readyState');
    const n = await evalJs('document.querySelectorAll(".book-page").length');
    if (rs === 'complete' && n > 0) break;
    if (Date.now() - started > 300000) throw new Error('timeout loading ' + file);
    await sleep(700);
  }
  await sleep(1200);
  out[file] = await evalJs(COUNTS);
}
const keys = Object.keys(out);
const a = out[keys[0]], b = out[keys[1]];
const diffs = {};
for (const k of Object.keys(a)) {
  if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
    diffs[k] = { before: typeof a[k] === 'string' ? a[k].slice(0, 200) + '…' : a[k], after: typeof b[k] === 'string' ? b[k].slice(0, 200) + '…' : b[k] };
  }
}
console.log(JSON.stringify({ files: keys, before: { regions: a.regions, navRows: a.navRows, numberedEntries: a.numberedEntries, lgBadges: a.lgBadges, imgs: a.imgs, tables: a.tables, disclosures: a.disclosures }, after: { regions: b.regions, navRows: b.navRows, numberedEntries: b.numberedEntries, lgBadges: b.lgBadges, imgs: b.imgs, tables: b.tables, disclosures: b.disclosures }, identical: { regionsDigest: a.regionsDigest === b.regionsDigest, imageDigest: a.imageDigest === b.imageDigest }, differing_keys: Object.keys(diffs), diffs }, null, 1));
writeFileSync('_master_work/step2/fixture_compare.json', JSON.stringify({ out, diff_keys: Object.keys(diffs) }, null, 1));
process.exit(0);
