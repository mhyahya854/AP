// Deep-link evidence: open a saved file:// URL with a #heading fragment in each
// stored reading mode and measure where the reader lands.
//   node reader/step3_deeplink.mjs <fileUrl> <outJson> [port]
// Each load uses a distinct query so the browser really re-loads the document.
import { writeFileSync } from 'node:fs';

const fileUrl = process.argv[2];
const out = process.argv[3];
const port = process.argv[4] || '9341';
const ENDPOINT = `http://127.0.0.1:${port}`;
const HASH = process.env.STEP3_DEEPLINK_HASH || '#book-heading-0200';

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
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = async (expression) => {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception || r.exceptionDetails));
  return r.result.value;
};

const MEASURE = `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const app = document.querySelector('.app');
  const main = document.querySelector('main');
  const bar = document.querySelector('main > .toolbar');
  const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  const pages = [...document.querySelectorAll('.book-page')];
  const vis = pages.filter((p) => { const b = p.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
  const cur = pages.find((p) => p.classList.contains('is-current'));
  let t = null;
  if (el) {
    const b = el.getBoundingClientRect();
    const reg = el.closest('.book-page');
    t = { tag: el.tagName, region: reg ? reg.id : null, gapBelowToolbar: Math.round(b.top - bar.getBoundingClientRect().bottom),
          visible: b.width > 0 && b.height > 0, belowToolbar: b.top >= bar.getBoundingClientRect().bottom - 2 };
  }
  const active = document.querySelector('#contents-nav .nav-child[aria-current], #contents-nav .nav-child.is-current');
  return { mode: app.getAttribute('data-mode'), effective: app.getAttribute('data-effective-mode'),
           hash: location.hash, counter: norm((document.querySelector('#counter') || {}).textContent),
           scrollTop: Math.round(main.scrollTop), target: t,
           visibleRegions: vis.length, visibleIds: vis.length <= 3 ? vis.map((p) => p.id) : [vis[0].id, '..', vis[vis.length - 1].id],
           currentRegion: cur ? cur.id : null,
           active: active ? { href: active.getAttribute('href'), title: norm(active.textContent).slice(0, 60) } : null,
           storedMode: (JSON.parse(localStorage.getItem('book2.reader.v1') || '{}').mode) || null };
})()`;

const report = { schema: 'book2.step3.deeplink.v1', fileUrl, hash: HASH, loads: [] };
for (const mode of ['continuous', 'section', 'single']) {
  await evalJs(`(() => { const p = JSON.parse(localStorage.getItem('book2.reader.v1') || '{}');
    p.mode = ${JSON.stringify(mode)}; localStorage.setItem('book2.reader.v1', JSON.stringify(p)); })()`);
  const url = `${fileUrl}?step3=deeplink-${mode}${HASH}`;
  await cdp.send('Page.navigate', { url });
  const t0 = Date.now();
  let st = null;
  while (Date.now() - t0 < 300000) {
    try {
      st = await evalJs('({rs:document.readyState,href:location.href,regions:document.querySelectorAll(".book-page").length,sem:!!window.book2Semantics})');
      if (st && st.rs === 'complete' && st.regions === 1899 && st.sem && st.href === url) { break; }
    } catch (e) { /* loading */ }
    await sleep(500);
  }
  await sleep(1500);
  report.loads.push({ storedMode: mode, url, ready: !!(st && st.rs === 'complete'), measured: await evalJs(MEASURE) });
}
writeFileSync(out, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.loads.map((l) => ({ stored: l.storedMode, mode: l.measured.mode,
  eff: l.measured.effective, region: l.measured.target && l.measured.target.region,
  gap: l.measured.target && l.measured.target.gapBelowToolbar,
  visible: l.measured.target && l.measured.target.visible, counter: l.measured.counter,
  active: l.measured.active && l.measured.active.href })), null, 1));
process.exit(0);
