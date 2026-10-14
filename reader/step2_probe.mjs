// Step-2 browser probe: drives the real reader (fixture or full book) in
// headless Chrome over CDP and records the toolbar geometry, the appearance
// matrix, the contrast of the real rendered text and the sidebar regression
// checks, with screenshots.
//
//   node step2_probe.mjs <fileUrl> <outDir> [--label name] [--port 9341]
//                        [--mobile-only] [--full]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const fileUrl = process.argv[2];
const outDir = process.argv[3];
const label = (() => { const i = process.argv.indexOf('--label'); return i >= 0 ? process.argv[i + 1] : 'step2'; })();
const port = (() => { const i = process.argv.indexOf('--port'); return i >= 0 ? process.argv[i + 1] : '9341'; })();
const full = process.argv.includes('--full');
const ENDPOINT = process.env.STEP2_CDP || `http://127.0.0.1:${port}`;
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
const evalJs = async (expression, timeoutMs = 900000) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
  if (r.exceptionDetails) { throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails)); }
  return r.result.value;
};
const shot = async (name) => {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const f = join(outDir, `${label}-${name}.png`);
  writeFileSync(f, Buffer.from(r.data, 'base64'));
  return f;
};
const viewport = async (w, h, mobile = false, dsf = 1) => {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dsf, mobile });
  await sleep(600);
};
const table = {
  1920: [1920, 1080], 1400: [1400, 1000], 1024: [1024, 768],
  m390: [390, 844, true, 2], m375: [375, 812, true, 2], m320: [320, 700, true, 2],
};
const setView = async (name) => {
  const v = table[name];
  await viewport(v[0], v[1], !!v[2], v[3] || 1);
};
const emulateScheme = async (scheme) => {
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  await sleep(500);
};

async function waitReady() {
  const started = Date.now();
  while (Date.now() - started < 300000) {
    try {
      const st = await evalJs('(()=>({rs:document.readyState,ui:!!window.book2ReaderPrefs,'
        + 'sem:!!window.book2Semantics,app:!!window.book2Appearance,theme:!!document.querySelector("#theme"),'
        + 'tb:!!document.querySelector(".toolbar")}))()');
      if (st && st.rs === 'complete' && st.ui && st.sem && st.app && st.theme && st.tb) {
        console.log(`ready after ${Math.round((Date.now() - started) / 1000)}s`);
        return st;
      }
    } catch (e) { /* still loading */ }
    await sleep(1000);
  }
  throw new Error('the reader did not become ready');
}

const GEOM = `(() => {
  const q = (s) => document.querySelector(s);
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
    return { x: Math.round(b.left), y: Math.round(b.top), left: Math.round(b.left), top: Math.round(b.top),
             w: Math.round(b.width), h: Math.round(b.height),
             right: Math.round(b.right), bottom: Math.round(b.bottom) }; };
  const vis = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const app = q('.app'), main = q('main'), tb = q('.toolbar');
  const cs = getComputedStyle(main), mb = main.getBoundingClientRect();
  const pad = { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 };
  const contentBox = { left: Math.round(mb.left + pad.l), right: Math.round(mb.right - pad.r) };
  const tbr = rect(tb);
  const kids = [...tb.children].map((el) => ({ id: el.id || el.tagName,
    r: rect(el), vis: vis(el), role: el.getAttribute('role') || null,
    text: (el.textContent || '').trim().slice(0, 18) }));
  /* a "row" is a group of controls sharing a vertical centre (item tops differ
     because the controls have different heights) */
  const centres = [...new Set(kids.filter((k) => k.r && k.r.h > 0)
    .map((k) => Math.round((k.r.top + k.r.h / 2) / 8)))].sort((a, b) => a - b);
  const rows = centres;
  const L = q('aside.left'), R = q('aside.right');
  const lb = rect(L), rb = rect(R);
  const pages = [...document.querySelectorAll('.book-page')];
  const top = Math.max(mb.top, tbr ? tbr.bottom : 0);
  let idx = -1;
  for (let i = 0; i < pages.length; i++) { const b = pages[i].getBoundingClientRect(); if (b.height > 0 && b.width > 0 && b.top <= top + 1) idx = i; }
  let frac = null;
  if (idx >= 0) { const b = pages[idx].getBoundingClientRect(); frac = +(((top - b.top) / b.height).toFixed(4)); }
  const imgs = [...document.querySelectorAll('img')];
  const filtered = imgs.filter((im) => { let e = im; while (e) { const f = getComputedStyle(e).filter; if (f && f !== 'none') return true; e = e.parentElement; } return false; });
  return {
    viewport: window.innerWidth + 'x' + window.innerHeight,
    theme: document.documentElement.getAttribute('data-theme'),
    appearance: window.book2Appearance ? window.book2Appearance() : null,
    mode: app.getAttribute('data-mode'), effective: app.getAttribute('data-effective-mode'),
    leftClosed: app.classList.contains('left-closed'), rightClosed: app.classList.contains('right-closed'),
    schema: document.querySelector('meta[name="color-scheme"]') ? 'meta' : null,
    main: rect(main), contentBox, toolbar: tbr, toolbarRows: rows.length,
    toolbarGapRight: tbr ? Math.round(contentBox.right - tbr.right) : null,
    toolbarGapLeft: tbr ? Math.round(tbr.left - contentBox.left) : null,
    toolbarInsideColumn: !!tbr && tbr.left >= contentBox.left - 1 && tbr.right <= contentBox.right + 1,
    toolbarSticky: tb ? getComputedStyle(tb).position + '/' + getComputedStyle(tb).top : null,
    toolbarWidth: tbr ? tbr.w : null,
    children: kids,
    /* an empty role=status live region is legitimately 0x0; every real control
       (or a status that carries text) must be laid out */
    allControlsVisible: kids.every((k) => k.vis || (!k.text && k.role === 'status')),
    emptyLiveRegion: kids.filter((k) => !k.vis && k.role === 'status').length,
    controlsOutsideColumn: kids.filter((k) => k.r && (k.r.x < contentBox.left - 1 || k.r.right > contentBox.right + 1)).map((k) => k.id),
    overlapsLeftPanel: !!(vis(L) && tbr && tbr.left < lb.right - 1),
    overlapsRightPanel: !!(vis(R) && tbr && tbr.right > rb.x + 1),
    leftPanel: lb, rightPanel: rb, leftVisible: vis(L), rightVisible: vis(R),
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    mainOverflow: main.scrollWidth - main.clientWidth,
    counter: (q('#counter') || {}).textContent,
    search: rect(q('#search')),
    anchor: { pageId: idx >= 0 ? pages[idx].id : null, fraction: frac, scrollTop: Math.round(main.scrollTop) },
    paintedImages: imgs.length, filteredImages: filtered.length,
    themeSelect: (() => { const s = q('#theme'); return s ? { value: s.value, label: (s.labels && s.labels[0] ? s.labels[0].textContent.trim() : null) } : null; })(),
    focus: (document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || null,
    stored: (() => { try { return JSON.parse(localStorage.getItem('book2.reader.v1') || 'null'); } catch (e) { return 'ERR'; } })(),
  };
})()`;
const measure = () => evalJs(GEOM);

const INTEGRITY = `(() => {
  const pages = [...document.querySelectorAll('.book-page')];
  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
  const seen = new Set(), dup = new Set();
  for (const id of ids) { if (seen.has(id)) dup.add(id); else seen.add(id); }
  const links = [...document.querySelectorAll('a[href^="#"]')];
  const broken = links.filter((a) => { const h = a.getAttribute('href').slice(1); return h && !document.getElementById(decodeURIComponent(h)); }).length;
  const numbered = [...document.querySelectorAll('.nav-page')].filter((s) => (s.textContent || '').trim().length > 0);
  const disclosures = [...document.querySelectorAll('.book-page details.disclosure')];
  const emptyDisclosures = disclosures.filter((d) => { const p = d.querySelector('.desc-panel'); return !p || !p.textContent.trim(); }).length;
  return {
    regions: pages.length, firstRegion: pages[0] && pages[0].id, lastRegion: pages[pages.length - 1] && pages[pages.length - 1].id,
    navRows: document.querySelectorAll('[data-source-contents-id]').length,
    numberedEntries: numbered.length,
    navGroups: document.querySelectorAll('#contents-nav details.nav-group').length,
    navModules: document.querySelectorAll('#contents-nav details.nav-module').length,
    disclosures: disclosures.length, emptyDisclosures,
    descLabels: document.querySelectorAll('.b2-desc-label').length,
    lgBadges: document.querySelectorAll('.lg-badge').length,
    imgs: document.querySelectorAll('img').length,
    tables: document.querySelectorAll('table').length,
    headings: document.querySelectorAll('[id^="book-heading-"]').length,
    links: links.length, brokenLinks: broken,
    duplicateIds: dup.size, duplicateIdSamples: [...dup].slice(0, 5),
    collapseButtons: document.querySelectorAll('.drawer-close.panel-collapse').length,
    themeControl: document.querySelectorAll('#theme').length,
    toolbarButtons: document.querySelectorAll('.toolbar button').length,
    toolbarInputs: document.querySelectorAll('.toolbar input').length,
    pngImages: document.querySelectorAll('img[src^="data:image/png"]').length,
  };
})()`;

const CONTRAST = `(() => {
  const par = (css) => { const m = /rgba?\\(([^)]+)\\)/.exec(css || ''); if (!m) return null;
    const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (f, b) => { const a = Math.max(lum(f), lum(b)), z = Math.min(lum(f), lum(b)); return +(((a + 0.05) / (z + 0.05)).toFixed(2)); };
  const bgOf = (el) => { let e = el; while (e) { const c = par(getComputedStyle(e).backgroundColor); if (c && c[3] > 0.5) return c; e = e.parentElement; } return [255, 255, 255, 1]; };
  const SEL = [
    ['.book-page#TMP-0001 .content span', 'cover title text'],
    ['.book-page#TMP-0117 .content span', 'module opener'],
    ['.book-page#TMP-0130 .content p', 'module 1.1 body'],
    ['.book-page#TMP-0130 .lg-question span, .book-page#TMP-0130 td>p>span:not(.lg-badge)', 'learning-goal strip'],
    ['.book-page#TMP-1107 .ocr-table td', 'financial table cell'],
    ['.book-page#TMP-1107 .table-title', 'table title'],
    ['.book-page#TMP-0542 details.disclosure>summary', 'description bar'],
    ['.book-page#TMP-0542 details.disclosure .desc-panel p, .book-page#TMP-0542 details.disclosure .desc-panel span', 'description body'],
    ['.book-page#TMP-1129 .content p', 'figure page text'],
    ['.book-page#TMP-1129 .source-photo-credit', 'photo credit'],
    ['#contents-nav a.nav-child', 'contents row'],
    ['#contents-nav .nav-page', 'printed page label'],
    ['#contents-nav .nav-group>summary', 'contents group'],
    ['.tools .ctl>label', 'tools label'],
    ['.toolbar button', 'toolbar button'],
    ['.toolbar #counter', 'toolbar counter'],
  ];
  const out = {};
  for (const [sel, name] of SEL) {
    const els = [...document.querySelectorAll(sel)].slice(0, 30);
    const res = [];
    for (const el of els) {
      const cs = getComputedStyle(el);
      const fg = par(cs.color); if (!fg) continue;
      res.push({ r: ratio(fg, bgOf(el)), fg: cs.color, bg: 'rgb(' + bgOf(el).slice(0, 3).join(',') + ')', text: (el.textContent || '').trim().slice(0, 24) });
    }
    if (!res.length) continue;
    const rs = res.map((x) => x.r).sort((a, b) => a - b);
    out[name] = { n: res.length, min: rs[0], median: rs[Math.floor(rs.length / 2)], max: rs[rs.length - 1],
      below45: res.filter((x) => x.r < 4.5).length,
      worst: res.reduce((a, b) => (b.r < a.r ? b : a)) };
  }
  return out;
})()`;

const click = (sel) => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'missing'; el.click(); return 'clicked'; })()`);
const setSelect = async (sel, value) => {
  await evalJs(`(() => { const s = document.querySelector(${JSON.stringify(sel)}); if (!s) return 'missing';
    s.value = ${JSON.stringify(value)}; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
  await sleep(500);
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
    return app.className; })()`);
  await sleep(450);
};
const scrollToRegion = async (id, offset = 0) => {
  await evalJs(`(() => { const el = document.getElementById(${JSON.stringify(id)});
    if (!el) return 'missing'; el.scrollIntoView({ block: 'start' });
    const m = document.querySelector('main'); m.scrollTop = Math.max(0, m.scrollTop + ${offset}); return Math.round(m.scrollTop); })()`);
  await sleep(600);
};
const KEYCODES = { Tab: 9, Enter: 13, Escape: 27, ArrowDown: 40, Space: 32 };
const key = async (k, n = 1) => {
  const code = KEYCODES[k];
  for (let i = 0; i < n; i++) {
    const base = { windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, key: k, code: k };
    await cdp.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, base));
    await cdp.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
    await sleep(150);
  }
  await sleep(250);
};

const report = { label, fileUrl, full, startedAt: new Date().toISOString() };

/* ---------------------------------------------------------------- load --- */
await setView(1400);
await cdp.send('Page.navigate', { url: 'about:blank' });
await sleep(400);
cdp.events.length = 0;
await cdp.send('Page.navigate', { url: fileUrl });
await waitReady();
await evalJs('localStorage.clear()');
await cdp.send('Page.navigate', { url: fileUrl });
await waitReady();
report.integrity = await evalJs(INTEGRITY);
report.initial = await measure();

/* ------------------------------------------------------ toolbar matrix --- */
report.toolbarMatrix = [];
for (const v of ['1920', '1400', '1024', 'm390', 'm375', 'm320']) {
  await setView(v);
  for (const [name, l, r] of [['both-open', true, true], ['both-closed', false, false],
                              ['left-only', true, false], ['right-only', false, true]]) {
    await setPanels(l, r);
    const st = await measure();
    report.toolbarMatrix.push({ view: v, panels: name, state: st });
    if (v === '1920' && (name === 'both-open' || name === 'both-closed')) {
      report[`shot_1920_${name}`] = await shot(`toolbar-1920-${name}`);
    }
    if ((v === 'm390' && name === 'both-closed') || (v === 'm320' && name === 'both-open')) {
      report[`shot_${v}_${name}`] = await shot(`toolbar-${v}-${name}`);
    }
  }
  await setPanels(true, true);
}

/* ------------------------------------------------------------- contrast -- */
await setView(1400);
await setPanels(true, true);
report.contrast = { light: await evalJs(CONTRAST) };

/* --------------------------------------------------------------- themes -- */
report.themes = [];
for (const [name, pref, scheme] of [['light-selected', 'light', 'light'], ['dark-selected', 'dark', 'light'],
                                    ['system-under-light', 'system', 'light'], ['system-under-dark', 'system', 'dark']]) {
  await emulateScheme(scheme);
  await setView(1400);
  await setSelect('#theme', pref);
  const st = await measure();
  const contrast = await evalJs(CONTRAST);
  report.themes.push({ name, pref, scheme, state: st, contrast });
  await scrollToRegion('TMP-0117');
  report[`shot_theme_${name}`] = await shot(`theme-${name}`);
}

/* ---- the themed component screenshots (dark) ---------------------------- */
await emulateScheme('dark');
await setSelect('#theme', 'dark');
await setView(1400);
await setPanels(true, true);
const shots = {};
await scrollToRegion('TMP-0117');
shots.moduleOpenDark = await shot('dark-module-opener');
await scrollToRegion('TMP-0130');
shots.lgDark = await shot('dark-learning-goal');
await scrollToRegion('TMP-1107');
shots.tableDark = await shot('dark-table');
await scrollToRegion('TMP-1129');
shots.figureDark = await shot('dark-figure-credit');
await evalJs('(() => { const d = document.querySelector("#TMP-0542 details.disclosure"); if (d) { d.open = true; } return !!d; })()');
await sleep(600);
await evalJs('(() => { const d = document.querySelector("#TMP-0542 details.disclosure"); if (d) d.scrollIntoView({ block: "start" }); return true; })()');
await sleep(700);
shots.extdescDark = await shot('dark-extdesc');
report.componentShots = shots;

/* light counterparts of the same components */
await setSelect('#theme', 'light');
await scrollToRegion('TMP-0117');
shots.moduleOpenLight = await shot('light-module-opener');
await scrollToRegion('TMP-0130');
shots.lgLight = await shot('light-learning-goal');
await scrollToRegion('TMP-1107');
shots.tableLight = await shot('light-table');
report.componentShotsLight = shots;

/* ----------------------------------------------------- theme persistence - */
report.persistence = [];
await setSelect('#theme', 'dark');
await scrollToRegion('TMP-1707');
const beforeReload = await measure();
await cdp.send('Page.navigate', { url: fileUrl });
await waitReady();
const afterReload = await measure();
report.persistence.push({
  case: 'dark survives a reload', before: { theme: beforeReload.theme, anchor: beforeReload.anchor },
  after: { theme: afterReload.theme, anchor: afterReload.anchor, stored: afterReload.stored },
  restored: afterReload.theme === 'dark' && afterReload.stored && afterReload.stored.theme === 'dark',
});
await setSelect('#theme', 'light');
await cdp.send('Page.navigate', { url: fileUrl });
await waitReady();
report.persistence.push({ case: 'light stays the default', after: { theme: (await measure()).theme },
  restored: (await measure()).theme === 'light' });

/* ------------------------------- theme change while scrolled + position --- */
await setPanels(true, true);
await scrollToRegion('TMP-1107', 180);
const posBefore = await measure();
await setSelect('#theme', 'dark');
const posDark = await measure();
await setPanels(false, false);
const posClosed = await measure();
await setSelect('#theme', 'light');
const posLight = await measure();
await setPanels(true, true);
const posReopened = await measure();
report.position = {
  before: posBefore.anchor, dark: posDark.anchor, bothClosed: posClosed.anchor,
  light: posLight.anchor, reopened: posReopened.anchor,
  keptOnThemeChange: posBefore.anchor.pageId === posDark.anchor.pageId && posBefore.anchor.pageId === posLight.anchor.pageId,
  keptOnSidebarToggleInDark: posDark.anchor.pageId === posClosed.anchor.pageId,
  sameLine: [posBefore.anchor.fraction, posDark.anchor.fraction, posClosed.anchor.fraction, posLight.anchor.fraction, posReopened.anchor.fraction],
};

/* ------------------------------------------- modes / typography / dark --- */
await setSelect('#theme', 'dark');
report.modes = [];
for (const mode of ['continuous', 'section', 'single']) {
  await setView(1400);
  await setPanels(true, true);
  await setSelect('#mode', mode);
  await sleep(700);
  const st = await measure();
  report.modes.push({ mode, theme: st.theme, appearance: st.appearance, effective: st.effective,
    counter: st.counter, docOverflow: st.docOverflow, toolbarInsideColumn: st.toolbarInsideColumn,
    controlsOutsideColumn: st.controlsOutsideColumn });
  report[`shot_mode_${mode}_dark`] = await shot(`dark-mode-${mode}`);
}
await setSelect('#mode', 'continuous');

report.typography = [];
for (const [name, sel, value] of [['text-size-130', '#zoom', '130'], ['spacing-relaxed', '#spacing', 'relaxed'],
                                  ['font-georgia', '#font', 'georgia']]) {
  await setSelect(sel, value);
  const st = await measure();
  report.typography.push({ name, theme: st.theme, appearance: st.appearance, mode: st.mode, mainOverflow: st.mainOverflow });
  report[`shot_typography_${name}_dark`] = await shot(`dark-typography-${name}`);
}
await setSelect('#spacing', 'normal');
await setSelect('#font', 'original');
await setSelect('#zoom', '100');
const afterResets = await measure();
await click('#size-reset'); await sleep(300);
await click('#font-reset'); await sleep(300);
await click('#view-reset'); await sleep(800);
const afterViewReset = await measure();
report.resets = {
  afterTypographyControls: { theme: afterResets.theme, appearance: afterResets.appearance },
  afterResetTypography: { theme: afterViewReset.theme, appearance: afterViewReset.appearance },
  afterResetView: { theme: afterViewReset.theme, appearance: afterViewReset.appearance, mode: afterViewReset.mode,
                    leftClosed: afterViewReset.leftClosed, rightClosed: afterViewReset.rightClosed },
  themeKept: afterViewReset.theme === 'dark',
};

/* ---- resize must not reset the theme ----------------------------------- */
await setView(1024);
const resizeDark = await measure();
await emulateScheme('light');
await setSelect('#theme', 'system');
await emulateScheme('dark');
const systemAfterSchemeChange = await measure();
await emulateScheme('light');
const systemBackToLight = await measure();
report.system = {
  resizeKeptDark: resizeDark.theme, afterSchemeChange: systemAfterSchemeChange.theme,
  backToLight: systemBackToLight.theme, pref: systemBackToLight.appearance && systemBackToLight.appearance.pref,
};
await setSelect('#theme', 'light');

/* ------------------------------------------------------------- keyboard -- */
await setView(1400);
await setPanels(true, true);
const focusRing = () => evalJs(`(() => { const el = document.activeElement; if (!el) return null; const cs = getComputedStyle(el);
  return { id: el.id || el.tagName, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, offset: cs.outlineOffset }; })()`);
await evalJs('document.body.setAttribute("tabindex","-1"); document.body.focus()');
await evalJs('document.querySelector("#theme").focus()');
const themeFocusRing = await focusRing();
/* keyboard-operate the select: ArrowDown on a focused native select changes it */
await key('ArrowDown');
const afterKeyboardTheme = await measure();
await evalJs('document.querySelector("#theme").focus()');
await key('ArrowDown');
const afterKeyboardTheme2 = await measure();
report.keyboard = {
  themeFocusRing, afterKeyboardTheme: { theme: afterKeyboardTheme.theme, focus: afterKeyboardTheme.focus },
  afterKeyboardTheme2: { theme: afterKeyboardTheme2.theme, focus: afterKeyboardTheme2.focus },
  selectIsFocusable: !!themeFocusRing,
};
await setSelect('#theme', 'dark');
report[`shot_keyboard_dark`] = await shot('dark-keyboard-focus');

/* ---- disclosure expanded / collapsed in dark ---------------------------- */
await scrollToRegion('TMP-0542');
await evalJs('(() => { const d = document.querySelector("#TMP-0542 details.disclosure"); if (d) { d.open = false; d.scrollIntoView({ block: "start" }); } return true; })()');
await sleep(600);
report.disclosureCollapsed = await shot('dark-extdesc-collapsed');
const collapsedContrast = await evalJs(CONTRAST);
report.contrast.darkCollapsed = collapsedContrast;

/* -------------------------------------------------------- mobile + dark --- */
report.mobileDark = [];
for (const v of ['m390', 'm320']) {
  await setView(v);
  await setPanels(true, false);
  const st = await measure();
  report.mobileDark.push({ view: v, state: st });
  report[`shot_${v}_dark`] = await shot(`dark-${v}`);
}

/* ----------------------------------------------------------- full check -- */
/* ---- interaction: real Tab focus ring on the Appearance control --------- */
await setView(1400);
await setPanels(true, true);
await setSelect('#theme', 'light');
await evalJs('document.body.setAttribute("tabindex","-1"); document.body.focus()');
let tabTrail = [];
let themeRing = null;
for (let i = 0; i < 60; i++) {
  await key('Tab');
  const id = await evalJs('document.activeElement && (document.activeElement.id || document.activeElement.tagName)');
  tabTrail.push(id);
  if (id === 'theme') { themeRing = await evalJs(`(() => { const cs = getComputedStyle(document.activeElement);
    return { outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, offset: cs.outlineOffset,
             focusVisible: document.activeElement.matches(':focus-visible') }; })()`); break; }
}
report.tabFocus = { tabs: tabTrail.length, trail: tabTrail.slice(0, 30), themeRing };
await key('Tab');
const afterThemeTab = await evalJs('document.activeElement && (document.activeElement.id || document.activeElement.tagName)');
report.tabFocus.afterTheme = afterThemeTab;
report[`shot_tab_focus`] = await shot('appearance-tab-focus');

/* ---- interaction: the live search in its new bounded box ---------------- */
await setSelect('#theme', 'dark');
await evalJs('(() => { const s = document.querySelector("#search"); s.focus(); s.value = "profit"; s.dispatchEvent(new Event("input", { bubbles: true })); return s.value; })()');
await sleep(3000);
const searchState = await evalJs(`(() => {
  const st = document.querySelector('.toolbar [role="status"]');
  const hit = document.querySelector('.search-hit');
  const b = document.querySelector('#search').getBoundingClientRect();
  const tb = document.querySelector('.toolbar').getBoundingClientRect();
  return { status: st ? st.textContent : null, statusVisible: st ? st.getBoundingClientRect().height > 0 : null,
           hits: document.querySelectorAll('.search-hit').length, hitText: hit ? hit.textContent.trim().slice(0, 40) : null,
           searchInsideToolbar: b.left >= tb.left - 1 && b.right <= tb.right + 1,
           docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }; })()`);
report.search = searchState;
report[`shot_search_dark`] = await shot('dark-search-hit');
await evalJs('(() => { const s = document.querySelector("#search"); s.value = ""; s.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
await sleep(1200);

/* ---- interaction: sticky while scrolling ------------------------------- */
await scrollToRegion('TMP-1107', 600);
const stickyState = await evalJs(`(() => {
  const tb = document.querySelector('.toolbar').getBoundingClientRect();
  const m = document.querySelector('main').getBoundingClientRect();
  return { topbarTop: Math.round(tb.top), topbarBottom: Math.round(tb.bottom), mainTop: Math.round(m.top),
           visible: tb.height > 0 && tb.top >= m.top - 1 && tb.bottom <= m.bottom,
           scrollTop: Math.round(document.querySelector('main').scrollTop),
           insideColumn: (() => { const cs = getComputedStyle(document.querySelector('main'));
             const pad = (parseFloat(cs.paddingLeft) || 0); const box = { left: m.left + pad, right: m.right - (parseFloat(cs.paddingRight) || 0) };
             return tb.left >= box.left - 1 && tb.right <= box.right + 1; })() }; })()`);
report.sticky = stickyState;

/* ---- interaction: an anchored Contents link lands below the toolbar ----- */
const anchorJump = await evalJs(`(async () => {
  const link = document.querySelector('#contents-nav a[href="#book-heading-0012"]')
            || document.querySelector('#contents-nav a[href^="#book-heading-"]');
  if (!link) return { error: 'no heading link' };
  const href = link.getAttribute('href');
  const id = href.slice(1);
  link.click();
  await new Promise((r) => setTimeout(r, 900));
  const target = document.getElementById(id);
  const tb = document.querySelector('.toolbar').getBoundingClientRect();
  const tr = target ? target.getBoundingClientRect() : null;
  return { href, targetFound: !!target, targetTop: tr ? Math.round(tr.top) : null,
           toolbarBottom: Math.round(tb.bottom), clear: !!tr && tr.top >= tb.bottom - 1,
           hash: location.hash }; })()`);
report.anchor = anchorJump;
report[`shot_anchor`] = await shot('dark-anchor-landing');

/* ---- toolbar on a wrapped desktop width (1024 + both panels) ------------ */
await setView(1024);
await setPanels(true, true);
report[`shot_1024`] = await shot('toolbar-1024-both-open');
const wrapState = await measure();
report.wrappedToolbar = { width: wrapState.toolbarWidth, rows: wrapState.toolbarRows,
  insideColumn: wrapState.toolbarInsideColumn, allControlsVisible: wrapState.allControlsVisible,
  docOverflow: wrapState.docOverflow };

/* ---- mobile: the live region must not break the two-row layout ---------- */
await setView('m390');
await setPanels(false, false);
await evalJs('(() => { const s = document.querySelector("#search"); s.value = "business"; s.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
await sleep(2500);
const mobileSearch = await measure();
report.mobileSearch = { rows: mobileSearch.toolbarRows, allControlsVisible: mobileSearch.allControlsVisible,
  docOverflow: mobileSearch.docOverflow, controlsOutsideColumn: mobileSearch.controlsOutsideColumn,
  status: await evalJs('(document.querySelector(".toolbar [role=status]")||{}).textContent'),
  statusVisible: await evalJs('!!(document.querySelector(".toolbar [role=status]")||{}).getBoundingClientRect && document.querySelector(".toolbar [role=status]").getBoundingClientRect().height>0') };
report[`shot_m390_search`] = await shot('mobile390-search-status');
await evalJs('(() => { const s = document.querySelector("#search"); s.value = ""; s.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');

report.integrityAfter = await evalJs(INTEGRITY);
await setView(1400);
await setSelect('#theme', 'dark');
const darkMeasure = await measure();
report.darkMeasure = darkMeasure;

report.errors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown'
  || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
  || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
  .map((e) => (e.method === 'Runtime.exceptionThrown'
    ? ((e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description) || e.params.exceptionDetails.text)
    : JSON.stringify(e.params).slice(0, 400)));
report.finishedAt = new Date().toISOString();
writeFileSync(join(outDir, `${label}-probe.json`), JSON.stringify(report, null, 1));

const tb = report.toolbarMatrix.map((m) => `${m.view}/${m.panels}: w=${m.state.toolbarWidth} rows=${m.state.toolbarRows} gapR=${m.state.toolbarGapRight} inside=${m.state.toolbarInsideColumn} overlapL=${m.state.overlapsLeftPanel} overlapR=${m.state.overlapsRightPanel} docOverflow=${m.state.docOverflow} allControls=${m.state.allControlsVisible}`);
const summary = {
  label, errors: report.errors,
  integrity: report.integrity, integrityAfter: report.integrityAfter,
  toolbar: tb,
  themes: report.themes.map((t) => `${t.name}: theme=${t.state.theme} applied=${t.state.appearance.applied} mapped=${t.state.appearance.mapped} build=${t.state.appearance.build_ms}ms apply=${t.state.appearance.apply_ms}ms`),
  contrastLight: Object.fromEntries(Object.entries(report.contrast.light).map(([k, v]) => [k, `min=${v.min} med=${v.median} below4.5=${v.below45}/${v.n}`])),
  contrastDark: Object.fromEntries(Object.entries(report.themes[1].contrast).map(([k, v]) => [k, `min=${v.min} med=${v.median} below4.5=${v.below45}/${v.n}`])),
  persistence: report.persistence.map((p) => `${p.case}: ${p.restored}`),
  position: report.position, resets: report.resets, system: report.system,
  keyboard: report.keyboard, modes: report.modes, typography: report.typography,
  filteredImages: darkMeasure.filteredImages, paintedImages: darkMeasure.paintedImages,
  tabFocus: report.tabFocus, search: report.search, sticky: report.sticky, anchor: report.anchor,
  wrappedToolbar: report.wrappedToolbar, mobileSearch: report.mobileSearch,
};
console.log(JSON.stringify(summary, null, 1));
process.exit(0);
