// Final release QA: reader features exercised for real (toolbar, sidebars,
// modes, theme, typography, search, history, responsive, keyboard, perf).
//
//   node reader/release_qa_interact.mjs [port] [fileUrl] [phases]
//   phases: shell,modes,theme,type,search,history,responsive,keyboard,perf,screens
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const port = process.argv[2] || '9356';
const fileUrl = process.argv[3]
  || 'file:///C:/Users/mhyah/Downloads/book-source/Word/_master_work/repo/AP/AP%20Book%20Final.html';
const phases = (process.argv[4] || 'shell,modes,theme,type,search,history,responsive,keyboard,perf,screens').split(',');
const OUTDIR = resolve(process.cwd(), 'reports/final_release_qa');
const SCREENS = join(OUTDIR, 'screens');
mkdirSync(SCREENS, { recursive: true });
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
  send(method, params = {}, timeoutMs = 1200000) {
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
await cdp.send('Page.enable');
await cdp.send('Log.enable');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function evq(expression, timeout) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true },
    timeout || 1200000);
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
async function reload(label) {
  await cdp.send('Page.navigate', { url: fileUrl });
  await wait(1500);
  const st = await gate();
  console.log('   reloaded for ' + label);
  return st;
}
function save(name, data) {
  writeFileSync(join(OUTDIR, name), JSON.stringify(data, null, 1));
  console.log('   wrote ' + name + ' (' + JSON.stringify(data).length + ' bytes)');
}
async function shot(name) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(SCREENS, name + '.png'), Buffer.from(r.data, 'base64'));
  return 'reports/final_release_qa/screens/' + name + '.png';
}
const setViewport = (w, h, mobile) => cdp.send('Emulation.setDeviceMetricsOverride',
  { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });

const results = { schema: 'book2.release.qa_interact.v1', fileUrl, startedAt: new Date().toISOString(), phases: {} };
await setViewport(1400, 1000);
results.gate = await gate();

if (phases.includes('shell')) {
  console.log('phase shell (sidebars + toolbar)');
  const shell = await evq(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const app = document.querySelector('.app');
    const main = document.querySelector('main');
    const toolbar = document.querySelector('main > .toolbar');
    const left = document.querySelector('#contents-panel');
    const right = document.querySelector('#reader-controls');
    const isClosed = (el) => !el || getComputedStyle(el).display === 'none'
      || el.getBoundingClientRect().width < 20
      || el.getBoundingClientRect().right <= 0 || el.getBoundingClientRect().left >= innerWidth;
    const state = () => {
      const mr = main.getBoundingClientRect();
      const tr = toolbar.getBoundingClientRect();
      const lr = left.getBoundingClientRect();
      const rr = right ? right.getBoundingClientRect() : null;
      return {
        leftClosed: isClosed(left), rightClosed: isClosed(right),
        leftWidth: Math.round(lr.width), rightWidth: rr ? Math.round(rr.width) : null,
        readingWidth: Math.round(mr.width), readingLeft: Math.round(mr.left),
        toolbar: { left: Math.round(tr.left), right: Math.round(tr.right), top: Math.round(tr.top),
          height: Math.round(tr.height), width: Math.round(tr.width) },
        windowGapRight: Math.round(innerWidth - tr.right),
        leftExpanded: document.querySelector('#left-toggle').getAttribute('aria-expanded'),
        rightExpanded: document.querySelector('#right-toggle').getAttribute('aria-expanded'),
        scrollTop: Math.round(main.scrollTop),
        docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    };
    const out = { states: {} };
    if (isClosed(left)) { document.querySelector('#left-toggle').click(); await sleep(450); }
    if (isClosed(right)) { document.querySelector('#right-toggle').click(); await sleep(450); }
    out.states.bothOpen = state();
    main.scrollTop += 26000;
    await sleep(400);
    const before = state();
    document.querySelector('#right-toggle').click(); await sleep(450);
    out.states.leftOpenRightClosed = state();
    document.querySelector('#right-toggle').click(); await sleep(450);
    out.states.leftOpenRightReopened = state();
    document.querySelector('#left-toggle').click(); await sleep(450);
    out.states.bothClosed = state();
    document.querySelector('#right-toggle').click(); await sleep(450);
    out.states.leftClosedRightOpen = state();
    document.querySelector('#left-toggle').click(); await sleep(450);
    out.states.bothOpenAgain = state();
    out.scrollPreserved = {
      before: before.scrollTop, after: state().scrollTop,
      delta: Math.abs(state().scrollTop - before.scrollTop),
    };
    const lc = document.querySelector('#left-close');
    if (lc) { lc.click(); await sleep(450); }
    out.afterLeftPanelClose = state();
    const rc = document.querySelector('#right-close');
    if (rc) { rc.click(); await sleep(450); }
    out.afterRightPanelClose = state();
    if (isClosed(left)) { document.querySelector('#left-toggle').click(); await sleep(400); }
    if (isClosed(right)) { document.querySelector('#right-toggle').click(); await sleep(400); }
    out.restored = state();
    const samples = [];
    for (const top of [0, 5000, 120000, 400000]) {
      main.scrollTop = top;
      await sleep(300);
      const tr = toolbar.getBoundingClientRect();
      samples.push({ requested: top, applied: Math.round(main.scrollTop), toolbarTop: Math.round(tr.top),
        toolbarBottom: Math.round(tr.bottom), toolbarRight: Math.round(tr.right),
        position: getComputedStyle(toolbar).position });
    }
    out.toolbarSamples = samples;
    out.toolbarTabOrder = [...document.querySelectorAll('main > .toolbar button, main > .toolbar input')]
      .map((el) => el.id || String(el.className));
    return out;
  })()`);
  const prefs = await evq("({ prefs: window.book2ReaderPrefs ? window.book2ReaderPrefs() : null, stored: JSON.parse(localStorage.getItem('book2.reader.v1') || 'null') })");
  shell.preferencesInSession = prefs;
  save('shell_audit.json', shell);
  results.phases.shell = {
    stateKeys: Object.keys(shell.states),
    scrollPreserved: shell.scrollPreserved,
    toolbarSamples: shell.toolbarSamples,
    fullscreenVsSplitReadingWidth: [shell.states.bothOpen.readingWidth, shell.states.bothClosed.readingWidth,
      shell.states.leftClosedRightOpen.readingWidth],
    expandedStates: {
      bothOpen: [shell.states.bothOpen.leftExpanded, shell.states.bothOpen.rightExpanded],
      bothClosed: [shell.states.bothClosed.leftExpanded, shell.states.bothClosed.rightExpanded],
    },
  };
  await reload('preference persistence');
  const persisted = await evq("({ prefs: window.book2ReaderPrefs ? window.book2ReaderPrefs() : null, stored: JSON.parse(localStorage.getItem('book2.reader.v1') || 'null'), leftClosed: getComputedStyle(document.querySelector('#contents-panel')).display === 'none' })");
  results.phases.shellPersisted = persisted;
}

if (phases.includes('modes')) {
  console.log('phase modes');
  const modes = await evq(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setMode = async (m) => {
      const s = document.querySelector('#mode');
      s.value = m;
      s.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(700);
    };
    const visibleRegions = () => [...document.querySelectorAll('.book-page')].filter((p) => p.offsetHeight > 0).length;
    const counter = () => (document.querySelector('#counter') || {}).textContent;
    const badge = () => (document.querySelector('#mode-badge') || {}).textContent;
    const app = document.querySelector('.app');
    const out = { perMode: {}, steps: {} };
    for (const m of ['continuous', 'section', 'single']) {
      await setMode(m);
      out.perMode[m] = { badge: badge(), counter: counter(), visibleRegions: visibleRegions(),
        dataMode: app.getAttribute('data-mode'), effective: app.getAttribute('data-effective-mode'),
        appClasses: app.className, label: (document.querySelector('#mode-note') || {}).textContent };
    }
    for (const m of ['continuous', 'section', 'single']) {
      await setMode(m);
      const steps = [];
      for (let i = 0; i < 3; i++) {
        document.querySelector('#next').click();
        await sleep(700);
        steps.push({ dir: 'next', counter: counter(), visible: visibleRegions(), hash: location.hash });
      }
      for (let i = 0; i < 4; i++) {
        document.querySelector('#prev').click();
        await sleep(700);
        steps.push({ dir: 'prev', counter: counter(), visible: visibleRegions(), hash: location.hash });
      }
      out.steps[m] = steps;
    }
    await setMode('section');
    const atStart = [];
    for (let i = 0; i < 4; i++) {
      document.querySelector('#prev').click();
      await sleep(500);
      atStart.push(counter());
    }
    out.sectionPrevAtStart = atStart;
    await setMode('single');
    const singleStart = [];
    for (let i = 0; i < 4; i++) {
      document.querySelector('#prev').click();
      await sleep(500);
      singleStart.push(counter());
    }
    out.singlePrevAtStart = singleStart;
    await setMode('continuous');
    out.continuousAfter = { visibleRegions: visibleRegions(),
      regions: document.querySelectorAll('.book-page').length, badge: badge() };
    return out;
  })()`);
  save('mode_audit.json', modes);
  results.phases.modes = {
    perMode: modes.perMode,
    continuousVisible: modes.continuousAfter,
    sectionPrevAtStart: modes.sectionPrevAtStart,
    singlePrevAtStart: modes.singlePrevAtStart,
  };
}

if (phases.includes('theme')) {
  console.log('phase theme');
  const theme = await evq(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const sel = document.querySelector('#theme');
    const set = async (v) => {
      sel.value = v;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(650);
    };
    const sampleEls = [...document.querySelectorAll('.book-page [style]')].slice(0, 400);
    const snapshot = () => ({
      theme: document.documentElement.getAttribute('data-theme'),
      styles: sampleEls.map((el) => el.getAttribute('style')).join('|'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      railBg: getComputedStyle(document.querySelector('#contents-panel')).backgroundColor,
    });
    await set('light');
    const light = snapshot();
    await set('dark');
    const dark = snapshot();
    await set('light');
    const light2 = snapshot();
    for (let i = 0; i < 4; i++) { await set('dark'); await set('light'); }
    const light6 = snapshot();
    await set('dark');
    const dark2 = snapshot();
    for (let i = 0; i < 4; i++) { await set('light'); await set('dark'); }
    const dark6 = snapshot();
    const imgFilters = [...document.querySelectorAll('img')].slice(0, 6).map((i) => getComputedStyle(i).filter);
    const imgSrcUnchanged = [...document.querySelectorAll('.book-page img')].slice(0, 6).every((i) => i.getAttribute('src').startsWith('data:image/png'));
    await set('system');
    const systemState = { theme: document.documentElement.getAttribute('data-theme'), bodyBg: getComputedStyle(document.body).backgroundColor };
    await set('light');
    return {
      options: [...sel.options].map((o) => o.value),
      light: { theme: light.theme, bodyBg: light.bodyBg, bodyColor: light.bodyColor },
      dark: { theme: dark.theme, bodyBg: dark.bodyBg, bodyColor: dark.bodyColor, railBg: dark.railBg },
      lightRestoredExactly: light.styles === light2.styles,
      lightStableAfter5Cycles: light.styles === light6.styles,
      darkStableAfter5Cycles: dark.styles === dark6.styles,
      lightDriftCells: light.styles === light6.styles ? 0
        : light.styles.split('|').filter((v, i) => v !== light6.styles.split('|')[i]).length,
      darkDriftCells: dark.styles === dark6.styles ? 0
        : dark.styles.split('|').filter((v, i) => v !== dark6.styles.split('|')[i]).length,
      imageFilters: imgFilters, imageFiltersAreNone: imgFilters.every((f) => f === 'none'),
      imageSrcUnchanged: imgSrcUnchanged,
      systemState: systemState,
    };
  })()`);
  save('theme_audit.json', theme);
  results.phases.theme = {
    options: theme.options, light: theme.light, dark: theme.dark,
    lightRestoredExactly: theme.lightRestoredExactly,
    lightStableAfter5Cycles: theme.lightStableAfter5Cycles,
    darkStableAfter5Cycles: theme.darkStableAfter5Cycles,
    lightDriftCells: theme.lightDriftCells, darkDriftCells: theme.darkDriftCells,
    imageFiltersAreNone: theme.imageFiltersAreNone, imageSrcUnchanged: theme.imageSrcUnchanged,
    systemState: theme.systemState,
  };
  await reload('theme persistence');
  const persisted = await evq("({ theme: document.documentElement.getAttribute('data-theme'), stored: JSON.parse(localStorage.getItem('book2.reader.v1') || 'null') })");
  results.phases.themePersisted = persisted;
}

if (phases.includes('type')) {
  console.log('phase typography');
  const type = await evq(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const probe = () => {
      const p = document.querySelector('.book-page p');
      const badge = document.querySelector('.lg-badge');
      const table = document.querySelector('.book-page table');
      const img = document.querySelector('.book-page img');
      const credit = document.querySelector('.b2-vcredit');
      const desc = document.querySelector('.b2-desc-label');
      const navRow = document.querySelector('#contents-nav .nav-child');
      const cs = getComputedStyle(p);
      const rectOf = (el) => (el ? [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)] : null);
      return {
        fontFamily: cs.fontFamily, fontSize: cs.fontSize, lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing, rootFontSize: getComputedStyle(document.documentElement).fontSize,
        badgeRect: rectOf(badge), tableWidth: table ? Math.round(table.getBoundingClientRect().width) : null,
        imgWidth: img ? Math.round(img.getBoundingClientRect().width) : null,
        creditMode: credit ? getComputedStyle(credit).writingMode : null,
        creditFont: credit ? getComputedStyle(credit).fontSize : null,
        creditRect: rectOf(credit), descRect: rectOf(desc),
        navRowFont: navRow ? getComputedStyle(navRow).fontSize : null,
        zoomVal: (document.querySelector('#zoom-val') || {}).textContent,
        sizeVal: (document.querySelector('#size-val') || {}).textContent,
      };
    };
    const out = { baseline: probe(), steps: [] };
    const font = document.querySelector('#font');
    out.fontOptions = font ? [...font.options].map((o) => o.value) : null;
    if (font) {
      for (const opt of [...font.options].map((o) => o.value)) {
        font.value = opt;
        font.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(450);
        out.steps.push({ control: 'font', value: opt, after: probe() });
      }
    }
    const spacing = document.querySelector('#spacing');
    out.spacingOptions = spacing ? [...spacing.options].map((o) => o.value) : null;
    if (spacing) {
      for (const opt of [...spacing.options].map((o) => o.value)) {
        spacing.value = opt;
        spacing.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(450);
        out.steps.push({ control: 'spacing', value: opt, after: probe() });
      }
    }
    const zoom = document.querySelector('#zoom');
    out.zoomRange = zoom ? { min: zoom.min, max: zoom.max, step: zoom.step, value: zoom.value } : null;
    if (zoom) {
      for (const v of [zoom.min, zoom.max, '100']) {
        zoom.value = v;
        zoom.dispatchEvent(new Event('input', { bubbles: true }));
        zoom.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(550);
        out.steps.push({ control: 'zoom', value: v, after: probe() });
      }
    }
    const sizeVal = document.querySelector('#size-val');
    out.sizeControls = sizeVal ? { text: sizeVal.textContent, parentButtons: [...sizeVal.parentElement.querySelectorAll('button')].map((b) => b.id || b.textContent.trim().slice(0, 10)) } : null;
    for (const id of ['#zoom-reset', '#zoom-in', '#zoom-out', '#size-reset', '#font-reset', '#view-reset']) {
      const el = document.querySelector(id);
      if (el) { el.click(); await sleep(500); out.steps.push({ control: id, after: probe() }); }
      else out.steps.push({ control: id, missing: true });
    }
    out.controlsInPanel = [...document.querySelectorAll('#reader-controls select, #reader-controls input, #reader-controls button')]
      .map((el) => ({ id: el.id || null, tag: el.tagName.toLowerCase(), type: el.getAttribute('type') }));
    return out;
  })()`);
  save('typography_audit.json', type);
  const changed = type.steps.filter((s) => s.after && s.after.fontSize !== type.baseline.fontSize).length;
  results.phases.type = {
    fontOptions: type.fontOptions, spacingOptions: type.spacingOptions, zoomRange: type.zoomRange,
    stepsThatChangedFontSize: changed, stepCount: type.steps.length,
    controlsInPanel: type.controlsInPanel,
    badgeScaleAcrossSteps: type.steps.map((s) => (s.after ? s.after.badgeRect : null)).filter(Boolean),
  };
}

if (phases.includes('search')) {
  console.log('phase search');
  const search = await evq(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const input = document.querySelector('#search');
    const main = document.querySelector('main');
    const run = async (q) => {
      input.value = q;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await sleep(1400);
      const marks = [...document.querySelectorAll('mark, .search-hit, [data-search-hit], .b2-hit')];
      return {
        query: q,
        marks: marks.length,
        firstMark: marks[0] ? {
          text: marks[0].textContent.slice(0, 45),
          region: marks[0].closest('.book-page') ? marks[0].closest('.book-page').id : null,
          top: Math.round(marks[0].getBoundingClientRect().top),
        } : null,
        counter: (document.querySelector('#counter') || {}).textContent,
        scrollTop: Math.round(main.scrollTop),
        hash: location.hash,
        activeRow: (() => { const a = document.querySelector('#contents-nav .nav-child[aria-current]'); return a ? a.getAttribute('href') : null; })(),
        statusText: (document.querySelector('#search-status, .search-status, [aria-live]') || {}).textContent || null,
      };
    };
    const out = { cases: [] };
    const queries = ['business', 'elasticity', 'Price Elasticity of Demand', 'PRICE ELASTICITY',
      'zzzz-no-such-token-zzzz', '', 'Cotopaxi', 'efficiency', 'opportunity cost'];
    for (const q of queries) out.cases.push(await run(q));
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(1000);
    out.afterClear = {
      marks: document.querySelectorAll('mark, .search-hit, [data-search-hit], .b2-hit').length,
      counter: (document.querySelector('#counter') || {}).textContent,
      hash: location.hash,
    };
    return out;
  })()`);
  save('search_audit.json', search);
  results.phases.search = search.cases.map((c) => ({ q: c.query, marks: c.marks,
    region: c.firstMark ? c.firstMark.region : null, counter: c.counter, statusText: c.statusText }));
  results.phases.searchAfterClear = search.afterClear;
}

if (phases.includes('history')) {
  console.log('phase history');
  const hist = await evq(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const toolbar = document.querySelector('main > .toolbar');
    const main = document.querySelector('main');
    const measure = () => {
      const el = location.hash ? document.getElementById(location.hash.slice(1)) : null;
      const rect = el ? el.getBoundingClientRect() : null;
      const tb = toolbar.getBoundingClientRect();
      return {
        hash: location.hash,
        target: el ? el.id : null,
        gap: rect ? Math.round(rect.top - tb.bottom) : null,
        belowToolbar: !!(rect && rect.top >= tb.bottom - 1),
        inViewport: !!(rect && rect.top < main.getBoundingClientRect().bottom),
        counter: (document.querySelector('#counter') || {}).textContent,
      };
    };
    const links = [...document.querySelectorAll('#contents-nav a[href^="#book-heading-"]')];
    const a = links[30].getAttribute('href');
    const b = links[300].getAttribute('href');
    const steps = [];
    document.querySelector('#contents-nav a[href="' + a + '"]').click();
    await sleep(2200);
    steps.push({ what: 'click A', href: a, m: measure() });
    document.querySelector('#contents-nav a[href="' + b + '"]').click();
    await sleep(2200);
    steps.push({ what: 'click B', href: b, m: measure() });
    window.history.back();
    await sleep(2500);
    steps.push({ what: 'back', expect: a, m: measure() });
    window.history.forward();
    await sleep(2500);
    steps.push({ what: 'forward', expect: b, m: measure() });
    document.querySelector('#contents-nav a[href="' + b + '"]').click();
    await sleep(1800);
    const twice1 = measure();
    document.querySelector('#contents-nav a[href="' + b + '"]').click();
    await sleep(1800);
    const twice2 = measure();
    return { a: a, b: b, steps: steps, sameLinkTwice: { first: twice1, second: twice2 } };
  })()`);
  save('history_audit.json', hist);
  results.phases.history = hist.steps.map((s) => ({ what: s.what, hash: s.m.hash, gap: s.m.gap,
    belowToolbar: s.m.belowToolbar, correct: s.expect ? s.m.hash === s.expect : s.m.hash === s.href }));
  results.phases.historySameTwice = hist.sameLinkTwice;
}

if (phases.includes('responsive')) {
  console.log('phase responsive');
  const viewports = [[320, 700, true], [375, 812, true], [390, 844, true], [600, 900, true], [768, 1024, true],
    [850, 1000, false], [1024, 768, false], [1366, 768, false], [1400, 1000, false], [1920, 1080, false]];
  const rows = [];
  for (const vp of viewports) {
    await setViewport(vp[0], vp[1], vp[2]);
    await wait(650);
    rows.push(await evq(`(() => {
      const toolbar = document.querySelector('main > .toolbar');
      const main = document.querySelector('main');
      const left = document.querySelector('#contents-panel');
      const right = document.querySelector('#reader-controls');
      const tr = toolbar.getBoundingClientRect();
      const visible = (el) => !!el && el.getBoundingClientRect().width > 20 && getComputedStyle(el).display !== 'none';
      return {
        viewport: [innerWidth, innerHeight],
        toolbarHeight: Math.round(tr.height),
        toolbarWidth: Math.round(tr.width),
        toolbarLeft: Math.round(tr.left),
        toolbarRight: Math.round(tr.right),
        toolbarWraps: tr.height > 60,
        toolbarFits: tr.right <= innerWidth + 1 && tr.left >= -1,
        docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        leftPanelVisible: visible(left),
        rightPanelVisible: visible(right),
        readingWidth: Math.round(main.getBoundingClientRect().width),
        navOffset: getComputedStyle(document.documentElement).getPropertyValue('--b2-nav-offset').trim(),
        searchWidth: Math.round(document.querySelector('#search').getBoundingClientRect().width),
        appClasses: document.querySelector('.app').className,
      };
    })()`));
  }
  await setViewport(320, 700, true);
  await wait(500);
  await evq("document.querySelector('main').scrollTop = 0");
  await wait(500);
  const cover320 = await shot('mobile-320-cover');
  const coverInfo = await evq(`(() => {
    const region = document.getElementById('TMP-0001');
    const imgs = [...region.querySelectorAll('img')].map((i) => ({
      natural: [i.naturalWidth, i.naturalHeight],
      rendered: [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)],
      alt: i.getAttribute('alt'),
    }));
    const texts = [...region.querySelectorAll('p')].slice(0, 6).map((p) => ({
      text: (p.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      width: Math.round(p.getBoundingClientRect().width),
      scrollOverflow: p.scrollWidth - p.clientWidth,
    }));
    return {
      regionWidth: Math.round(region.getBoundingClientRect().width),
      docOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      imgs: imgs, paragraphs: texts,
      toolbarHeight: Math.round(document.querySelector('main > .toolbar').getBoundingClientRect().height),
    };
  })()`);
  await setViewport(390, 844, true);
  await wait(500);
  const cover390 = await shot('mobile-390-cover');
  const drawerMobile = await evq(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const left = document.querySelector('#contents-panel');
    const right = document.querySelector('#reader-controls');
    const vis = (el) => !!el && el.getBoundingClientRect().width > 20 && getComputedStyle(el).display !== 'none';
    const out = { start: { left: vis(left), right: vis(right) } };
    if (!vis(left)) { document.querySelector('#left-toggle').click(); await sleep(500); }
    out.leftAfterToggle = vis(left);
    if (!vis(right)) { document.querySelector('#right-toggle').click(); await sleep(500); }
    out.rightAfterToggle = vis(right);
    const links = [...document.querySelectorAll('#contents-nav a[href^="#book-heading-"]')];
    const href = links[150].getAttribute('href');
    document.querySelector('#contents-nav a[href="' + href + '"]').click();
    await sleep(2500);
    const toolbar = document.querySelector('main > .toolbar');
    const el = document.getElementById(href.slice(1));
    const rect = el ? el.getBoundingClientRect() : null;
    out.afterNav = {
      href: href,
      leftDrawerOpen: vis(left),
      rightDrawerOpen: vis(right),
      belowToolbar: !!(rect && rect.top >= toolbar.getBoundingClientRect().bottom - 1),
      gap: rect ? Math.round(rect.top - toolbar.getBoundingClientRect().bottom) : null,
      storedPrefs: JSON.parse(localStorage.getItem('book2.reader.v1') || 'null'),
    };
    return out;
  })()`);
  await setViewport(1400, 1000);
  await wait(500);
  const desktopAfterMobile = await evq(`(() => {
    const left = document.querySelector('#contents-panel');
    const right = document.querySelector('#reader-controls');
    const vis = (el) => !!el && el.getBoundingClientRect().width > 20 && getComputedStyle(el).display !== 'none';
    return { leftVisible: vis(left), rightVisible: vis(right),
      prefs: JSON.parse(localStorage.getItem('book2.reader.v1') || 'null') };
  })()`);
  save('responsive_audit.json', { schema: 'book2.release.responsive.v1', viewports: rows,
    cover320: cover320, cover390: cover390, coverInfo: coverInfo,
    mobileDrawer: drawerMobile, desktopAfterMobile: desktopAfterMobile });
  results.phases.responsive = {
    viewports: rows.map((r) => ({ vp: r.viewport, toolbarHeight: r.toolbarHeight, wraps: r.toolbarWraps,
      fits: r.toolbarFits, overflowX: r.docOverflowX, navOffset: r.navOffset })),
    coverInfo: coverInfo, mobileDrawer: drawerMobile, desktopAfterMobile: desktopAfterMobile,
  };
}

if (phases.includes('keyboard')) {
  console.log('phase keyboard');
  const kb = await evq(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const active = () => {
      const el = document.activeElement;
      if (!el) return null;
      return el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0];
    };
    const focusables = () => [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
      .filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden'
        && getComputedStyle(e).display !== 'none');
    const seq = [];
    const start = document.querySelector('#left-toggle');
    start.focus();
    seq.push(active());
    for (let i = 0; i < 10; i++) {
      const list = focusables();
      const idx = list.indexOf(document.activeElement);
      const next = list[Math.min(idx + 1, list.length - 1)];
      if (next) next.focus();
      await sleep(50);
      seq.push(active());
    }
    const ringOf = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel: sel, missing: true };
      el.focus();
      const cs = getComputedStyle(el);
      return { sel: sel, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
        outlineWidthPx: parseFloat(cs.outlineWidth),
        boxShadow: cs.boxShadow === 'none' ? null : cs.boxShadow.slice(0, 40) };
    };
    const rings = ['#left-toggle', '#prev', '#next', '#search', '#right-toggle', '#nav-expand',
      '#nav-collapse', '#zoom', '#theme', '#font', '#spacing'].map(ringOf);
    const d = document.querySelector('details.disclosure');
    const sum = d.querySelector('summary');
    d.open = false;
    await sleep(120);
    const closedH = Math.round(d.getBoundingClientRect().height);
    sum.focus();
    sum.click();
    await sleep(400);
    const openH = Math.round(d.getBoundingClientRect().height);
    const openedByClick = d.open;
    sum.click();
    await sleep(400);
    const closedAgainH = Math.round(d.getBoundingClientRect().height);
    const lt = document.querySelector('#left-toggle');
    lt.focus();
    lt.click();
    await sleep(500);
    const afterOpenFocus = active();
    const lc = document.querySelector('#left-close');
    if (lc) { lc.focus(); lc.click(); await sleep(500); }
    const afterCloseFocus = active();
    return {
      tabSequence: seq, focusRings: rings,
      disclosure: { closedH: closedH, openH: openH, openedByClick: openedByClick, closedAgainH: closedAgainH },
      drawerFocus: { afterOpenFocus: afterOpenFocus, afterCloseFocus: afterCloseFocus },
    };
  })()`);
  save('keyboard_audit.json', kb);
  results.phases.keyboard = kb;
}

if (phases.includes('perf')) {
  console.log('phase perf');
  const wall = Date.now();
  await reload('perf load');
  const loadMs = Date.now() - wall;
  const perf = await evq(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const main = document.querySelector('main');
    const time = async (label, fn) => {
      const a = performance.now();
      await fn();
      return { label: label, ms: Math.round(performance.now() - a) };
    };
    const setMode = async (m) => {
      const s = document.querySelector('#mode');
      s.value = m;
      s.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(600);
    };
    const timings = [];
    timings.push(await time('search', async () => {
      const i = document.querySelector('#search');
      i.value = 'business';
      i.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(900);
    }));
    timings.push(await time('contents-click', async () => {
      const a = document.querySelectorAll('#contents-nav a[href^="#book-heading-"]')[200];
      a.click();
      await sleep(900);
    }));
    timings.push(await time('mode-section', async () => { await setMode('section'); }));
    timings.push(await time('mode-source-capture', async () => { await setMode('single'); }));
    timings.push(await time('mode-continuous', async () => { await setMode('continuous'); }));
    timings.push(await time('sidebar-toggle', async () => {
      document.querySelector('#right-toggle').click();
      await sleep(400);
      document.querySelector('#right-toggle').click();
    }));
    timings.push(await time('disclosure-open', async () => {
      const d = document.querySelector('details.disclosure');
      d.open = true;
      await sleep(250);
    }));
    const memBefore = performance.memory ? performance.memory.usedJSHeapSize : null;
    const stress = [];
    for (let round = 0; round < 3; round++) {
      const a = performance.now();
      for (let i = 0; i < 6; i++) {
        const link = document.querySelectorAll('#contents-nav a[href^="#"]')[100 + i * 50];
        if (link) link.click();
        await sleep(120);
      }
      const th = document.querySelector('#theme');
      th.value = round % 2 ? 'dark' : 'light';
      th.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(400);
      await setMode(round % 2 ? 'section' : 'single');
      document.querySelector('#nav-expand').click();
      await sleep(200);
      document.querySelector('#nav-collapse').click();
      await sleep(200);
      const d = document.querySelectorAll('details.disclosure')[round];
      d.open = true;
      await sleep(120);
      d.open = false;
      stress.push({ round: round, ms: Math.round(performance.now() - a) });
    }
    const memAfter = performance.memory ? performance.memory.usedJSHeapSize : null;
    main.scrollTop = main.scrollHeight;
    await sleep(1500);
    const endReachable = { scrollTop: Math.round(main.scrollTop), scrollHeight: main.scrollHeight,
      lastRegionVisible: document.getElementById('TMP-1899').offsetHeight > 0 };
    return {
      navigation: { domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
        load: Math.round(nav.loadEventEnd || 0), type: nav.type },
      timings: timings,
      memory: { before: memBefore, after: memAfter,
        growthMB: memBefore && memAfter ? Math.round((memAfter - memBefore) / 1048576) : null },
      stress: stress, endReachable: endReachable,
      elementCount: document.getElementsByTagName('*').length,
    };
  })()`, 1200000);
  perf.wallClockLoadMs = loadMs;
  save('performance_audit.json', perf);
  results.phases.perf = perf;
}

if (phases.includes('screens')) {
  console.log('phase screens');
  await setViewport(1400, 1000);
  await wait(500);
  const shots = {};
  const gotoScroll = async (selector) => {
    const ok = await evq('(() => { const el = document.querySelector(' + JSON.stringify(selector)
      + '); if (!el) return false; el.scrollIntoView({ block: "start" }); return true; })()');
    await wait(1000);
    return ok;
  };
  const targets = [
    ['cover', '#TMP-0001'],
    ['frontmatter-contents', '#book-heading-0004'],
    ['unit1-opener', '#book-heading-0007'],
    ['case-study-cotopaxi', '#book-heading-0008'],
    ['module-1-1', '#book-heading-0009'],
    ['lg-badge-region', '#TMP-0119'],
    ['disclosure-front-cover', '#TMP-0002'],
    ['table-region', '#TMP-0333'],
    ['credit-region', '#TMP-0254'],
    ['glossary', '#book-heading-0382'],
    ['last-linked-row', '#book-heading-0383'],
    ['deep-region', '#TMP-1500'],
  ];
  for (const pair of targets) {
    const found = await gotoScroll(pair[1]);
    const file = await shot('desktop-' + pair[0]);
    shots[pair[0]] = { selector: pair[1], found: found, file: file };
  }
  await evq("(() => { const s = document.querySelector('#mode'); s.value = 'section'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await wait(900);
  shots.modeSection = { file: await shot('desktop-mode-section') };
  await evq("(() => { const s = document.querySelector('#mode'); s.value = 'single'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await wait(900);
  shots.modeSourceCapture = { file: await shot('desktop-mode-source-capture') };
  await evq("(() => { const s = document.querySelector('#mode'); s.value = 'continuous'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await evq("(() => { const t = document.querySelector('#theme'); t.value = 'dark'; t.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await wait(900);
  shots.darkContinuous = { file: await shot('desktop-dark-continuous') };
  await evq("(() => { const d = document.querySelector('details.disclosure'); d.open = true; d.scrollIntoView({ block: 'center' }); })()");
  await wait(800);
  shots.darkDisclosureOpen = { file: await shot('desktop-dark-disclosure-open') };
  await evq("(() => { const t = document.querySelector('#theme'); t.value = 'light'; t.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await wait(800);
  await evq("(() => { const t = document.querySelector('.book-page table'); if (t) t.scrollIntoView({ block: 'center' }); })()");
  await wait(800);
  shots.tableStructure = { file: await shot('desktop-table') };
  await evq("(() => { document.querySelector('#nav-expand').click(); })()");
  await wait(700);
  shots.contentsExpanded = { file: await shot('desktop-contents-expanded') };
  save('screens_inventory.json', shots);
  results.phases.screens = Object.keys(shots);
}

results.jsErrors = cdp.events
  .filter((e) => e.method === 'Runtime.exceptionThrown'
    || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
  .map((e) => (e.method === 'Runtime.exceptionThrown'
    ? (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description
      || e.params.exceptionDetails.text)
    : JSON.stringify(e.params).slice(0, 200)));
results.finishedAt = new Date().toISOString();
save('stage_b_summary.json', results);
console.log('js errors: ' + results.jsErrors.length + ' ' + JSON.stringify(results.jsErrors.slice(0, 3)));
console.log('DONE phases: ' + phases.join(','));
process.exit(0);
