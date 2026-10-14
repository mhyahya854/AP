// Step 2 wave (2026-10-14): compact top-right toolbar + Light/Dark/System
// appearance.
//
// The patcher is streaming and exact-match only.  It edits four things and
// copies every other byte of the 1.13 GB artifact unchanged:
//
//   head  (first 2 MB)
//     1. the reader-UI stylesheet block (reader/ui.css, guarded by its hash) -
//        it now also carries the compact top-right toolbar layout and the dark
//        palette
//   tail  (last 200 KB)
//     2. the reader-UI script block (reader/ui.js, guarded by its hash) - it
//        now also owns the appearance choice and the inline-colour mapping
//     3. an Appearance control is inserted at the top of the Reader Tools panel
//     4. the additive semantics/drawer block (reader/ui2.js) is verified
//        unchanged - this wave does not touch the drawers
//
// Nothing inside an article region, a disclosure body, a table or an embedded
// PNG is read or written: every byte between the first article region and the
// tools panel is streamed through untouched.
//
// Usage:
//   node reader/patch_step2.mjs <in.html> <out.html> [--report <file>] [--fixture]
import { createReadStream, createWriteStream, openSync, readSync, closeSync, statSync,
         readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const [input, output] = process.argv.slice(2);
const fixture = process.argv.includes('--fixture');
const reportPath = (() => {
  const i = process.argv.indexOf('--report');
  return i >= 0 ? process.argv[i + 1] : null;
})();
if (!input || !output) {
  console.error('usage: node patch_step2.mjs <in.html> <out.html> [--report file] [--fixture]');
  process.exit(2);
}

/* ---- the artifact this patch is written for (guards) -------------------- */
const EXPECT_INPUT_SHA = 'db07ab804bed45df6dd7b27a70dea2e86f259707d047b9b307d19e71108e35df';
const EXPECT_INPUT_BYTES = 1132269052;
const CSS_SEGMENT = { len: 12655, sha: '9cbde857967dd72825c8e7889ef4f67cb707b8cc0da75353cf3b9358e1c0b166' };
const UI1_INNER = { len: 17072, sha: '91fdfb8767093b90d21f1f4ffacbcd6445fed390cffe455268615d8732d722ce' };
const UI2_INNER = { len: 17277, sha: 'a0fa80caa610988f723d29f14e4a3983b9faa10f82e4ae78910115d675e503e1' };
/* The patchable shell is delimited by two markers that are located in a
   byte-level pre-pass, so the same patcher works on the 1.13 GB artifact and on
   a small fixture:
     head   [0, first article)        the sidebar, toolbar and stylesheet
     middle [first article, tools)    copied byte for byte
     tail   [tools panel, EOF)        the tools panel and the four scripts */
const HEAD_MARK = '<article class="book-page" id="TMP-';
const TAIL_MARK = '<aside class="right" id="reader-controls"';

const CSS_MARK = '/* ===== Book 2 reader UI layer (2026-10-12)';
const WAVE_CSS_MARK = '/* ===== Book 2 continuous-reading wave';
const UI1_MARK = 'window.book2ReaderPrefs = function';
const UI2_MARK = 'window.book2Semantics';

/* the Reading-tools panel gets its Appearance control first, so the theme is
   the first thing the panel shows; a single line of markup, like the rest */
const TOOLS_ANCHOR = '<div class="tools">';
const APPEARANCE_CTL =
  '<div class="ctl"><label for="theme">Appearance</label><select id="theme">'
  + '<option value="light">Light</option><option value="dark">Dark</option>'
  + '<option value="system">System</option></select>'
  + '<p class="ctl-note theme-hint" id="theme-hint" role="status"></p></div>';

/* the toolbar this stylesheet is written for: one group of controls inside
   <main>, in the order the reader already had */
const TOOLBAR_PARTS = [
  '<main><div class="toolbar">',
  '<button id="left-toggle" aria-label="Toggle contents sidebar" aria-controls="contents-panel" aria-expanded="false">',
  '<button id="prev" aria-label="Previous section">',
  '<button id="next" aria-label="Next section">',
  '<input id="search" type="search" placeholder="Search text" aria-label="Search text">',
  '<span class="mode-badge" id="mode-badge" title="Current view mode">',
  '<button id="right-toggle" aria-controls="reader-controls" aria-expanded="false">Controls</button>',
];

const sha256text = (s) => createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
const fail = (msg) => { console.error('ABORT: ' + msg); process.exit(1); };
const count = (hay, needle) => hay.split(needle).length - 1;

function readRange(start, len) {
  const fd = openSync(input, 'r');
  const buf = Buffer.alloc(len);
  const n = readSync(fd, buf, 0, len, start);
  closeSync(fd);
  return buf.subarray(0, n);
}

async function scanInput() {
  const h = createHash('sha256');
  const needles = { head: Buffer.from(HEAD_MARK, 'utf8'), tail: Buffer.from(TAIL_MARK, 'utf8') };
  const hits = { head: 0, tail: 0 };
  const firstAt = { head: -1, tail: -1 };
  let offset = 0;
  let carry = Buffer.alloc(0);
  for await (const chunk of createReadStream(input, { highWaterMark: 8 << 20 })) {
    h.update(chunk);
    const buf = Buffer.concat([carry, chunk]);
    for (const [key, needle] of Object.entries(needles)) {
      let i = buf.indexOf(needle);
      while (i >= 0) {
        hits[key]++;
        if (firstAt[key] < 0) { firstAt[key] = offset - carry.length + i; }
        i = buf.indexOf(needle, i + 1);
      }
    }
    const keep = Math.max(needles.head.length, needles.tail.length) - 1;
    carry = buf.subarray(Math.max(0, buf.length - keep));
    offset += chunk.length;
  }
  return { sha256: h.digest('hex'), hits, firstAt };
}

const size = statSync(input).size;
const scan = await scanInput();
const inputSha = scan.sha256;
if (scan.hits.tail !== 1) { fail(`the tools panel occurs ${scan.hits.tail} times; expected exactly one`); }
const HEAD_END = scan.firstAt.head;
const TAIL_START = scan.firstAt.tail;
if (!(HEAD_END > 100000 && HEAD_END < (4 << 20))) { fail(`implausible head boundary: ${HEAD_END}`); }
if (!(TAIL_START > HEAD_END)) { fail('the tools panel precedes the first article region'); }
if (fixture) {
  console.log(`fixture mode: the artifact guard is off (${size} bytes, sha256 ${inputSha})`);
} else {
  if (inputSha !== EXPECT_INPUT_SHA) { fail(`input sha256 ${inputSha} is not the accepted artifact`); }
  if (size !== EXPECT_INPUT_BYTES) { fail(`input is ${size} bytes, expected ${EXPECT_INPUT_BYTES}`); }
}

const headBuf = readRange(0, HEAD_END);
const tailBuf = readRange(TAIL_START, size - TAIL_START);
const headRaw = headBuf.toString('utf8');
const tailRaw = tailBuf.toString('utf8');
if (headRaw.includes('\uFFFD') || tailRaw.includes('\uFFFD')) { fail('a slice boundary cut a UTF-8 sequence'); }
if (!Buffer.from(headRaw, 'utf8').equals(headBuf)) { fail('head slice does not round-trip byte for byte'); }
if (!Buffer.from(tailRaw, 'utf8').equals(tailBuf)) { fail('tail slice does not round-trip byte for byte'); }

const guards = {};

/* ---- 0. the toolbar this stylesheet positions --------------------------- */
for (const part of TOOLBAR_PARTS) {
  const n = count(headRaw, part);
  if (n !== 1) { fail(`toolbar markup ${JSON.stringify(part.slice(0, 40))} occurs ${n} times`); }
}
guards.toolbar_markup_verified = TOOLBAR_PARTS.length;

/* ---- 1. stylesheet block ------------------------------------------------ */
const c1 = headRaw.indexOf(CSS_MARK);
const c2 = headRaw.indexOf(WAVE_CSS_MARK);
if (c1 < 0 || c2 < 0 || c2 <= c1) { fail('the reader-UI stylesheet block was not found'); }
const oldCss = headRaw.slice(c1, c2);
guards.old_css_segment = { len: oldCss.length, sha256: sha256text(oldCss) };
if (oldCss.length !== CSS_SEGMENT.len || guards.old_css_segment.sha256 !== CSS_SEGMENT.sha) {
  fail('the stylesheet block is not the accepted one');
}
const trailing = oldCss.match(/\s+$/)[0];
const newCss = readFileSync(join(HERE, 'ui.css'), 'utf8')
  .replace(/\r\n/g, '\n').replace(/^\s+/, '').replace(/\s+$/, '') + trailing;
let head = headRaw.slice(0, c1) + newCss + headRaw.slice(c2);
guards.css_injected = { was_len: oldCss.length, now_len: newCss.length };

/* ---- 2. scripts in the tail -------------------------------------------- */
let tail = tailRaw;
const scripts = {
  'ui.js': { mark: UI1_MARK, expect: UI1_INNER, replace: true },
  'ui2.js': { mark: UI2_MARK, expect: UI2_INNER, replace: false },
};
for (const [name, { mark, expect, replace }] of Object.entries(scripts)) {
  const i = tail.indexOf(mark);
  if (i < 0) { fail(`${name}: marker not found in the tail`); }
  const s = tail.lastIndexOf('<script>', i);
  const e = tail.indexOf('</script>', i);
  if (s < 0 || e < 0 || e < s) { fail(`${name}: script block is not delimited`); }
  const inner = tail.slice(s + '<script>'.length, e);
  guards[name] = { was_len: inner.length, was_sha256: sha256text(inner) };
  if (inner.length !== expect.len || guards[name].was_sha256 !== expect.sha) {
    fail(`${name}: the script block is not the accepted one`);
  }
  if (!replace) { continue; }
  const src = readFileSync(join(HERE, name), 'utf8');
  tail = tail.slice(0, s + '<script>'.length) + src + tail.slice(e);
  guards[name].now_len = src.length;
  guards[name].now_sha256 = sha256text(src);
}

/* ---- 3. the Appearance control ---------------------------------------- */
if (count(tail, TOOLS_ANCHOR) !== 1) { fail('the tools container was not found exactly once'); }
tail = tail.replace(TOOLS_ANCHOR, TOOLS_ANCHOR + APPEARANCE_CTL);
if (count(tail, 'id="theme"') !== 1) { fail('the Appearance control was not inserted once'); }
guards.appearance_control = true;

/* ---- write: [0,2MB) patched, middle streamed raw, tail patched --------- */
const digest = createHash('sha256');
const out = createWriteStream(output);
let written = 0;
let backpressure = false;
out.on('drain', () => { backpressure = false; });
function push(buf) {
  digest.update(buf);
  written += buf.length;
  if (!out.write(buf)) { backpressure = true; }
}
function write(text) { push(Buffer.from(text, 'utf8')); }
write(head);
await new Promise((resolve, reject) => {
  const rs = createReadStream(input, { start: HEAD_END, end: TAIL_START - 1, highWaterMark: 8 << 20 });
  rs.on('data', (chunk) => {
    push(chunk);
    if (backpressure) { rs.pause(); out.once('drain', () => { backpressure = false; rs.resume(); }); }
  });
  rs.on('end', resolve);
  rs.on('error', reject);
});
write(tail);
await new Promise((resolve) => out.end(resolve));

const outSha = digest.digest('hex');
const report = {
  patch: 'step 2 wave 2026-10-14 (compact top-right toolbar + appearance)',
  input: { path: input, bytes: size, sha256: inputSha },
  output: { path: output, bytes: written, sha256: outSha },
  bytes_delta: written - size,
  guards,
  preserved: {
    note: 'every byte between the first article region and the tools panel is copied unchanged',
    middle_bytes: TAIL_START - HEAD_END,
    head_bytes: headBuf.length,
    tail_start: TAIL_START,
    tail_bytes: tailBuf.length,
  },
};
if (reportPath) { writeFileSync(reportPath, JSON.stringify(report, null, 1)); }
console.log(JSON.stringify(report, null, 1));
