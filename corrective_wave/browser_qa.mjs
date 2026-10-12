// Corrective-wave browser QA for the finished Book 2 reader.
// Usage: node browser_qa.mjs <fileUrl> <outJson> [screenshotPng]
import { writeFileSync } from 'node:fs';

const fileUrl = process.argv[2];
const outJson = process.argv[3];
const shotPath = process.argv[4] || '';
const ENDPOINT = process.env.BOOK2_CDP || 'http://127.0.0.1:9334';
const LOAD_TIMEOUT = 600000;
const t0 = Date.now();

const result = {
  fileUrl,
  startedAt: new Date().toISOString(),
  consoleErrors: [],
  exceptions: [],
  logErrors: [],
  checks: null,
  coverProbe: null,
  disclosureProbe: null,
  firstViewport: null,
  error: null,
};

function finish(code) {
  result.elapsedMs = Date.now() - t0;
  try { writeFileSync(outJson, JSON.stringify(result, null, 2), 'utf8'); } catch {}
  process.exit(code);
}

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.handlers = []; }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => res();
      this.ws.onerror = (e) => rej(new Error('ws error: ' + (e && e.message)));
      this.ws.onmessage = (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.id !== undefined) {
          const p = this.pending.get(msg.id);
          if (p) { this.pending.delete(msg.id); msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result); }
        } else { for (const h of this.handlers) h(msg); }
      };
    });
  }
  send(method, params = {}, timeoutMs = 300000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { this.pending.delete(id); rej(new Error('timeout ' + method)); }, timeoutMs);
      this.pending.set(id, { res: r => { clearTimeout(timer); res(r); }, rej: e => { clearTimeout(timer); rej(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(fn) { this.handlers.push(fn); return this; }
  close() { try { this.ws.close(); } catch {} }
}

const ev = (expression) => ({ expression, returnByValue: true, awaitPromise: false });

const STATIC_CHECKS = String.raw`(function () {
  var out = {};
  var pages = [].slice.call(document.querySelectorAll('.book-page'));
  out.readyState = document.readyState;
  out.title = document.title;
  out.pages = pages.length;
  out.firstPageId = pages.length ? pages[0].id : null;
  out.lastPageId = pages.length ? pages[pages.length - 1].id : null;
  out.tables = document.querySelectorAll('table').length;
  out.details = document.querySelectorAll('details').length;
  out.disclosureControls = document.querySelectorAll('details.disclosure').length;
  out.descLabels = document.querySelectorAll('.b2-desc-label').length;
  out.emptyDescLabels = [].filter.call(document.querySelectorAll('.b2-desc-label'),
      function (n) { return !n.textContent.trim(); }).length;
  out.images = document.querySelectorAll('img').length;
  out.lgBadges = document.querySelectorAll('.lg-badge').length;
  out.navGroups = document.querySelectorAll('.nav-group').length;
  out.navModules = document.querySelectorAll('.nav-module').length;
  out.navRows = document.querySelectorAll('[data-source-contents-id]').length;
  out.navUnlinked = document.querySelectorAll('.nav-unlinked').length;
  out.navPageCells = document.querySelectorAll('.nav-page').length;
  out.navPageValues = [].map.call(document.querySelectorAll('.nav-page'),
      function (n) { return n.textContent.trim(); });
  out.headingsRoleHeading = document.querySelectorAll('[role="heading"]').length;
  out.sectionHeads = document.querySelectorAll('[data-section-start]').length;
  out.book2QAType = typeof window.book2QA;
  var idEls = document.querySelectorAll('[id]');
  var seen = {}, dups = [];
  for (var i = 0; i < idEls.length; i++) {
    var v = idEls[i].id;
    if (seen[v]) { if (dups.indexOf(v) < 0) dups.push(v); } else { seen[v] = 1; }
  }
  out.duplicateIds = dups.length;
  out.duplicateIdSamples = dups.slice(0, 8);
  var broken = [];
  var links = document.querySelectorAll('nav a[href^="#"]');
  for (var k = 0; k < links.length; k++) {
    var id = decodeURIComponent(links[k].getAttribute('href').slice(1));
    if (!document.getElementById(id)) broken.push(id);
  }
  out.navLinksChecked = links.length;
  out.brokenHashLinks = broken.length;
  out.brokenHashSamples = broken.slice(0, 8);
  return out;
})()`;

const LAYOUT_CHECKS = String.raw`(function () {
  var out = {};
  var main = document.querySelector('main');
  out.docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  out.mainOverflow = main ? main.scrollWidth - main.clientWidth : null;
  var fails = [];
  try { if (typeof window.book2QA === 'function') { fails = window.book2QA(); } }
  catch (e) { out.qaError = String(e); }
  out.qaFailureCount = fails.length;
  out.qaFailures = fails.slice(0, 12);
  out.overflowingPages = fails.filter(function (f) { return f.kind === 'section-horizontal'; }).length;
  out.outsideSection = fails.filter(function (f) { return f.kind === 'visible-content-outside-section'; });
  return out;
})()`;

const COVER_PROBE = String.raw`(function () {
  var p = document.getElementById('TMP-0001');
  if (!p) return { error: 'cover region missing' };
  var r = p.getBoundingClientRect();
  var out = { page: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width },
              pageScrollWidth: p.scrollWidth, pageClientWidth: p.clientWidth,
              contentScrollWidth: null, contentClientWidth: null,
              tables: [], offenders: [] };
  var c = p.querySelector('.content');
  if (c) { out.contentScrollWidth = c.scrollWidth; out.contentClientWidth = c.clientWidth; }
  var ts = p.querySelectorAll('table');
  for (var i = 0; i < ts.length; i++) {
    var tr = ts[i].getBoundingClientRect();
    out.tables.push({ index: i, left: Math.round(tr.left), right: Math.round(tr.right),
                      width: Math.round(tr.width), scrollWidth: ts[i].scrollWidth,
                      clientWidth: ts[i].clientWidth });
    if (tr.left < r.left - 1 || tr.right > r.right + 1) {
      out.offenders.push({ index: i, tag: 'TABLE', left: tr.left, right: tr.right });
    }
  }
  var kids = p.querySelectorAll('p,table,img,svg,figure,figcaption,details,.desc-panel');
  for (var j = 0; j < kids.length && out.offenders.length < 6; j++) {
    var d = kids[j];
    if (d.getClientRects().length === 0) continue;
    var x = d.getBoundingClientRect();
    if (x.left < r.left - 1 || x.right > r.right + 1 || x.top < r.top - 1 || x.bottom > r.bottom + 1) {
      out.offenders.push({ tag: d.tagName, left: Math.round(x.left), right: Math.round(x.right),
                           top: Math.round(x.top), bottom: Math.round(x.bottom) });
    }
  }
  return out;
})()`;

const DISCLOSURE_PROBE = String.raw`(function () {
  var out = { controls: [], keyboard: null };
  var want = ['Extended description for Walmart', 'Extended description for Starbucks Rewards',
              'Extended description for Merck', 'Extended description for Front Cover'];
  var all = [].slice.call(document.querySelectorAll('details.disclosure'));
  for (var w = 0; w < want.length; w++) {
    var hit = null;
    for (var i = 0; i < all.length; i++) {
      var lab = all[i].querySelector('.b2-desc-label');
      if (lab && lab.textContent.trim() === want[w]) { hit = all[i]; break; }
    }
    if (!hit) { out.controls.push({ label: want[w], found: false }); continue; }
    var panel = hit.querySelector('.desc-panel');
    var summary = hit.querySelector('summary');
    var rec = {
      label: want[w], found: true,
      collapsedHeight: Math.round(hit.getBoundingClientRect().height),
      summaryHeight: Math.round(summary.getBoundingClientRect().height),
      panelText: panel ? panel.textContent.replace(/\s+/g, ' ').trim().slice(0, 400) : null,
      panelTextChars: panel ? panel.textContent.replace(/\s+/g, ' ').trim().length : 0,
      panelImages: panel ? panel.querySelectorAll('img').length : 0,
      panelScrollWidth: panel ? panel.scrollWidth : null,
      panelClientWidth: panel ? panel.clientWidth : null,
    };
    hit.open = true;
    var pr = hit.getBoundingClientRect();
    rec.openHeight = Math.round(pr.height);
    rec.grew = rec.openHeight > rec.collapsedHeight;
    rec.panelOverflow = panel ? panel.scrollWidth - panel.clientWidth : null;
    var para = panel ? panel.querySelector('p') : null;
    if (para) {
      var cs = getComputedStyle(para);
      rec.paraPaddingLeft = cs.paddingLeft;
      rec.paraPaddingRight = cs.paddingRight;
    }
    hit.open = false;
    out.controls.push(rec);
  }
  // keyboard operation on the first control
  var first = all[0];
  if (first) {
    var s = first.querySelector('summary');
    s.focus();
    var focused = document.activeElement === s;
    var before = first.open;
    s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    s.click();
    var after = first.open;
    first.open = before;
    out.keyboard = { focusable: focused, toggledByClick: before !== after };
  }
  return out;
})()`;

(async () => {
  let page;
  try {
    const nt = await (await fetch(ENDPOINT + '/json/new?about:blank', { method: 'PUT' })).json();
    page = new CDP(nt.webSocketDebuggerUrl);
    await page.connect();
    page.on(m => {
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails || {};
        result.exceptions.push({ text: d.text, line: d.lineNumber, url: d.url,
                                 desc: (d.exception && d.exception.description || '').slice(0, 300) });
      }
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        result.logErrors.push(String(m.params.entry.text).slice(0, 300));
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        result.consoleErrors.push((m.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 300));
      }
    });
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Log.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: fileUrl }, 180000);
    const deadline = Date.now() + LOAD_TIMEOUT;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        const r = await page.send('Runtime.evaluate', ev('document.readyState + "|" + document.querySelectorAll(".book-page").length'), 60000);
        if (/^complete\|1899$/.test(String(r.result && r.result.value))) { ready = true; break; }
      } catch { /* parsing */ }
      await new Promise(r => setTimeout(r, 3000));
    }
    result.loadReady = ready;
    await new Promise(r => setTimeout(r, 3000));
    const s = await page.send('Runtime.evaluate', ev(STATIC_CHECKS), 300000);
    result.checks = s.result ? s.result.value : null;
    const l = await page.send('Runtime.evaluate', ev(LAYOUT_CHECKS), 300000);
    result.firstViewport = l.result ? l.result.value : null;
    const c = await page.send('Runtime.evaluate', ev(COVER_PROBE), 120000);
    result.coverProbe = c.result ? c.result.value : null;
    const d = await page.send('Runtime.evaluate', ev(DISCLOSURE_PROBE), 180000);
    result.disclosureProbe = d.result ? d.result.value : null;

    // second viewport: mobile
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await new Promise(r => setTimeout(r, 4000));
    const l2 = await page.send('Runtime.evaluate', ev(LAYOUT_CHECKS), 300000);
    result.mobile = l2.result ? l2.result.value : null;
    const c2 = await page.send('Runtime.evaluate', ev(COVER_PROBE), 120000);
    result.coverProbeMobile = c2.result ? c2.result.value : null;

    // third viewport: wide
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1200, deviceScaleFactor: 1, mobile: false });
    await new Promise(r => setTimeout(r, 4000));
    const l3 = await page.send('Runtime.evaluate', ev(LAYOUT_CHECKS), 300000);
    result.wide = l3.result ? l3.result.value : null;

    // interactions: navigation focus + search, at desktop width
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    await new Promise(r => setTimeout(r, 1500));
    const nav = await page.send('Runtime.evaluate', ev(String.raw`(function(){
      var link = document.querySelector('a[href="#book-heading-0010"]');
      var out = { link: !!link };
      if (link) {
        link.click();
        out.hash = location.hash;
        out.activeId = document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null;
        var t = document.getElementById('book-heading-0010');
        out.targetTop = t ? Math.round(t.getBoundingClientRect().top) : null;
        var tb = document.querySelector('.toolbar');
        out.toolbarBottom = tb ? Math.round(tb.getBoundingClientRect().bottom) : null;
        out.landedBelowToolbar = out.targetTop === null || out.toolbarBottom === null ? null : out.targetTop >= out.toolbarBottom;
        out.currentRows = document.querySelectorAll('[aria-current]').length;
      }
      return out;
    })()`), 120000);
    result.navigation = nav.result ? nav.result.value : null;
    const search = await page.send('Runtime.evaluate', ev(String.raw`(function(){
      var s = document.querySelector('#search');
      if (!s) return { error: 'no search input' };
      s.value = 'Walmart';
      s.dispatchEvent(new Event('input', { bubbles: true }));
      return { dispatched: true };
    })()`), 60000);
    result.searchDispatch = search.result ? search.result.value : null;
    await new Promise(r => setTimeout(r, 8000));
    const sr = await page.send('Runtime.evaluate', ev(String.raw`(function(){
      var st = document.querySelector('.toolbar span[role="status"]');
      return { status: st ? st.textContent.trim() : null };
    })()`), 60000);
    result.searchResult = sr.result ? sr.result.value : null;

    if (shotPath) {
      try {
        const shot = await page.send('Page.captureScreenshot', { format: 'png' }, 120000);
        writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
        result.screenshot = shotPath;
      } catch (e) { result.screenshotError = e.message; }
    }
  } catch (e) {
    result.error = String(e && e.message || e);
  } finally {
    try { if (page) page.close(); } catch {}
    finish(result.error ? 1 : 0);
  }
})();
