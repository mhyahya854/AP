// One bounded controlled regression over the full staged artifact.
// node regression_full.mjs <fileUrl> <changedRegions.json> <outReport.json> [endpoint]
import { writeFileSync, readFileSync } from 'node:fs';

const url = process.argv[2];
const changedPath = process.argv[3];
const outPath = process.argv[4];
const ENDPOINT = process.argv[5] || process.env.BOOK2_CDP || 'http://127.0.0.1:9336';
const CHANGED = JSON.parse(readFileSync(changedPath, 'utf8'));
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1) + 's', ...a);

class CDP {
  constructor(u) { this.url = u; this.id = 0; this.p = new Map(); this.events = []; }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => res();
      this.ws.onerror = () => rej(new Error('ws'));
      this.ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.id !== undefined) {
          const q = this.p.get(m.id);
          if (q) { this.p.delete(m.id); m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result); }
        } else if (m.method === 'Runtime.exceptionThrown' || m.method === 'Log.entryAdded') {
          this.events.push(m);
        }
      };
    });
  }
  send(method, params = {}, t = 120000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const to = setTimeout(() => { this.p.delete(id); rej(new Error('timeout ' + method)); }, t);
      this.p.set(id, { res: r => { clearTimeout(to); res(r); }, rej: e => { clearTimeout(to); rej(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { try { this.ws.close(); } catch { } }
}

const ev = e => ({ expression: e, returnByValue: true, awaitPromise: true });
const R = { started: new Date().toISOString(), checks: {}, creditFailures: [], disclosure: {},
            exceptions: [], consoleErrors: [], logErrors: [], limits: [] };
const budget = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const nt = await (await fetch(ENDPOINT + '/json/new?about:blank', { method: 'PUT' })).json();
  const page = new CDP(nt.webSocketDebuggerUrl);
  await page.connect();
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Log.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  log('navigating');
  await page.send('Page.navigate', { url }, 120000);

  // bounded wait for the whole book
  let ready = false;
  const loadDeadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < loadDeadline) {
    try {
      const r = await page.send('Runtime.evaluate', ev('document.readyState + "|" + document.querySelectorAll(".book-page").length'), 60000);
      const v = String(r.result && r.result.value);
      if (/^complete\|1899$/.test(v)) { ready = true; break; }
      log('  still loading:', v);
    } catch (e) { log('  probe error', e.message); }
    await budget(4000);
  }
  R.checks.loaded = ready;
  if (!ready) {
    R.limits.push('the full book did not reach readyState=complete with 1,899 regions inside the 8 minute budget');
    finish(page); return;
  }
  log('book loaded');

  // 1) structure
  const structure = await page.send('Runtime.evaluate', ev(String.raw`(function(){
    var pages=[].slice.call(document.querySelectorAll('.book-page'));
    var ids=pages.map(function(p){return p.id;});
    var uniq={},dups=0; ids.forEach(function(i){ if(uniq[i])dups++; uniq[i]=1; });
    var details=[].slice.call(document.querySelectorAll('details'));
    var links=[].slice.call(document.querySelectorAll('a[href^="#"]'));
    var broken=links.filter(function(a){var h=a.getAttribute('href').slice(1); return h && !document.getElementById(h);});
    var words=(document.body.innerText||'').split(/\s+/).filter(Boolean).length;
    return {regions:pages.length, duplicateRegionIds:dups, details:details.length,
      summaries:document.querySelectorAll('summary').length, imgs:document.querySelectorAll('img').length,
      tables:document.querySelectorAll('table').length, navLinks:links.length, brokenLinks:broken.length,
      words:words, docOverflowDesktop:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      hasQA: typeof window.book2QA==='function'};
  })()`), 180000);
  R.checks.structure = structure.result && structure.result.value;
  log('structure', JSON.stringify(R.checks.structure));

  // 2) every changed credit: computed writing mode + one vertical line, image loaded
  log('checking', CHANGED.length, 'changed credits');
  const creditCheck = await page.send('Runtime.evaluate', ev(`(async function(){
    const ids=${JSON.stringify(CHANGED)};
    const main=document.querySelector('main');
    const out={checked:0, sideways:0, wrongMode:[], overflow:[], multiLine:[], imgNotLoaded:[]};
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    for(const id of ids){
      const pg=document.getElementById(id); if(!pg){ out.missing=out.missing||[]; out.missing.push(id); continue; }
      pg.scrollIntoView({block:'start'});
      const img=pg.querySelector('img');
      for(let k=0;k<6;k++){ if(img && img.complete && img.naturalWidth>0) break; await sleep(120); }
      const ps=pg.querySelectorAll('.content p, p');
      let target=null;
      for(const p of ps){ const t=p.textContent.replace(/\\s+/g,' ').trim();
        if(/Getty Images|Alamy|Shutterstock|Stock Photo|Reuters|Bloomberg|Anadolu|AFP|ZUMA|Zuma/.test(t) && t.length<90){ target=p; break; } }
      if(!target){ out.noCredit=out.noCredit||[]; out.noCredit.push(id); continue; }
      const cs=getComputedStyle(target), r=target.getBoundingClientRect();
      out.checked++;
      if(cs.writingMode==='sideways-lr') out.sideways++; else out.wrongMode.push({id,wm:cs.writingMode});
      const lh=parseFloat(cs.lineHeight)||16;
      const lines=Math.round(r.height/lh);
      if(lines>2) out.multiLine.push({id,lines,w:Math.round(r.width),h:Math.round(r.height)});
      const cell=target.closest('td');
      if(cell && cell.scrollWidth-cell.clientWidth>1) out.overflow.push({id,cw:cell.clientWidth,sw:cell.scrollWidth});
      if(!(img&&img.complete&&img.naturalWidth>0)) out.imgNotLoaded.push(id);
    }
    out.docOverflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;
    return out;})()`), 8 * 60 * 1000);
  R.checks.credits = creditCheck.result && creditCheck.result.value;
  log('credits', JSON.stringify({checked: R.checks.credits && R.checks.credits.checked,
    sideways: R.checks.credits && R.checks.credits.sideways,
    wrongMode: (R.checks.credits && R.checks.credits.wrongMode || []).length,
    multiLine: (R.checks.credits && R.checks.credits.multiLine || []).length,
    overflow: (R.checks.credits && R.checks.credits.overflow || []).length}));

  // 3) disclosures: every control opens to a real panel and closes again
  log('checking disclosures');
  const disc = await page.send('Runtime.evaluate', ev(`(async function(){
    const ds=[].slice.call(document.querySelectorAll('details'));
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const out={total:ds.length, opened:0, revealed:0, closed:0, noSummary:0, emptyPanel:0,
      nested:0, failures:[]};
    for(let i=0;i<ds.length;i++){
      const d=ds[i];
      const sum=d.querySelector('summary');
      if(!sum){ out.noSummary++; continue; }
      if(d.querySelector('details')) out.nested++;
      const before=d.querySelector('summary').getBoundingClientRect();
      d.open=true;
      const panel=[].slice.call(d.children).filter(function(c){return c.tagName!=='SUMMARY';});
      const text=panel.map(function(c){return c.innerText||'';}).join(' ').replace(/\\s+/g,' ').trim();
      const h=d.getBoundingClientRect().height;
      if(text) out.revealed++; else out.emptyPanel++;
      d.open=false;
      const h2=d.getBoundingClientRect().height;
      if(h2<before.height+4) out.closed++;
      out.opened++;
      if(i%40===0) await sleep(0);
    }
    return out;})()`), 8 * 60 * 1000);
  R.checks.disclosures = disc.result && disc.result.value;
  log('disclosures', JSON.stringify(R.checks.disclosures));

  // 4) the artifact's own QA harness
  const qa = await page.send('Runtime.evaluate', ev(`(function(){
    if(typeof window.book2QA!=='function') return {available:false};
    try { var r=window.book2QA(); return {available:true, result:r}; } catch(e){ return {available:true, error:String(e)}; }
  })()`), 300000);
  R.checks.book2QA = qa.result && qa.result.value;
  log('book2QA', JSON.stringify(R.checks.book2QA));

  // 5) mobile pass
  await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await budget(2500);
  const mobile = await page.send('Runtime.evaluate', ev(String.raw`(function(){
    var doc=document.documentElement;
    var wide=[].slice.call(document.querySelectorAll('.book-page')).slice(0,200)
      .filter(function(p){return p.scrollWidth-p.clientWidth>2;}).length;
    return {docOverflow:doc.scrollWidth-doc.clientWidth, mainOverflow:(function(){var m=document.querySelector('main');
      return m?m.scrollWidth-m.clientWidth:null;})(), wideSample:wide};})()`), 300000);
  R.checks.mobile390 = mobile.result && mobile.result.value;
  log('mobile', JSON.stringify(R.checks.mobile390));

  finish(page);
}

function finish(page) {
  try { page.close(); } catch { }
  const cr = page && page.events || [];
  R.exceptions = cr.filter(e => e.method === 'Runtime.exceptionThrown')
    .map(e => (e.params.exceptionDetails && e.params.exceptionDetails.text || '').slice(0, 200));
  R.consoleErrors = cr.filter(e => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
    .map(e => ({ source: e.params.entry.source, text: String(e.params.entry.text).slice(0, 200),
                 url: String(e.params.entry.url || '').slice(-60) }));
  // errors that come from the artifact itself, not from a missing favicon
  R.logErrors = R.consoleErrors.filter(e => !/favicon/.test(e.text));
  const ok = R.checks.loaded && R.checks.structure && R.checks.structure.regions === 1899
    && R.checks.structure.duplicateRegionIds === 0 && R.checks.structure.brokenLinks === 0
    && R.checks.credits && R.checks.credits.checked === CHANGED.length
    && (R.checks.credits.wrongMode || []).length === 0
    && (R.checks.credits.multiLine || []).length === 0
    && R.checks.disclosures && R.checks.disclosures.noSummary === 0
    && R.checks.disclosures.emptyPanel === 0
    && R.checks.structure.words === 228459
    && R.logErrors.length === 0;
  R.ok = !!ok;
  R.tookSeconds = Math.round((Date.now() - T0) / 1000);
  writeFileSync(outPath, JSON.stringify(R, null, 1), 'utf8');
  log('report written', outPath, 'ok=' + R.ok, 'took', R.tookSeconds + 's');
  process.exit(0);
}

main().catch(err => {
  R.error = String(err && err.message || err);
  R.ok = false;
  try { writeFileSync(outPath, JSON.stringify(R, null, 1), 'utf8'); } catch { }
  console.log('FAILED', R.error);
  process.exit(1);
});
