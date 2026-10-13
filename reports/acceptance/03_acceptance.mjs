// Book 2 acceptance harness.
//  A) the two suspicious controls: closed/open visibility, 5 viewports, font+spacing variants
//  C) every disclosure control: structure, closed-hides, open-reveals, overflow, label
//  D) reader modes, controls, search, navigation, drawers
// node 03_acceptance.mjs <fileUrl> <outJson> <shotDir>
import { writeFileSync, mkdirSync } from 'node:fs';
const url = process.argv[2], outJson = process.argv[3], shotDir = process.argv[4] || '';
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

// C) every control
const ALL = String.raw`(function(){
  var out=[], all=[].slice.call(document.querySelectorAll('details.disclosure'));
  var bodyText=document.body.textContent.replace(/\s+/g,' ');
  for(var i=0;i<all.length;i++){
    var d=all[i], s=d.querySelector('summary'), p=d.querySelector('.desc-panel');
    var reg=d.closest('.book-page');
    var lab=d.querySelector('.b2-desc-label');
    var rec={idx:i, region:reg?reg.id:null, label:lab?lab.textContent.replace(/\s+/g,' ').trim():null,
      hasSummary:!!s, hasPanel:!!p,
      panelIsDirectChild: p? (p.parentElement===d):null,
      summaryIsDirectChild: s? (s.parentElement===d):null,
      nestedDetails: d.querySelectorAll('details').length,
      panelChars: p? p.textContent.replace(/\s+/g,' ').trim().length : 0,
      focusableCount: p? p.querySelectorAll('a,button,input,select,textarea,[tabindex]').length : -1};
    d.open=false;
    rec.closedDetailsH=Math.round(d.getBoundingClientRect().height);
    rec.closedSummaryH=Math.round(s.getBoundingClientRect().height);
    d.open=true;
    rec.openDetailsH=Math.round(d.getBoundingClientRect().height);
    rec.openPanelH=Math.round(p.getBoundingClientRect().height);
    rec.panelW=Math.round(p.getBoundingClientRect().width);
    rec.panelOverflow=p?(p.scrollWidth-p.clientWidth):null;
    d.open=false;
    rec.hidesWhenClosed = rec.closedDetailsH <= rec.closedSummaryH + 6;
    rec.revealsWhenOpen = rec.openDetailsH > rec.closedDetailsH + 6;
    var slice=(p?p.textContent.replace(/\s+/g,' ').trim():'').slice(0,60);
    if(slice.length>40){ var first=bodyText.indexOf(slice); var second=bodyText.indexOf(slice, first+1);
      rec.duplicateSlice= second>=0; } else rec.duplicateSlice=false;
    out.push(rec);
  }
  return out;})()`;

// A) the two controls, rich
const TWO = String.raw`(function(){
  var res=[];
  ['TMP-0125','TMP-0516'].forEach(function(rid){
    var reg=document.getElementById(rid); if(!reg){res.push({region:rid,error:'missing'});return;}
    var d=reg.querySelector('details.disclosure'); if(!d){res.push({region:rid,error:'no control'});return;}
    var s=d.querySelector('summary'), p=d.querySelector('.desc-panel');
    var rec={region:rid, label:s?s.textContent.replace(/\s+/g,' ').trim():null,
      panelIsDirectChild:(p&&p.parentElement===d), summaryIsDirectChild:(s&&s.parentElement===d),
      nestedDetails:d.querySelectorAll('details').length};
    d.open=false;
    rec.closed={detailsH:Math.round(d.getBoundingClientRect().height), summaryH:Math.round(s.getBoundingClientRect().height),
      panelH:p?Math.round(p.getBoundingClientRect().height):null, panelW:p?Math.round(p.getBoundingClientRect().width):null,
      open:d.open};
    d.open=true;
    rec.open={detailsH:Math.round(d.getBoundingClientRect().height), summaryH:Math.round(s.getBoundingClientRect().height),
      panelH:p?Math.round(p.getBoundingClientRect().height):null, panelW:p?Math.round(p.getBoundingClientRect().width):null,
      panelOverflow:p?(p.scrollWidth-p.clientWidth):null, open:d.open};
    rec.hiddenWhenClosed = rec.closed.detailsH <= rec.closed.summaryH + 6;
    rec.revealedWhenOpen = rec.open.detailsH > rec.closed.detailsH + 6;
    rec.growth = rec.open.detailsH - rec.closed.detailsH;
    // focus reachability inside the panel (nothing focusable expected)
    rec.focusablesInside = p? p.querySelectorAll('a,button,input,select,textarea,[tabindex]').length : -1;
    // mouse
    s.focus(); rec.summaryFocusable=(document.activeElement===s);
    d.open=false; s.click(); rec.clickOpens=d.open; s.click(); rec.clickCloses=!d.open;
    // keyboard
    s.focus(); var before=d.open;
    s.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));
    if(d.open===before){ s.click(); }
    rec.keyboardToggles=(before!==d.open);
    d.open=false;
    res.push(rec);
  });
  return res;})()`;

const MODES = String.raw`(function(){
  var app=document.querySelector('.app'), out={};
  var sel=document.querySelector('#mode');
  out.modeOptions=sel?[].map.call(sel.options,function(o){return o.value;}):null;
  function set(m){ if(sel){sel.value=m; sel.dispatchEvent(new Event('change',{bubbles:true}));} }
  set('continuous');
  out.continuous={counter:(document.querySelector('#counter')||{}).textContent,
    sheetBg:getComputedStyle(document.querySelector('main')).backgroundColor,
    pageShadow:getComputedStyle(document.querySelector('.book-page')).boxShadow,
    pageMargin:getComputedStyle(document.querySelector('.book-page')).marginTop,
    pages:document.querySelectorAll('.book-page').length,
    hidden:document.querySelectorAll('.book-page[style*="display: none"]').length};
  set('section');
  out.section={counter:(document.querySelector('#counter')||{}).textContent,
    sections:(window.book2Semantics?window.book2Semantics.sections():null),
    hidden:document.querySelectorAll('.book-page[style*="display: none"]').length};
  set('single');
  out.capture={counter:(document.querySelector('#counter')||{}).textContent,
    note:(document.querySelector('#mode-note')||{}).textContent};
  set('continuous');
  out.restored={counter:(document.querySelector('#counter')||{}).textContent,
    hidden:document.querySelectorAll('.book-page[style*="display: none"]').length};
  // typography + zoom + spacing
  var size=document.querySelector('#zoom'), font=document.querySelector('#font'), sp=document.querySelector('#spacing');
  if(size){size.value='130';size.dispatchEvent(new Event('input',{bubbles:true}));}
  out.sizeVal=(document.querySelector('#size-val')||{}).textContent;
  out.textscale=getComputedStyle(document.documentElement).getPropertyValue('--b2-text').trim();
  if(font){font.value='georgia';font.dispatchEvent(new Event('change',{bubbles:true}));}
  out.fontAttr=app.getAttribute('data-font');
  if(sp){sp.value='relaxed';sp.dispatchEvent(new Event('change',{bubbles:true}));}
  out.leading=getComputedStyle(document.documentElement).getPropertyValue('--reader-leading').trim();
  var zi=document.querySelector('#zoom-in'); if(zi){zi.click();zi.click();}
  out.zoomVal=(document.querySelector('#zoom-val')||{}).textContent;
  var zr=document.querySelector('#zoom-reset'); if(zr) zr.click();
  var fr=document.querySelector('#font-reset'); if(fr) fr.click();
  var vr=document.querySelector('#view-reset'); if(vr) vr.click();
  out.afterReset={sizeVal:(document.querySelector('#size-val')||{}).textContent,
    fontAttr:app.getAttribute('data-font'), zoomVal:(document.querySelector('#zoom-val')||{}).textContent};
  // search
  var srch=document.querySelector('#search');
  if(srch){ srch.value='Walmart'; srch.dispatchEvent(new Event('input',{bubbles:true})); }
  return out;})()`;

const SEARCH_STATUS = String.raw`(function(){var st=document.querySelector('.toolbar span[role="status"]');
  return {status:st?st.textContent.trim():null, hits:document.querySelectorAll('.search-hit').length};})()`;

const NAV = String.raw`(function(){
  var out={};
  var link=document.querySelector('#contents-nav a[href^="#"]');
  var l2=document.querySelector('a[href="#book-heading-0010"]');
  if(l2){ l2.click(); out.hash=location.hash;
    out.activeId=document.activeElement?(document.activeElement.id||document.activeElement.tagName):null;
    var t=document.getElementById('book-heading-0010');
    out.targetTop=t?Math.round(t.getBoundingClientRect().top):null;
    var tb=document.querySelector('.toolbar'); out.toolbarBottom=tb?Math.round(tb.getBoundingClientRect().bottom):null;
    out.landedBelowToolbar=(out.targetTop!==null&&out.toolbarBottom!==null)?out.targetTop>=out.toolbarBottom:null;
    out.ariaCurrent=document.querySelectorAll('[aria-current="true"]').length; }
  out.navLinks=document.querySelectorAll('#contents-nav a[href^="#"]').length;
  out.navRows=document.querySelectorAll('#contents-nav .nav-child, #contents-nav .nav-unlinked').length;
  var ids={}, dup=0;
  var els=document.querySelectorAll('[id]');
  for(var i=0;i<els.length;i++){ if(ids[els[i].id]) dup++; ids[els[i].id]=1; }
  out.duplicateIds=dup;
  var broken=[], links=document.querySelectorAll('nav a[href^="#"]');
  for(var k=0;k<links.length;k++){ var id=decodeURIComponent(links[k].getAttribute('href').slice(1));
    if(!document.getElementById(id)) broken.push(id); }
  out.brokenHashLinks=broken.length; out.brokenSamples=broken.slice(0,5);
  out.qaFailures=(typeof window.book2QA==='function')?window.book2QA().length:-1;
  out.docOverflow=document.documentElement.scrollWidth-document.documentElement.clientWidth;
  var main=document.querySelector('main');
  out.mainOverflow=main?main.scrollWidth-main.clientWidth:null;
  return out;})()`;

(async () => {
  let page; const R = { exceptions: [], consoleErrors: [], logErrors: [] };
  try {
    const nt = await (await fetch(ENDPOINT + '/json/new?about:blank', { method: 'PUT' })).json();
    page = new CDP(nt.webSocketDebuggerUrl); await page.connect();
    page.on(m => {
      if (m.method === 'Runtime.exceptionThrown') R.exceptions.push(((m.params.exceptionDetails || {}).text || '').slice(0, 200));
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') R.consoleErrors.push((m.params.args || []).map(a => a.value || '').join(' ').slice(0, 200));
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') R.logErrors.push(String(m.params.entry.text).slice(0, 200));
    });
    await page.send('Page.enable'); await page.send('Runtime.enable'); await page.send('Log.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url }, 240000);
    const waitReady = async () => { const dl = Date.now() + 600000;
      while (Date.now() < dl) { try { const r = await page.send('Runtime.evaluate',
        ev('document.readyState + "|" + document.querySelectorAll(".book-page").length'), 60000);
        if (/^complete\|1899/.test(String(r.result && r.result.value))) return true; } catch {}
        await new Promise(r => setTimeout(r, 3000)); } return false; };
    R.loaded = await waitReady();
    await page.send('Runtime.evaluate', ev('(function(){try{localStorage.clear();}catch(e){}return 1;})()'), 60000);
    await page.send('Page.reload', {}, 240000);
    R.loaded = await waitReady();
    await new Promise(r => setTimeout(r, 4000));
    const run = async (name, expr, t) => { try { const r = await page.send('Runtime.evaluate', ev(expr), t || 300000);
      R[name] = r.result ? r.result.value : null; } catch (e) { R[name + '_error'] = String(e.message); } };

    await run('modes', MODES);
    await new Promise(r => setTimeout(r, 8000));
    await run('search', SEARCH_STATUS, 60000);
    await run('navigation', NAV, 180000);
    await run('controls_ALL', ALL, 600000);
    await run('twoControls_1400', TWO, 180000);

    // A/C at narrow widths, plus font/spacing stress
    for (const [w, h] of [[768, 1024], [390, 844], [375, 812], [320, 700]]) {
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w <= 850 });
      await new Promise(r => setTimeout(r, 2500));
      await run('twoControls_' + w, TWO, 180000);
    }
    // 390 with 130% text and relaxed spacing
    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await page.send('Runtime.evaluate', ev(String.raw`(function(){
      var s=document.querySelector('#zoom'); if(s){s.value='130';s.dispatchEvent(new Event('input',{bubbles:true}));}
      var p=document.querySelector('#spacing'); if(p){p.value='relaxed';p.dispatchEvent(new Event('change',{bubbles:true}));}
      return 1;})()`), 60000);
    await new Promise(r => setTimeout(r, 2000));
    await run('twoControls_390_tight', TWO, 180000);
    await page.send('Runtime.evaluate', ev(String.raw`(function(){
      var s=document.querySelector('#zoom'); if(s){s.value='100';s.dispatchEvent(new Event('input',{bubbles:true}));}
      var p=document.querySelector('#spacing'); if(p){p.value='normal';p.dispatchEvent(new Event('change',{bubbles:true}));}
      var f=document.querySelector('#font'); if(f){f.value='original';f.dispatchEvent(new Event('change',{bubbles:true}));}
      return 1;})()`), 60000);

    if (shotDir) {
      mkdirSync(shotDir, { recursive: true });
      const shots = [['TMP-0001','d1-cover'],['TMP-0112','d2-momo-credit'],['TMP-0125','d3-kellogg'],
                     ['TMP-0516','d4-cooper'],['TMP-1074','d5-ocr-region']];
      await page.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
      await new Promise(r => setTimeout(r, 2000));
      for (const [rid, name] of shots) {
        await page.send('Runtime.evaluate', ev(`(function(){var app=document.querySelector('.app');
          app.classList.remove('left-closed'); app.classList.add('right-closed');
          var r=document.getElementById('${rid}'); if(r) r.scrollIntoView({block:'start'});
          var m=document.querySelector('main'), b=document.querySelector('.toolbar');
          if(m&&b) m.scrollTop=Math.max(0,m.scrollTop-b.getBoundingClientRect().height-8); return 1;})()`), 120000);
        await new Promise(r => setTimeout(r, 2200));
        const im = await page.send('Page.captureScreenshot', { format: 'png' }, 120000);
        writeFileSync(shotDir + '\\' + name + '.png', Buffer.from(im.data, 'base64'));
        (R.screenshots = R.screenshots || []).push(name + '.png');
      }
    }
  } catch (e) { R.error = String(e && e.message || e); }
  finally { try { if (page) page.close(); } catch {} writeFileSync(outJson, JSON.stringify(R, null, 1), 'utf8'); process.exit(0); }
})();
