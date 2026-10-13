// Task A screenshots: both controls, desktop + mobile, drawers closed, framed on the summary.
import { writeFileSync, mkdirSync } from 'node:fs';
const url = process.argv[2], shotDir = process.argv[3];
const ENDPOINT = process.env.BOOK2_CDP || 'http://127.0.0.1:9335';
class CDP { constructor(u){this.url=u;this.id=0;this.p=new Map();}
  connect(){return new Promise((res,rej)=>{this.ws=new WebSocket(this.url);this.ws.onopen=()=>res();
    this.ws.onerror=()=>rej(new Error('ws'));this.ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
      if(m.id!==undefined){const q=this.p.get(m.id);if(q){this.p.delete(m.id);m.error?q.rej(new Error(JSON.stringify(m.error))):q.res(m.result);}}};});}
  send(method,params={},t=300000){const id=++this.id;return new Promise((res,rej)=>{const to=setTimeout(()=>{this.p.delete(id);rej(new Error('timeout '+method));},t);
    this.p.set(id,{res:r=>{clearTimeout(to);res(r);},rej:e=>{clearTimeout(to);rej(e);}});this.ws.send(JSON.stringify({id,method,params}));});}
  close(){try{this.ws.close();}catch{}} }
const ev = e => ({ expression: e, returnByValue: true, awaitPromise: false });

(async () => {
  let page; const out = {};
  try {
    const nt = await (await fetch(ENDPOINT + '/json/new?about:blank', { method: 'PUT' })).json();
    page = new CDP(nt.webSocketDebuggerUrl); await page.connect();
    await page.send('Page.enable'); await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url }, 240000);
    const wait = async () => { const dl = Date.now() + 600000;
      while (Date.now() < dl) { try { const r = await page.send('Runtime.evaluate',
          ev('document.readyState + "|" + document.querySelectorAll(".book-page").length'), 60000);
        if (/^complete\|1899/.test(String(r.result && r.result.value))) return; } catch {}
        await new Promise(r => setTimeout(r, 3000)); } };
    await wait();
    await page.send('Runtime.evaluate', ev('(function(){try{localStorage.clear();}catch(e){}return 1;})()'), 60000);
    await page.send('Page.reload', {}, 240000); await wait();
    await new Promise(r => setTimeout(r, 3000));
    mkdirSync(shotDir, { recursive: true });
    for (const [w, h] of [[1400, 1000], [390, 844]]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 850 });
      await new Promise(r => setTimeout(r, 2000));
      for (const rid of ['TMP-0125', 'TMP-0516']) {
        // close both drawers and frame the control with a little context above it
        await page.send('Runtime.evaluate', ev(`(function(){
          var app=document.querySelector('.app'); app.classList.add('left-closed','right-closed');
          var d=document.getElementById('${rid}').querySelector('details.disclosure');
          d.open=false; d.scrollIntoView({block:'center'});
          var main=document.querySelector('main');
          var bar=document.querySelector('.toolbar');
          if(main&&bar) main.scrollTop=Math.max(0, main.scrollTop - bar.getBoundingClientRect().height - 12);
          return true;})()`), 120000);
        await new Promise(r => setTimeout(r, 1500));
        for (const state of ['closed', 'open']) {
          await page.send('Runtime.evaluate', ev(`(function(){document.getElementById('${rid}')
            .querySelector('details.disclosure').open=${state === 'open'}; return 1;})()`), 60000);
          await new Promise(r => setTimeout(r, 1200));
          const im = await page.send('Page.captureScreenshot', { format: 'png' }, 120000);
          const name = `ab-${rid}-${w}-${state}.png`;
          writeFileSync(shotDir + '\\' + name, Buffer.from(im.data, 'base64'));
          (out.shots = out.shots || []).push(name);
        }
      }
    }
  } catch (e) { out.error = String(e && e.message || e); }
  finally { try { if (page) page.close(); } catch {} writeFileSync(shotDir + '\\shots.json', JSON.stringify(out, null, 1), 'utf8'); process.exit(0); }
})();
