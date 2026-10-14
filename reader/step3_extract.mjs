// Step 3 (Contents navigation) - streaming extractor for the 1.13 GB reader.
//
// Pass 1 walks the file once as raw bytes and records byte offsets for the
// structural markers this step needs; pass 2 random-access reads the small
// pieces back out.  The whole file is never materialised.  Byte offsets are
// used throughout because the artifact carries multibyte text and a
// char-offset tracker drifts against `readSync`.
//
// Usage: node reader/step3_extract.mjs "<artifact.html>" <outDir>
import { createReadStream, statSync, writeFileSync, openSync, readSync, closeSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { join } from 'node:path';

const [, , html, outDir] = process.argv;
if (!html || !outDir) { console.error('usage: node step3_extract.mjs <html> <outDir>'); process.exit(2); }
const size = statSync(html).size;
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) {
  if (/\.(js|html|json)$/.test(f)) { rmSync(join(outDir, f)); }
}

function readRange(start, len) {
  const fd = openSync(html, 'r');
  const buf = Buffer.alloc(len);
  const n = readSync(fd, buf, 0, len, start);
  closeSync(fd);
  return buf.subarray(0, n);
}
const readText = (start, len) => readRange(start, len).toString('utf8');

// ---- pass 1: offsets -------------------------------------------------------
const interesting = ['<script', '</script>', '<aside', '</aside>', '<article class="book-page" id="TMP-'];
const needles = interesting.map((m) => ({ m, b: Buffer.from(m, 'latin1') }));
const offsets = new Map(interesting.map((m) => [m, []]));
const phraseCounts = {
  'href="#book-heading-': 0,
  'href="#book-group-': 0,
  'href="#TMP-': 0,
  'href="#': 0,
  'id="book-heading-': 0,
  'id="book-group-': 0,
  'data-source-contents-id=': 0,
  '<span class="nav-page"': 0,
};
const phraseNeedles = Object.keys(phraseCounts).map((p) => ({ p, b: Buffer.from(p, 'latin1') }));

{
  const KEEP = 64;
  let tail = Buffer.alloc(0);
  let base = 0;              // byte offset of tail[0] within the file
  for await (const chunk of createReadStream(html, { highWaterMark: 8 << 20 })) {
    const buf = tail.length ? Buffer.concat([tail, chunk]) : chunk;
    const limit = Math.max(0, buf.length - KEEP);
    const body = buf.subarray(0, limit);
    for (const { m, b } of needles) {
      let i = body.indexOf(b, 0);
      while (i >= 0) { offsets.get(m).push(base + i); i = body.indexOf(b, i + 1); }
    }
    for (const { p, b } of phraseNeedles) {
      let i = body.indexOf(b, 0);
      while (i >= 0) { phraseCounts[p]++; i = body.indexOf(b, i + 1); }
    }
    base += limit;
    tail = buf.subarray(limit);
  }
  for (const { m, b } of needles) {
    let i = tail.indexOf(b, 0);
    while (i >= 0) { offsets.get(m).push(base + i); i = tail.indexOf(b, i + 1); }
  }
  for (const { p, b } of phraseNeedles) {
    let i = tail.indexOf(b, 0);
    while (i >= 0) { phraseCounts[p]++; i = tail.indexOf(b, i + 1); }
  }
}

// ---- pass 2: extract -------------------------------------------------------
const scripts = offsets.get('<script');
const scriptEnds = offsets.get('</script>');
const scriptBlocks = [];
scripts.forEach((start, idx) => {
  if (scriptBlocks.length && start < scriptBlocks[scriptBlocks.length - 1].bodyEnd) { return; }
  const gt = (() => {
    // the opening tag ends at the first '>' after start (script tags never hold '>' in attributes here)
    const win = readText(start, 400);
    const k = win.indexOf('>');
    return k < 0 ? -1 : start + k + 1;
  })();
  if (gt < 0) { return; }
  const end = scriptEnds.find((e) => e > gt);
  if (end === undefined) { return; }
  const body = readText(gt, end - gt);
  const file = join(outDir, `script-${idx + 1}.js`);
  writeFileSync(file, body);
  scriptBlocks.push({ idx: idx + 1, start, bodyStart: gt, bodyEnd: end, chars: body.length, file,
    head: body.slice(0, 160).replace(/\s+/g, ' ') });
});

const asides = offsets.get('<aside');
const asideEnds = offsets.get('</aside>');
const asideBlocks = [];
asides.forEach((start, idx) => {
  if (asideBlocks.length && start < asideBlocks[asideBlocks.length - 1].end) { return; }
  const end = asideEnds[idx];
  if (end === undefined) { return; }
  const whole = readText(start, end + '</aside>'.length - start);
  const firstTag = whole.slice(0, whole.indexOf('>') + 1).replace(/\s+/g, ' ');
  const isLeft = /class="[^"]*\bleft\b/.test(firstTag);
  const cls = /class="([^"]*)"/.exec(firstTag);
  const name = `aside-${asides.indexOf(start) + 1}-${isLeft ? 'left' : 'other'}-${(cls ? cls[1] : 'x').replace(/\W+/g, '-')}.html`;
  writeFileSync(join(outDir, name), whole);
  asideBlocks.push({ idx: idx + 1, name, start, end, chars: whole.length, opening: firstTag });
});

const arts = offsets.get('<article class="book-page" id="TMP-');
const summary = {
  schema: 'book2.step3.extract.v1',
  file: html,
  bytes: size,
  scripts: scriptBlocks,
  asides: asideBlocks,
  regionOpeners: arts.length,
  phraseCounts,
};
writeFileSync(join(outDir, 'extract-index.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
