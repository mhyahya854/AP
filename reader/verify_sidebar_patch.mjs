// Proof that the sidebar wave changed exactly what it claims to change, using
// only the two files (no repo sources needed).
//
// The artifact is treated as three regions:
//   head   [0, 2 MB)                - the shell, patched
//   middle [2 MB, tools panel)      - must be byte-identical
//   tail   [tools panel, EOF)       - the tools panel and the scripts, patched
//
// The middle is compared byte for byte.  The head and the tail of the new file
// are then reverted with the inverse of every patch: if the result is
// byte-equal to the old file, the patch set is complete and nothing else moved.
//
// Usage: node verify_patch.mjs <old.html> <new.html>
import { openSync, readSync, closeSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [oldF, newF] = process.argv.slice(2);
const HEAD_MARK = '<article class="book-page" id="TMP-';
const TAIL_MARK = '<aside class="right" id="reader-controls"';
const CSS_MARK = '/* ===== Book 2 reader UI layer (2026-10-12)';
const WAVE_CSS_MARK = '/* ===== Book 2 continuous-reading wave';

const NEW_ASIDE_LEFT =
  '<aside class="left" id="contents-panel" aria-labelledby="contents-heading">'
  + '<button id="left-close" class="drawer-close panel-collapse" type="button"'
  + ' aria-label="Collapse contents sidebar" aria-controls="contents-panel" aria-expanded="true"'
  + '><span class="pc-glyph" aria-hidden="true">&#171;</span>Collapse contents</button>'
  + '<div class="rail-head">';
const OLD_ASIDE_LEFT = '<aside class="left" aria-labelledby="contents-heading"><div class="rail-head">';
const OLD_LEFT_CLOSE = '<button id="left-close" class="drawer-close" aria-label="Close contents">\u00d7</button>';
const NEW_LEFT_TOGGLE = '<button id="left-toggle" aria-label="Toggle contents sidebar" aria-controls="contents-panel"';
const OLD_LEFT_TOGGLE = '<button id="left-toggle" aria-label="Toggle contents" aria-controls="contents-nav"';
const NEW_RIGHT_CLOSE =
  '<button id="right-close" class="drawer-close panel-collapse" type="button"'
  + ' aria-label="Collapse tools sidebar" aria-controls="reader-controls" aria-expanded="true"'
  + '><span class="pc-glyph" aria-hidden="true">&#187;</span>Collapse tools</button>';
const OLD_RIGHT_CLOSE = '<button id="right-close" class="drawer-close" aria-label="Close tools">&times;</button>';
const HEADING = '<h2 id="contents-heading">';

function readRange(file, start, len) {
  const fd = openSync(file, 'r');
  const buf = Buffer.alloc(len);
  const n = readSync(fd, buf, 0, len, start);
  closeSync(fd);
  return buf.subarray(0, n);
}
function findMarker(file, marker) {
  const fd = openSync(file, 'r');
  const size = statSync(file).size;
  const CH = 8 << 20;
  const needle = Buffer.from(marker, 'utf8');
  let offset = 0;
  let carry = Buffer.alloc(0);
  let hits = 0, first = -1;
  while (offset < size) {
    const buf = Buffer.alloc(Math.min(CH, size - offset));
    const n = readSync(fd, buf, 0, buf.length, offset);
    if (!n) break;
    const window = Buffer.concat([carry, buf.subarray(0, n)]);
    let i = window.indexOf(needle);
    while (i >= 0) { hits++; if (first < 0) first = offset - carry.length + i; i = window.indexOf(needle, i + 1); }
    carry = window.subarray(Math.max(0, window.length - needle.length + 1));
    offset += n;
  }
  closeSync(fd);
  return { hits, first };
}
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const swap = (text, from, to) => ({ text: text.split(from).join(to), n: text.split(from).length - 1 });
function scriptBlock(text, mark) {
  const i = text.indexOf(mark);
  if (i < 0) throw new Error('marker not found: ' + mark);
  const s = text.lastIndexOf('<script>', i) + '<script>'.length;
  const e = text.indexOf('</script>', i);
  return { start: s, end: e, inner: text.slice(s, e) };
}
function cssSegment(head) {
  const c1 = head.indexOf(CSS_MARK);
  const c2 = head.indexOf(WAVE_CSS_MARK);
  return head.slice(c1, c2);
}

const sizeOld = statSync(oldF).size, sizeNew = statSync(newF).size;
const headOldEnd = findMarker(oldF, HEAD_MARK).first;
const headNewEnd = findMarker(newF, HEAD_MARK).first;
const tailOldStart = findMarker(oldF, TAIL_MARK).first;
const tailNewStart = findMarker(newF, TAIL_MARK).first;

const headOld = readRange(oldF, 0, headOldEnd);
const headNew = readRange(newF, 0, headNewEnd);
const tailOld = readRange(oldF, tailOldStart, sizeOld - tailOldStart);
const tailNew = readRange(newF, tailNewStart, sizeNew - tailNewStart);

const midOld = readRange(oldF, headOldEnd, tailOldStart - headOldEnd);
const midNew = readRange(newF, headNewEnd, tailNewStart - headNewEnd);
const middleIdentical = midOld.length === midNew.length && sha(midOld) === sha(midNew);

const log = [];
// ---- revert the head ----------------------------------------------------
let h = headNew.toString('utf8');
let r;
r = swap(h, NEW_ASIDE_LEFT, OLD_ASIDE_LEFT); log.push({ edit: 'sidebar id + collapse button', occ: r.n }); h = r.text;
r = swap(h, NEW_LEFT_TOGGLE, OLD_LEFT_TOGGLE); log.push({ edit: 'contents toggle attributes', occ: r.n }); h = r.text;
r = swap(h, HEADING, OLD_LEFT_CLOSE + HEADING); log.push({ edit: 'restore the old close button', occ: r.n }); h = r.text;
r = swap(h, cssSegment(h), cssSegment(headOld.toString('utf8'))); log.push({ edit: 'stylesheet block', occ: r.n }); h = r.text;
const headReverted = h === headOld.toString('utf8');
let headMismatch = null;
if (!headReverted) {
  const oldText = headOld.toString('utf8');
  let i = 0;
  while (i < Math.min(h.length, oldText.length) && h[i] === oldText[i]) i++;
  headMismatch = {
    at: i, old_len: oldText.length, new_len: h.length,
    old_context: oldText.slice(Math.max(0, i - 70), i + 110),
    new_context: h.slice(Math.max(0, i - 70), i + 110),
  };
}

// ---- revert the tail ----------------------------------------------------
let t = tailNew.toString('utf8');
const oldTailText = tailOld.toString('utf8');
r = swap(t, NEW_RIGHT_CLOSE, OLD_RIGHT_CLOSE); log.push({ edit: 'tools collapse button', occ: r.n }); t = r.text;
for (const mark of ['window.book2ReaderPrefs = function', 'window.book2Semantics']) {
  const nb = scriptBlock(t, mark);
  const ob = scriptBlock(oldTailText, mark);
  r = swap(t, nb.inner, ob.inner);
  log.push({ edit: 'script block ' + mark.slice(0, 24), occ: r.n, inner_old: ob.inner.length, inner_new: nb.inner.length });
  t = r.text;
}
const tailReverted = t === oldTailText;

console.log(JSON.stringify({
  old: { path: oldF, bytes: sizeOld, tail_start: tailOldStart },
  new: { path: newF, bytes: sizeNew, tail_start: tailNewStart },
  head: { bytes_old: headOld.length, bytes_new: headNew.length, reverted_to_old: headReverted },
  head_mismatch: headMismatch,
  tail: { bytes_old: tailOld.length, bytes_new: tailNew.length, reverted_to_old: tailReverted },
  bytes_delta: sizeNew - sizeOld,
  middle: { bytes_old: midOld.length, bytes_new: midNew.length, identical: middleIdentical,
            sha256_old: sha(midOld), sha256_new: sha(midNew) },
  revert_log: log,
  verdict: (middleIdentical && headReverted && tailReverted) ? 'ONLY THE INTENDED EDITS' : 'UNEXPECTED DIFFERENCE',
}, null, 1));
