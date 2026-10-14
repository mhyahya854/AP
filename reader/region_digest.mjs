// Compare every article region of two reader builds: ids in order, then the
// SHA-256 of each region's markup (including its opening tag).
// Usage: node region_digest.mjs <a.html> <b.html> [outJson]
import { createReadStream, writeFileSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { createHash } from 'node:crypto';

const [a, b, outJson] = process.argv.slice(2);
const ART = '<article class="book-page" id="TMP-';
const ART_END = '</article>';

async function regions(file) {
  const decoder = new StringDecoder('utf8');
  const out = [];
  let buf = '';
  let current = null;
  for await (const chunk of createReadStream(file, { highWaterMark: 8 << 20 })) {
    buf += decoder.write(chunk);
    for (;;) {
      if (current === null) {
        const i = buf.indexOf(ART);
        if (i < 0) { buf = buf.slice(Math.max(0, buf.length - 8192)); break; }
        buf = buf.slice(i);
        const idEnd = buf.indexOf('"', ART.length);
        current = buf.slice(ART.length, idEnd);
      }
      const e = buf.indexOf(ART_END);
      if (e < 0) break;
      const markup = buf.slice(0, e + ART_END.length);
      out.push({ id: current, sha256: createHash('sha256').update(Buffer.from(markup, 'utf8')).digest('hex'), chars: markup.length });
      buf = buf.slice(e + ART_END.length);
      current = null;
    }
  }
  return out;
}

const ra = await regions(a);
const rb = await regions(b);
const diffs = [];
for (let i = 0; i < Math.max(ra.length, rb.length); i++) {
  const x = ra[i], y = rb[i];
  if (!x || !y || x.id !== y.id || x.sha256 !== y.sha256) diffs.push({ i, a: x && x.id, b: y && y.id });
}
const report = {
  a: { path: a, regions: ra.length, first: ra[0] && ra[0].id, last: ra[ra.length - 1] && ra[ra.length - 1].id },
  b: { path: b, regions: rb.length, first: rb[0] && rb[0].id, last: rb[rb.length - 1] && rb[rb.length - 1].id },
  regions_identical: diffs.length === 0,
  differing_regions: diffs.slice(0, 40),
  differing_count: diffs.length,
  order_preserved: ra.every((r, i) => rb[i] && rb[i].id === r.id),
};
if (outJson) writeFileSync(outJson, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
