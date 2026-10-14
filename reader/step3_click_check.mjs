// Step 3: an independent, hand-driven click check of the published artifact.
//
// The wave's own acceptance probe produced the 433-landing matrix.  This script
// is a second, deliberately separate pass: it launches nothing, it drives a
// running CDP Chrome, it clicks a handful of rail rows itself and it measures
// the toolbar, the reading container and the target from the DOM - without
// using the wave's probe helpers.  Its gate refuses to measure unless the page
// really is the artifact (1,899 `.book-page` regions and the navigation layer
// present), so a half-loaded page cannot produce a passing row.
//
//   node reader/step3_click_check.mjs [port] [fileUrl]
//
// Writes reports/contents_navigation/independent_click_check.json.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const port = process.argv[2] || '9355';
const fileUrl = process.argv[3]
  || 'file:///C:/Users/mhyah/Downloads/book-source/Word/_master_work/repo/AP/AP%20Book%20Final.html';
const OUT = resolve(process.cwd(), 'reports/contents_navigation/independent_click_check.json');
const ENDPOINT = `http://127.0.0.1:${port}`;
const EXPECT_REGIONS = 1899;

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.events = []; }
  connect() {
    return new Promise((ok, bad) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => ok();
      this.ws.onerror = () => bad(new Error('cdp websocket failed'));
      this.ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.id !== undefined) {
          const p = this.pending.get(m.id);
          if (p) {
            this.pending.delete(m.id);
            m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
          }
        } else { this.events.push(m); }
      };
    });
  }
  send(method, params = {}, timeoutMs = 600000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error('timeout ' + method)); }, timeoutMs);
      this.pending.set(id, { res: (r) => { clearTimeout(t); res(r); }, rej: (e) => { clearTimeout(t); rej(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

const list = await (await fetch(`${ENDPOINT}/json/list`)).json();
const page = list.filter((t) => t.type === 'page')[0];
if (!page) { console.error('no page target on', ENDPOINT); process.exit(2); }
const cdp = new CDP(page.webSocketDebuggerUrl);
await cdp.connect();
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Log.enable');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PRELUDE = "const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();";

async function evalJson(expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, 600000);
  if (r.exceptionDetails) { throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 400)); }
  return r.result.value;
}

// Strict gate: only the real artifact counts as loaded.
async function gate(label, budgetMs = 420000) {
  const deadline = Date.now() + budgetMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await evalJson(`(() => { ${PRELUDE}
      return {
        rs: document.readyState,
        regions: document.querySelectorAll('.book-page').length,
        nav: !!window.book2Navigation,
        sem: !!window.book2Semantics,
        rows: document.querySelectorAll('#contents-nav .nav-child').length,
      }; })()`);
    if (last.rs === 'complete' && last.regions === EXPECT_REGIONS && last.nav && last.sem && last.rows >= 500) {
      return last;
    }
    await wait(2000);
  }
  throw new Error(`${label}: artifact never became ready: ${JSON.stringify(last)}`);
}

async function load(url, label) {
  await cdp.send('Page.navigate', { url });
  await wait(1500);
  return gate(label);
}

// Everything a landing row needs, measured here and nowhere else.
const MEASURE = `(() => { ${PRELUDE}
  const main = document.querySelector('main');
  const toolbar = document.querySelector('main > .toolbar');
  const mRect = main.getBoundingClientRect();
  const tRect = toolbar ? toolbar.getBoundingClientRect() : null;
  const id = location.hash ? location.hash.slice(1) : '';
  let el = null;
  try { el = id ? document.getElementById(decodeURIComponent(id)) : null; } catch (e) { el = null; }
  const rect = el ? el.getBoundingClientRect() : null;
  const cur = document.querySelector('#contents-nav .nav-child[aria-current], #contents-nav .nav-child.is-current');
  const panel = document.querySelector('#contents-panel');
  const pRect = panel ? panel.getBoundingClientRect() : null;
  return {
    hash: location.hash,
    modeBadge: norm((document.querySelector('#mode-badge') || {}).textContent),
    counter: norm((document.querySelector('#counter') || {}).textContent),
    toolbarBottom: tRect ? Math.round(tRect.bottom) : null,
    mainTop: Math.round(mRect.top),
    mainBottom: Math.round(mRect.bottom),
    targetTag: el ? el.tagName : null,
    targetId: el ? el.id : null,
    targetTop: rect ? Math.round(rect.top) : null,
    targetBottom: rect ? Math.round(rect.bottom) : null,
    gapBelowToolbar: rect && tRect ? Math.round(rect.top - tRect.bottom) : null,
    belowToolbar: !!(rect && tRect && rect.top >= tRect.bottom - 1),
    inViewport: !!(rect && rect.top < mRect.bottom && rect.bottom > mRect.top),
    region: el && el.closest ? ((el.closest('.book-page') || {}).id || null) : null,
    active: cur ? { href: cur.getAttribute('href'), title: norm(cur.textContent).slice(0, 70) } : null,
    navOffset: getComputedStyle(document.documentElement).getPropertyValue('--b2-nav-offset').trim(),
    scrollTop: Math.round(main.scrollTop),
    drawer: { appLeftClosed: document.querySelector('.app').classList.contains('left-closed'),
              panelWidth: pRect ? Math.round(pRect.width) : null,
              panelLeft: pRect ? Math.round(pRect.left) : null },
  };
})()`;

const measure = () => evalJson(MEASURE);

const setMode = (mode) => evalJson(
  `(() => { const s = document.querySelector('#mode'); s.value = ${JSON.stringify(mode)};`
  + ' s.dispatchEvent(new Event("change", { bubbles: true })); return s.value; })()');

const railHrefs = (prefix) => evalJson(
  `[...document.querySelectorAll('#contents-nav a[href^="${prefix}"]')].map((a) => a.getAttribute('href'))`);

const clickHref = (href) => evalJson(
  `(() => { const a = document.querySelector('#contents-nav a[href=${JSON.stringify(href)}]');`
  + ' if (!a) return "missing"; const r = a.getBoundingClientRect(); a.click();'
  + ' return JSON.stringify({ clicked: true, wasVisible: r.width > 0 && r.height > 0,'
  + ' text: a.textContent.replace(/\\s+/g, " ").trim().slice(0, 70) }); })()');

async function clickAndSettle(href, settleMs = 2600) {
  const clicked = await clickHref(href);
  await wait(settleMs);              // let the reader's own scroll-sync settle
  return { clicked: JSON.parse(clicked), landing: await measure() };
}

const rows = [];
function record(name, expected, got, pass, note) {
  rows.push({ name, expected, measured: got, pass, note: note || null });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${note ? '  :: ' + note : ''}`);
}

const errors = () => cdp.events
  .filter((e) => e.method === 'Runtime.exceptionThrown'
    || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
  .map((e) => (e.method === 'Runtime.exceptionThrown'
    ? (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text)
    : JSON.stringify(e.params).slice(0, 300)));

const report = {
  schema: 'book2.step3.independent_click_check.v1',
  fileUrl,
  startedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------- desktop
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
report.gate = await load(fileUrl, 'first load');
report.toolbarAt = await measure();

// 1. a source-capture-begin row, deep in the book
{
  const href = '#TMP-0119';
  const { clicked, landing } = await clickAndSettle(href);
  const pass = clicked.clicked === true
    && landing.hash === href
    && landing.region === 'TMP-0119'
    && landing.belowToolbar === true
    && landing.active && landing.active.href === href
    && /Continuous/.test(landing.modeBadge);
  record('continuous/region-begin-row',
    { href, region: 'TMP-0119', belowToolbar: true, activeRow: href }, { clicked, landing }, pass);
}

// 2. the last linked heading row in the rail
{
  const hrefs = await railHrefs('#book-heading-');
  const href = hrefs[hrefs.length - 1];
  const { clicked, landing } = await clickAndSettle(href);
  const pass = landing.hash === href && landing.belowToolbar === true
    && landing.inViewport === true && landing.active && landing.active.href === href;
  record('continuous/last-linked-row',
    { href, belowToolbar: true, inViewport: true }, { clicked, landing, railRows: hrefs.length }, pass);
}

// 3. Section mode: a row that lives in another section must switch and land
{
  await setMode('section');
  await wait(600);
  const hrefs = await railHrefs('#book-heading-');
  const href = hrefs[120];
  const { clicked, landing } = await clickAndSettle(href);
  const pass = landing.hash === href && landing.belowToolbar === true
    && landing.inViewport === true && landing.active && landing.active.href === href
    && /Section/.test(landing.modeBadge) && /Section \d+ of 383/.test(landing.counter);
  record('section/cross-section-row',
    { href, modeKept: 'Section', belowToolbar: true, activeRow: href }, { clicked, landing }, pass,
    landing.counter);
}

// 4. Section mode, a second click in yet another section
{
  const hrefs = await railHrefs('#book-heading-');
  const href = hrefs[300];
  const { clicked, landing } = await clickAndSettle(href);
  const pass = landing.hash === href && landing.belowToolbar === true
    && landing.active && landing.active.href === href && /Section/.test(landing.modeBadge);
  record('section/second-cross-section-row',
    { href, belowToolbar: true, activeRow: href }, { clicked, landing }, pass, landing.counter);
}

// 5. Source capture mode
{
  await setMode('single');
  await wait(600);
  const hrefs = await railHrefs('#book-heading-');
  const href = hrefs[200];
  const { clicked, landing } = await clickAndSettle(href);
  const pass = landing.hash === href && landing.belowToolbar === true
    && /Source capture \d+ of 1899/.test(landing.counter)
    && landing.active && landing.active.href === href;
  record('source-capture/cross-capture-row',
    { href, counter: 'Source capture n of 1899', belowToolbar: true }, { clicked, landing }, pass,
    landing.counter);
}

// 6. mode round trip keeps the logical location
{
  const before = await measure();
  await setMode('continuous');
  await wait(1500);
  const after = await measure();
  const pass = after.hash === before.hash && after.inViewport === true && after.belowToolbar === true;
  record('mode-round-trip/source-capture-to-continuous',
    { hash: before.hash, inViewport: true }, { before, after }, pass);
}

// 7. Back / Forward
{
  const hrefs = await railHrefs('#book-heading-');
  const a = hrefs[40];
  const b = hrefs[280];
  await clickAndSettle(a, 1800);
  const atA = await measure();
  await clickAndSettle(b, 1800);
  const atB = await measure();
  await evalJson('history.back()');
  await wait(2500);
  const back = await measure();
  await evalJson('history.forward()');
  await wait(2500);
  const fwd = await measure();
  const pass = atA.hash === a && atB.hash === b
    && back.hash === a && back.belowToolbar === true
    && fwd.hash === b && fwd.belowToolbar === true;
  record('history/back-and-forward', { a, b }, { atA, atB, back, fwd }, pass);
}

// 8. clicking the same row twice
{
  const href = '#book-heading-0042';
  const first = await clickAndSettle(href, 1800);
  const second = await clickAndSettle(href, 1800);
  const pass = first.landing.hash === href && second.landing.hash === href
    && first.landing.belowToolbar === true && second.landing.belowToolbar === true
    && Math.abs(first.landing.scrollTop - second.landing.scrollTop) <= 2;
  record('repeat/same-row-twice', { href }, { first: first.landing, second: second.landing }, pass,
    `scrollTop ${first.landing.scrollTop} then ${second.landing.scrollTop}`);
}

// 9. a deep link on a fresh load
{
  await load(fileUrl + '#book-heading-0200', 'deep link');
  await wait(2000);
  const landing = await measure();
  const pass = landing.hash === '#book-heading-0200' && landing.belowToolbar === true
    && landing.inViewport === true;
  record('deeplink/load-with-hash', { hash: '#book-heading-0200', belowToolbar: true }, landing, pass,
    `${landing.counter} :: gap ${landing.gapBelowToolbar}`);
}

// ---------------------------------------------------------------- mobile
{
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await load(fileUrl, 'mobile reload');
  let opened = await measure();
  if (opened.drawer.appLeftClosed) {
    await evalJson('document.querySelector("#left-toggle").click()');
    await wait(800);
    opened = await measure();
  }
  const hrefs = await railHrefs('#book-heading-');
  const href = hrefs[150];
  const { clicked, landing } = await clickAndSettle(href, 3000);
  const pass = landing.hash === href && landing.belowToolbar === true
    && landing.drawer.appLeftClosed === true
    && landing.active && landing.active.href === href;
  record('mobile/drawer-closes-after-navigation',
    { href, drawerClosed: true, belowToolbar: true },
    { drawerAfterOpen: opened.drawer, afterClick: landing.drawer, clicked, landing }, pass,
    `gap ${landing.gapBelowToolbar}`);
}

await cdp.send('Emulation.clearDeviceMetricsOverride');

report.rows = rows;
report.landings = rows.length;
report.failures = rows.filter((r) => !r.pass).map((r) => r.name);
report.regionGate = `${EXPECT_REGIONS} regions required before any measurement`;
report.jsErrors = errors();
report.finishedAt = new Date().toISOString();

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(`\n${rows.length - report.failures.length}/${rows.length} rows passed; js errors: ${report.jsErrors.length}`);
console.log('written', OUT);
