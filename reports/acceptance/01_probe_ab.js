// Task A: rich diagnostics for the two suspicious mobile disclosures.
// node 01_probe_ab.js <fileUrl> <outJson> <shotDir>
import { writeFileSync, mkdirSync } from 'node:fs';
const url = process.argv[2], outJson = process.argv[3], shotDir = process.argv[4] || '';
const ENDPOINT = process.env.BOOK2_CDP || 'http://127.0.0.1:9335';
class CDP {
  constructor(u) { this.url = u; this.id = 0; this.p = new Map(); this.h = []; }
  connect() { return new Promise((res, rej) => { this.ws = new WebSocket(this.url);
    this.ws.onopen = () => res(); this.ws.onerror = () => rej(new Error('ws'));
    this.ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.id !== undefined) { const q = this.p.get(m.id);
        if (q) { this.p.delete(m.id); m.error ? q.rej(new Error(JSON.stringify(m.error))) : q.res(m.result); } }
      else for (const f of this.h) f(m); }; }); }
  send(method, params = {}, t = 300000) { const id = ++this.id;
    return new Promise((res, rej) => { const to = setTimeout(() => { this.p.delete(id); rej(new Error('timeout ' + method)); }, t);
      this.p.set(id, { res: r => { clearTimeout(to); res(r); }, rej: e => { clearTimeout(to); rej(e); } });
      this.ws.send(JSON.stringify({ id, method, params })); }); }
  on(fn) { this.h.push(fn); return this; } close() { try { this.ws.close(); } catch {} }
}
const ev = e => ({ expression: e, returnByValue: true, awaitPromise: false });

const INSPECT = String.raw`(function(rid){
  function rects(el){ return el ? el.getClientRects().length : -1; }
  function visText(el){
    // how many characters of the element are actually rendered
    var n=0, w=document.createTreeWalker(el, NodeFilter.SHOW_TEXT), t;
    while((t=w.nextNode())){
      if(!t.textContent.trim()) continue;
      var r=document.createRange(); r.selectNodeContents(t);
      if(r.getClientRects().length) n+=t.textContent.trim().length;
    }
    return n;
  }
  var reg=document.getElementById(rid);
  if(!reg) return {region:rid, error:'region missing'};
  var d=reg.querySelector('details.disclosure');
  if(!d) return {region:rid, error:'control missing'};
  var s=d.querySelector('summary'), p=d.querySelector('.desc-panel');
  var o={region:rid, detailsTag:d.tagName, parentTag:d.parentElement.tagName,
         panelIsChildOfDetails:(p?p.parentElement===d:null),
         summaryIsChildOfDetails:(s?s.parentElement===d:null),
         allPanelsInDetails:d.querySelectorAll('.desc-panel').length,
         detailsInDetails:d.querySelectorAll('details').length};
  function snap(tag){
    var cs=p?getComputedStyle(p):null;
    o[tag]={open:d.open,
      detailsH:Math.round(d.getBoundingClientRect().height),
      detailsW:Math.round(d.getBoundingClientRect().width),
      summaryH:Math.round(s.getBoundingClientRect().height),
      panelH:p?Math.round(p.getBoundingClientRect().height):null,
      panelW:p?Math.round(p.getBoundingClientRect().width):null,
      panelDisplay:cs?cs.display:null,
      panelContentVis:cs?(cs.contentVisibility||''):null,
      panelOffsetParent: p ? (p.offsetParent!==null) : null,
      panelRects:rects(p), summaryRects:rects(s),
      visibleChars: p?visText(p):0,
      totalChars: p?p.textContent.replace(/\s+/g,' ').trim().length:0,
      panelOverflow: p?(p.scrollWidth-p.clientWidth):null};
  }
  d.open=false; snap('closed');
  d.open=true;  snap('open');
  // keyboard: focus summary, Tab-into-panel reachability is not meaningful for
  // details; instead confirm the summary is focusable and Enter toggles
  s.focus(); o.summaryFocusable=(document.activeElement===s);
  var before=d.open; s.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  if(d.open===before) s.click();
  o.keyboardToggles=(before!==d.open);
  d.open=before;
  return o;})`;

(async () => {
  let page; const R = { exceptions: [], consoleErrors: [], viewports: {} };
  try {
    const nt = await (await fetch(ENDPOINT + '/json/new?about:blank', { method: 'PUT' })).json();
    page = new CDP(nt.webSocketDebuggerUrl); await page.connect();
    page.on(m => {
      if (m.method === 'Runtime.exceptionThrown') R.exceptions.push(((m.params.exceptionDetails || {}).text || '').slice(0, 200));
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') R.consoleErrors.push((m.params.args || []).map(a => a.value || '').join(' ').slice(0, 200));
    });
    await page.send('Page.enable'); await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url }, 240000);
    const dl = Date.now() + 600000;
    while (Date.now() < dl) {
      try { const r = await page.send('Runtime.evaluate', ev('document.readyState + "|" + document.querySelectorAll(".book-page").length'), 60000);
        if (/^complete\|1899/.test(String(r.result && r.result.value))) break; } catch {}
      await new Promise(r => setTimeout(r, 3000));
    }
    await page.send('Runtime.evaluate', ev('(function(){try{localStorage.clear();}catch(e){}return 1;})()'), 60000);
    await page.send('Page.reload', {}, 240000);
    const dl2 = Date.now() + 600000;
    while (Date.now() < dl2) {
      try { const r = await page.send('Runtime.evaluate', ev('document.readyState + "|" + document.querySelectorAll(".book-page").length'), 60000);
        if (/^complete\|1899/.test(String(r.result && r.result.value))) break; } catch {}
      await new Promise(r => setTimeout(r, 3000));
    }
    await new Promise(r => setTimeout(r, 3000));
    const VPS = [[1400, 1000], [768, 1024], [390, 844], [375, 812], [320, 700]];
    for (const [w, h] of VPS) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 850 });
      await new Promise(r => setTimeout(r, 2000));
      R.viewports[w + 'x' + h] = {};
      for (const rid of ['TMP-0125', 'TMP-0516']) {
        await page.send('Runtime.evaluate', ev(`(function(){var r=document.getElementById('${rid}');if(r)r.scrollIntoView({block:'start'});})()`), 120000);
        await new Promise(r => setTimeout(r, 1200));
        const r = await page.send('Runtime.evaluate', ev(INSPECT + `('${rid}')`), 180000);
        R.viewports[w + 'x' + h][rid] = r.result ? r.result.value : null;
        if (shotDir && (w === 1400 || w === 390)) {
          for (const state of ['closed', 'open']) {
            await page.send('Runtime.evaluate', ev(`(function(){var d=document.getElementById('${rid}').querySelector('details.disclosure');d.open=${state === 'open'};for(var i=0;i<2;i++){} })()`), 60000);
            await new Promise(r2 => setTimeout(r2, 900));
            const im = await page.send('Page.captureScreenshot', { format: 'png' }, 120000);
            const name = `${rid}-${w}-${state}.png`;
            try { mkdirSync(shotDir, { recursive: true }); } catch {}
            writeFileSync(shotDir + '\\' + name, Buffer.from(im.data, 'base64'));
            (R.screenshots = R.screenshots || []).push(name);
          }
          await page.send('Runtime.evaluate', ev(`(function(){document.getElementById('${rid}').querySelector('details.disclosure').open=false;})()`), 60000);
        }
      }
    }
  } catch (e) { R.error = String(e && e.message || e); }
  finally { try { if (page) page.close(); } catch {} writeFileSync(outJson, JSON.stringify(R, null, 1), 'utf8'); process.exit(0); }
})();
