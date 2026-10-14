// Toolbar geometry only: navigate to a reader build, then record the toolbar
// rectangle at the widths/panel combinations of the report.  Works on both the
// accepted build and the step-2 build (it never needs the Appearance control).
//
//   node geom_probe.mjs <fileUrl> [port]
import { writeFileSync } from 'node:fs';

const fileUrl = process.argv[2];
const port = process.argv[3] || '9342';
const ENDPOINT = `http://127.0.0.1:${port}`;
const list = await (await fetch(`${ENDPOINT}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const send = (method, params = {}) => new Promise((res, rej) => {
  const myId = ++id;
  const t = setTimeout(() => rej(new Error('timeout ' + method)), 600000);
  const onMsg = (ev) => { const m = JSON.parse(ev.data); if (m.id === myId) { ws.removeEventListener('message', onMsg); clearTimeout(t); res(m); } };
  ws.addEventListener('message', onMsg);
  ws.send(JSON.stringify({ id: myId, method, params }));
});
await send('Runtime.enable');
await send('Page.enable');
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const viewport = async (w, h) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await sleep(500); };

await viewport(1920, 1080);
await send('Page.navigate', { url: fileUrl });
for (;;) {
  const ok = await evalJs('document.readyState === "complete" && !!document.querySelector(".toolbar") && document.querySelectorAll(".book-page").length > 0');
  if (ok) break;
  await sleep(800);
}

const GEOM = `(() => {
  const q = (s) => document.querySelector(s);
  const r = (el) => { const b = el.getBoundingClientRect();
    return { left: Math.round(b.left), right: Math.round(b.right), width: Math.round(b.width), height: Math.round(b.height) }; };
  const main = q('main'), tb = q('.toolbar');
  const cs = getComputedStyle(main), mb = main.getBoundingClientRect();
  const box = { left: Math.round(mb.left + (parseFloat(cs.paddingLeft) || 0)), right: Math.round(mb.right - (parseFloat(cs.paddingRight) || 0)) };
  const t = r(tb);
  const kids = [...tb.children].filter((el) => el.getBoundingClientRect().height > 0);
  const rows = [...new Set(kids.map((el) => { const b = el.getBoundingClientRect(); return Math.round((b.top + b.height / 2) / 8); }))].length;
  return { toolbar: t, column: box, columnWidth: box.right - box.left, rows,
    gapLeft: t.left - box.left, gapRight: box.right - t.right,
    fillsColumn: (t.right - t.left) >= (box.right - box.left) - 2,
    searchWidth: Math.round(q('#search').getBoundingClientRect().width),
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    leftOpen: !q('.app').classList.contains('left-closed'), rightOpen: !q('.app').classList.contains('right-closed') };
})()`;
const setPanels = async (l, open) => {
  await evalJs(`(() => { const app = document.querySelector('.app');
    const k = ${JSON.stringify(l)} === 'left' ? 'left-closed' : 'right-closed';
    if ((!app.classList.contains(k)) !== ${open}) { document.querySelector(${JSON.stringify(l)} === 'left' ? '#left-toggle' : '#right-toggle').click(); }
    return app.className; })()`);
  await sleep(450);
};

const out = { fileUrl, cases: [] };
for (const [w, h] of [[1920, 1080], [1400, 1000], [1024, 768], [390, 844], [320, 700]]) {
  await viewport(w, h);
  for (const [name, l, r] of [['both-open', true, true], ['both-closed', false, false],
                              ['left-only', true, false], ['right-only', false, true]]) {
    await setPanels('left', l);
    await setPanels('right', r);
    out.cases.push(Object.assign({ view: `${w}x${h}`, panels: name }, await evalJs(GEOM)));
  }
}
writeFileSync(process.argv[4] || '_master_work/step2/geom.json', JSON.stringify(out, null, 1));
for (const c of out.cases) {
  console.log([c.view.padEnd(9), c.panels.padEnd(12), 'w=' + String(c.toolbar.width).padEnd(5), 'col=' + String(c.columnWidth).padEnd(5),
    'rows=' + c.rows, 'gapL=' + String(c.gapLeft).padEnd(5), 'gapR=' + String(c.gapRight).padEnd(4),
    'fills=' + c.fillsColumn, 'search=' + c.searchWidth, 'ovf=' + c.docOverflow].join(' '));
}
process.exit(0);
