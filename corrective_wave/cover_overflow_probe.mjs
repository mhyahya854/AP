// Does the cover region escape its section when the contents rail is open?
// Usage: node cover_overflow_probe.mjs <fileUrl> <outJson>
import { writeFileSync } from 'node:fs';
const fileUrl = process.argv[2];
const outJson = process.argv[3];
const ENDPOINT = process.env.BOOK2_CDP || 'http://127.0.0.1:9334';
const t0 = Date.now();
const result = { fileUrl, steps: [], error: null };
function finish(code) {
  result.elapsedMs = Date.now() - t0;
  writeFileSync(outJson, JSON.stringify(result, null, 2), 'utf8');
  process.exit(code);
}
class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.handlers = []; }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => res();
      this.ws.onerror = (e) => rej(new Error('ws ' + (e && e.message)));
      this.ws.onmessage = (m) => {
        let msg; try { msg = JSON.parse(m.data); } catch { return; }
        if (msg.id !== undefined) {
          const p = this.pending.get(msg.id);
          if (p) { this.pending.delete(msg.id); msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result); }
        } else for (const h of this.handlers) h(msg);
      };
    });
  }
  send(method, params = {}, t = 300000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { this.pending.delete(id); rej(new Error('timeout ' + method)); }, t);
      this.pending.set(id, { res: r => { clearTimeout(timer); res(r); }, rej: e => { clearTimeout(timer); rej(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(fn) { this.handlers.push(fn); return this; }
  close() { try { this.ws.close(); } catch {} }
}
const ev = e => ({ expression: e, returnByValue: true });
const PROBE = String.raw`(function(){
  var app = document.querySelector('.app');
  var main = document.querySelector('main');
  var p = document.getElementById('TMP-0001');
  var r = p.getBoundingClientRect();
  var fails = [];
  try { fails = window.book2QA(); } catch (e) { return { qaError: String(e) }; }
  var row = fails.filter(function (f) { return f.id === 'TMP-0001'; });
  var t = p.querySelector('table');
  var tr = t ? t.getBoundingClientRect() : null;
  return {
    appClasses: app.className,
    mainWidth: main.clientWidth,
    pageLeft: Math.round(r.left), pageRight: Math.round(r.right),
    pageWidth: Math.round(r.width), pageScrollWidth: p.scrollWidth, pageClientWidth: p.clientWidth,
    tableLeft: tr ? Math.round(tr.left) : null, tableRight: tr ? Math.round(tr.right) : null,
    tableWidth: tr ? Math.round(tr.width) : null,
    tableScrollWidth: t ? t.scrollWidth : null,
    escapes: row.map(function (f) { return f.kind + ':' + f.tag; }),
    totalFailures: fails.length,
    failureIds: fails.slice(0, 6).map(function (f) { return (f.id || '-') + ':' + f.kind; }),
  };
})()`;
(async () => {
  let page;
  try {
    const nt = await (await fetch(ENDPOINT + '/json/new?about:blank', { method: 'PUT' })).json();
    page = new CDP(nt.webSocketDebuggerUrl);
    await page.connect();
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.send('Page.navigate', { url: fileUrl }, 180000);
    const deadline = Date.now() + 600000;
    while (Date.now() < deadline) {
      try {
        const r = await page.send('Runtime.evaluate', ev('document.readyState + "|" + document.querySelectorAll(".book-page").length'), 60000);
        if (/^complete\|1899$/.test(String(r.result && r.result.value))) break;
      } catch {}
      await new Promise(r => setTimeout(r, 3000));
    }
    await new Promise(r => setTimeout(r, 2500));
    const before = await page.send('Runtime.evaluate', ev(PROBE), 240000);
    result.steps.push({ name: 'closed', value: before.result.value });
    await page.send('Runtime.evaluate', ev('document.querySelector("#left-toggle").click()'), 60000);
    await new Promise(r => setTimeout(r, 2500));
    const after = await page.send('Runtime.evaluate', ev(PROBE), 240000);
    result.steps.push({ name: 'open', value: after.result.value });
  } catch (e) { result.error = String(e && e.message || e); }
  finally { try { if (page) page.close(); } catch {} finish(result.error ? 1 : 0); }
})();
