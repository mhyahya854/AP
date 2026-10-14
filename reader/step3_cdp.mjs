// Tiny CDP CLI for one-off inspection of the step-3 QA browser.
//   node reader/step3_cdp.mjs <port> state
//   node reader/step3_cdp.mjs <port> eval "<expression>"
//   node reader/step3_cdp.mjs <port> goto "<url>"
import { writeFileSync } from 'node:fs';

const port = process.argv[2] || '9341';
const cmd = process.argv[3] || 'state';
const arg = process.argv[4];
const ENDPOINT = `http://127.0.0.1:${port}`;

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.events = []; }
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
        } else { this.events.push(m); }
      };
    });
  }
  send(method, params = {}, timeoutMs = 600000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error('timeout ' + method)); }, timeoutMs);
      this.pending.set(id, { res: (r) => { clearTimeout(t); res(r); }, rej: (e) => { clearTimeout(t); rej(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

const list = await (await fetch(`${ENDPOINT}/json/list`)).json();
const targets = list.filter((t) => t.type === 'page');
if (cmd === 'list') { console.log(JSON.stringify(list.map((t) => ({ id: t.id, type: t.type, url: t.url, title: t.title })), null, 1)); process.exit(0); }
const page = targets[0];
const cdp = new CDP(page.webSocketDebuggerUrl);
await cdp.connect();
await cdp.send('Runtime.enable');
await cdp.send('Page.enable');
await cdp.send('Log.enable');

if (cmd === 'goto') {
  await cdp.send('Page.navigate', { url: arg });
  console.log('navigating to', arg);
  await new Promise((r) => setTimeout(r, 3000));
  const s = await cdp.send('Runtime.evaluate', { expression: '({url:location.href,rs:document.readyState,title:document.title,bodyKids:document.body.children.length})', returnByValue: true });
  console.log(JSON.stringify(s.result.value));
  process.exit(0);
}
if (cmd === 'watch') {
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: arg });
  await new Promise((r) => setTimeout(r, 20000));
  const errs = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown'
    || (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
    || (e.method === 'Log.entryAdded' && ['error', 'warning'].includes(e.params.entry.level)))
    .map((e) => (e.method === 'Runtime.exceptionThrown'
      ? ((e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description)
         || e.params.exceptionDetails.text)
      : JSON.stringify(e.params).slice(0, 400)));
  const st = await cdp.send('Runtime.evaluate', {
    expression: '({rs:document.readyState,ui:!!window.book2ReaderPrefs,sem:!!window.book2Semantics,'
      + 'nav:!!window.book2Navigation,rows:document.querySelectorAll("#contents-nav .nav-child").length,'
      + 'scrollPad:getComputedStyle(document.querySelector("main")).scrollPaddingTop,'
      + 'off:getComputedStyle(document.documentElement).getPropertyValue("--b2-nav-offset")})',
    returnByValue: true });
  console.log(JSON.stringify({ state: st.result.value, errors: errs.slice(0, 12) }, null, 1));
  process.exit(0);
}
if (cmd === 'eval') {
  const r = await cdp.send('Runtime.evaluate', { expression: arg, returnByValue: true, awaitPromise: true }, 600000);
  console.log(JSON.stringify(r.exceptionDetails ? r.exceptionDetails : r.result.value, null, 1));
  process.exit(0);
}
const st = await cdp.send('Runtime.evaluate', {
  expression: '({url:location.href,rs:document.readyState,title:document.title,'
    + 'regions:document.querySelectorAll(".book-page").length,'
    + 'navRows:document.querySelectorAll("#contents-nav .nav-child").length,'
    + 'ui:!!window.book2ReaderPrefs,sem:!!window.book2Semantics,'
    + 'bodyKids:document.body.children.length})', returnByValue: true });
console.log(JSON.stringify(st.result.value, null, 1));
process.exit(0);
