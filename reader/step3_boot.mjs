// Load the artifact once in the step-3 QA browser and report timings, using
// only cheap evaluations (never serialises the huge DOM).
//   node reader/step3_boot.mjs <fileUrl> [port] [budgetSeconds]
import { writeFileSync } from 'node:fs';

const fileUrl = process.argv[2];
const port = process.argv[3] || '9341';
const budget = Number(process.argv[4] || 900);
const ENDPOINT = `http://127.0.0.1:${port}`;

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); }
  connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => res();
      this.ws.onerror = () => rej(new Error('ws error'));
      this.ws.onmessage = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.id !== undefined) {
          const p = this.pending.get(m.id);
          if (p) { this.pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
        }
      };
    });
  }
  send(method, params = {}, timeoutMs = 900000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error('timeout ' + method)); }, timeoutMs);
      this.pending.set(id, { res: (r) => { clearTimeout(t); res(r); }, rej: (e) => { clearTimeout(t); rej(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

const list = await (await fetch(`${ENDPOINT}/json/list`)).json();
const page = list.filter((t) => t.type === 'page')[0];
const cdp = new CDP(page.webSocketDebuggerUrl);
await cdp.connect();
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');

const t0 = Date.now();
await cdp.send('Page.navigate', { url: fileUrl });
let last = '';
while ((Date.now() - t0) / 1000 < budget) {
  const r = await cdp.send('Runtime.evaluate', {
    expression: '({rs:document.readyState,t:document.title,n:document.querySelectorAll(".book-page").length,'
      + 'ui:!!window.book2ReaderPrefs,sem:!!window.book2Semantics})',
    returnByValue: true }, 120000);
  const v = r.result.value || {};
  const line = `${((Date.now() - t0) / 1000).toFixed(1)}s rs=${v.rs} regions=${v.n} ui=${v.ui} sem=${v.sem}`;
  if (line !== last) { console.log(line); last = line; }
  if (v.rs === 'complete' && v.ui && v.sem && v.n === 1899) break;
  await new Promise((r2) => setTimeout(r2, 2000));
}
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log('ready in', elapsed, 's');
const b = await cdp.send('Runtime.evaluate', { expression: `(() => {
  const t0 = performance.now();
  const info = {
    rows: document.querySelectorAll('#contents-nav .nav-child').length,
    headings: document.querySelectorAll('[id^="book-heading-"]').length,
    links: document.querySelectorAll('a[href^="#"]').length,
    h: document.querySelector('main > .toolbar').getBoundingClientRect().height,
    scrollMargin: getComputedStyle(document.getElementById('book-heading-0007')).scrollMarginTop,
  };
  info.probeMs = Math.round(performance.now() - t0);
  return info;
})()`, returnByValue: true }, 300000);
console.log(JSON.stringify(b.result.value));
writeFileSync('reports/contents_navigation/boot.json', JSON.stringify({ elapsed, info: b.result.value }, null, 1));
process.exit(0);
