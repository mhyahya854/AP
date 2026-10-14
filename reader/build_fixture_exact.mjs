// Byte-exact reader fixture: the real shell, the real scripts and a handful of
// real article regions, copied without any newline translation (Python's
// Path.write_text rewrites LF as CRLF on Windows, which would make the fixture
// diverge from the artifact and hide real byte differences).
//
// Usage: node make_fixture.mjs <source.html> <out.html> [TMP-0001,TMP-0002,...]
import { createReadStream, writeFileSync, statSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';

const [src, out, listArg] = process.argv.slice(2);
const WANT = (listArg || [
  'TMP-0001', 'TMP-0002', 'TMP-0016', 'TMP-0117', 'TMP-0130', 'TMP-0137',
  'TMP-0542', 'TMP-1105', 'TMP-1210', 'TMP-1227', 'TMP-1309', 'TMP-1328',
  'TMP-1468', 'TMP-0740', 'TMP-0971', 'TMP-1500', 'TMP-1671', 'TMP-1899',
].join(',')).split(',');
const LAST = WANT[WANT.length - 1];
const ART = '<article class="book-page" id="';
const ART_END = '</article>';

const decoder = new StringDecoder('utf8');
let buf = '';
let head = null;
let current = null;
let body = '';
let tail = null;
const kept = [];
const rs = createReadStream(src, { highWaterMark: 4 << 20 });

for await (const chunk of rs) {
  buf += decoder.write(chunk);
  for (;;) {
    if (tail !== null) break;
    if (current === null) {
      const i = buf.indexOf(ART);
      if (i < 0) { buf = buf.slice(Math.max(0, buf.length - 8192)); break; }
      if (head === null) head = buf.slice(0, i);
      const idEnd = buf.indexOf('"', i + ART.length);
      current = buf.slice(i + ART.length, idEnd);
      /* skip the whole opening tag, not just the id attribute, so the region's
         markup starts at its content (the region's own attributes are not part
         of the book) */
      const tagEnd = buf.indexOf('>', idEnd);
      if (tagEnd < 0) { buf = buf.slice(Math.max(0, buf.length - 8192)); break; }
      buf = buf.slice(tagEnd + 1);
    }
    const e = buf.indexOf(ART_END);
    if (e < 0) { break; }
    const markup = buf.slice(0, e);
    if (WANT.includes(current)) { kept.push(current); body += `<article class="book-page" id="${current}" data-source="fixture" data-status="UNVERIFIED" data-group-index="1" data-group-title="Fixture" data-nav-label="${current}">${markup}</article>`; }
    if (current === LAST) { tail = buf.slice(e + ART_END.length); }
    buf = buf.slice(e + ART_END.length);
    current = null;
  }
  if (tail !== null) break;
}

if (head === null || tail === null) { throw new Error('extraction failed'); }
/* The reader script resolves the ten group anchors with
   `document.getElementById(id).closest('.book-page')` and throws if any is
   missing, which would disable navigation, the group counter and the scroll
   sync in the fixture.  A fixture only carries a handful of regions, so the
   group anchors that live in the regions it does not carry are parked inside
   the first carried region - same ids, same class, no book text touched. */
const GROUPS = Array.from({ length: 10 }, (_, i) => 'book-group-' + String(i + 1).padStart(2, '0'));
const present = new Set([...`${head}${body}${tail}`.matchAll(/id="(book-group-\d+)"/g)].map((m) => m[1]));
const missing = GROUPS.filter((g) => !present.has(g));
const anchors = missing.map((g) => `<span class="canon-anchor" id="${g}"></span>`).join('');
const MARK = '<div class="content">';
const at = body.indexOf(MARK);
const fixtureBody = anchors && at >= 0
  ? body.slice(0, at + MARK.length) + anchors + body.slice(at + MARK.length)
  : body;

const html = head + fixtureBody + tail;
const bytes = Buffer.from(html, 'utf8');
writeFileSync(out, bytes);
console.log(JSON.stringify({
  out, bytes: bytes.length, regions: kept.length, source: src, sourceBytes: statSync(src).size,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  headBytes: Buffer.byteLength(head, 'utf8'), tailBytes: Buffer.byteLength(tail, 'utf8'),
  groupAnchorsAdded: missing,
}, null, 1));
