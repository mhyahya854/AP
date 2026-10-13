// Bounded scan: for every credit paragraph in a side cell, load its image, then
// measure whether its widest word fits.  Reports the genuinely broken set.
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
  on(f){this.h.push(f);return f;} close(){try{this.ws.close();}catch{}} }
const ev = e => ({ expression: e, returnByValue: true, awaitPromise: false });

const COLLECT = String.raw`(function(){
  var RE=/(Getty Images|Alamy|Shutterstock|iStock|AP Images|Reuters|Bloomberg|Unsplash|Pexels|Zuma|Newscom|Science Source|The Image Bank|Corbis|Stock Photo|Photographer|AFP|Associated Press|PA Images|Anadolu|picture alliance|Design Pics|Superstock|Nature Picture|Los Angeles Times|Houston Chronicle|Washington Post|Tribune|Hearst)/i;
  var res=[], ps=document.querySelectorAll('.book-page .content p');
  for(var i=0;i<ps.length;i++){
    var p=ps[i], t=p.textContent.replace(/\s+/g,' ').trim();
    if(!t || t.length>90 || !RE.test(t)) continue;
    if(/(Left:|right:|;)/.test(t)) continue;
    var cell=p.closest('td'); if(!cell) continue;
    if(cell.querySelector('img')) continue;
    var row=cell.closest('tr'), table=p.closest('table');
    if(!row) continue;
    var rowHTML=row.innerHTML||'';
    if(rowHTML.indexOf('<img')<0 && !(table&&table.querySelector('img'))) continue;
    p.setAttribute('data-scan-idx', String(res.length));
    res.push({idx:res.length, region:p.closest('.book-page').id, text:t});
  }
  return res;})()`;

const MEASURE_ONE = i => String.raw`(function(){
  var p=document.querySelector('[data-scan-idx="${i}"]');
  if(!p) return {error:'gone'};
  var cs=getComputedStyle(p), cell=p.closest('td'), table=p.closest('table');
  var probe=document.createElement('span');
  probe.style.cssText='position:absolute;left:-9999px;white-space:nowrap;visibility:hidden;font:'+cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+'/'+cs.lineHeight+' '+cs.fontFamily;
  document.body.appendChild(probe);
  var widest=0, w=p.textContent.replace(/\s+/g,' ').trim().split(' ');
  for(var k=0;k<w.length;k++){probe.textContent=w[k]; widest=Math.max(widest, probe.getBoundingClientRect().width);}
  probe.remove();
  var img=table?table.querySelector('img'):null;
  var r=p.getBoundingClientRect();
  return {idx:${i}, region:p.closest('.book-page').id,
    text:p.textContent.replace(/\s+/g,' ').trim(),
    cellW:Math.round(cell.getBoundingClientRect().width), pW:Math.round(r.width), pH:Math.round(r.height),
    widest:Math.round(widest), writingMode:cs.writingMode, cls:p.className,
    avail:Math.round(p.clientWidth-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0)),
    imgLoaded:!!(img&&img.complete&&img.naturalWidth>0),
    docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};})()`;

(async () => {
  let page; const R = { exceptions: [], results: [] };
  try {
    const nt = await (await fetch(ENDPOINT + '/json/new?about:blank', { method: 'PUT' })).json();
    page = new CDP(nt.webSocketDebuggerUrl); await page.connect();
    await page.send('Page.enable'); await page.send('Runtime.enable');
    page.on(m => { if (m.method === 'Runtime.exceptionThrown') R.exceptions.push(((m.params.exceptionDetails || {}).text || '').slice(0, 160)); });
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url }, 240000);
    const dl = Date.now() + 600000;
    while (Date.now() < dl) { try { const r = await page.send('Runtime.evaluate',
      ev('document.readyState + "|" + document.querySelectorAll(".book-page").length'), 60000);
      if (/^complete\|1899/.test(String(r.result && r.result.value))) break; } catch {}
      await new Promise(r => setTimeout(r, 3000)); }
    await page.send('Runtime.evaluate', ev('(function(){try{localStorage.clear();}catch(e){}return 1;})()'), 60000);
    await page.send('Page.reload', {}, 240000);
    const dl2 = Date.now() + 600000;
    while (Date.now() < dl2) { try { const r = await page.send('Runtime.evaluate',
      ev('document.readyState + "|" + document.querySelectorAll(".book-page").length'), 60000);
      if (/^complete\|1899/.test(String(r.result && r.result.value))) break; } catch {}
      await new Promise(r => setTimeout(r, 3000)); }
    await new Promise(r => setTimeout(r, 3000));
    const c = await page.send('Runtime.evaluate', ev(COLLECT), 300000);
    const list = (c.result && c.result.value) || [];
    R.candidates = list.length;
    for (const item of list) {
      // bring it into view so its lazy image loads, then wait briefly
      await page.send('Runtime.evaluate', ev(String.raw`(function(){var p=document.querySelector('[data-scan-idx="${item.idx}"]');
        if(p){p.scrollIntoView({block:'center'});}})()`), 60000);
      for (let k = 0; k < 8; k++) {
        const r = await page.send('Runtime.evaluate', ev(String.raw`(function(){var p=document.querySelector('[data-scan-idx="${item.idx}"]');
          var t=p?p.closest('table'):null, im=t?t.querySelector('img'):null; return !!(im&&im.complete&&im.naturalWidth>0);})()`), 60000);
        if (r.result && r.result.value === true) break;
        await new Promise(r2 => setTimeout(r2, 250));
      }
      const m = await page.send('Runtime.evaluate', ev(MEASURE_ONE(item.idx)), 60000);
      R.results.push(m.result ? m.result.value : { idx: item.idx });
      if (R.results.length % 40 === 0) R.progress = R.results.length;
    }
  } catch (e) { R.error = String(e && e.message || e); }
  finally { try { if (page) page.close(); } catch {} writeFileSync(outJson, JSON.stringify(R, null, 1), 'utf8'); process.exit(0); }
})();
