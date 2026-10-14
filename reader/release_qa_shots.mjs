// Final release QA: targeted screenshots (region or element) with a chosen
// theme, so low-contrast candidates can be checked against the real pixels.
//
//   node reader/release_qa_shots.mjs [port] "name=selector[:theme][,name2=...]"
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { attach, evq, gate, outdir, wait } from './qa_cdp.mjs';

const dir = outdir();
const cdp = await attach(process.argv[2] || '9356');
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
await gate(cdp, 'shots');

const specs = (process.argv[3] || '').split(',').filter(Boolean);
const done = [];
for (const spec of specs) {
  const eq = spec.indexOf('=');
  const name = spec.slice(0, eq);
  const rest = spec.slice(eq + 1);
  const colon = rest.lastIndexOf(':');
  const selector = colon > 0 ? rest.slice(0, colon) : rest;
  const theme = colon > 0 ? rest.slice(colon + 1) : null;
  if (theme) {
    await evq(cdp, "(() => { const t = document.querySelector('#theme'); t.value = "
      + JSON.stringify(theme) + "; t.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await wait(700);
  }
  const info = await evq(cdp, "(() => { const el = document.querySelector(" + JSON.stringify(selector)
    + "); if (!el) return null; el.scrollIntoView({ block: 'center' });"
    + " const r = el.getBoundingClientRect();"
    + " return { top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width),"
    + " text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 70) }; })()");
  await wait(900);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file = join(dir, 'screens', name + '.png');
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log(name + ' -> ' + info.text.slice(0, 50));
  done.push({ name: name, selector: selector, theme: theme, info: info,
    file: 'reports/final_release_qa/screens/' + name + '.png' });
}
console.log(JSON.stringify(done, null, 1));
process.exit(0);
