// Report the real rendered measure and per-line text of a frontmatter paragraph.
import { attach, evaluate, goto, wait } from './cdp.mjs';

const url = process.argv[2];
const selector = process.argv[3] || '#TMP-0005 .content>p:nth-child(4)';
const cdp = await attach('9361');
await goto(cdp, url, 2000);
await wait(400);
const out = await evaluate(cdp, `(() => {
  const p = document.querySelector(${JSON.stringify(selector)});
  if (!p) return null;
  const cs = getComputedStyle(p);
  const rects = [];
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let n;
  while ((n = walker.nextNode())) {
    for (let i = 0; i < n.length; i++) {
      range.setStart(n, i); range.setEnd(n, i + 1);
      const r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      rects.push({ top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), ch: n.data[i] });
    }
  }
  const lines = [];
  for (const r of rects) {
    const last = lines[lines.length - 1];
    if (!last || Math.abs(last.top - r.top) > 3) { lines.push({ top: r.top, left: r.left, right: r.right, text: r.ch }); }
    else { last.right = Math.max(last.right, r.right); last.text += r.ch; }
  }
  const span = p.querySelector('span');
  return {
    clientWidth: p.clientWidth, offsetWidth: p.offsetWidth,
    padding: cs.paddingLeft + ' / ' + cs.paddingRight,
    textIndent: cs.textIndent, lineHeight: cs.lineHeight, fontSize: cs.fontSize, fontFamily: cs.fontFamily,
    spanFont: span ? getComputedStyle(span).fontFamily + ' ' + getComputedStyle(span).fontSize : null,
    lines: lines.map((l) => ({ width: l.right - l.left, left: l.left, text: l.text })),
  };
})()`);
console.log(JSON.stringify(out, null, 2));
cdp.close();
