// Sidebar wave (2026-10-14): give each sidebar its own always-visible collapse
// button, keep the toolbar toggles that reopen a hidden panel, and never let a
// sidebar toggle move the reader.
//
// The patcher is streaming and exact-match only.  It edits five things and
// copies every other byte of the 1.13 GB artifact unchanged:
//
//   head  (first 2 MB)
//     1. the reader-UI stylesheet block (reader/ui.css, guarded by its hash)
//     2. `aside.left` gains an id and its collapse button moves to the top of
//        the panel (the old copy of the button is removed)
//     3. the Contents toolbar toggle now names the panel it controls
//   tail  (last 400 KB)
//     4. the Reader-Tools collapse button is relabelled and given state
//     5. the two additive scripts (reader/ui.js, reader/ui2.js)
//
// Nothing inside an article region, a disclosure body, a table or an embedded
// PNG is read or written.
//
// Usage:
//   node reader/patch_sidebar.mjs <in.html> <out.html> [--report <file>]
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
  console.error('usage: node patch_sidebar.mjs <in.html> <out.html> [--report file]');
  process.exit(2);
}

/* ---- the artifact this patch is written for (guards) -------------------- */
const EXPECT_INPUT_SHA = '73d175779ae506d9f2b902e83f56438ca313c3d75be4eb1dd0c5cf75c4f645b2';
const EXPECT_INPUT_BYTES = 1132261630;
const CSS_SEGMENT = { len: 9659, sha: '118d3fc5f833a41feca9b1cab5a10a713d1866fe6aacbce6843a3643587825b7' };
const UI1_INNER = { len: 13239, sha: '3b8fa776f183c77af599aefcd409f4c9ce1d72a0d12526dc3508025a32052d35' };
const UI2_INNER = { len: 17031, sha: '0ef23e0316a0a59ec94d52a678fd6c3a4b5377aa5382e6c1a1b821b67692726d' };
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

const OLD_ASIDE_LEFT = '<aside class="left" aria-labelledby="contents-heading"><div class="rail-head">';
const NEW_ASIDE_LEFT =
  '<aside class="left" id="contents-panel" aria-labelledby="contents-heading">'
  + '<button id="left-close" class="drawer-close panel-collapse" type="button"'
  + ' aria-label="Collapse contents sidebar" aria-controls="contents-panel" aria-expanded="true"'
  + '><span class="pc-glyph" aria-hidden="true">&#171;</span>Collapse contents</button>'
  + '<div class="rail-head">';
const OLD_LEFT_CLOSE = '<button id="left-close" class="drawer-close" aria-label="Close contents">\u00d7</button>';
const OLD_LEFT_TOGGLE = '<button id="left-toggle" aria-label="Toggle contents" aria-controls="contents-nav"';
const NEW_LEFT_TOGGLE = '<button id="left-toggle" aria-label="Toggle contents sidebar" aria-controls="contents-panel"';
const OLD_RIGHT_CLOSE = '<button id="right-close" class="drawer-close" aria-label="Close tools">&times;</button>';
const NEW_RIGHT_CLOSE =
  '<button id="right-close" class="drawer-close panel-collapse" type="button"'
  + ' aria-label="Collapse tools sidebar" aria-controls="reader-controls" aria-expanded="true"'
  + '><span class="pc-glyph" aria-hidden="true">&#187;</span>Collapse tools</button>';

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
if (scan.hits.tail !== 1) fail(`the tools panel occurs ${scan.hits.tail} times; expected exactly one`);
const HEAD_END = scan.firstAt.head;
const TAIL_START = scan.firstAt.tail;
if (!(HEAD_END > 100000 && HEAD_END < (4 << 20))) fail(`implausible head boundary: ${HEAD_END}`);
if (!(TAIL_START > HEAD_END)) fail('the tools panel precedes the first article region');
if (fixture) {
  console.log(`fixture mode: the artifact guard is off (${size} bytes, sha256 ${inputSha})`);
} else {
  if (inputSha !== EXPECT_INPUT_SHA) fail(`input sha256 ${inputSha} is not the accepted artifact`);
  if (size !== EXPECT_INPUT_BYTES) fail(`input is ${size} bytes, expected ${EXPECT_INPUT_BYTES}`);
}

const headBuf = readRange(0, HEAD_END);
const tailBuf = readRange(TAIL_START, size - TAIL_START);
const headRaw = headBuf.toString('utf8');
const tailRaw = tailBuf.toString('utf8');
if (headRaw.includes('\uFFFD') || tailRaw.includes('\uFFFD')) fail('a slice boundary cut a UTF-8 sequence');
if (!Buffer.from(headRaw, 'utf8').equals(headBuf)) fail('head slice does not round-trip byte for byte');
if (!Buffer.from(tailRaw, 'utf8').equals(tailBuf)) fail('tail slice does not round-trip byte for byte');

const guards = {};

/* ---- 1. stylesheet block ------------------------------------------------ */
const c1 = headRaw.indexOf(CSS_MARK);
const c2 = headRaw.indexOf(WAVE_CSS_MARK);
if (c1 < 0 || c2 < 0 || c2 <= c1) fail('the reader-UI stylesheet block was not found');
const oldCss = headRaw.slice(c1, c2);
guards.old_css_segment = { len: oldCss.length, sha256: sha256text(oldCss) };
if (oldCss.length !== CSS_SEGMENT.len || guards.old_css_segment.sha256 !== CSS_SEGMENT.sha) {
  fail('the stylesheet block is not the accepted one');
}
const trailing = oldCss.match(/\s+$/)[0];
/* the stylesheet is injected with LF endings and no leading blank line, exactly
   as the reader-UI patcher injected the original block */
const newCss = readFileSync(join(HERE, 'ui.css'), 'utf8')
  .replace(/\r\n/g, '\n').replace(/^\s+/, '').replace(/\s+$/, '') + trailing;
let head = headRaw.slice(0, c1) + newCss + headRaw.slice(c2);
guards.css_injected = true;

/* ---- 2./3. sidebar markup ---------------------------------------------- */
for (const [name, oldStr, newStr] of [
  ['app_panel_id_and_collapse_button', OLD_ASIDE_LEFT, NEW_ASIDE_LEFT],
  ['contents_toggle_names_panel', OLD_LEFT_TOGGLE, NEW_LEFT_TOGGLE],
]) {
  if (count(head, oldStr) !== 1) fail(`${name}: expected exactly one match, found ${count(head, oldStr)}`);
  head = head.replace(oldStr, newStr);
  guards[name] = true;
}
if (count(head, OLD_LEFT_CLOSE) !== 1) fail('the old Contents close button was not found exactly once');
head = head.replace(OLD_LEFT_CLOSE, '');
guards.old_left_close_removed = true;

/* ---- 4. tools-panel collapse button ------------------------------------ */
if (count(tailRaw, OLD_RIGHT_CLOSE) !== 1) fail('the Tools close button was not found exactly once');
let tail = tailRaw.replace(OLD_RIGHT_CLOSE, NEW_RIGHT_CLOSE);
guards.tools_collapse_button = true;

/* ---- 5. additive scripts ----------------------------------------------- */
const scripts = {
  'ui.js': { mark: UI1_MARK, expect: UI1_INNER },
  'ui2.js': { mark: UI2_MARK, expect: UI2_INNER },
};
for (const [name, { mark, expect }] of Object.entries(scripts)) {
  const i = tail.indexOf(mark);
  if (i < 0) fail(`${name}: marker not found in the tail`);
  const s = tail.lastIndexOf('<script>', i);
  const e = tail.indexOf('</script>', i);
  if (s < 0 || e < 0 || e < s) fail(`${name}: script block is not delimited`);
  const inner = tail.slice(s + '<script>'.length, e);
  guards[name] = { was_len: inner.length, was_sha256: sha256text(inner) };
  if (inner.length !== expect.len || guards[name].was_sha256 !== expect.sha) {
    fail(`${name}: the script block is not the accepted one`);
  }
  const src = readFileSync(join(HERE, name), 'utf8');
  const body = name === 'ui2.js'
    ? '\n' + src.replace(/\s+$/, '') + '\n'          /* the ui2 block carries a newline each side */
    : src;                                            /* the ui.js block is inserted verbatim */
  tail = tail.slice(0, s + '<script>'.length) + body + tail.slice(e);
  guards[name].now_len = body.length;
  guards[name].now_sha256 = sha256text(body);
  guards[name].now_source_sha256 = sha256text(src);
}

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
function write(text) {
  const buf = Buffer.from(text, 'utf8');
  push(buf);
  return buf.length;
}
write(head);
// stream the untouched middle
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
  patch: 'sidebar wave 2026-10-14',
  input: { path: input, bytes: size, sha256: inputSha },
  output: { path: output, bytes: written, sha256: outSha },
  bytes_delta: written - size,
  guards,
  preserved: {
    note: 'every byte between the first article region and the tools panel is copied unchanged',
    middle_bytes: TAIL_START - HEAD_END,
    head_bytes: headBuf.length,
    tail_start: TAIL_START,
    tail_bytes: size - TAIL_START,
  },
};
if (reportPath) { writeFileSync(reportPath, JSON.stringify(report, null, 1)); }
console.log(JSON.stringify(report, null, 1));
