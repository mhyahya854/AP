// Capture element clips from the fixture at a given viewport.
//   node region_shot.mjs <file-url> <outdir> <width> <name=selector,...>
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { attach, evaluate, goto, viewport, wait } from './cdp.mjs';
import { writeFileSync } from 'node:fs';

const url = process.argv[2];
const outdir = process.argv[3];
const width = Number(process.argv[4] || 1400);
const specs = (process.argv[5] || '').split(',').filter(Boolean);
mkdirSync(outdir, { recursive: true });

const cdp = await attach('9361');
await cdp.send('Runtime.enable');
await viewport(cdp, width, 1000);
await goto(cdp, url, 2500);

const out = [];
for (const spec of specs) {
  const eq = spec.indexOf('=');
  const name = spec.slice(0, eq);
  const selector = spec.slice(eq + 1);
  const r = await evaluate(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    el.scrollIntoView({ block: 'start' });
    const b = el.getBoundingClientRect();
    return { x: b.left, y: b.top, width: b.width, height: b.height, h: el.offsetHeight };
  })()`);
  if (!r) { console.log(name + ' -> not found'); continue; }
  await wait(500);
  const b = await evaluate(cdp, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const x = el.getBoundingClientRect();
    return { x: x.left, y: x.top, width: x.width, height: x.height };
  })()`);
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true, fromSurface: true,
    clip: { x: Math.max(0, b.x), y: Math.max(0, b.y), width: b.width, height: b.height, scale: 1 },
  });
  const file = join(outdir, name + '.png');
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  out.push({ name, selector, width: Math.round(b.width), height: Math.round(b.height), file });
  console.log(name, Math.round(b.width) + 'x' + Math.round(b.height), '->', file);
}
console.log(JSON.stringify(out));
cdp.close();
