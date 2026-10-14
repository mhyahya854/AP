// Final release QA: all 453 Contents links measured one by one in the real
// browser (Continuous mode), plus bounded image decode / in-view batches.
//
//   node reader/release_qa_nav.mjs [port] [fileUrl] [what]
//   what: nav | images | both
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const port = process.argv[2] || '9356';
const fileUrl = process.argv[3]
  || 'file:///C:/Users/mhyah/Downloads/book-source/Word/_master_work/repo/AP/AP%20Book%20Final.html';
const what = process.argv[4] || 'both';
const OUTDIR = resolve(process.cwd(), 'reports/final_release_qa');
mkdirSync(OUTDIR, { recursive: true });
const EXPECT_REGIONS = 1899;

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.events = []; }
  connect() {
    return new Promise((ok, bad) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => ok();
      this.ws.onerror = () => bad(new Error('cdp websocket failed'));
      this.ws.onmessage = (evt) => {
        let m; try { m = JSON.parse(evt.data); } catch { return; }
        if (m.id !== undefined) {
          const p = this.pending.get(m.id);
          if (p) { this.pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
        } else { this.events.push(m); }
      };
    });
  }
  send(method, params = {}, timeoutMs = 1800000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error('timeout ' + method)); }, timeoutMs);
      this.pending.set(id, { res: (r) => { clearTimeout(t); res(r); }, rej: (e) => { clearTimeout(t); rej(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
const target = list.filter((t) => t.type === 'page')[0];
if (!target) { console.error('no page target on', port); process.exit(2); }
const cdp = new CDP(target.webSocketDebuggerUrl);
await cdp.connect();
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function evq(expression, timeout) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true },
    timeout || 1800000);
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
  return r.result.value;
}
async function gate() {
  for (let i = 0; i < 240; i++) {
    const st = await evq("({rs:document.readyState,regions:document.querySelectorAll('.book-page').length,nav:!!window.book2Navigation})");
    if (st.rs === 'complete' && st.regions === EXPECT_REGIONS && st.nav) return st;
    await wait(2000);
  }
  throw new Error('artifact never ready');
}
function save(name, data) {
  writeFileSync(join(OUTDIR, name), JSON.stringify(data, null, 1));
  console.log('   wrote', name, JSON.stringify(data).length + ' bytes');
}

await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
const gateState = await gate();
console.log('gate', JSON.stringify(gateState));
const t0 = Date.now();

if (what === 'nav' || what === 'both') {
  console.log('scanning all Contents links in Continuous mode');
  const nav = await evq(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const modeSel = document.querySelector('#mode');
    modeSel.value = 'continuous';
    modeSel.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(700);
    const toolbar = document.querySelector('main > .toolbar');
    const main = document.querySelector('main');
    const links = [...document.querySelectorAll('#contents-nav a[href^="#"]')];
    const rows = [];
    let round = 0;
    for (const a of links) {
      const href = a.getAttribute('href');
      a.click();
      await sleep(80);
      const el = document.getElementById(href.slice(1));
      const rect = el ? el.getBoundingClientRect() : null;
      const tb = toolbar.getBoundingClientRect();
      const mr = main.getBoundingClientRect();
      const active = document.querySelector('#contents-nav .nav-child[aria-current], #contents-nav .nav-child.is-current');
      rows.push({
        href,
        kind: a.getAttribute('data-link-kind') || 'heading',
        isRegion: href.startsWith('#TMP-'),
        targetExists: !!el,
        targetTag: el ? el.tagName.toLowerCase() : null,
        region: el && el.closest && el.closest('.book-page') ? el.closest('.book-page').id : null,
        hash: location.hash,
        gap: rect ? Math.round(rect.top - tb.bottom) : null,
        belowToolbar: !!(rect && rect.top >= tb.bottom - 1),
        insideReadingColumn: !!(rect && rect.top >= mr.top - 1 && rect.left >= mr.left - 1),
        inViewport: !!(rect && rect.top < mr.bottom && rect.bottom > mr.top),
        active: active ? active.getAttribute('href') : null,
        counter: (document.querySelector('#counter') || {}).textContent,
      });
      round += 1;
      if (round % 150 === 0) await sleep(400);
    }
    await sleep(3000);
    const activeAfter = document.querySelector('#contents-nav .nav-child[aria-current], #contents-nav .nav-child.is-current');
    const hash = location.hash;
    const el = document.getElementById(hash.slice(1));
    const rect = el ? el.getBoundingClientRect() : null;
    const tb = toolbar.getBoundingClientRect();
    const mr = main.getBoundingClientRect();
    const settled = {
      hash: hash,
      gap: rect ? Math.round(rect.top - tb.bottom) : null,
      belowToolbar: !!(rect && rect.top >= tb.bottom - 1),
      inViewport: !!(rect && rect.top < mr.bottom && rect.bottom > mr.top),
      active: activeAfter ? activeAfter.getAttribute('href') : null,
    };
    const failures = rows.filter((r) => !r.targetExists || !r.belowToolbar || !r.inViewport
      || r.active !== r.href || r.hash !== r.href || !r.insideReadingColumn);
    const gapHistogram = {};
    rows.forEach((r) => {
      const key = r.gap === null ? 'null'
        : (r.gap < 0 ? 'negative' : (r.gap <= 20 ? '0-20' : (r.gap <= 100 ? '21-100' : 'over100')));
      gapHistogram[key] = (gapHistogram[key] || 0) + 1;
    });
    return {
      total: rows.length,
      regionLinks: rows.filter((r) => r.isRegion).length,
      headingLinks: rows.filter((r) => !r.isRegion).length,
      failureCount: failures.length,
      failures: failures.slice(0, 40),
      gapHistogram: gapHistogram,
      targetsExist: rows.filter((r) => r.targetExists).length,
      belowToolbar: rows.filter((r) => r.belowToolbar).length,
      inViewport: rows.filter((r) => r.inViewport).length,
      activeMatched: rows.filter((r) => r.active === r.href).length,
      hashMatched: rows.filter((r) => r.hash === r.href).length,
      distinctTargetRegions: new Set(rows.map((r) => r.region)).size,
      settled: settled,
      sample: rows.filter((r, i) => i % 37 === 0).slice(0, 14),
    };
  })()`, 1800000);
  save('navigation_audit.json', nav);
  console.log('nav summary: ' + JSON.stringify({
    total: nav.total, failures: nav.failureCount, gaps: nav.gapHistogram,
    below: nav.belowToolbar, active: nav.activeMatched, hash: nav.hashMatched, settled: nav.settled }));
  if (nav.failures.length) console.log('failure sample: ' + JSON.stringify(nav.failures.slice(0, 5)));
}

if (what === 'images' || what === 'both') {
  console.log('image decode + in-view batches');
  const decode = await evq(`(async () => {
    const imgs = [...document.querySelectorAll('.book-page img')];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const seen = new Map();
    let ok = 0;
    const bad = [];
    for (let i = 0; i < imgs.length; i++) {
      const src = imgs[i].getAttribute('src');
      if (!seen.has(src)) {
        const probe = new Image();
        probe.src = src;
        try {
          await probe.decode();
          seen.set(src, { w: probe.naturalWidth, h: probe.naturalHeight });
        } catch (e) {
          seen.set(src, { error: String(e).slice(0, 60) });
        }
        probe.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
      }
      const info = seen.get(src);
      if (info && info.w > 0) ok += 1;
      else bad.push({ region: imgs[i].closest('.book-page').id, info: info });
      if (i % 25 === 24) await sleep(150);
    }
    return { images: imgs.length, distinctPayloads: seen.size, decodedOk: ok, bad: bad.slice(0, 10) };
  })()`, 1800000);
  const inView = await evq(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const imgs = [...document.querySelectorAll('.book-page img')];
    const rows = [];
    for (let i = 0; i < 12; i++) {
      const img = imgs[Math.floor(i * (imgs.length - 1) / 11)];
      img.scrollIntoView({ block: 'center' });
      await sleep(450);
      const r = img.getBoundingClientRect();
      const nat = img.naturalHeight ? img.naturalWidth / img.naturalHeight : null;
      const rendered = r.height ? r.width / r.height : null;
      rows.push({
        region: img.closest('.book-page').id,
        complete: img.complete,
        natural: [img.naturalWidth, img.naturalHeight],
        rendered: [Math.round(r.width), Math.round(r.height)],
        distortion: nat && rendered ? Number((Math.abs(nat - rendered) / nat).toFixed(4)) : null,
        visible: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight,
      });
    }
    return rows;
  })()`, 900000);
  save('image_render_audit.json', { decode: decode, inView: inView });
  console.log('images: ' + JSON.stringify({
    images: decode.images, payloads: decode.distinctPayloads, ok: decode.decodedOk, bad: decode.bad.length,
    inView: inView.map((r) => [r.region, r.visible, r.distortion]) }));
}

if (what === 'recheck') {
  const prior = JSON.parse(readFileSync(join(OUTDIR, 'navigation_audit.json'), 'utf8'));
  const hrefs = [...new Set(prior.failures.map((f) => f.href))];
  console.log('rechecking ' + hrefs.length + ' rows with a 2.5 s settle each');
  const recheck = await evq(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const modeSel = document.querySelector('#mode');
    modeSel.value = 'continuous';
    modeSel.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(700);
    const toolbar = document.querySelector('main > .toolbar');
    const main = document.querySelector('main');
    const hrefs = ${JSON.stringify(hrefs)};
    const rows = [];
    for (const href of hrefs) {
      const a = document.querySelector('#contents-nav a[href="' + href + '"]');
      if (!a) { rows.push({ href: href, missing: true }); continue; }
      a.click();
      await sleep(2500);
      const el = document.getElementById(href.slice(1));
      const rect = el ? el.getBoundingClientRect() : null;
      const tb = toolbar.getBoundingClientRect();
      const mr = main.getBoundingClientRect();
      const active = document.querySelector('#contents-nav .nav-child[aria-current], #contents-nav .nav-child.is-current');
      rows.push({
        href: href,
        inSummary: !!a.closest('summary'),
        groupHeader: a.classList.contains('nav-module-link') || !!a.closest('details.nav-group > summary'),
        targetExists: !!el,
        region: el && el.closest && el.closest('.book-page') ? el.closest('.book-page').id : null,
        hash: location.hash,
        gap: rect ? Math.round(rect.top - tb.bottom) : null,
        belowToolbar: !!(rect && rect.top >= tb.bottom - 1),
        inViewport: !!(rect && rect.top < mr.bottom && rect.bottom > mr.top),
        active: active ? active.getAttribute('href') : null,
        activeIsGroupHeader: active ? active.classList.contains('nav-module-link') || !!active.closest('details.nav-group > summary') : null,
      });
    }
    return rows;
  })()`, 900000);
  save('navigation_recheck.json', { schema: 'book2.release.nav_recheck.v1', settleMs: 2500, rows: recheck });
  const stillBad = recheck.filter((r) => r.missing || !r.targetExists || !r.belowToolbar || !r.inViewport
    || r.hash !== r.href || (r.active !== r.href && !r.activeIsGroupHeader));
  console.log('recheck bad rows: ' + stillBad.length + ' ' + JSON.stringify(stillBad.slice(0, 6)));
}

const errors = cdp.events
  .filter((e) => e.method === 'Runtime.exceptionThrown'
    || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
  .map((e) => (e.method === 'Runtime.exceptionThrown'
    ? (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description
      || e.params.exceptionDetails.text)
    : JSON.stringify(e.params).slice(0, 200)));
console.log('js errors: ' + errors.length + ' ' + JSON.stringify(errors.slice(0, 3)));
console.log('elapsed s: ' + Math.round((Date.now() - t0) / 1000));
