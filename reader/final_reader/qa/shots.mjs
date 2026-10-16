// Capture a scripted set of reader screenshots.
//   node shots.mjs <file-url> <outdir> <spec-json-file>
// spec: [{ name, width, height, hash?, theme?, panel?, drawer?, scroll?, clip? }]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { attach, evaluate, goto, startConsoleCapture, viewport, wait } from './cdp.mjs';

const url = process.argv[2];
const outdir = process.argv[3];
const specs = JSON.parse(readFileSync(process.argv[4], 'utf8'));
mkdirSync(outdir, { recursive: true });

const cdp = await attach('9361');
await cdp.send('Runtime.enable');
const problems = startConsoleCapture(cdp);

let loaded = false;
const results = [];
for (const s of specs) {
  await viewport(cdp, s.width, s.height);
  if (!loaded) { await goto(cdp, url, 4000); loaded = true; }
  else { await wait(400); }
  if (s.theme) {
    await evaluate(cdp, `window.book2ReaderUI ? window.book2ReaderUI.setTheme(${JSON.stringify(s.theme)})
      : (document.getElementById('theme-' + ${JSON.stringify(s.theme)}) || {click(){}}).click()`);
    await wait(2200);
  }
  if (typeof s.panel === 'boolean') {
    await evaluate(cdp, `(() => { const b = document.getElementById(${s.panel ? "'rail-open'" : "'panel-close'"});
        if (b) b.click(); })()`);
    await wait(1200);
  }
  if (s.hash) {
    await evaluate(cdp, `window.book2ReaderUI.go(${JSON.stringify(s.hash)})`);
    await wait(1800);
  }
  if (typeof s.scroll === 'number') {
    await evaluate(cdp, `(() => { const m = document.querySelector('main');
      m.scrollTop = Math.round((m.scrollHeight - m.clientHeight) * ${s.scroll}); })()`);
    await wait(1400);
  }
  let clip = null;
  if (s.clip) {
    clip = await evaluate(cdp, `(() => { const el = document.querySelector(${JSON.stringify(s.clip)});
      if (!el) return null; el.scrollIntoView({ block: 'start' });
      const b = el.getBoundingClientRect();
      return { x: Math.max(0, b.left), y: Math.max(0, b.top), width: b.width, height: b.height }; })()`);
    await wait(700);
  }
  const opts = { format: 'png', captureBeyondViewport: !!clip };
  if (clip) { opts.clip = { ...clip, scale: 1 }; }
  const shot = await cdp.send('Page.captureScreenshot', opts);
  writeFileSync(join(outdir, s.name + '.png'), Buffer.from(shot.data, 'base64'));
  const info = await evaluate(cdp, `(() => ({
    hash: location.hash, theme: document.documentElement.getAttribute('data-theme'),
    panel: document.getElementById('b2-app').className,
    locator: document.getElementById('locator') ? document.getElementById('locator').textContent : null,
    progress: document.getElementById('progress') ? document.getElementById('progress').getAttribute('aria-valuenow') : null,
    hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }))()`);
  results.push({ ...s, ...info });
  console.log(s.name, JSON.stringify(info));
}
writeFileSync(join(outdir, 'shots.json'), JSON.stringify({ results, problems }, null, 1));
cdp.close();
