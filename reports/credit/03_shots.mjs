// Before/after screenshots of the credit at TMP-0124, with the image actually loaded.
// node 03_shots.mjs <fileUrl> <outDir> <prefix>
import { writeFileSync, mkdirSync } from 'node:fs';
const url = process.argv[2], outDir = process.argv[3], prefix = process.argv[4] || 'shot';
const ENDPOINT = process.env.BOOK2_CDP || 'http://127.0.0.1:9335';
class CDP { constructor(u){this.url=u;this.id=0;this.p=new Map();}
  connect(){return new Promise((res,rej)=>{this.ws=new WebSocket(this.url);this.ws.onopen=()=>res();
    this.ws.onerror=()=>rej(new Error('ws'));this.ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
      if(m.id!==undefined){const q=this.p.get(m.id);if(q){this.p.delete(m.id);m.error?q.rej(new Error(JSON.stringify(m.error))):q.res(m.result);}}};});}
  send(method,params={},t=300000){const id=++this.id;return new Promise((res,rej)=>{const to=setTimeout(()=>{this.p.delete(id);rej(new Error('timeout '+method));},t);
    this.p.set(id,{res:r=>{clearTimeout(to);res(r);},rej:e=>{clearTimeout(to);rej(e);}});this.ws.send(JSON.stringify({id,method,params}));});}
  on(fn){this.h=this.h||[];this.h.push(fn);return this;}
  close(){try{this.ws.close();}catch{}} }
const ev = e => ({ expression: e, returnByValue: true, awaitPromise: false });
const MEASURE = String.raw`(function(){
  var out=[];
  ['Kristoffer Tripplaar/Alamy Stock Photo','MoMo Productions/Getty Images'].forEach(function(t){
    var ps=document.querySelectorAll('.book-page .content p');
    for(var i=0;i<ps.length;i++){
      if(ps[i].textContent.replace(/\s+/g,' ').trim()!==t) continue;
      var p=ps[i], cs=getComputedStyle(p), cell=p.closest('td');
      var probe=document.createElement('span');
      probe.style.cssText='position:absolute;left:-9999px;white-space:nowrap;visibility:hidden;font:'+cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+'/'+cs.lineHeight+' '+cs.fontFamily;
      document.body.appendChild(probe);
      var widest=0,w=t.split(' ');
      for(var k=0;k<w.length;k++){probe.textContent=w[k];widest=Math.max(widest,probe.getBoundingClientRect().width);}
      probe.remove();
      var r=p.getBoundingClientRect();
      out.push({text:t, region:p.closest('.book-page').id, cellW:Math.round(cell.getBoundingClientRect().width),
        pW:Math.round(r.width), pH:Math.round(r.height), widest:Math.round(widest),
        writingMode:cs.writingMode, cls:p.className,
        imgLoaded:(function(){var im=p.closest('table').querySelector('img');return !!(im&&im.complete&&im.naturalWidth>0);})(),
        docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth});
      break;
    }
  });
  return out;})()`;
(async () => {
  let page; const R = { shots: [], measures: {}, exceptions: [] };
  try { mkdirSync(outDir, { recursive: true }); } catch {}
  try {
    const nt = await (await fetch(ENDPOINT + '/json/new?about:blank', { method: 'PUT' })).json();
    page = new CDP(nt.webSocketDebuggerUrl); await page.connect();
    await page.send('Page.enable'); await page.send('Runtime.enable');
    page.on(m => { if (m.method === 'Runtime.exceptionThrown') R.exceptions.push(((m.params.exceptionDetails || {}).text || '').slice(0, 160)); });
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
    try { mkdirSync(outDir, { recursive: true }); } catch {}
    for (const [w, h] of [[1400, 1000], [768, 1024], [390, 844], [375, 812], [320, 700]]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 850 });
      await new Promise(r => setTimeout(r, 1500));
      // scroll the region into view so the lazy image loads, then wait for it
      await page.send('Runtime.evaluate', ev(`(function(){var app=document.querySelector('.app');
        app.classList.add('left-closed'); app.classList.add('right-closed');
        var r=document.getElementById('TMP-0124'); if(r) r.scrollIntoView({block:'start'});
        var m=document.querySelector('main'), b=document.querySelector('.toolbar');
        if(m&&b) m.scrollTop=Math.max(0,m.scrollTop-b.getBoundingClientRect().height-6); return 1;})()`), 120000);
      for (let k = 0; k < 12; k++) {
        const r = await page.send('Runtime.evaluate', ev(String.raw`(function(){var t=document.getElementById('TMP-0124');
          var im=t?t.querySelector('img'):null; return !!(im&&im.complete&&im.naturalWidth>0);})()`), 60000);
        if (r.result && r.result.value === true) break;
        await new Promise(r2 => setTimeout(r2, 500));
      }
      await new Promise(r => setTimeout(r, 1200));
      const m = await page.send('Runtime.evaluate', ev(MEASURE), 180000);
      R.measures[w + 'x' + h] = m.result ? m.result.value : null;
      const im = await page.send('Page.captureScreenshot', { format: 'png' }, 120000);
      const name = `${prefix}-0124-${w}.png`;
      writeFileSync(outDir + '\\' + name, Buffer.from(im.data, 'base64'));
      R.shots.push(name);
    }
  } catch (e) { R.error = String(e && e.message || e); }
  finally { try { if (page) page.close(); } catch {}
    try { writeFileSync(outDir + '\\' + prefix + '-measures.json', JSON.stringify(R, null, 1), 'utf8'); } catch (e) { console.log('write failed', e.message); }
    process.exit(0); }
})();
