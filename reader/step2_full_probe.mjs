// Bounded validation of the promoted-size artifact: one Chrome, two loads,
// the toolbar geometry at two desktop widths, the appearance switch (with its
// real cost), the required component screenshots and the reading position.
//
//   node full_probe.mjs <fileUrl> <outDir> [--label full] [--port 9341]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const fileUrl = process.argv[2];
const outDir = process.argv[3];
const label = (() => { const i = process.argv.indexOf('--label'); return i >= 0 ? process.argv[i + 1] : 'full'; })();
const port = (() => { const i = process.argv.indexOf('--port'); return i >= 0 ? process.argv[i + 1] : '9341'; })();
const ENDPOINT = `http://127.0.0.1:${port}`;
mkdirSync(outDir, { recursive: true });

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.events = []; }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => res();
      this.ws.onerror = () => rej(new Error('ws error'));
      this.ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.id !== undefined) {
          const p = this.pending.get(m.id);
          if (p) { this.pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
        } else { this.events.push(m); }
      };
    });
  }
  send(method, params = {}, timeoutMs = 900000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error('timeout ' + method)); }, timeoutMs);
      this.pending.set(id, { res: (r) => { clearTimeout(t); res(r); }, rej: (e) => { clearTimeout(t); rej(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}
const list = await (await fetch(`${ENDPOINT}/json/list`)).json();
const page = list.find((t) => t.type === 'page') || list[0];
const cdp = new CDP(page.webSocketDebuggerUrl);
await cdp.connect();
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
await cdp.send('Page.enable');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = async (expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) { throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails)); }
  return r.result.value;
};
const shot = async (name) => {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const f = join(outDir, `${label}-${name}.png`);
  writeFileSync(f, Buffer.from(r.data, 'base64'));
  return f;
};
const viewport = async (w, h) => { await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await sleep(500); };
const setSelect = async (sel, value) => {
  await evalJs(`(() => { const s = document.querySelector(${JSON.stringify(sel)}); if (!s) return 'missing';
    s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
  await sleep(600);
};
const setPanels = async (l, r) => {
  await evalJs(`(() => { const app = document.querySelector('.app');
    const set = (which, open) => { const k = which === 'left' ? 'left-closed' : 'right-closed';
      if ((!app.classList.contains(k)) !== open) { document.querySelector(which === 'left' ? '#left-toggle' : '#right-toggle').click(); } };
    set('left', ${l}); set('right', ${r}); return app.className; })()`);
  await sleep(600);
};
async function load() {
  const t0 = Date.now();
  await cdp.send('Page.navigate', { url: fileUrl });
  for (;;) {
    try {
      const st = await evalJs('(()=>({rs:document.readyState,ui:!!window.book2ReaderPrefs,app:!!window.book2Appearance,'
        + 'theme:!!document.querySelector("#theme"),regions:document.querySelectorAll(".book-page").length}))()');
      if (st && st.rs === 'complete' && st.ui && st.app && st.theme && st.regions === 1899) {
        return { seconds: Math.round((Date.now() - t0) / 1000), regions: st.regions };
      }
    } catch (e) { /* not ready */ }
    if (Date.now() - t0 > 900000) throw new Error('the book did not become ready');
    await sleep(1000);
  }
}

const GEOM = `(() => {
  const q = (s) => document.querySelector(s);
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
    return { left: Math.round(b.left), top: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height),
             right: Math.round(b.right), bottom: Math.round(b.bottom) }; };
  const main = q('main'), tb = q('.toolbar');
  const cs = getComputedStyle(main), mb = main.getBoundingClientRect();
  const box = { left: mb.left + (parseFloat(cs.paddingLeft) || 0), right: mb.right - (parseFloat(cs.paddingRight) || 0) };
  const tbr = rect(tb);
  const kids = [...tb.children].map((el) => ({ id: el.id || el.tagName, role: el.getAttribute('role') || null,
    r: rect(el), text: (el.textContent || '').trim().slice(0, 14) }));
  const rows = [...new Set(kids.filter((k) => k.r && k.r.height > 0).map((k) => Math.round((k.r.top + k.r.height / 2) / 8)))].length;
  const pages = [...document.querySelectorAll('.book-page')];
  const top = Math.max(mb.top, tbr ? tbr.bottom : 0);
  let idx = -1;
  for (let i = 0; i < pages.length; i++) { const b = pages[i].getBoundingClientRect(); if (b.height > 0 && b.width > 0 && b.top <= top + 1) idx = i; }
  let frac = null;
  if (idx >= 0) { const b = pages[idx].getBoundingClientRect(); frac = +(((top - b.top) / b.height).toFixed(4)); }
  const L = q('aside.left'), R = q('aside.right');
  const imgs = [...document.querySelectorAll('img')];
  return {
    theme: document.documentElement.getAttribute('data-theme'), appearance: window.book2Appearance ? window.book2Appearance() : null,
    mode: q('.app').getAttribute('data-mode'),
    toolbar: tbr, toolbarRows: rows, toolbarGapRight: tbr ? Math.round(box.right - tbr.right) : null,
    toolbarInsideColumn: !!tbr && tbr.left >= box.left - 1 && tbr.right <= box.right + 1,
    toolbarSticky: getComputedStyle(tb).position,
    allControlsVisible: kids.every((k) => k.r.width > 0 && k.r.height > 0 || k.role === 'status'),
    controlsOutsideColumn: kids.filter((k) => k.r && (k.r.left < box.left - 1 || k.r.right > box.right + 1)).map((k) => k.id),
    overlapsRightPanel: !!(R && R.getBoundingClientRect().width > 0 && tbr && tbr.right > rect(R).left + 1),
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mainOverflow: main.scrollWidth - main.clientWidth,
    filteredImages: imgs.filter((im) => { let e = im; while (e) { const f = getComputedStyle(e).filter; if (f && f !== 'none') return true; e = e.parentElement; } return false; }).length,
    images: imgs.length,
    anchor: { pageId: idx >= 0 ? pages[idx].id : null, fraction: frac, scrollTop: Math.round(main.scrollTop) },
    counter: (q('#counter') || {}).textContent,
  };
})()`;
const measure = () => evalJs(GEOM);
const scrollToRegion = async (id, offset = 0) => {
  await evalJs(`(() => { const el = document.getElementById(${JSON.stringify(id)}); if (!el) return 'missing';
    el.scrollIntoView({ block: 'start' }); const m = document.querySelector('main');
    m.scrollTop = Math.max(0, m.scrollTop + ${offset}); return Math.round(m.scrollTop); })()`);
  await sleep(1200);
};

const report = { label, fileUrl, startedAt: new Date().toISOString() };
await viewport(1920, 1080);
await cdp.send('Page.navigate', { url: 'about:blank' });
await sleep(400);
cdp.events.length = 0;
report.load = await load();
report.initial = await measure();
report.integrity = await evalJs(`(() => {
  const pages = [...document.querySelectorAll('.book-page')];
  const links = [...document.querySelectorAll('a[href^="#"]')];
  const numbered = [...document.querySelectorAll('.nav-page')].filter((s) => (s.textContent || '').trim().length > 0);
  const disclosures = [...document.querySelectorAll('.book-page details.disclosure')];
  return { regions: pages.length, first: pages[0].id, last: pages[pages.length - 1].id,
    navRows: document.querySelectorAll('[data-source-contents-id]').length, numberedEntries: numbered.length,
    disclosures: disclosures.length, descLabels: document.querySelectorAll('.b2-desc-label').length,
    lgBadges: document.querySelectorAll('.lg-badge').length, imgs: document.querySelectorAll('img').length,
    tables: document.querySelectorAll('table').length, headings: document.querySelectorAll('[id^="book-heading-"]').length,
    links: links.length, brokenLinks: links.filter((a) => { const h = a.getAttribute('href').slice(1); return h && !document.getElementById(decodeURIComponent(h)); }).length,
    duplicateIds: (() => { const s = new Set(); let d = 0; for (const e of document.querySelectorAll('[id]')) { if (s.has(e.id)) d++; else s.add(e.id); } return d; })(),
    verticalCredits: document.querySelectorAll('[style*="sideways-lr"]').length,
    themeControl: document.querySelectorAll('#theme').length,
    toolbarButtons: document.querySelectorAll('.toolbar button').length }; })()`);

/* toolbar geometry: two desktop widths x the four panel combinations */
report.toolbar = [];
for (const [w, h] of [[1920, 1080], [1400, 1000]]) {
  await viewport(w, h);
  for (const [name, l, r] of [['both-open', true, true], ['both-closed', false, false],
                              ['left-only', true, false], ['right-only', false, true]]) {
    await setPanels(l, r);
    const st = await measure();
    report.toolbar.push({ view: `${w}x${h}`, panels: name, width: st.toolbar ? st.toolbar.width : null, rows: st.toolbarRows,
      gapRight: st.toolbarGapRight, inside: st.toolbarInsideColumn, allControls: st.allControlsVisible,
      outside: st.controlsOutsideColumn, overlapsRight: st.overlapsRightPanel, docOverflow: st.docOverflow });
    if (w === 1920 && (name === 'both-open' || name === 'both-closed')) {
      report[`shot_${w}_${name}`] = await shot(`toolbar-${w}-${name}`);
    }
  }
  await setPanels(true, true);
}

/* appearance: switch to dark and record the real cost on the full book */
await viewport(1400, 1000);
await setPanels(true, true);
await scrollToRegion('TMP-0117');
const t0 = Date.now();
await setSelect('#theme', 'dark');
report.darkSwitch = { wall_ms: Date.now() - t0, state: await measure() };
await scrollToRegion('TMP-0117');
report[`shot_dark_module11`] = await shot('dark-module-1-1');
await scrollToRegion('TMP-0130');
report[`shot_dark_lg`] = await shot('dark-learning-goal');
await scrollToRegion('TMP-1151');
report[`shot_dark_table`] = await shot('dark-table-yeti');
await scrollToRegion('TMP-1707');
report[`shot_dark_figure`] = await shot('dark-source-figure');
await evalJs('(() => { const d = document.querySelector("#TMP-0542 details.disclosure"); if (d) d.open = true; return !!d; })()');
await sleep(500);
await scrollToRegion('TMP-0542');
report[`shot_dark_extdesc`] = await shot('dark-extended-description');
await setSelect('#theme', 'light');
await scrollToRegion('TMP-0117');
report[`shot_light_module11`] = await shot('light-module-1-1');

/* persistence + position with the theme while scrolled deep */
await setSelect('#theme', 'dark');
await scrollToRegion('TMP-1500', 300);
const beforeSwitch = await measure();
await setSelect('#theme', 'light');
const afterLight = await measure();
await setSelect('#theme', 'dark');
const afterDark = await measure();
report.position = { before: beforeSwitch.anchor, light: afterLight.anchor, dark: afterDark.anchor,
  kept: beforeSwitch.anchor.pageId === afterLight.anchor.pageId && beforeSwitch.anchor.pageId === afterDark.anchor.pageId,
  fractions: [beforeSwitch.anchor.fraction, afterLight.anchor.fraction, afterDark.anchor.fraction] };
await setPanels(false, false);
const closed = await measure();
await setPanels(true, true);
const reopened = await measure();
report.sidebarsInDark = { keptOnClose: afterDark.anchor.pageId === closed.anchor.pageId,
  keptOnReopen: afterDark.anchor.pageId === reopened.anchor.pageId,
  fractions: [afterDark.anchor.fraction, closed.anchor.fraction, reopened.anchor.fraction] };

/* reload: the dark choice must survive */
report.reload = await load();
const afterReload = await measure();
report.reloadState = { theme: afterReload.theme, appearance: afterReload.appearance,
  stored: await evalJs('localStorage.getItem("book2.reader.v1")') };

/* system preference */
await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await setSelect('#theme', 'system');
const sysLight = await measure();
await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await sleep(600);
const sysDark = await measure();
report.system = { underLight: sysLight.theme, underDark: sysDark.theme, appearance: sysDark.appearance };
await cdp.send('Emulation.setEmulatedMedia', { features: [] });
await setSelect('#theme', 'dark');

report.errors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown'
  || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
  || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
  .map((e) => (e.method === 'Runtime.exceptionThrown'
    ? ((e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description) || e.params.exceptionDetails.text)
    : JSON.stringify(e.params).slice(0, 400)));
report.finishedAt = new Date().toISOString();
writeFileSync(join(outDir, `${label}-probe.json`), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ load: report.load, integrity: report.integrity,
  toolbar: report.toolbar, darkSwitch: { wall_ms: report.darkSwitch.wall_ms, appearance: report.darkSwitch.state.appearance },
  position: report.position, sidebarsInDark: report.sidebarsInDark, reload: report.reload,
  reloadState: { theme: report.reloadState.theme, appearance: report.reloadState.appearance },
  system: report.system, filteredImages: report.darkSwitch.state.filteredImages, images: report.darkSwitch.state.images,
  errors: report.errors }, null, 1));
process.exit(0);
