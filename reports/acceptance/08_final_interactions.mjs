// Task D tail: capture-mode label after the relabel settles, and drawer behaviour
// with fresh preferences vs stored desktop preferences.
import { writeFileSync } from 'node:fs';
const url = process.argv[2], outJson = process.argv[3];
const ENDPOINT = process.env.BOOK2_CDP || 'http://127.0.0.1:9335';
class CDP { constructor(u){this.url=u;this.id=0;this.p=new Map();this.h=[];}
  connect(){return new Promise((res,rej)=>{this.ws=new WebSocket(this.url);this.ws.onopen=()=>res();
    this.ws.onerror=()=>rej(new Error('ws'));this.ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
      if(m.id!==undefined){const q=this.p.get(m.id);if(q){this.p.delete(m.id);m.error?q.rej(new Error(JSON.stringify(m.error))):q.res(m.result);}}
      else for(const f of this.h)f(m);};});}
  send(method,params={},t=300000){const id=++this.id;return new Promise((res,rej)=>{const to=setTimeout(()=>{this.p.delete(id);rej(new Error('timeout '+method));},t);
    this.p.set(id,{res:r=>{clearTimeout(to);res(r);},rej:e=>{clearTimeout(to);rej(e);}});this.ws.send(JSON.stringify({id,method,params}));});}
  on(f){this.h.push(f);return this;} close(){try{this.ws.close();}catch{}} }
const ev = e => ({ expression: e, returnByValue: true, awaitPromise: false });
const DRAWERS = String.raw`(function(){
  function box(sel){var e=document.querySelector(sel); if(!e) return null; var r=e.getBoundingClientRect();
    return {shown:r.width>0&&r.height>0, left:Math.round(r.left), right:Math.round(r.right), w:Math.round(r.width)};}
  var l=box('aside.left'), r=box('aside.right');
  return {left:l, right:r, overlap:!!(l&&r&&l.shown&&r.shown&&l.right>r.left&&r.right>l.left), vw:window.innerWidth};})()`;
const COUNTER = String.raw`(function(){return {counter:(document.querySelector('#counter')||{}).textContent,
  note:(document.querySelector('#mode-note')||{}).textContent};})()`;

(async () => {
  let page; const R = { exceptions: [], consoleErrors: [] };
  try {
    const nt = await (await fetch(ENDPOINT + '/json/new?about:blank', { method: 'PUT' })).json();
    page = new CDP(nt.webSocketDebuggerUrl); await page.connect();
    page.on(m => {
      if (m.method === 'Runtime.exceptionThrown') R.exceptions.push(((m.params.exceptionDetails || {}).text || '').slice(0, 200));
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') R.consoleErrors.push((m.params.args || []).map(a => a.value || '').join(' ').slice(0, 200));
    });
    await page.send('Page.enable'); await page.send('Runtime.enable');
    const load = async (w, h) => {
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 850 });
      await page.send('Page.navigate', { url }, 240000);
      const dl = Date.now() + 600000;
      while (Date.now() < dl) { try { const r = await page.send('Runtime.evaluate',
          ev('document.readyState + "|" + document.querySelectorAll(".book-page").length'), 60000);
        if (/^complete\|1899/.test(String(r.result && r.result.value))) return; } catch {}
        await new Promise(r => setTimeout(r, 3000)); }
    };
    const run = async (name, expr) => { const r = await page.send('Runtime.evaluate', ev(expr), 120000);
      R[name] = r.result ? r.result.value : null; };

    // fresh preferences at mobile width
    await load(390, 844);
    await page.send('Runtime.evaluate', ev('(function(){try{localStorage.clear();}catch(e){}return 1;})()'), 60000);
    await load(390, 844);
    await new Promise(r => setTimeout(r, 2500));
    await run('fresh_mobile', DRAWERS);

    // stored desktop preferences (both open) then narrow
    await load(1400, 1000);
    await page.send('Runtime.evaluate', ev(String.raw`(function(){try{localStorage.setItem('book2.reader.v1',
      JSON.stringify({mode:'continuous',font:'original',size:100,spacing:'normal',zoom:100,left:'open',right:'open'}));}catch(e){}
      return 1;})()`), 60000);
    await load(1400, 1000);
    await new Promise(r => setTimeout(r, 2500));
    await run('stored_desktop', DRAWERS);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await new Promise(r => setTimeout(r, 2500));
    await run('stored_desktop_then_narrow', DRAWERS);
    await page.send('Runtime.evaluate', ev(String.raw`(function(){document.querySelector('#right-toggle').click();})()`), 60000);
    await new Promise(r => setTimeout(r, 1500));
    await run('after_opening_tools', DRAWERS);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    await new Promise(r => setTimeout(r, 2500));
    await run('back_on_desktop', DRAWERS);

    // capture-mode label, read only after the relabel has settled
    await page.send('Runtime.evaluate', ev(String.raw`(function(){var s=document.querySelector('#mode');
      s.value='single'; s.dispatchEvent(new Event('change',{bubbles:true})); return 1;})()`), 60000);
    await new Promise(r => setTimeout(r, 2000));
    await run('captureMode_label', COUNTER);
    await page.send('Runtime.evaluate', ev(String.raw`(function(){var s=document.querySelector('#mode');
      s.value='continuous'; s.dispatchEvent(new Event('change',{bubbles:true})); return 1;})()`), 60000);
    await new Promise(r => setTimeout(r, 1500));
    await run('continuous_label', COUNTER);
  } catch (e) { R.error = String(e && e.message || e); }
  finally { try { if (page) page.close(); } catch {} writeFileSync(outJson, JSON.stringify(R, null, 1), 'utf8'); process.exit(0); }
})();
