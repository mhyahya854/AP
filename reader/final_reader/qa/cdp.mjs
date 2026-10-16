// Minimal CDP client for the redesign QA run (no dependencies).
import { writeFileSync } from 'node:fs';

export class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.events = []; this.listeners = []; }
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
        } else {
          this.events.push(m);
          for (const fn of this.listeners) { try { fn(m); } catch {} }
        }
      };
    });
  }
  send(method, params = {}, timeoutMs = 300000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error('timeout ' + method)); }, timeoutMs);
      this.pending.set(id, { res: (r) => { clearTimeout(t); res(r); }, rej: (e) => { clearTimeout(t); rej(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(fn) { this.listeners.push(fn); }
  close() { try { this.ws.close(); } catch {} }
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function attach(port, urlFilter = null) {
  let list = [];
  for (let i = 0; i < 40; i++) {
    try { list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); } catch { list = []; }
    const pages = list.filter((t) => t.type === 'page');
    if (pages.length) {
      const target = urlFilter ? pages.find((t) => t.url.startsWith(urlFilter)) : pages[0];
      if (target) {
        const cdp = new CDP(target.webSocketDebuggerUrl);
        await cdp.connect();
        return cdp;
      }
    }
    await wait(500);
  }
  throw new Error('no page target on port ' + port);
}

export async function evaluate(cdp, expression, awaitPromise = true) {
  const r = await cdp.send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise, allowUnsafeEvalBlockedByCSP: true,
  });
  if (r.exceptionDetails) {
    throw new Error('evaluate threw: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}

export async function goto(cdp, url, settleMs = 1500) {
  await cdp.send('Page.enable');
  await cdp.send('Page.navigate', { url });
  for (let i = 0; i < 120; i++) {
    await wait(250);
    const ready = await evaluate(cdp, 'document.readyState').catch(() => null);
    if (ready === 'complete') break;
  }
  await wait(settleMs);
}

export async function viewport(cdp, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: 1, mobile: false });
  await wait(400);
}

export async function shot(cdp, file) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(file, Buffer.from(r.data, 'base64'));
  return file;
}

export function startConsoleCapture(cdp) {
  const problems = [];
  cdp.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') {
      problems.push({ kind: 'exception',
        text: m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text });
    } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      problems.push({ kind: 'log', text: m.params.entry.text });
    }
  });
  return problems;
}
