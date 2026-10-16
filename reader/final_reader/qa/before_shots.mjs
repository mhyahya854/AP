// Capture the accepted artifact's own rendering of the three frontmatter pages
// and its reader chrome, for the before/after pairs.
//   node before_shots.mjs <file-url> <outdir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { attach, evaluate, goto, startConsoleCapture, viewport, wait } from './cdp.mjs';

const url = process.argv[2];
const outdir = process.argv[3];
mkdirSync(outdir, { recursive: true });
const cdp = await attach('9361');
await cdp.send('Runtime.enable');
const problems = startConsoleCapture(cdp);

const SPECS = [
  { name: 'before-01-reader-light', width: 1400, height: 1000, hash: '' },
  { name: 'before-11-a11y', width: 1400, height: 1000, hash: '#book-heading-0002' },
  { name: 'before-12-title', width: 1400, height: 1000, hash: '#TMP-0007' },
  { name: 'before-13-copyright', width: 1400, height: 1000, hash: '#TMP-0011' },
  { name: 'before-23-a11y-clip', width: 1400, height: 1000, hash: '#book-heading-0002', clip: '#TMP-0005' },
  { name: 'before-25-title-clip', width: 1400, height: 1000, hash: '#TMP-0007', clip: '#TMP-0007' },
  { name: 'before-26-title8-clip', width: 1400, height: 1000, hash: '#TMP-0007', clip: '#TMP-0008' },
  { name: 'before-27-copyright-clip', width: 1400, height: 1000, hash: '#TMP-0011', clip: '#TMP-0011' },
];

await viewport(cdp, 1400, 1000);
await goto(cdp, url, 4000);
const out = [];
for (const s of SPECS) {
  await evaluate(cdp, `location.hash = ${JSON.stringify(s.hash)}`);
  await wait(2200);
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
  out.push(s.name);
  console.log('captured', s.name, clip ? JSON.stringify(clip) : 'viewport');
}
writeFileSync(join(outdir, 'before_shots.json'), JSON.stringify({ out, problems }, null, 1));
cdp.close();
