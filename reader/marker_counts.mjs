// Streaming inspection of the 1.13 GB reader: marker counts, byte-range
// extraction and per-region digests, without ever loading the whole file.
// Usage:
//   node scan.mjs head <html> <outFile> <bytes>
//   node scan.mjs tail <html> <outFile> <bytes>
//   node scan.mjs find <html> <marker> [contextBytes]
//   node scan.mjs counts <html> <outJson>
import { createReadStream, statSync, writeFileSync, openSync, readSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';

const [cmd, html, arg3, arg4] = process.argv.slice(2);
const size = statSync(html).size;

function readRange(start, len) {
  const fd = openSync(html, 'r');
  const buf = Buffer.alloc(len);
  const n = readSync(fd, buf, 0, len, start);
  closeSync(fd);
  return buf.subarray(0, n);
}

if (cmd === 'head' || cmd === 'tail') {
  const n = Number(arg4 || 200000);
  const start = cmd === 'head' ? 0 : Math.max(0, size - n);
  writeFileSync(arg3, readRange(start, n));
  console.log(JSON.stringify({ cmd, out: arg3, start, bytes: n, fileBytes: size }));
  process.exit(0);
}

// stream the file once, decoding UTF-8 and reporting marker hits / counts
async function stream(check) {
  const decoder = new StringDecoder('utf8');
  let carry = '';
  let offset = 0;                 // decoded chars consumed so far
  const rs = createReadStream(html, { highWaterMark: 4 << 20 });
  for await (const chunk of rs) {
    const text = carry + decoder.write(chunk);
    carry = '';
    const keep = 4096;
    const body = text.length > keep ? text.slice(0, text.length - keep) : '';
    check(body, offset);
    offset += body.length;
    carry = text.slice(body.length);
  }
  check(carry, offset);
}

if (cmd === 'find') {
  const marker = arg3;
  const ctx = Number(arg4 || 400);
  const hits = [];
  await stream((text, off) => {
    let i = 0;
    while ((i = text.indexOf(marker, i)) >= 0) {
      hits.push({ offset: off + i, snippet: text.slice(Math.max(0, i - ctx), i + marker.length + ctx) });
      i += marker.length;
    }
  });
  console.log(JSON.stringify({ marker, count: hits.length, hits: hits.slice(0, 20) }, null, 1));
  process.exit(0);
}

if (cmd === 'counts') {
  const out = { file: html, bytes: size, markers: {}, regions: {}, notes: {} };
  const markers = {
    'region-open': '<article class="book-page" id="TMP-',
    'nav-row': 'data-source-contents-id="',
    'numbered-entry': '<span class="nav-page">',
    'nav-page-empty': '<span class="nav-page"></span>',
    'disclosure-control': '<details class="disclosure"',
    'desc-label': 'class="b2-desc-label"',
    'lg-badge': 'class="lg-badge',
    'embedded-png': 'data:image/png;base64,',
    'img': '<img ',
    'table': '<table',
    'book-heading': 'id="book-heading-',
    'group-anchor': 'id="book-group-',
    'internal-link': 'href="#',
    'nav-group': 'class="nav-group"',
    'canon-anchor': 'class="canon-anchor"',
    'lg-question': 'class="lg-question"',
    'left-close-button': 'id="left-close"',
    'right-close-button': 'id="right-close"',
    'panel-collapse-class': 'panel-collapse',
    'left-close': 'id="left-close"',
    'right-close': 'id="right-close"',
    'left-toggle': 'id="left-toggle"',
    'right-toggle': 'id="right-toggle"',
    'ui1-script': 'window.book2ReaderPrefs',
    'ui2-script': 'window.book2Semantics',
    'sidebar-open': '<aside class="left"',
    'tools-open': '<aside class="right"',
    'app-open': '<div class="app',
  };
  const counts = {};
  for (const k of Object.keys(markers)) counts[k] = 0;
  const regionIds = [];
  await stream((text) => {
    for (const [k, m] of Object.entries(markers)) {
      let i = 0;
      while ((i = text.indexOf(m, i)) >= 0) { counts[k]++; i += m.length; }
    }
    const rx = /<article class="book-page" id="(TMP-\d{4})"/g;
    let m2;
    while ((m2 = rx.exec(text))) regionIds.push(m2[1]);
  });
  out.markers = counts;
  out.regionIds = { count: regionIds.length, first: regionIds[0], last: regionIds.at(-1) };
  writeFileSync(arg3, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ bytes: size, markers: counts, regionCount: regionIds.length, first: regionIds[0], last: regionIds.at(-1) }, null, 1));
  process.exit(0);
}

console.error('unknown command: ' + cmd);
process.exit(2);
