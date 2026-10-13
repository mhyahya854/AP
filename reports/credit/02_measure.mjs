// Measure the Kellogg's credit geometry, sideways-lr support, and what a fixed
// credit-keyword rule would tag.
import { writeFileSync } from 'node:fs';
const url = process.argv[2], outJson = process.argv[3];
const ENDPOINT = process.env.BOOK2_CDP || 'http://127.0.0.1:9335';
class CDP { constructor(u){this.url=u;this.id=0;this.p=new Map();}
  connect(){return new Promise((res,rej)=>{this.ws=new WebSocket(this.url);this.ws.onopen=()=>res();
    this.ws.onerror=()=>rej(new Error('ws'));this.ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
      if(m.id!==undefined){const q=this.p.get(m.id);if(q){this.p.delete(m.id);m.error?q.rej(new Error(JSON.stringify(m.error))):q.res(m.result);}}};});}
  send(method,params={},t=300000){const id=++this.id;return new Promise((res,rej)=>{const to=setTimeout(()=>{this.p.delete(id);rej(new Error('timeout '+method));},t);
    this.p.set(id,{res:r=>{clearTimeout(to);res(r);},rej:e=>{clearTimeout(to);rej(e);}});this.ws.send(JSON.stringify({id,method,params}));});}
  close(){try{this.ws.close();}catch{}} }
const ev = e => ({ expression: e, returnByValue: true, awaitPromise: false });

const M = String.raw`(function(){
  var out={};
  out.supportsSidewaysLr = CSS.supports('writing-mode','sideways-lr');
  out.supportsVerticalRl  = CSS.supports('writing-mode','vertical-rl');
  function info(p){
    var cs=getComputedStyle(p);
    var cell=p.closest('td'), table=p.closest('table');
    var r=p.getBoundingClientRect();
    var probe=document.createElement('span');
    probe.style.cssText='position:absolute;left:-9999px;white-space:nowrap;visibility:hidden;font:'+
      cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+'/'+cs.lineHeight+' '+cs.fontFamily;
    document.body.appendChild(probe);
    var widest=0, words=p.textContent.replace(/\s+/g,' ').trim().split(' ');
    for(var i=0;i<words.length;i++){probe.textContent=words[i];
      widest=Math.max(widest, probe.getBoundingClientRect().width);}
    probe.remove();
    var avail=p.clientWidth-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0);
    var lh=parseFloat(cs.lineHeight)||(parseFloat(cs.fontSize)*1.2);
    return {text:p.textContent.replace(/\s+/g,' ').trim(), region:(p.closest('.book-page')||{}).id,
      cellW:cell?Math.round(cell.getBoundingClientRect().width):null,
      tableW:table?Math.round(table.getBoundingClientRect().width):null,
      pW:Math.round(r.width), pH:Math.round(r.height), avail:Math.round(avail),
      widestWord:Math.round(widest), lines:Math.round(r.height/lh),
      writingMode:cs.writingMode, cls:p.className,
      wordOverflows: widest > avail + 0.5};
  }
  var kell=null;
  var ps=document.querySelectorAll('.book-page .content p');
  for(var i=0;i<ps.length;i++){
    var t=ps[i].textContent.replace(/\s+/g,' ').trim();
    if(t.indexOf('Tripplaar')>=0){ kell=info(ps[i]); break; }
  }
  out.kellogg=kell;
  var momo=null;
  for(var j=0;j<ps.length;j++){
    var t2=ps[j].textContent.replace(/\s+/g,' ').trim();
    if(t2.indexOf('MoMo Productions')>=0){ momo=info(ps[j]); break; }
  }
  out.momo=momo;
  // what a fixed keyword rule would flag (structure + geometry, no keyword-only)
  var RE=/(Getty Images|Alamy|Shutterstock|iStock|AP Images|Reuters|Bloomberg|Unsplash|Pexels|Zuma|Newscom|Science Source|The Image Bank|Corbis|Stock Photo|Photographer|AFP|Associated Press|PA Images|Anadolu|picture alliance|Elwood|Design Pics|Superstock|Universal Images Group|Nature Picture)/i;
  var cands=[];
  for(var k=0;k<ps.length;k++){
    var p2=ps[k], t3=p2.textContent.replace(/\s+/g,' ').trim();
    if(!t3 || t3.length>120 || !RE.test(t3)) continue;
    var cell2=p2.closest('td'); if(!cell2) continue;
    var table2=p2.closest('table'); if(!table2 || !table2.querySelector('img')) continue;
    var i2=info(p2);
    if(i2.wordOverflows && i2.lines>1) cands.push({region:i2.region,text:t3.slice(0,46),
      cellW:i2.cellW,widest:i2.widestWord,avail:i2.avail,lines:i2.lines,wm:i2.writingMode});
  }
  out.fixedRuleCandidates=cands;
  out.candidateCount=cands.length;
  // credits that are in a side cell but whose widest word fits (leave alone)
  var ok=0;
  for(var q=0;q<ps.length;q++){
    var t4=ps[q].textContent.replace(/\s+/g,' ').trim();
    if(!t4 || t4.length>120 || !RE.test(t4)) continue;
    var cell3=ps[q].closest('td'); if(!cell3) continue;
    var table3=ps[q].closest('table'); if(!table3 || !table3.querySelector('img')) continue;
    var i3=info(ps[q]); if(!(i3.wordOverflows && i3.lines>1)) ok++;
  }
  out.sideCreditsThatFit=ok;
  return out;})()`;

(async () => {
  let page; const R = { viewports: {}, exceptions: [], consoleErrors: [] };
  try {
    const nt = await (await fetch(ENDPOINT + '/json/new?about:blank', { method: 'PUT' })).json();
    page = new CDP(nt.webSocketDebuggerUrl); await page.connect();
    await page.send('Page.enable'); await page.send('Runtime.enable');
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
    for (const [w, h] of [[1400, 1000], [390, 844]]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 850 });
      await new Promise(r => setTimeout(r, 2000));
      const r = await page.send('Runtime.evaluate', ev(M), 300000);
      R.viewports[w + 'x' + h] = r.result ? r.result.value : null;
    }
  } catch (e) { R.error = String(e && e.message || e); }
  finally { try { if (page) page.close(); } catch {} writeFileSync(outJson, JSON.stringify(R, null, 1), 'utf8'); process.exit(0); }
})();
