// Final release QA - stage A: DOM truth about the shipped artifact.
//
// Connects to a CDP Chrome that is already running (reader/step3_chrome.ps1),
// loads the artifact, and refuses to measure until the page really is the book
// (1,899 regions + the navigation layer).  Writes one JSON per phase into
// reports/final_release_qa/ so an interrupted run resumes instead of repeating.
//
//   node reader/release_qa_dom.mjs [port] [fileUrl] [phases]
//
// phases: comma list of inventory,dom,tables,images,disclosures,a11y,contrast
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';

const port = process.argv[2] || '9356';
const fileUrl = process.argv[3]
  || 'file:///C:/Users/mhyah/Downloads/book-source/Word/_master_work/repo/AP/AP%20Book%20Final.html';
const wantPhases = (process.argv[4] || 'inventory,dom,tables,images,disclosures,a11y,contrast').split(',');
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

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.filter((t) => t.type === 'page')[0];
if (!page) { console.error('no page target on port', port); process.exit(2); }
const cdp = new CDP(page.webSocketDebuggerUrl);
await cdp.connect();
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Log.enable');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let jsErrors = [];

async function evalJson(expression) {
  const r = await cdp.send('Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true }, 900000);
  if (r.exceptionDetails) {
    throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 600));
  }
  return r.result.value;
}

async function gate(label) {
  for (let i = 0; i < 240; i++) {
    const st = await evalJson("({ rs: document.readyState, regions: document.querySelectorAll('.book-page').length, nav: !!window.book2Navigation })");
    if (st.rs === 'complete' && st.regions === EXPECT_REGIONS && st.nav) return st;
    await wait(2000);
  }
  throw new Error(label + ': artifact never ready');
}

async function load(url, label) {
  const already = await evalJson("({ url: location.href, regions: document.querySelectorAll('.book-page').length })");
  if (already.url.split('#')[0] !== fileUrl.split('#')[0] || already.regions !== EXPECT_REGIONS) {
    await cdp.send('Page.navigate', { url });
    await wait(1500);
  }
  return gate(label);
}

function save(name, data) {
  const path = join(OUTDIR, name);
  writeFileSync(path, JSON.stringify(data, null, 1));
  console.log('   wrote', name, `(${JSON.stringify(data).length} bytes)`);
}

function loadIfDone(name) {
  const path = join(OUTDIR, name);
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'));
  return null;
}

const summary = { schema: 'book2.release.qa_dom.v1', fileUrl, phases: {} };
const record = (phase, value) => { summary.phases[phase] = value; };

await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
summary.gate = await load(fileUrl, 'stage A');

// ------------------------------------------------------------------ inventory
if (wantPhases.includes('inventory')) {
  console.log('phase inventory');
  const inventory = await evalJson(`(() => {
    const desc = (el) => {
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: el.className ? String(el.className).slice(0, 90) : null,
        type: el.getAttribute('type'),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        ariaExpanded: el.getAttribute('aria-expanded'),
        ariaControls: el.getAttribute('aria-controls'),
        ariaCurrent: el.getAttribute('aria-current'),
        text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
        value: (el.tagName === 'INPUT' || el.tagName === 'SELECT') ? String(el.value).slice(0, 40) : null,
        options: el.tagName === 'SELECT' ? [...el.options].map((o) => o.value + '=' + o.textContent.trim().slice(0, 24)) : null,
        min: el.getAttribute('min'), max: el.getAttribute('max'), step: el.getAttribute('step'),
        visible: cs.display !== 'none' && cs.visibility !== 'hidden' && (el.offsetWidth + el.offsetHeight) > 0,
      };
    };
    const inNav = (el) => !!el.closest('#contents-nav');
    const all = [...document.querySelectorAll('button, input, select, textarea, a[href], [role="button"], summary')];
    const ui = all.filter((el) => !inNav(el)).map(desc);
    const navLinks = [...document.querySelectorAll('#contents-nav a[href^="#"]')].map((a) => ({
      href: a.getAttribute('href'),
      page: (a.querySelector('.nav-page') || {}).textContent || null,
      title: (a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 70),
      kind: a.getAttribute('data-link-kind') || 'heading',
      module: (a.closest('details.nav-module') ? (a.closest('details.nav-module').querySelector('summary').textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60) : null),
      group: (a.closest('details.nav-group') ? (a.closest('details.nav-group').querySelector('summary').textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60) : null),
    }));
    const navUnlinked = [...document.querySelectorAll('#contents-nav span.nav-unlinked')].map((s) => ({
      page: (s.querySelector('.nav-page') || {}).textContent || null,
      title: (s.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 70),
      titleAttr: s.getAttribute('title'),
    }));
    return {
      uiControls: ui,
      uiControlCount: ui.length,
      navLinkCount: navLinks.length,
      navUnlinkedCount: navUnlinked.length,
      navLinks,
      navUnlinked,
      counts: {
        buttons: ui.filter((c) => c.tag === 'button').length,
        inputs: ui.filter((c) => c.tag === 'input').length,
        selects: ui.filter((c) => c.tag === 'select').length,
        summariesOutsideNav: ui.filter((c) => c.tag === 'summary').length,
      },
    };
  })()`);
  inventory.navLinkSample = inventory.navLinks.slice(0, 3);
  save('feature_inventory.json', inventory);
  record('inventory', { uiControlCount: inventory.uiControlCount, navLinkCount: inventory.navLinkCount,
    navUnlinkedCount: inventory.navUnlinkedCount, counts: inventory.counts });
}

// ------------------------------------------------------------------ dom
if (wantPhases.includes('dom')) {
  console.log('phase dom');
  const dom = await evalJson(`(() => {
    const qsa = (s, root) => [...(root || document).querySelectorAll(s)];
    const textWalker = (limit) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const patterns = {
        markerTmp: /\\bTMP-\\d{4}\\b/g,
        markerUnverified: /UNVERIFIED/g,
        ocrUnclear: /\\[OCR unclear\\]/g,
        todo: /\\bTODO\\b/g,
        placeholder: /\\bPLACEHOLDER\\b/g,
        mojibake: /(Ã.|â€|Â(?![\\s\\d])|\\uFFFD)/g,
        rawEntity: /&(amp|nbsp|lt|gt|quot);/g,
        doubleSpace: /  +/g,
      };
      const hits = {}; const examples = {};
      let nodes = 0; let chars = 0;
      let node;
      while ((node = walker.nextNode()) && nodes < limit) {
        nodes++;
        const t = node.nodeValue;
        if (!t) continue;
        chars += t.length;
        for (const key of Object.keys(patterns)) {
          patterns[key].lastIndex = 0;
          const m = t.match(patterns[key]);
          if (m) {
            hits[key] = (hits[key] || 0) + m.length;
            if (!examples[key]) {
              const host = node.parentElement;
              examples[key] = {
                sample: t.slice(Math.max(0, (m.index || 0) - 60), (m.index || 0) + 80).replace(/\\s+/g, ' '),
                host: host ? (host.tagName.toLowerCase() + (host.id ? '#' + host.id : '') + (host.className ? '.' + String(host.className).split(' ')[0] : '')) : null,
                region: host && host.closest('.book-page') ? host.closest('.book-page').id : null,
                visible: host ? !!(host.offsetWidth + host.offsetHeight) : null,
              };
            }
          }
        }
      }
      return { nodesScanned: nodes, charsScanned: chars, hits, examples };
    };
    const ids = qsa('[id]').map((el) => el.id);
    const dupes = {};
    ids.forEach((id) => { dupes[id] = (dupes[id] || 0) + 1; });
    const duplicateIds = Object.keys(dupes).filter((k) => dupes[k] > 1);
    const pages = qsa('article.book-page');
    const regionOrder = pages.map((p) => p.id);
    const expected = regionOrder.map((_, i) => 'TMP-' + String(i + 1).padStart(4, '0'));
    const tds = qsa('td'); const ths = qsa('th');
    const orphanTd = tds.filter((td) => !td.closest('table'));
    const nestedInteractive = {
      aInA: qsa('a a').length, buttonInA: qsa('a button').length,
      aInButton: qsa('button a').length, buttonInButton: qsa('button button').length,
      inputInA: qsa('a input').length,
    };
    const anchorOk = { aInSummaryWithHref: qsa('summary a[href]').length };
    const headings = qsa('[role="heading"], h1, h2, h3, h4, h5, h6').map((h) => ({
      tag: h.tagName.toLowerCase(), level: h.getAttribute('aria-level') || h.tagName.replace('H', ''),
      id: h.id || null, region: h.closest('.book-page') ? h.closest('.book-page').id : null,
      text: (h.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
    }));
    const inlineStyles = qsa('[style]');
    let colorDecls = 0;
    inlineStyles.forEach((el) => { colorDecls += (el.getAttribute('style').match(/color:/g) || []).length; });
    const verticalCredits = qsa('*').filter((el) => {
      const wm = getComputedStyle(el).writingMode;
      return wm === 'sideways-lr' || wm === 'vertical-rl' || wm === 'vertical-lr';
    });
    const visibleCredits = verticalCredits.filter((el) => (el.offsetWidth + el.offsetHeight) > 0);
    return {
      doctype: document.doctype ? document.doctype.name : null,
      compatMode: document.compatMode,
      characterSet: document.characterSet,
      charsetMeta: (document.querySelector('meta[charset]') || {}).getAttribute ? document.querySelector('meta[charset]').getAttribute('charset') : null,
      title: document.title,
      counts: {
        regions: pages.length,
        regionOrderSequential: JSON.stringify(regionOrder) === JSON.stringify(expected),
        headingAnchors: qsa('[id^="book-heading-"]').length,
        groupAnchors: qsa('[id^="book-group-"]').length,
        disclosureControls: qsa('details.disclosure').length,
        summaries: qsa('summary').length,
        navLinks: qsa('#contents-nav a[href^="#"]').length,
        navUnlinked: qsa('#contents-nav span.nav-unlinked').length,
        navPageCells: qsa('#contents-nav .nav-page').length,
        navGroups: qsa('details.nav-group').length,
        navModules: qsa('details.nav-module').length,
        tables: qsa('table').length,
        td: tds.length, th: ths.length,
        imgs: qsa('img').length,
        pngDataUris: qsa('[src^="data:image/png;base64"]').length,
        lgBadges: qsa('.lg-badge').length,
        descLabels: qsa('.b2-desc-label').length,
        descriptionPanels: qsa('.b2-desc-panel').length,
        sourceContentsIds: qsa('[data-source-contents-id]').length,
        inlineStyled: inlineStyles.length,
        verticalWriting: verticalCredits.length,
        visibleVerticalWriting: visibleCredits.length,
        roleHeading: qsa('[role="heading"]').length,
        uniqueIds: new Set(ids).size,
        totalIds: ids.length,
        elementCount: document.getElementsByTagName('*').length,
      },
      duplicateIds: duplicateIds.slice(0, 20),
      markupSymptoms: {
        orphanTd: orphanTd.length,
        orphanTdRegions: orphanTd.slice(0, 5).map((td) => td.closest('.book-page') ? td.closest('.book-page').id : null),
        nestedInteractive,
        anchorOk,
        tdOutsideTable: qsa('body > td, div > td:not(table td), p > td').length,
        detailsDirectChildTd: qsa('details > td').length,
        disclosurePanelWithTd: qsa('details.disclosure .b2-desc-panel td').length,
      },
      headingLevels: headings.slice(0, 60),
      headingLevelHistogram: headings.reduce((acc, h) => { acc[h.level] = (acc[h.level] || 0) + 1; return acc; }, {}),
      inlineColorDeclarations: colorDecls,
      textScan: textWalker(200000),
    };
  })()`);
  save('dom_validation.json', dom);
  record('dom', { counts: dom.counts, duplicateIds: dom.duplicateIds,
    markupSymptoms: dom.markupSymptoms, textScan: { nodesScanned: dom.textScan.nodesScanned, hits: dom.textScan.hits } });
}

// ------------------------------------------------------------------ tables
if (wantPhases.includes('tables')) {
  console.log('phase tables');
  const tables = await evalJson(`(() => {
    const out = { tables: [], dataTables: [], layoutTables: 0, problems: [] };
    [...document.querySelectorAll('table')].forEach((t, i) => {
      const rows = [...t.rows];
      const cells = [...t.querySelectorAll('th, td')];
      const headerCells = [...t.querySelectorAll('th')];
      const colspan = cells.map((c) => c.colSpan).filter((n) => n > 1);
      const rowspan = cells.map((c) => c.rowSpan).filter((n) => n > 1);
      const region = t.closest('.book-page');
      const firstText = (rows[0] ? rows[0].textContent : '').replace(/\\s+/g, ' ').trim().slice(0, 70);
      const numericCells = cells.filter((c) => /^[\\s$€£%(),.0-9-]+$/.test(c.textContent.trim()) && c.textContent.trim().length > 1).length;
      const rect = t.getBoundingClientRect();
      const isData = headerCells.length > 0 || (rows.length >= 3 && cells.length / Math.max(rows.length, 1) >= 1.5
        && rows.slice(0, 3).every((r) => [...r.cells].length >= 2));
      const record = {
        index: i,
        dataTableId: t.getAttribute('data-table-id'),
        cls: t.className || null,
        region: region ? region.id : null,
        rows: rows.length,
        cells: cells.length,
        headerCells: headerCells.length,
        colspanCells: colspan.length,
        rowspanCells: rowspan.length,
        raggedRows: new Set(rows.map((r) => [...r.cells].length)).size > 1,
        numericCells,
        firstText,
        computedWidth: Math.round(rect.width),
        scrollable: t.scrollWidth > t.clientWidth + 2,
        cellWidthsVary: (() => { const w = [...t.rows[0] ? t.rows[0].cells : []].map((c) => Math.round(c.getBoundingClientRect().width)); return new Set(w).size > 1; })(),
      };
      if (isData) out.dataTables.push(record); else out.layoutTables++;
      if (record.raggedRows && isData) out.problems.push({ index: i, region: record.region, issue: 'ragged rows' });
      if (record.scrollable) out.problems.push({ index: i, region: record.region, issue: 'horizontal overflow inside table' });
      if (i < 400) out.tables.push(record);
    });
    out.summary = {
      total: out.dataTables.length + out.layoutTables,
      dataTables: out.dataTables.length,
      layoutTables: out.layoutTables,
      ragged: out.problems.filter((p) => p.issue === 'ragged rows').length,
      horizontalOverflow: out.problems.filter((p) => p.issue !== 'ragged rows').length,
    };
    return out;
  })()`);
  save('table_audit.json', tables);
  record('tables', tables.summary);
}

// ------------------------------------------------------------------ images
if (wantPhases.includes('images')) {
  console.log('phase images');
  const images = await evalJson(`(() => {
    const imgs = [...document.querySelectorAll('img')];
    const rows = imgs.map((img, i) => {
      const cs = getComputedStyle(img);
      const rect = img.getBoundingClientRect();
      const natural = { w: img.naturalWidth, h: img.naturalHeight };
      const attrW = img.getAttribute('width'); const attrH = img.getAttribute('height');
      const rendered = { w: Math.round(rect.width), h: Math.round(rect.height) };
      const ratioNatural = natural.w && natural.h ? natural.w / natural.h : null;
      const ratioRendered = rendered.h ? rendered.w / rendered.h : null;
      return {
        index: i,
        region: img.closest('.book-page') ? img.closest('.book-page').id : null,
        srcKind: (img.getAttribute('src') || '').startsWith('data:image/png') ? 'png-data-uri' : (img.getAttribute('src') || '').slice(0, 60),
        complete: img.complete,
        natural, attrW, attrH, rendered,
        distortion: ratioNatural && ratioRendered ? Math.abs(ratioNatural - ratioRendered) / ratioNatural : null,
        alt: img.getAttribute('alt'),
        hasAltAttr: img.hasAttribute('alt'),
        decoding: img.getAttribute('decoding'),
        loading: img.getAttribute('loading'),
        display: cs.display, visibility: cs.visibility,
        broken: img.complete && natural.w === 0,
        zeroBox: rendered.w === 0 || rendered.h === 0,
      };
    });
    return {
      total: rows.length,
      loaded: rows.filter((r) => r.complete).length,
      notYetLoaded: rows.filter((r) => !r.complete).length,
      broken: rows.filter((r) => r.broken).length,
      zeroBox: rows.filter((r) => r.zeroBox).length,
      withAltAttr: rows.filter((r) => r.hasAltAttr).length,
      withNonEmptyAlt: rows.filter((r) => r.hasAltAttr && r.alt && r.alt.trim().length).length,
      altSamples: rows.filter((r) => r.alt && r.alt.trim()).slice(0, 5).map((r) => ({ region: r.region, alt: r.alt.slice(0, 90) })),
      stretched: rows.filter((r) => r.distortion !== null && r.distortion > 0.08 && !r.zeroBox)
        .slice(0, 20).map((r) => ({ index: r.index, region: r.region, distortion: Number(r.distortion.toFixed(3)), natural: r.natural, rendered: r.rendered })),
      byRegion: rows.slice(0, 30),
    };
  })()`);
  save('image_audit.json', images);
  record('images', { total: images.total, loaded: images.loaded, notYetLoaded: images.notYetLoaded,
    broken: images.broken, withAltAttr: images.withAltAttr, withNonEmptyAlt: images.withNonEmptyAlt,
    stretched: images.stretched.length });
}

// ------------------------------------------------------------------ disclosures
if (wantPhases.includes('disclosures')) {
  console.log('phase disclosures');
  const disclosures = await evalJson(`(async () => {
    const list = [...document.querySelectorAll('details.disclosure')];
    const out = { total: list.length, rows: [], problems: [] };
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const summary = d.querySelector(':scope > summary');
      const panel = d.querySelector(':scope > .b2-desc-panel, :scope > div, :scope > p');
      const region = d.closest('.book-page');
      d.open = false;
      await new Promise((r) => requestAnimationFrame(r));
      const closedH = panel ? Math.round(panel.getBoundingClientRect().height) : null;
      const closedVisible = panel ? (panel.getBoundingClientRect().height > 1 && getComputedStyle(panel).display !== 'none') : null;
      d.open = true;
      await new Promise((r) => requestAnimationFrame(r));
      const pr = panel ? panel.getBoundingClientRect() : null;
      const cs = panel ? getComputedStyle(panel) : null;
      const openH = pr ? Math.round(pr.height) : null;
      const text = panel ? (panel.textContent || '').replace(/\\s+/g, ' ').trim() : '';
      const rects = panel ? [...panel.querySelectorAll('*')].slice(0, 400).map((el) => el.getBoundingClientRect()) : [];
      const maxRight = rects.length ? Math.max(...rects.map((r) => r.right)) : null;
      const maxLeft = rects.length ? Math.min(...rects.map((r) => r.left)) : null;
      const overflowX = panel ? panel.scrollWidth > panel.clientWidth + 2 : null;
      const clipped = pr ? (pr.height < 8 && text.length > 40) : null;
      const bg = cs ? cs.backgroundColor : null;
      const color = cs ? cs.color : null;
      const focusableInside = d.querySelectorAll('a[href], button, input, select, textarea').length;
      const row = {
        i, id: d.id || null, region: region ? region.id : null,
        summaryText: summary ? (summary.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80) : null,
        hasSummary: !!summary, summaryCount: d.querySelectorAll(':scope > summary').length,
        panelTag: panel ? panel.tagName.toLowerCase() : null,
        panelClass: panel ? String(panel.className).slice(0, 60) : null,
        closedHeight: closedH, closedVisible, openHeight: openH,
        bodyChars: text.length, bodyWords: text.split(/\\s+/).filter(Boolean).length,
        bodyHead: text.slice(0, 70),
        overflowX, clipped, bg, color, focusableInside,
        wellFormed: !!(summary && panel && closedH !== null && openH !== null && openH > 12 && text.length > 40),
        leftEdge: maxLeft !== null ? Math.round(maxLeft) : null,
        rightEdge: maxRight !== null ? Math.round(maxRight) : null,
      };
      out.rows.push(row);
      if (!row.wellFormed) out.problems.push({ i, id: row.id, region: row.region, why: 'closed/open geometry or body text', row });
      if (closedVisible) out.problems.push({ i, id: row.id, region: row.region, why: 'panel visible while closed' });
      if (overflowX) out.problems.push({ i, id: row.id, region: row.region, why: 'horizontal overflow' });
      if (clipped) out.problems.push({ i, id: row.id, region: row.region, why: 'panel clipped with text inside' });
      d.open = false;
    }
    const regions = new Set(out.rows.map((r) => r.region));
    out.distinctRegions = regions.size;
    out.withBodyOver100 = out.rows.filter((r) => r.bodyChars > 100).length;
    out.emptyBodies = out.rows.filter((r) => r.bodyChars < 40).map((r) => ({ i: r.i, region: r.region, chars: r.bodyChars, head: r.bodyHead }));
    out.problemCount = out.problems.length;
    return out;
  })()`);
  save('disclosure_audit.json', disclosures);
  record('disclosures', { total: disclosures.total, distinctRegions: disclosures.distinctRegions,
    withBodyOver100: disclosures.withBodyOver100, emptyBodies: disclosures.emptyBodies.length,
    problemCount: disclosures.problemCount });
}

// ------------------------------------------------------------------ a11y
if (wantPhases.includes('a11y')) {
  console.log('phase a11y');
  const a11y = await evalJson(`(() => {
    const focusableSel = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
    const visible = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const focusInfo = (el) => {
      el.focus();
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        id: el.id || null, tag: el.tagName.toLowerCase(),
        outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle, outlineColor: cs.outlineColor,
        boxShadow: cs.boxShadow === 'none' ? null : cs.boxShadow.slice(0, 60),
        focusVisible: cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px',
        rect: { w: Math.round(r.width), h: Math.round(r.height) },
      };
    };
    const panelState = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        selector: sel, display: cs.display, visibility: cs.visibility, width: Math.round(r.width),
        left: Math.round(r.left), offscreen: r.right <= 0 || r.left >= innerWidth,
        focusablesInside: [...el.querySelectorAll(focusableSel)].filter(visible).length,
        ariaHidden: el.getAttribute('aria-hidden'),
      };
    };
    const ariaExpanded = [...document.querySelectorAll('[aria-expanded]')].map((el) => ({
      id: el.id || null, cls: el.className ? String(el.className).slice(0, 40) : null, value: el.getAttribute('aria-expanded'),
    }));
    const ariaControls = [...document.querySelectorAll('[aria-controls]')].map((el) => ({
      id: el.id || null, controls: el.getAttribute('aria-controls'),
      targetExists: !!document.getElementById(el.getAttribute('aria-controls')),
    }));
    const ariaCurrent = [...document.querySelectorAll('[aria-current]')].map((el) => ({
      tag: el.tagName.toLowerCase(), value: el.getAttribute('aria-current'),
      href: el.getAttribute('href'), text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 50),
    }));
    const inputs = [...document.querySelectorAll('input, select, textarea')].map((el) => ({
      tag: el.tagName.toLowerCase(), id: el.id || null, type: el.getAttribute('type'),
      ariaLabel: el.getAttribute('aria-label'), hasLabelElement: !!document.querySelector('label[for="' + el.id + '"]'),
      title: el.getAttribute('title'), role: el.getAttribute('role'),
    }));
    /* tab order sample: first 25 focusables in DOM order that are visible */
    const tabOrder = [...document.querySelectorAll(focusableSel)].filter(visible).slice(0, 25)
      .map((el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]));
    const hiddenFocusable = [...document.querySelectorAll(focusableSel)].filter((el) => !visible(el)).length;
    const imagesWithoutAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length;
    const imagesEmptyAlt = [...document.querySelectorAll('img')].filter((i) => i.hasAttribute('alt') && !i.alt.trim()).length;
    const tableSemantics = [...document.querySelectorAll('table')].filter((t) => t.querySelector('th')).length;
    const captions = [...document.querySelectorAll('caption')].length;
    const scopes = [...document.querySelectorAll('th')].filter((th) => th.hasAttribute('scope')).length;
    return {
      focusIndicators: ['#left-toggle', '#prev', '#next', '#search', '#right-toggle', '#nav-expand', '#nav-collapse', '#zoom', '#theme', '#font'].map((sel) => {
        const el = document.querySelector(sel);
        return el ? focusInfo(el) : { selector: sel, missing: true };
      }),
      panelsOpen: [panelState('#contents-panel'), panelState('#reader-controls')],
      ariaExpanded, ariaControls, ariaCurrent, inputs,
      tabOrderSample: tabOrder,
      hiddenFocusableCount: hiddenFocusable,
      imagesWithoutAlt, imagesEmptyAlt,
      tableWithHeaders: tableSemantics, tableCaptions: captions, thWithScope: scopes,
      liveRegions: [...document.querySelectorAll('[aria-live]')].map((el) => ({ id: el.id || null, live: el.getAttribute('aria-live') })),
      htmlLang: document.documentElement.getAttribute('lang'),
    };
  })()`);
  save('accessibility_audit.json', a11y);
  record('a11y', { ariaCurrentCount: a11y.ariaCurrent.length, ariaExpandedCount: a11y.ariaExpanded.length,
    imagesWithoutAlt: a11y.imagesWithoutAlt, imagesEmptyAlt: a11y.imagesEmptyAlt,
    hiddenFocusableCount: a11y.hiddenFocusableCount, tableWithHeaders: a11y.tableWithHeaders,
    htmlLang: a11y.htmlLang });
}

// ------------------------------------------------------------------ contrast
if (wantPhases.includes('contrast')) {
  console.log('phase contrast');
  const contrast = await evalJson(`(async () => {
    const lum = (rgb) => { const a = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
    const parse = (c) => { const m = (c || '').match(/[\\d.]+/g); return m ? m.map(Number) : null; };
    const bgOf = (el) => {
      let n = el, sawImage = false;
      while (n && n !== document.documentElement.parentNode) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== 'none') sawImage = true;
        const c = parse(cs.backgroundColor);
        if (c && c.length >= 3 && (c.length < 4 || c[3] > 0.6)) return { rgb: c.slice(0, 3), sawImage };
        n = n.parentElement;
      }
      return { rgb: [255, 255, 255], sawImage };
    };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };
    const sample = (sel, label, limit) => {
      const els = [...document.querySelectorAll(sel)].slice(0, limit || 60);
      const rows = [];
      els.forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        const fg = parse(cs.color); if (!fg) return;
        const bg = bgOf(el);
        const size = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight, 10) >= 700;
        const large = size >= 24 || (bold && size >= 18.66);
        const color = cs.color === 'rgba(0, 0, 0, 0)' ? [0, 0, 0] : fg.slice(0, 3);
        rows.push({
          label, region: el.closest('.book-page') ? el.closest('.book-page').id : null,
          tag: el.tagName.toLowerCase(), text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
          fg: color, bg: bg.rgb, bgImage: bg.sawImage, fontSize: size, bold, large,
          ratio: Number(ratio(color, bg.rgb).toFixed(2)),
          required: large ? 3 : 4.5,
        });
      });
      return rows;
    };
    const readAll = () => ({
      body: sample('.book-page p', 'body-paragraph', 80),
      headings: sample('.book-page [role="heading"]', 'heading', 40),
      tableCells: sample('.book-page td', 'table-cell', 60),
      summaries: sample('details.disclosure > summary', 'disclosure-summary', 40),
      descLabels: sample('.b2-desc-label', 'description-label', 40),
      lgBadges: sample('.lg-badge', 'learning-goal-badge', 40),
      credits: sample('.b2-vcredit', 'photo-credit', 40),
      nav: sample('#contents-nav .nav-child', 'contents-row', 60),
      toolbar: sample('main > .toolbar button, main > .toolbar input, main > .toolbar span', 'toolbar', 20),
      controlsPanel: sample('#reader-controls button, #reader-controls input, #reader-controls select, #reader-controls label, #reader-controls p', 'tools-panel', 40),
    });
    const result = { light: null, dark: null, failures: {} };
    const themeSel = document.querySelector('#theme');
    const setTheme = (value) => { if (themeSel) { themeSel.value = value; themeSel.dispatchEvent(new Event('change', { bubbles: true })); } };
    setTheme('light'); await new Promise((r) => setTimeout(r, 700));
    result.light = readAll();
    setTheme('dark'); await new Promise((r) => setTimeout(r, 700));
    result.dark = readAll();
    setTheme('light'); await new Promise((r) => setTimeout(r, 700));
    for (const theme of ['light', 'dark']) {
      const fails = [];
      for (const [group, rows] of Object.entries(result[theme])) {
        rows.forEach((row) => { if (row.ratio < row.required) fails.push({ group, ...row }); });
      }
      result.failures[theme] = { count: fails.length, examples: fails.slice(0, 25) };
    }
    return result;
  })()`);
  save('theme_contrast.json', contrast);
  record('contrast', { lightFailures: contrast.failures.light.count, darkFailures: contrast.failures.dark.count });
}

jsErrors = cdp.events
  .filter((e) => e.method === 'Runtime.exceptionThrown'
    || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
  .map((e) => (e.method === 'Runtime.exceptionThrown'
    ? (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text)
    : JSON.stringify(e.params).slice(0, 300)));
summary.jsErrors = jsErrors;
summary.finishedAt = new Date().toISOString();
save('stage_a_summary.json', summary);
console.log('js errors:', jsErrors.length);
console.log('DONE stage A');
