// Sidebar-wave browser probe: drives the real reader (fixture or full book) in
// headless Chrome over CDP and records the sidebar behaviour of the checklist.
//
//   node sidebar_probe.mjs <fileUrl> <outDir> [--label name] [--port 9339]
//                          [--skip-mobile]
//
// Everything is measured inside the page; screenshots are written to <outDir>.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const fileUrl = process.argv[2];
const outDir = process.argv[3];
const label = (() => { const i = process.argv.indexOf('--label'); return i >= 0 ? process.argv[i + 1] : 'run'; })();
const port = (() => { const i = process.argv.indexOf('--port'); return i >= 0 ? process.argv[i + 1] : '9339'; })();
const skipMobile = process.argv.includes('--skip-mobile');
const fullProfile = process.argv.includes('--full');
const ENDPOINT = process.env.SIDEBAR_CDP || `http://127.0.0.1:${port}`;
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
const page = list.find((t) => t.type === 'page') || list[0];
const cdp = new CDP(page.webSocketDebuggerUrl);
await cdp.connect();
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
await cdp.send('Page.enable');

const VIEW = {
  desktop1400: { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false },
  mobile390: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
  mobile320: { width: 320, height: 568, deviceScaleFactor: 2, mobile: true },
};
const setView = async (name, extra = {}) => {
  await cdp.send('Emulation.setDeviceMetricsOverride', Object.assign({}, VIEW[name], extra));
  await new Promise((r) => setTimeout(r, 700));
};
const viewport = async (w, h) => {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await new Promise((r) => setTimeout(r, 700));
};

const evalJs = async (expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, 600000);
  if (r.exceptionDetails) { throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails)); }
  return r.result.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const f = join(outDir, `${label}-${name}.png`);
  writeFileSync(f, Buffer.from(r.data, 'base64'));
  return f;
};

async function waitReady() {
  const started = Date.now();
  while (Date.now() - started < 240000) {
    try {
      const st = await evalJs('(()=>({rs:document.readyState,ui:!!window.book2ReaderPrefs,'
        + 'sem:!!window.book2Semantics,tools:!!document.querySelector("aside.right"),'
        + 'close:!!document.querySelector("#left-close"),handlers:!!window.book2ReaderPrefs}))()');
      if (st && st.rs === 'complete' && st.ui && st.sem && st.tools && st.close) {
        console.log(`ready after ${Math.round((Date.now() - started) / 1000)}s`);
        return st;
      }
    } catch (e) { /* still loading */ }
    await sleep(1000);
  }
  throw new Error('the reader did not become ready');
}

const STATE = `(() => {
  const q = (s) => document.querySelector(s);
  const app = q('.app'), main = q('main'), L = q('aside.left'), R = q('aside.right');
  const box = (el) => { const b = el.getBoundingClientRect(); return {x:Math.round(b.left),y:Math.round(b.top),w:Math.round(b.width),h:Math.round(b.height),right:Math.round(b.right),bottom:Math.round(b.bottom)}; };
  const vis = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const pages = [...document.querySelectorAll('.book-page')];
  const visible = pages.filter((p) => { const b = p.getBoundingClientRect(); return b.height > 0 && b.width > 0; });
  const cur = pages.find((p) => p.classList.contains('is-current'));
  const toolbar = q('.toolbar').getBoundingClientRect();
  const top = Math.max(main.getBoundingClientRect().top, toolbar.bottom);
  let idx = -1;
  for (let i = 0; i < pages.length; i++) { const b = pages[i].getBoundingClientRect(); if (b.height > 0 && b.width > 0 && b.top <= top + 1) idx = i; }
  let frac = null;
  if (idx >= 0) { const b = pages[idx].getBoundingClientRect(); frac = +(((top - b.top) / b.height).toFixed(4)); }
  const lc = q('#left-close'), rc = q('#right-close'), lt = q('#left-toggle'), rt = q('#right-toggle');
  const prefs = window.book2ReaderPrefs ? window.book2ReaderPrefs() : null;
  let stored = null; try { stored = JSON.parse(localStorage.getItem('book2.reader.v1') || 'null'); } catch (e) { stored = 'ERR'; }
  const lb = box(L), mb = box(main), rb = box(R);
  return {
    mode: app.getAttribute('data-mode'), effective: app.getAttribute('data-effective-mode'),
    leftClosed: app.classList.contains('left-closed'), rightClosed: app.classList.contains('right-closed'),
    leftVisible: vis(L), rightVisible: vis(R),
    L: lb, main: mb, R: rb,
    leftOverlapsReading: vis(L) && lb.right > mb.x + 1,
    rightOverlapsReading: vis(R) && rb.x < mb.right - 1,
    bothPanelsVisible: vis(L) && vis(R),
    fit: getComputedStyle(document.documentElement).getPropertyValue('--fit-continuous').trim(),
    visibleRegionCount: visible.length,
    visibleRegionIds: visible.length <= 4 ? visible.map((p) => p.id) : [visible[0].id, '..', visible[visible.length - 1].id],
    firstVisiblePageWidth: visible.length ? Math.round(visible[0].getBoundingClientRect().width) : null,
    currentPageId: cur ? cur.id : null,
    counter: (q('#counter') || {}).textContent,
    anchorPageId: idx >= 0 ? pages[idx].id : null, anchorFraction: frac,
    scrollTop: Math.round(main.scrollTop),
    aria: { leftClose: lc && lc.getAttribute('aria-expanded'), rightClose: rc && rc.getAttribute('aria-expanded'),
            leftToggle: lt && lt.getAttribute('aria-expanded'), rightToggle: rt && rt.getAttribute('aria-expanded'),
            leftCloseName: lc && lc.getAttribute('aria-label'), rightCloseName: rc && rc.getAttribute('aria-label'),
            leftCloseControls: lc && lc.getAttribute('aria-controls'), rightCloseControls: rc && rc.getAttribute('aria-controls'),
            leftToggleControls: lt && lt.getAttribute('aria-controls') },
    closeText: { left: lc ? lc.textContent.replace(/\\s+/g, ' ').trim() : null, right: rc ? rc.textContent.replace(/\\s+/g, ' ').trim() : null },
    closeVisible: { left: vis(lc), right: vis(rc) },
    togglesVisible: { left: vis(lt), right: vis(rt) },
    leftPanelClass: L.className, rightPanelClass: R.className, panelId: L.id,
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mainOverflow: main.scrollWidth - main.clientWidth,
    qaFailures: window.book2QA ? window.book2QA().length : null,
    focus: (document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || null,
    prefs, stored, viewport: window.innerWidth + 'x' + window.innerHeight,
  };
})()`;

const report = { label, fileUrl, startedAt: new Date().toISOString() };
const measure = () => evalJs(STATE);
/* one whole-document integrity pass: the counts every wave has to preserve, the
   link/id checks, and the outside-page overflow probe the reader ships */
const INTEGRITY = `(() => {
  const pages = [...document.querySelectorAll('.book-page')];
  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
  const seen = new Set(), dup = new Set();
  for (const id of ids) { if (seen.has(id)) dup.add(id); else seen.add(id); }
  const links = [...document.querySelectorAll('a[href^="#"]')];
  const broken = links.filter((a) => { const h = a.getAttribute('href').slice(1); return h && !document.getElementById(decodeURIComponent(h)); }).length;
  const numbered = [...document.querySelectorAll('.nav-page')].filter((s) => (s.textContent || '').trim().length > 0);
  const disclosures = [...document.querySelectorAll('.book-page details.disclosure')];
  const emptyDisclosures = disclosures.filter((d) => !(d.querySelector('.desc-panel') || {}).textContent || !d.querySelector('.desc-panel').textContent.trim()).length;
  return {
    regions: pages.length,
    firstRegion: pages[0] && pages[0].id, lastRegion: pages[pages.length - 1] && pages[pages.length - 1].id,
    navRows: document.querySelectorAll('[data-source-contents-id]').length,
    numberedEntries: numbered.length,
    printedLabels: numbered.map((s) => s.textContent.trim()).slice(0, 12),
    navGroups: document.querySelectorAll('#contents-nav details.nav-group').length,
    navModules: document.querySelectorAll('#contents-nav details.nav-module').length,
    details: document.querySelectorAll('details').length,
    disclosures: disclosures.length,
    emptyDisclosures,
    descLabels: document.querySelectorAll('.b2-desc-label').length,
    lgBadges: document.querySelectorAll('.lg-badge').length,
    imgs: document.querySelectorAll('img').length,
    pngImages: document.querySelectorAll('img[src^="data:image/png"]').length,
    tables: document.querySelectorAll('table').length,
    headings: document.querySelectorAll('[id^="book-heading-"]').length,
    roleHeadings: document.querySelectorAll('[role="heading"]').length,
    links: links.length,
    brokenLinks: broken,
    duplicateIds: dup.size,
    duplicateIdSamples: [...dup].slice(0, 5),
    collapseButtons: document.querySelectorAll('.drawer-close.panel-collapse').length,
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;
const click = (sel) => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'missing'; el.click(); return 'clicked'; })()`);
/* real key events through the browser input pipeline, so the default actions
   (Tab moving focus, Enter activating a focused button) really happen */
const KEYCODES = { Tab: 9, Enter: 13, Escape: 27 };
const key = async (k, n = 1) => {
  const code = KEYCODES[k];
  for (let i = 0; i < n; i++) {
    const base = { windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: k, code: k };
    await cdp.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown', text: k === 'Enter' ? '\r' : undefined }, base));
    await cdp.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
    await sleep(120);
  }
  await sleep(200);
};
const focusId = () => evalJs('(() => (document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || null)()');
const scrollReadingPosition = () => evalJs(`(() => {
  const pages = [...document.querySelectorAll('.book-page')];
  const shown = pages.filter((p) => p.getBoundingClientRect().height > 0);
  const main = document.querySelector('main');
  if (shown.length > 3) { shown[Math.floor(shown.length / 2)].scrollIntoView({ block: 'start' }); main.scrollTop += 250; }
  else { for (let i = 0; i < 2; i++) { document.querySelector('#next').click(); } }
  return { shown: shown.length, scrollTop: Math.round(main.scrollTop) };
})()`);
const setMode = async (mode) => {
  await evalJs(`(() => { const s = document.querySelector('#mode'); s.value = ${JSON.stringify(mode)}; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
  await sleep(600);
};
const setPanels = async (leftOpen, rightOpen) => {
  await evalJs(`(() => {
    const app = document.querySelector('.app');
    const set = (which, open) => {
      const closedKey = which === 'left' ? 'left-closed' : 'right-closed';
      const isOpen = !app.classList.contains(closedKey);
      if (isOpen !== open) { document.querySelector(which === 'left' ? '#left-toggle' : '#right-toggle').click(); }
    };
    set('left', ${leftOpen}); set('right', ${rightOpen});
    return app.className;
  })()`);
  await sleep(450);
};

/* ---------------------------------------------------------------- load --- */
await setView('desktop1400');
/* start from a clean target so no error from a previous page can be attributed
   to this run */
await cdp.send('Page.navigate', { url: 'about:blank' });
await sleep(500);
cdp.events.length = 0;
await cdp.send('Page.navigate', { url: fileUrl });
await waitReady();
await evalJs('localStorage.clear()');
await cdp.send('Page.navigate', { url: fileUrl });
await waitReady();
report.initial = await measure();
report.screenshots = { initial: await shot('desktop-initial') };
report.integrity = await evalJs(INTEGRITY);

/* --------------------------------------------------- desktop 4 combos ---- */
report.combos = [];
for (const [name, l, r] of [['left=open,right=open', true, true], ['left=closed,right=open', false, true],
                            ['left=open,right=closed', true, false], ['left=closed,right=closed', false, false]]) {
  await setPanels(l, r);
  const st = await measure();
  report.combos.push({ name, leftOpen: l, rightOpen: r, state: st });
  report.screenshots[name] = await shot('desktop-' + name.replace(/[=,]/g, '-'));
}
await setPanels(true, true);
report.combos.push({ name: 'both-reopened', leftOpen: true, rightOpen: true, state: await measure() });

/* --------------------------------------------- in-panel collapse buttons - */
report.inPanelButtons = {};
await click('#left-close'); await sleep(450);
report.inPanelButtons.afterLeftClose = await measure();
report.screenshots.leftCloseClicked = await shot('desktop-left-close-clicked');
await click('#left-toggle'); await sleep(450);
report.inPanelButtons.afterLeftReopen = await measure();
await click('#right-close'); await sleep(450);
report.inPanelButtons.afterRightClose = await measure();
await click('#right-toggle'); await sleep(450);
report.inPanelButtons.afterRightReopen = await measure();

/* ---------------------------------------------- position / active section */
await setPanels(true, true);
await evalJs('document.querySelector("main").scrollTop = Math.round(document.querySelector("main").scrollTop + 900)');
await sleep(400);
const posBefore = await measure();
await click('#left-close'); await sleep(500);
const posLeft = await measure();
await click('#right-close'); await sleep(500);
const posBoth = await measure();
report.position = {
  before: posBefore, afterLeftClose: posLeft, afterBothClosed: posBoth,
  keptOnLeftClose: posBefore.anchorPageId === posLeft.anchorPageId && posBefore.currentPageId === posLeft.currentPageId,
  keptOnBothClosed: posBefore.anchorPageId === posBoth.anchorPageId && posBefore.currentPageId === posBoth.currentPageId,
  anchorTrail: [posBefore.anchorPageId, posLeft.anchorPageId, posBoth.anchorPageId],
  fractionTrail: [posBefore.anchorFraction, posLeft.anchorFraction, posBoth.anchorFraction],
};
await setPanels(true, true);

/* ----------------------------------------------------------- persistence - */
report.persistence = [];
const persistCases = fullProfile
  ? [['both-closed', false, false, 1400, 1000], ['both-open', true, true, 1400, 1000]]
  : [['left-closed', false, true, 1400, 1000], ['both-open', true, true, 1400, 1000],
     ['both-closed', false, false, 1400, 1000], ['left-closed-1024', false, true, 1024, 900]];
for (const [name, l, r, w, h] of persistCases) {
  await viewport(w, h);
  await setPanels(l, r);
  const set = await measure();
  await cdp.send('Page.navigate', { url: fileUrl });
  await waitReady();
  const reloaded = await measure();
  report.persistence.push({ name, viewport: `${w}x${h}`, set, reloaded,
    restored: reloaded.leftClosed === set.leftClosed && reloaded.rightClosed === set.rightClosed });
}

/* ------------------------------------------------------ modes x sidebars - */
report.modes = [];
await setView('desktop1400');
await setPanels(true, true);
for (const mode of (fullProfile ? ['continuous', 'section'] : ['continuous', 'section', 'single'])) {
  await setMode(mode);
  await scrollReadingPosition();
  await sleep(400);
  const open = await measure();
  await click('#left-close'); await sleep(500);
  const leftClosed = await measure();
  await click('#right-close'); await sleep(500);
  const bothClosed = await measure();
  await click('#left-toggle'); await click('#right-toggle'); await sleep(500);
  const reopened = await measure();
  report.modes.push({ mode, open, leftClosed, bothClosed,
    reopened,
    keptOnLeftClose: open.anchorPageId === leftClosed.anchorPageId && open.currentPageId === leftClosed.currentPageId,
    keptOnBothClosed: open.anchorPageId === bothClosed.anchorPageId && open.currentPageId === bothClosed.currentPageId,
    counterKept: open.counter === bothClosed.counter,
    visibleKept: JSON.stringify(open.visibleRegionIds) === JSON.stringify(bothClosed.visibleRegionIds),
    widthRestored: reopened.L.w === open.L.w && reopened.R.w === open.R.w,
    fractionTrail: [open.anchorFraction, leftClosed.anchorFraction, bothClosed.anchorFraction, reopened.anchorFraction],
    scrollTrail: [open.scrollTop, leftClosed.scrollTop, bothClosed.scrollTop, reopened.scrollTop] });
  report.screenshots['mode-' + mode] = await shot(`desktop-mode-${mode}-both-closed`);
  await setPanels(true, true);
}
await setMode('continuous');

/* ------------------------------------------------------------- keyboard -- */
const focusRing = () => evalJs(`(() => { const el = document.activeElement; if (!el) return null; const cs = getComputedStyle(el); return { id: el.id || el.tagName, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, offset: cs.outlineOffset }; })()`);
await evalJs('document.body.setAttribute("tabindex","-1"); document.body.focus()');
const tabTrail = [];
let landedOnClose = null;
for (let i = 0; i < 30; i++) {
  await key('Tab');
  const id = await focusId();
  tabTrail.push(id);
  if (id === 'left-close') { landedOnClose = await focusRing(); break; }
}
await key('Enter');
const kbAfterEnter = await measure();
const kbEnterRing = await focusRing();
await key('Enter');
const kbAfterSecondEnter = await measure();
// Escape closes an open panel and returns focus to its toolbar toggle
await evalJs('document.querySelector("#right-toggle").focus()');
await key('Enter');
const kbRightOpen = await measure();
await key('Escape');
const kbAfterEscape = await measure();
report.keyboard = { tabTrail, landedOnClose, afterEnter: kbAfterEnter, enterRing: kbEnterRing,
                    afterSecondEnter: kbAfterSecondEnter, rightOpen: kbRightOpen, afterEscape: kbAfterEscape };
report.screenshots.keyboard = await shot('desktop-keyboard');
await setPanels(true, true);

/* --------------------------------------------------------------- mobile -- */
if (!skipMobile) {
  report.mobile = {};
  for (const v of (fullProfile ? ['mobile390'] : ['mobile390', 'mobile320'])) {
    const entries = [];
    await setView(v);
    await evalJs('localStorage.setItem("book2.reader.v1", JSON.stringify(Object.assign({}, window.book2ReaderPrefs(), {left:"open", right:"open"})))');
    await cdp.send('Page.navigate', { url: fileUrl });
    await waitReady();
    entries.push({ step: 'narrow load', state: await measure() });
    report.screenshots[v + '-load'] = await shot(`${v}-load`);
    if (!fullProfile) {
      await click('#left-toggle'); await sleep(450);
      entries.push({ step: 'left toggle', state: await measure() });
      report.screenshots[v + '-left-closed'] = await shot(`${v}-drawers-closed`);
    }
    await click('#right-toggle'); await sleep(450);
    entries.push({ step: 'right toggle', state: await measure() });
    report.screenshots[v + '-right'] = await shot(`${v}-right-open`);
    await click('#left-toggle'); await sleep(450);
    entries.push({ step: 'left toggle again', state: await measure() });
    report.screenshots[v + '-left-again'] = await shot(`${v}-left-open-again`);
    const stored = await evalJs('localStorage.getItem("book2.reader.v1")');
    report.mobile[v] = {
      entries, storedAfterDrawerUse: stored,
      overlapsSeen: entries.filter((e) => e.state.bothPanelsVisible).length,
      overflowSeen: entries.map((e) => e.state.docOverflow),
    };
    await setView('desktop1400');
    report.mobile[v].afterResizeBack = await measure();
    report.screenshots[v + '-back-to-desktop'] = await shot(`${v}-back-to-desktop`);
  }
}

/* ------------------------------------------------- errors and finished --- */
report.errors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown'
  || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
  || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
  .map((e) => (e.method === 'Runtime.exceptionThrown'
    ? ((e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description) || e.params.exceptionDetails.text)
    : JSON.stringify(e.params).slice(0, 300)));
report.finishedAt = new Date().toISOString();
writeFileSync(join(outDir, `${label}-probe.json`), JSON.stringify(report, null, 1));

const summary = {
  label, errors: report.errors,
  integrity: report.integrity,
  combos: report.combos.map((c) => `${c.name}: main=${c.state.main.w} left=${c.state.L.w} right=${c.state.R.w} overlap=${c.state.leftOverlapsReading || c.state.rightOverlapsReading}`),
  inPanelButtons: Object.fromEntries(Object.entries(report.inPanelButtons).map(([k, v]) => [k, `${v.leftClosed ? 'left-closed' : 'left-open'}/${v.rightClosed ? 'right-closed' : 'right-open'} focus=${v.focus}`])),
  position: { leftClose: report.position.keptOnLeftClose, bothClosed: report.position.keptOnBothClosed, anchors: report.position.anchorTrail, fractions: report.position.fractionTrail },
  persistence: report.persistence.map((p) => `${p.name}: restored=${p.restored} (${p.reloaded.leftClosed ? 'left-closed' : 'left-open'}/${p.reloaded.rightClosed ? 'right-closed' : 'right-open'})`),
  modes: report.modes.map((m) => `${m.mode}: keptLeft=${m.keptOnLeftClose} keptBoth=${m.keptOnBothClosed} counterKept=${m.counterKept} visibleKept=${m.visibleKept} widthRestored=${m.widthRestored} scroll=${JSON.stringify(m.scrollTrail)}`),
  keyboard: { tabTrail: report.keyboard.tabTrail, landedOnClose: report.keyboard.landedOnClose,
              afterEnter: { focus: report.keyboard.afterEnter.focus, leftClosed: report.keyboard.afterEnter.leftClosed },
              enterRing: report.keyboard.enterRing,
              afterSecondEnter: { focus: report.keyboard.afterSecondEnter.focus, leftClosed: report.keyboard.afterSecondEnter.leftClosed },
              rightOpen: report.keyboard.rightOpen.rightClosed, afterEscape: { focus: report.keyboard.afterEscape.focus, rightClosed: report.keyboard.afterEscape.rightClosed } },
  mobile: report.mobile ? Object.fromEntries(Object.entries(report.mobile).map(([k, v]) => [k, { overlaps: v.overlapsSeen, stored: v.storedAfterDrawerUse, back: `${v.afterResizeBack.leftClosed ? 'left-closed' : 'left-open'}/${v.afterResizeBack.rightClosed ? 'right-closed' : 'right-open'}`, overflow: v.overflowSeen }])) : 'skipped',
};
console.log(JSON.stringify(summary, null, 1));
process.exit(0);
