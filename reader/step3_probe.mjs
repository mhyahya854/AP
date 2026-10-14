// Step 3 Contents-navigation probe: drives the real 1.13 GB reader in headless
// Chrome over CDP and measures where a Contents click actually lands.
//
//   node reader/step3_probe.mjs <fileUrl> <outDir> [--label name] [--port 9341]
//                               [--matrix quick|full] [--screens]
//
// Chrome must already be listening with --remote-debugging-port=<port>.
import { writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const fileUrl = process.argv[2];
const outDir = process.argv[3];
const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : dflt; };
const label = arg('--label', 'run');
const port = arg('--port', '9341');
const matrix = arg('--matrix', 'quick');
const wantShots = process.argv.includes('--screens');
/* the artifact under test always has 1,899 regions; a fixture has fewer.  The
   count is the only reliable proof that the *new* document is the one
   answering, because location.href updates before the load commits. */
const expectRegions = Number(arg('--expect-regions', '1899'));
const ENDPOINT = process.env.BOOK3_CDP || `http://127.0.0.1:${port}`;
mkdirSync(outDir, { recursive: true });
/* a re-run owns its label's evidence: drop this label's earlier output */
for (const f of readdirSync(outDir)) {
  if (f.startsWith(label + '-') || f === `${label}-probe.json`) { rmSync(join(outDir, f)); }
}

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
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = async (expression, timeoutMs = 900000) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails));
  return r.result.value;
};
const shot = async (name) => {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const f = join(outDir, `${label}-${name}.png`);
  writeFileSync(f, Buffer.from(r.data, 'base64'));
  return f;
};
const viewport = async (w, h, mobile = false) => {
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
  await sleep(700);
};

async function waitReady() {
  const t0 = Date.now();
  let tries = 0;
  while (Date.now() - t0 < 300000) {
    try {
      const st = await evalJs('(()=>({rs:document.readyState,ui:!!window.book2ReaderPrefs,'
        + 'sem:!!window.book2Semantics,rows:document.querySelectorAll("#contents-nav .nav-child").length,'
        + 'regions:document.querySelectorAll(".book-page").length}))()', 120000);
      tries++;
      if (tries % 5 === 1) {
        console.log(`  [waitReady ${((Date.now() - t0) / 1000).toFixed(0)}s] rs=${st && st.rs} rows=${st && st.rows} ui=${st && st.ui} sem=${st && st.sem}`);
      }
      if (st && st.rs === 'complete' && st.ui && st.sem && st.rows > 500 && st.regions === expectRegions) {
        console.log(`  [waitReady] complete after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        return st;
      }
    } catch (e) { console.log('  [waitReady] eval:', String(e).slice(0, 120)); }
    await sleep(1000);
  }
  throw new Error('reader did not become ready');
}
/* a navigation is only finished when the *new* document is the one answering */
async function navigate(url) {
  const want = url;
  await cdp.send('Page.navigate', { url });
  const t0 = Date.now();
  while (Date.now() - t0 < 300000) {
    try {
      const st = await evalJs('(()=>({href:location.href,rs:document.readyState,'
        + 'rows:document.querySelectorAll("#contents-nav .nav-child").length,'
        + 'regions:document.querySelectorAll(".book-page").length}))()', 120000);
      if (st && st.rs === 'complete' && st.rows > 500 && st.regions === expectRegions
          && st.href === want) {
        await waitReady();
        return;
      }
    } catch (e) { /* mid-navigation */ }
    await sleep(500);
  }
  throw new Error('navigation to ' + url + ' did not settle');
}

/* ---------------------------------------------------------------- census -- */
const CENSUS = `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const pages = [...document.querySelectorAll('.book-page')];
  const pid = new Map(pages.map((p, i) => [p, i]));
  const heads = [...document.querySelectorAll('[id^="book-heading-"]')].map((el) => {
    const reg = el.closest('.book-page');
    return { id: el.id, tag: el.tagName, role: el.getAttribute('role'),
             level: el.getAttribute('aria-level'),
             region: reg ? reg.id : null, regionIndex: reg ? pid.get(reg) : null,
             text: norm(el.textContent).slice(0, 200) };
  });
  const railRows = [...document.querySelectorAll('#contents-nav a[href^="#"], #contents-nav span.nav-unlinked')];
  const rows = railRows.map((el) => {
    const href = el.getAttribute('href');
    const labelEl = el.querySelector('.nav-page');
    const title = norm(el.textContent.replace(labelEl ? labelEl.textContent : '\\u0000', ''));
    let group = null, module = null;
    let node = el;
    while (node) {
      if (!group && node.tagName === 'DETAILS' && node.classList.contains('nav-group')) {
        const s = node.querySelector('summary'); group = norm(s ? s.textContent : '');
      }
      if (!module && node.tagName === 'DETAILS' && node.classList.contains('nav-module')) {
        const s = node.querySelector('summary'); module = norm(s ? s.textContent : '');
      }
      node = node.parentElement;
    }
    let target = null, tag = null, region = null, ttext = null, regionIndex = null;
    if (href) {
      const id = decodeURIComponent(href.slice(1));
      target = document.getElementById(id);
      if (target) { tag = target.tagName; region = (target.closest('.book-page') || {}).id || null;
                    regionIndex = target.closest('.book-page') ? pid.get(target.closest('.book-page')) : null;
                    ttext = norm(target.textContent).slice(0, 200); }
    }
    return { tag: el.tagName, href, id: el.getAttribute('data-source-contents-id'),
             supplied: el.getAttribute('data-supplied-entry'), depth: el.getAttribute('data-depth'),
             linkKind: el.getAttribute('data-link-kind'),
             page: labelEl ? norm(labelEl.textContent) : null, title,
             classes: el.className, group, module,
             targetExists: !!target, targetTag: tag, targetRegion: region, targetRegionIndex: regionIndex,
             targetText: ttext };
  });
  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
  const seen = new Set(), dup = new Set();
  for (const id of ids) { if (seen.has(id)) dup.add(id); else seen.add(id); }
  const links = [...document.querySelectorAll('a[href^="#"]')];
  const broken = links.filter((a) => { const h = a.getAttribute('href').slice(1); return h && !document.getElementById(decodeURIComponent(h)); })
    .map((a) => ({ href: a.getAttribute('href'), text: norm(a.textContent).slice(0, 60) }));
  const numbered = [...document.querySelectorAll('.nav-page')].filter((s) => norm(s.textContent).length > 0);
  const toolbar = document.querySelector('main > .toolbar');
  return {
    regions: pages.length, firstRegion: pages[0] && pages[0].id, lastRegion: pages[pages.length - 1] && pages[pages.length - 1].id,
    headingCount: heads.length, headings: heads,
    railRows: rows.length, rows,
    hrefCount: links.length, brokenLinks: broken,
    duplicateIds: [...dup],
    groups: document.querySelectorAll('#contents-nav details.nav-group').length,
    modules: document.querySelectorAll('#contents-nav details.nav-module').length,
    sourceContentsGroups: document.querySelectorAll('#contents-nav details.source-contents').length,
    labelledCells: numbered.length,
    disclosureControls: document.querySelectorAll('.book-page details.disclosure').length,
    descLabels: document.querySelectorAll('.b2-desc-label').length,
    lgBadges: document.querySelectorAll('.lg-badge').length,
    tables: document.querySelectorAll('table').length,
    images: document.querySelectorAll('img').length,
    pngDataUris: document.querySelectorAll('img[src^="data:image/png"]').length,
    sectionStarts: document.querySelectorAll('[data-section-start]').length,
    verticalCredits: document.querySelectorAll('.b2-vcredit').length,
    toolbar: (() => { const b = toolbar.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), bottom: Math.round(b.bottom) }; })(),
    scrollMarginSample: (() => {
      const out = {};
      for (const id of ['book-heading-0001','book-heading-0007','book-heading-0383','TMP-0056','book-group-02']) {
        const el = document.getElementById(id);
        if (el) { const cs = getComputedStyle(el); out[id] = { tag: el.tagName, scrollMarginTop: cs.scrollMarginTop,
          scrollPaddingTop: getComputedStyle(document.querySelector('main')).scrollPaddingTop }; }
      }
      return out;
    })(),
  };
})()`;

/* --------------------------------------------------------------- landing -- */
const LAND = `((href) => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const main = document.querySelector('main');
  const app = document.querySelector('.app');
  const toolbar = document.querySelector('main > .toolbar');
  const toolbarBottom = toolbar.getBoundingClientRect().bottom;
  const mainRect = main.getBoundingClientRect();
  const id = decodeURIComponent(href.slice(1));
  const el = document.getElementById(id);
  const pages = [...document.querySelectorAll('.book-page')];
  const pid = new Map(pages.map((p, i) => [p, i]));
  const visible = pages.filter((p) => { const b = p.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
  let out = {
    href, mode: app.getAttribute('data-mode'), effective: app.getAttribute('data-effective-mode'),
    hash: location.hash,
    toolbar: { h: Math.round(toolbar.getBoundingClientRect().height), bottom: Math.round(toolbarBottom) },
    mainTop: Math.round(mainRect.top), mainBottom: Math.round(mainRect.bottom),
    visibleRegions: visible.length,
    visibleIds: visible.length <= 3 ? visible.map((p) => p.id) : [visible[0].id, '..', visible[visible.length - 1].id],
    counter: norm((document.querySelector('#counter') || {}).textContent),
    scrollTop: Math.round(main.scrollTop),
    exists: !!el,
  };
  if (el) {
    const b = el.getBoundingClientRect();
    const reg = el.closest('.book-page');
    out.target = { tag: el.tagName, region: reg ? reg.id : null, regionIndex: reg ? pid.get(reg) : null,
                   top: Math.round(b.top), bottom: Math.round(b.bottom), height: Math.round(b.height),
                   gapBelowToolbar: Math.round(b.top - toolbarBottom),
                   visible: b.width > 0 && b.height > 0,
                   belowToolbar: b.top >= toolbarBottom - 2,
                   insideMain: b.top >= mainRect.top - 2 && b.bottom <= mainRect.bottom + 2,
                   text: norm(el.textContent).slice(0, 120) };
  }
  const cur = document.querySelector('#contents-nav .nav-child[aria-current], #contents-nav .nav-child.is-current');
  out.currentRail = cur ? { href: cur.getAttribute('href'), title: norm(cur.textContent).slice(0, 70) } : null;
  out.activeElement = (document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || null;
  const openGroups = [...document.querySelectorAll('#contents-nav details.nav-group')].map((d) => d.open);
  const curGroup = cur && cur.closest('details.nav-group');
  out.activeGroupOpen = curGroup ? curGroup.open : null;
  out.openGroupCount = openGroups.filter(Boolean).length;
  const rail = document.querySelector('aside.left');
  if (cur && rail) {
    const rb = rail.getBoundingClientRect(), cb = cur.getBoundingClientRect();
    out.railShowsActive = cb.top >= rb.top - 2 && cb.bottom <= rb.bottom + 2;
  }
  out.leftClosed = app.classList.contains('left-closed');
  out.rightClosed = app.classList.contains('right-closed');
  out.leftVisible = (() => { const b = document.querySelector('aside.left').getBoundingClientRect(); return b.width > 0 && b.height > 0; })();
  return out;
})`;

const clickRow = async (href, waitMs = 900) => {
  const r = await evalJs(`(() => {
    const rows = [...document.querySelectorAll('#contents-nav a[href], #contents-nav span.nav-unlinked')];
    const el = rows.find((x) => x.getAttribute('href') === ${JSON.stringify(href)});
    if (!el) return 'missing';
    if (el.tagName === 'SPAN') return 'unlinked';
    el.scrollIntoView({ block: 'nearest' });
    el.click();
    return 'clicked';
  })()`);
  await sleep(waitMs);
  return r;
};
const setMode = async (mode) => {
  await evalJs(`(() => { const s = document.querySelector('#mode'); s.value = ${JSON.stringify(mode)};
    s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
  await sleep(900);
};
const readLanding = (href) => evalJs(`${LAND}(${JSON.stringify(href)})`);

/* ------------------------------------------------------------------ run --- */
const report = { label, fileUrl, matrix, startedAt: new Date().toISOString() };
await cdp.send('Page.navigate', { url: 'about:blank' });
for (let i = 0; i < 40; i++) {
  const h = await evalJs('location.href', 60000);
  if (h === 'about:blank') { break; }
  await sleep(250);
}
await sleep(300);
cdp.events.length = 0;
await navigate(fileUrl);
await evalJs('localStorage.clear()');
await navigate(fileUrl);
report.census = await evalJs(CENSUS);
report.screenshots = { initial: await shot('initial') };

const pick = (title) => {
  const r = report.census.rows.find((x) => x.title === title && x.href && x.targetExists);
  return r ? r.href : null;
};
const resolving = report.census.rows.filter((r) => r.href && r.targetExists);
const lastLinked = [...resolving].reverse()[0];
/* a heading a little past the middle of the rail: for the deep-link and
   mode-switch cases, whatever actually resolves in this build */
const midHeadings = resolving.filter((r) => (r.href || '').startsWith('#book-heading-'));
const DEEP = (midHeadings[Math.floor(midHeadings.length / 2)] || { href: '#book-heading-0200' }).href;

const NAMED = [
  ['frontmatter-accessibility', pick('Accessibility')],
  ['unit1-start', pick('Unit 1 Businesses, Competition, and New Ideas')],
  ['module-1-1-subsection', pick('Customers and Consumers')],
  ['module-1-1-review', pick('Module 1.1 Review')],
  ['case-study-imperfect', pick('CASE STUDY: Imperfect Foods')],
  ['terms-to-know-first', pick('Terms to Know')],
  ['terms-to-know-second', (() => { const all = report.census.rows.filter((r) => r.title === 'Terms to Know' && r.href); return all.length > 1 ? all[1].href : null; })()],
  ['unit5', pick('Unit 5 Personal Goals, Budgeting, and Investing')],
  ['unit2', pick('Unit 2 Marketing')],
  ['unit3', pick('Unit 3 / Part 1 Personal Saving and Borrowing')],
  ['unit4', pick('Unit 4 Management and Strategy')],
  ['practice-your-ap-skills', report.census.rows.find((r) => /Practice Your AP/.test(r.title) && r.href && r.targetExists)?.href || null],
  ['terms-to-know-last', (() => { const all = report.census.rows.filter((r) => r.title === 'Terms to Know' && r.href && r.targetExists); return all.length ? all[all.length - 1].href : null; })()],
  ['appendix', pick('Appendix The Business Model Canvas')],
  ['glossary', pick('Glossary')],
  ['deep-heading-mid', DEEP],
  ['cover-page', pick('Cover Page')],
  ['get-the-most', report.census.rows.find((r) => /^Get the most/.test(r.title) && r.href)?.href || null],
  ['last-linked', lastLinked ? lastLinked.href : null],
];
/* a fixture carries only a handful of regions, so fall back to whatever
   actually resolves: a spread across the whole rail plus any repeated title */
const SPREAD = [[0, 'dyn-first'], [0.2, 'dyn-20'], [0.45, 'dyn-45'], [0.7, 'dyn-70'], [0.999, 'dyn-last']]
  .map(([f, name]) => [name, resolving.length ? resolving[Math.floor((resolving.length - 1) * f)].href : null]);
const byTitle = {};
for (const r of resolving) { (byTitle[r.title] = byTitle[r.title] || []).push(r); }
const repeated = Object.entries(byTitle).find(([, v]) => v.length > 1 && v[0].targetRegion !== v[1].targetRegion);
const REPEATED = repeated ? [['repeat-a', repeated[1][0].href], ['repeat-b', repeated[1][1].href]] : [];
/* the rows task D turned from held text into real links (step-3 additions) */
const NEW_LINKS = report.census.rows.filter((r) => r.linkKind === 'region-begin' && r.targetExists);
const NEWLINK_CASES = NEW_LINKS.slice(0, 3).map((r, i) => [`step3-link-${i + 1}`, r.href]);
const seen = new Set();
const CONTINUOUS = NEWLINK_CASES.concat(NAMED, SPREAD, REPEATED)
  .filter(([, h]) => h && resolving.some((r) => r.href === h) && !seen.has(h) && seen.add(h));

const VIEWPORTS = {
  d1920: [1920, 1080, false], d1400: [1400, 1000, false], d1024: [1024, 768, false],
  t768: [768, 1024, true], m390: [390, 844, true], m320: [320, 700, true],
};

report.landings = [];
let lastViewport = null, lastMode = null;
const runCase = async (tag, mode, vp, href, note) => {
  if (lastViewport !== vp) { await viewport(...VIEWPORTS[vp]); lastViewport = vp; lastMode = null; }
  if (mode !== 'current' && lastMode !== mode) { await setMode(mode); lastMode = mode; }
  const clicked = await clickRow(href);
  const landing = await readLanding(href);
  const rec = { case: tag, mode, viewport: vp, clicked, note, landing };
  report.landings.push(rec);
  return rec;
};

const full = matrix === 'full';
const modes = ['continuous', 'section', 'single'];
const viewportList = full ? ['d1920', 'd1400', 'd1024', 't768', 'm390', 'm320'] : ['d1400', 'm390'];
const cases = full ? CONTINUOUS : CONTINUOUS.slice(0, 8);

for (const vp of viewportList) {
  for (const mode of modes) {
    for (const [tag, href] of cases) {
      await runCase(tag, vp === 'd1400' && mode === 'continuous' ? 'current' : mode, vp, href,
        vp === 'd1400' && mode === 'continuous' ? 'same link twice' : null);
      if (wantShots && tag === cases[0][0] && (mode === 'continuous' || full)) {
        report.screenshots[`${vp}-${mode}-first`] = await shot(`${vp}-${mode}-landing`);
      }
      if (vp === 'd1400' && mode === 'continuous' && tag === 'frontmatter-accessibility') {
        // clicking the same link twice must be stable
        const again = await clickRow(href);
        report.landings.push({ case: tag + '-twice', mode, viewport: vp, clicked: again,
                               landing: await readLanding(href) });
      }
    }
  }
}

/* theme and font-size changes must not disturb navigation */
await viewport(1400, 1000, false);
await setMode('continuous');
await evalJs('(() => { const s = document.querySelector("#theme"); s.value = "dark"; s.dispatchEvent(new Event("change", { bubbles: true })); })()');
await sleep(900);
const themeHref = pick('Module 1.1 Review') || DEEP;
report.afterThemeDark = await clickRow(themeHref);
report.afterThemeDarkLanding = await readLanding(themeHref);
report.screenshots.dark = await shot('dark-after-nav');
await evalJs('(() => { const s = document.querySelector("#theme"); s.value = "light"; s.dispatchEvent(new Event("change", { bubbles: true })); })()');
await sleep(700);
await evalJs('(() => { const el = document.querySelector("#zoom"); el.value = "130"; el.dispatchEvent(new Event("input", { bubbles: true })); })()');
await sleep(900);
const fontHref = pick('CASE STUDY: Imperfect Foods') || resolving[0].href;
report.afterFontSize = await clickRow(fontHref);
report.afterFontSizeLanding = await readLanding(fontHref);
await evalJs('(() => { const el = document.querySelector("#zoom"); el.value = "100"; el.dispatchEvent(new Event("input", { bubbles: true })); })()');
await sleep(600);

/* both sidebars collapsed */
await evalJs('(() => { const app = document.querySelector(".app"); if (!app.classList.contains("left-closed")) document.querySelector("#left-toggle").click(); if (!app.classList.contains("right-closed")) document.querySelector("#right-toggle").click(); })()');
await sleep(900);
const closedHref = pick('Unit 5 Personal Goals, Budgeting, and Investing') || resolving[Math.floor(resolving.length / 2)].href;
report.bothClosed = await clickRow(closedHref);
report.bothClosedLanding = await readLanding(closedHref);
report.screenshots.bothClosed = await shot('both-closed-after-nav');
await evalJs('(() => { const app = document.querySelector(".app"); if (app.classList.contains("left-closed")) document.querySelector("#left-toggle").click(); if (app.classList.contains("right-closed")) document.querySelector("#right-toggle").click(); })()');
await sleep(900);

/* a group header must navigate without collapsing its own disclosure group */
report.groupHeader = {};
{
  const gh = report.census.rows.find((r) => (r.href || '').startsWith('#book-group-') && r.targetExists);
  if (gh) {
    const openOf = (href) => evalJs(`(() => { const rows=[...document.querySelectorAll('#contents-nav a[href]')];
      const el=rows.find(x=>x.getAttribute('href')===${JSON.stringify(href)});
      return el ? el.closest('details').open : null; })()`);
    await evalJs(`(() => { const rows=[...document.querySelectorAll('#contents-nav a[href]')];
      const el=rows.find(x=>x.getAttribute('href')===${JSON.stringify(gh.href)}); el.closest('details').open = true; })()`);
    const before = await openOf(gh.href);
    await clickRow(gh.href);
    const after = await openOf(gh.href);
    report.groupHeader = { href: gh.href, openBefore: before, openAfter: after,
                           landing: await readLanding(gh.href) };
    report.screenshots.groupHeader = await shot('group-header-after-nav');
  }
}

/* navigating immediately after expanding a content disclosure */
{
  const expanded = await evalJs(`(() => {
    const d = document.querySelector('.book-page details.disclosure');
    if (!d) return null;
    d.open = true;
    return d.closest('.book-page').id;
  })()`);
  const t = resolving[Math.floor(resolving.length * 0.6)];
  await clickRow(t.href);
  report.afterDisclosure = { expandedIn: expanded, href: t.href, landing: await readLanding(t.href) };
}

/* deep link: reload straight to a heading, in continuous then section */
report.deepLink = {};
for (const mode of ['continuous', 'section', 'single']) {
  await evalJs(`localStorage.setItem('book2.reader.v1', JSON.stringify(Object.assign({}, window.book2ReaderPrefs(), { mode: ${JSON.stringify(mode)} })))`);
  await navigate(fileUrl + DEEP);
  await sleep(1200);
  report.deepLink[mode] = await readLanding(DEEP);
  report.deepLink[mode].storedMode = await evalJs('(JSON.parse(localStorage.getItem("book2.reader.v1")||"{}").mode) || null');
}
await evalJs("localStorage.setItem('book2.reader.v1', JSON.stringify(Object.assign({}, window.book2ReaderPrefs(), { mode: 'continuous' })))");
await navigate(fileUrl);
await sleep(600);

/* history: two clicks then back / forward */
await viewport(1400, 1000, false);
const historyA = resolving[0].href;
const historyB = DEEP;
await clickRow(historyA);
await clickRow(historyB);
report.history = { first: historyA, second: historyB, afterTwoClicks: await readLanding(historyB) };
await evalJs('history.back()');
await sleep(1200);
report.history.afterBack = await evalJs(`${LAND}(location.hash || ${JSON.stringify(historyB)})`);
await evalJs('history.forward()');
await sleep(1200);
report.history.afterForward = await evalJs(`${LAND}(location.hash || ${JSON.stringify(historyB)})`);
report.history.finalHash = await evalJs('location.hash');

/* mode switch keeps the logical location */
report.modeSwitch = {};
await clickRow(DEEP);
report.modeSwitch.continuous = await readLanding(DEEP);
await setMode('section');
report.modeSwitch.section = await evalJs(`${LAND}(${JSON.stringify(DEEP)})`);
report.screenshots.section = await shot('mode-switch-section');
await setMode('single');
report.modeSwitch.single = await evalJs(`${LAND}(${JSON.stringify(DEEP)})`);
await setMode('continuous');
report.modeSwitch.backToContinuous = await evalJs(`${LAND}(${JSON.stringify(DEEP)})`);

/* the clicked row must still be the active row once reader/ui.js's own
   scroll-sync hold (1.2 s) has expired and its sync has run */
report.pinSurvival = [];
{
  const samples = [];
  const regionLink = NEW_LINKS[0];
  if (regionLink) { samples.push(['step3-region-link', regionLink.href]); }
  const headingRow = resolving.find((r) => (r.href || '').startsWith('#book-heading-'));
  if (headingRow) { samples.push(['heading-link', headingRow.href]); }
  const middle = resolving[Math.floor(resolving.length / 2)];
  if (middle) { samples.push(['mid-rail-link', middle.href]); }
  await viewport(1400, 1000, false);
  lastViewport = 'd1400';
  await setMode('continuous');
  lastMode = 'continuous';
  for (const [name, href] of samples) {
    await clickRow(href);
    await sleep(2600);
    const l = await readLanding(href);
    report.pinSurvival.push({ name, href, afterSync: l.currentRail, ok: !!(l.currentRail && l.currentRail.href === href) });
  }
}

report.errors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown'
  || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
  || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
  .map((e) => (e.method === 'Runtime.exceptionThrown'
    ? ((e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description) || e.params.exceptionDetails.text)
    : JSON.stringify(e.params).slice(0, 300)))
  .slice(0, 40);
report.finishedAt = new Date().toISOString();
writeFileSync(join(outDir, `${label}-probe.json`), JSON.stringify(report, null, 1));

const brief = (l) => l && ({ mode: l.mode, eff: l.effective, gap: l.target ? l.target.gapBelowToolbar : null,
  visible: l.target ? l.target.visible : null, below: l.target ? l.target.belowToolbar : null,
  region: l.target ? l.target.region : null, counter: l.counter, cur: l.currentRail ? l.currentRail.href : null,
  visibleRegions: l.visibleRegions });
console.log(JSON.stringify({
  census: { regions: report.census.regions, headings: report.census.headingCount, rows: report.census.railRows,
            hrefs: report.census.hrefCount, broken: report.census.brokenLinks.length,
            dupIds: report.census.duplicateIds, labelled: report.census.labelledCells,
            toolbar: report.census.toolbar, scrollMargin: report.census.scrollMarginSample },
  landings: report.landings.map((r) => ({ c: r.case, m: r.mode, v: r.viewport, click: r.clicked,
    gap: r.landing.target ? r.landing.target.gapBelowToolbar : null,
    below: r.landing.target ? r.landing.target.belowToolbar : null,
    vis: r.landing.target ? r.landing.target.visible : null,
    reg: r.landing.target ? r.landing.target.region : null,
    visRegions: r.landing.visibleRegions, mode: r.landing.mode, counter: r.landing.counter })),
  themeDark: brief(report.afterThemeDarkLanding), fontSize130: brief(report.afterFontSizeLanding),
  bothClosed: brief(report.bothClosedLanding),
  groupHeader: report.groupHeader.href ? { href: report.groupHeader.href, openBefore: report.groupHeader.openBefore,
    openAfter: report.groupHeader.openAfter, land: brief(report.groupHeader.landing) } : 'no group header resolved',
  afterDisclosure: report.afterDisclosure ? { href: report.afterDisclosure.href, land: brief(report.afterDisclosure.landing) } : null,
  deepLink: Object.fromEntries(Object.entries(report.deepLink).map(([k, v]) => [k, brief(v)])),
  history: { back: brief(report.history.afterBack), fwd: brief(report.history.afterForward), hash: report.history.finalHash },
  modeSwitch: Object.fromEntries(Object.entries(report.modeSwitch).map(([k, v]) => [k, brief(v)])),
  pinSurvival: report.pinSurvival.map((p) => `${p.name}: ${p.ok ? 'still active' : 'MOVED to ' + (p.afterSync && p.afterSync.href)}`),
  errors: report.errors,
}, null, 1));
process.exit(0);
