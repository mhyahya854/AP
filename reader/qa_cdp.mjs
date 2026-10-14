// Shared CDP plumbing for the final release QA probes.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

export const EXPECT_REGIONS = 1899;

export class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.events = []; }
  connect() {
    return new Promise((ok, bad) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => ok();
      this.ws.onerror = () => bad(new Error('cdp websocket failed'));
      this.ws.onmessage = (evt) => {
        let m; try { m = JSON.parse(evt.data); } catch { return; }
        if (m.id !== undefined) {
          const p = this.pending.get(m.id);
          if (p) { this.pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
        } else { this.events.push(m); }
      };
    });
  }
  send(method, params = {}, timeoutMs = 1200000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error('timeout ' + method)); }, timeoutMs);
      this.pending.set(id, { res: (r) => { clearTimeout(t); res(r); }, rej: (e) => { clearTimeout(t); rej(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function attach(port) {
  const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  const target = list.filter((t) => t.type === 'page')[0];
  if (!target) throw new Error('no page target on port ' + port);
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  return cdp;
}

export async function evq(cdp, expression, timeout) {
  const r = await cdp.send('Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true }, timeout || 1200000);
  if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
  return r.result.value;
}

export async function gate(cdp, label) {
  for (let i = 0; i < 240; i++) {
    const st = await evq(cdp, "({rs:document.readyState,regions:document.querySelectorAll('.book-page').length,nav:!!window.book2Navigation})");
    if (st.rs === 'complete' && st.regions === EXPECT_REGIONS && st.nav) return st;
    await wait(2000);
  }
  throw new Error((label || 'artifact') + ': never ready');
}

export function outdir() {
  const dir = resolve(process.cwd(), 'reports/final_release_qa');
  mkdirSync(join(dir, 'screens'), { recursive: true });
  return dir;
}

export function save(name, data, dir) {
  const path = join(dir || outdir(), name);
  writeFileSync(path, JSON.stringify(data, null, 1));
  console.log('   wrote ' + name + ' (' + JSON.stringify(data).length + ' bytes)');
  return path;
}

export function jsErrors(cdp) {
  return cdp.events
    .filter((e) => e.method === 'Runtime.exceptionThrown'
      || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'))
    .map((e) => (e.method === 'Runtime.exceptionThrown'
      ? (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description
        || e.params.exceptionDetails.text)
      : JSON.stringify(e.params).slice(0, 200)));
}
