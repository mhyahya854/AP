// Geometry + element screenshots for the credit fixtures.
// node fixture_shots.mjs <outDir> [endpoint] [fixturesDir]
import { writeFileSync, mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '.';
const ENDPOINT = process.argv[3] || process.env.BOOK2_CDP || 'http://127.0.0.1:9336';
const fixturesDir = process.argv[4] || outDir;
const fileUrl = p => 'file:///' + p.replace(/\\/g, '/').replace(/^\//, '');
const VIEWPORTS = [[1400, 1000], [390, 844]];
const VARIANTS = ['accepted', 'vrl', 'slr'];
const REGION = { 'TMP-0124': 'Tripplaar', 'TMP-0161': 'Mario Tama', 'TMP-0250': 'Bloomberg' };

class CDP {
  constructor(u) { this.url = u; this.id = 0; this.p = new Map(); }
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

const ev = e => ({ expression: e, returnByValue: true, awaitPromise: false });
const MEASURE = String.raw`(function(){
  var out=[];
  document.querySelectorAll('.book-page').forEach(function(pg){
    var ps=pg.querySelectorAll('p'); var hit=null;
    for(var i=0;i<ps.length;i++){ var t=ps[i].textContent.replace(/\s+/g,' ').trim();
      if(/Tripplaar|Mario Tama|Bloomberg\/Getty/.test(t)){hit=ps[i];break;} }
    if(!hit) return;
    var cs=getComputedStyle(hit), r=hit.getBoundingClientRect(), cell=hit.closest('td');
    var probe=document.createElement('span');
    probe.style.cssText='position:absolute;left:-9999px;white-space:nowrap;visibility:hidden;font:'+
      cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+'/'+cs.lineHeight+' '+cs.fontFamily;
    document.body.appendChild(probe);
    var widest=0, ws=hit.textContent.replace(/\s+/g,' ').trim().split(' ');
    for(var k=0;k<ws.length;k++){probe.textContent=ws[k];widest=Math.max(widest,probe.getBoundingClientRect().width);}
    probe.remove();
    var img=pg.querySelector('img');
    out.push({region:pg.id, text:hit.textContent.replace(/\s+/g,' ').trim(),
      writingMode:cs.writingMode, textOrientation:cs.textOrientation,
      pW:Math.round(r.width), pH:Math.round(r.height),
      cellW:cell?Math.round(cell.getBoundingClientRect().width):null,
      lines:Math.round(r.height/(parseFloat(cs.lineHeight)||16)),
      widestWord:Math.round(widest), styles:cs.transform,
      imgLoaded:!!(img&&img.complete&&img.naturalWidth>0),
      docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      box:{x:Math.round(r.x),y:Math.round(r.y)}});
  });
  return out;})()`;

(async () => {
  mkdirSync(outDir, { recursive: true });
  const R = { measures: {}, exceptions: [], files: [] };
  let page;
  try {
    const nt = await (await fetch(ENDPOINT + '/json/new?about:blank', { method: 'PUT' })).json();
    page = new CDP(nt.webSocketDebuggerUrl);
    await page.connect();
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    for (const variant of VARIANTS) {
      const url = fileUrl(fixturesDir) + '/fixture-' + variant + '.html';
      for (const [w, h] of VIEWPORTS) {
        const key = variant + '-' + w;
        await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 850 });
        await page.send('Page.navigate', { url }, 90000);
        const deadline = Date.now() + 60000;
        while (Date.now() < deadline) {
          const r = await page.send('Runtime.evaluate', ev('document.readyState + "|" + document.querySelectorAll(".book-page").length'), 30000);
          if (/^complete\|3/.test(String(r.result && r.result.value))) break;
          await new Promise(r2 => setTimeout(r2, 500));
        }
        await page.send('Runtime.evaluate', ev(`(function(){
          document.getElementById('b2-app').className='app left-closed right-closed';
          var m=document.getElementById('b2-main'); if(m) m.scrollTop=0; return 1;})()`), 30000);
        let loaded = false;
        for (let k = 0; k < 20 && !loaded; k++) {
          const r = await page.send('Runtime.evaluate', ev(String.raw`(function(){
            var ims=document.querySelectorAll('.book-page img');
            for(var i=0;i<ims.length;i++){ if(!(ims[i].complete&&ims[i].naturalWidth>0)) return false; }
            return ims.length>0;})()`), 30000);
          loaded = r.result && r.result.value === true;
          if (!loaded) await new Promise(r2 => setTimeout(r2, 500));
        }
        for (const rid of Object.keys(REGION)) {
          await page.send('Runtime.evaluate', ev(`(function(){
            var el=document.getElementById('${rid}'); if(el) el.scrollIntoView({block:'start'});
            var m=document.getElementById('b2-main'); if(m) m.scrollTop=Math.max(0,m.scrollTop-4);
            window.scrollTo(0,0); return 1;})()`), 30000);
          await new Promise(r2 => setTimeout(r2, 400));
          const box = await page.send('Runtime.evaluate', ev(`(function(){
            var el=document.getElementById('${rid}').querySelector('img'); if(!el) return null;
            var r=el.getBoundingClientRect();
            return JSON.stringify({x:r.x-2,y:r.y-2,width:Math.min(r.width+70,2000),height:r.height+4});})()`), 30000);
          const clip = box.result && box.result.value ? JSON.parse(box.result.value) : null;
          const shot = await page.send('Page.captureScreenshot', clip
            ? { format: 'png', clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 } }
            : { format: 'png' }, 60000);
          const name = `${key}-${rid}.png`;
          writeFileSync(outDir + '\\' + name, Buffer.from(shot.data, 'base64'));
          R.files.push(name);
        }
        const m = await page.send('Runtime.evaluate', ev(MEASURE), 60000);
        R.measures[key] = m.result ? m.result.value : null;
      }
    }
  } catch (e) {
    R.error = String((e && e.message) || e);
  } finally {
    try { if (page) page.close(); } catch { }
    try { writeFileSync(outDir + '\\fixture-measures.json', JSON.stringify(R, null, 1), 'utf8'); } catch { }
    console.log(JSON.stringify({ error: R.error || null, files: R.files.length }, null, 1));
    process.exit(0);
  }
})();
