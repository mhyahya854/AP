// Final release QA: interaction latency without artificial sleeps, end-of-book
// reachability in Continuous mode, and CDP heap metrics.
//
//   node reader/release_qa_perf2.mjs [port]
import { attach, evq, gate, outdir, save, jsErrors } from './qa_cdp.mjs';

const dir = outdir();
const cdp = await attach(process.argv[2] || '9356');
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
await cdp.send('Performance.enable');
await gate(cdp, 'perf 2');

async function metricsOf() {
  const m = await cdp.send('Performance.getMetrics');
  const map = {};
  m.metrics.forEach((x) => { map[x.name] = x.value; });
  return {
    jsHeapUsedMB: +(map.JSHeapUsedSize / 1048576).toFixed(1),
    jsHeapTotalMB: +(map.JSHeapTotalSize / 1048576).toFixed(1),
    nodes: map.Nodes,
    layoutCount: map.LayoutCount,
    recalcStyleCount: map.RecalcStyleCount,
  };
}

const before = await metricsOf();

const latency = await evq(cdp, `(async () => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const out = {};
  const timeIt = async (label, fn) => {
    const a = performance.now();
    fn();
    await frame();
    out[label] = Math.round((performance.now() - a) * 10) / 10;
  };
  const setMode = (m) => {
    const s = document.querySelector('#mode');
    s.value = m;
    s.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const input = document.querySelector('#search');
  await timeIt('search-input-to-frame', () => {
    input.value = 'business';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const link = document.querySelectorAll('#contents-nav a[href^="#"]')[420];
  await timeIt('contents-click-to-frame', () => { link.click(); });
  await timeIt('disclosure-open-to-frame', () => { document.querySelector('details.disclosure').open = true; });
  document.querySelector('details.disclosure').open = false;
  await timeIt('mode-to-section', () => { setMode('section'); });
  await timeIt('mode-to-source-capture', () => { setMode('single'); });
  await timeIt('mode-to-continuous', () => { setMode('continuous'); });
  await timeIt('sidebar-toggle', () => { document.querySelector('#right-toggle').click(); });
  document.querySelector('#right-toggle').click();
  const theme = document.querySelector('#theme');
  await timeIt('theme-switch', () => {
    theme.value = 'dark';
    theme.dispatchEvent(new Event('change', { bubbles: true }));
  });
  theme.value = 'light';
  theme.dispatchEvent(new Event('change', { bubbles: true }));
  return out;
})()`, 300000);

const endOfBook = await evq(cdp, `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const main = document.querySelector('main');
  const s = document.querySelector('#mode');
  s.value = 'continuous';
  s.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(900);
  const start = { scrollTop: Math.round(main.scrollTop), scrollHeight: main.scrollHeight, clientHeight: main.clientHeight };
  main.scrollTop = main.scrollHeight;
  await sleep(1500);
  const last = document.getElementById('TMP-1899');
  const r = last.getBoundingClientRect();
  return {
    start: start,
    after: { scrollTop: Math.round(main.scrollTop), scrollHeight: main.scrollHeight },
    lastRegionVisible: r.height > 0 && r.bottom > 0 && r.top < innerHeight,
    lastRegionRect: [Math.round(r.top), Math.round(r.bottom)],
    docScrolledToEnd: Math.round(main.scrollTop + main.clientHeight) >= main.scrollHeight - 4,
  };
})()`, 300000);

const after = await metricsOf();
save('performance_audit_2.json', { heapBefore: before, heapAfter: after, latencyMs: latency,
  endOfBook: endOfBook }, dir);
console.log('latency (ms, input -> 2 frames): ' + JSON.stringify(latency, null, 1));
console.log('end of book: ' + JSON.stringify(endOfBook, null, 1));
console.log('heap before: ' + JSON.stringify(before));
console.log('heap after:  ' + JSON.stringify(after));
console.log('js errors: ' + jsErrors(cdp).length);
process.exit(0);
