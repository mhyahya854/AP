// Final release QA: pixel-level contrast evidence.
//
// Computed styles mislead in this book (reconstructed pages nest source colour
// bands, so an ancestor background is often not the pixels behind a glyph).
// This probe therefore screenshots the exact bounding box of a text element and
// hands the crop to the Python step, which reads the two dominant colours out of
// the actual pixels.
//
//   node reader/release_qa_pixels.mjs [port] [fileUrl]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { attach, evq, gate, outdir, wait } from './qa_cdp.mjs';

const dir = outdir();
const cdp = await attach(process.argv[2] || '9356');
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
await gate(cdp, 'pixel contrast');

const targets = [
  ['cover-title', '#TMP-0001', 'light'],
  ['cover-title', '#TMP-0001', 'dark'],
  ['body-paragraph', '#TMP-0119', 'light'],
  ['body-paragraph', '#TMP-0119', 'dark'],
  ['module-heading', '#book-heading-0117', 'light'],
  ['module-heading', '#book-heading-0117', 'dark'],
  ['table-cell', '#TMP-0333', 'light'],
  ['table-cell', '#TMP-0333', 'dark'],
  ['lg-badge', '.lg-badge', 'light'],
  ['lg-badge', '.lg-badge', 'dark'],
  ['disclosure-summary', 'details.disclosure > summary', 'light'],
  ['disclosure-summary', 'details.disclosure > summary', 'dark'],
  ['photo-credit', '.b2-vcredit', 'light'],
  ['photo-credit', '.b2-vcredit', 'dark'],
  ['nav-row-linked', '#contents-nav a.nav-child', 'light'],
  ['nav-row-linked', '#contents-nav a.nav-child', 'dark'],
  ['nav-row-muted', '#contents-nav span.nav-unlinked', 'light'],
  ['nav-row-muted', '#contents-nav span.nav-unlinked', 'dark'],
  ['toolbar-button', '#right-toggle', 'light'],
  ['toolbar-button', '#right-toggle', 'dark'],
  ['tools-panel-label', '#reader-controls label', 'light'],
  ['tools-panel-label', '#reader-controls label', 'dark'],
];

const rows = [];
for (const spec of targets) {
  const name = spec[0];
  const selector = spec[1];
  const theme = spec[2];
  await evq(cdp, "(() => { const t = document.querySelector('#theme'); t.value = "
    + JSON.stringify(theme) + "; t.dispatchEvent(new Event('change', { bubbles: true })); })()");
  await wait(500);
  const box = await evq(cdp, "(() => {"
    + " const el = document.querySelector(" + JSON.stringify(selector) + ");"
    + " if (!el) return null;"
    + " el.scrollIntoView({ block: 'center' });"
    + " const r = el.getBoundingClientRect();"
    + " const dark = document.documentElement.getAttribute('data-theme');"
    + " return { x: Math.max(0, Math.floor(r.left)), y: Math.max(0, Math.floor(r.top)),"
    + " w: Math.min(900, Math.ceil(r.width)), h: Math.min(600, Math.ceil(r.height)),"
    + " theme: dark, text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 56),"
    + " fontPx: parseFloat(getComputedStyle(el).fontSize),"
    + " weight: getComputedStyle(el).fontWeight }; })()");
  if (!box || box.w < 8 || box.h < 8) { rows.push({ name: name, selector: selector, theme: theme, skipped: true }); continue; }
  await wait(600);
  const shot = await cdp.send('Page.captureScreenshot',
    { format: 'png', clip: { x: box.x, y: box.y, width: box.w, height: box.h, scale: 1 } });
  const file = 'qa-pixel-' + name + '-' + theme + '.png';
  writeFileSync(join(dir, 'screens', file), Buffer.from(shot.data, 'base64'));
  rows.push({ name: name, selector: selector, theme: theme, clip: box,
    file: 'reports/final_release_qa/screens/' + file });
}

await evq(cdp, "(() => { const t = document.querySelector('#theme'); t.value = 'light'; t.dispatchEvent(new Event('change', { bubbles: true })); })()");
writeFileSync(join(dir, 'pixel_contrast_samples.json'), JSON.stringify(rows, null, 1));
console.log('captured ' + rows.filter((r) => !r.skipped).length + ' clips of ' + rows.length);
console.log(JSON.stringify(rows.map((r) => r.name + ':' + r.theme + (r.skipped ? ' SKIP' : ' ok'))));
process.exit(0);
