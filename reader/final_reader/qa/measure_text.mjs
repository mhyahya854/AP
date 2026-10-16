// Measure the width of a string in the fixture's own frontmatter font, so the
// side padding can be chosen from the source's real line breaks.
//   node measure_text.mjs <file-url> <css-font-shorthand> "string" ...
import { attach, evaluate, goto, wait } from './cdp.mjs';

const url = process.argv[2];
const font = process.argv[3];
const strings = process.argv.slice(4);
const cdp = await attach('9361');
await goto(cdp, url, 1500);
await wait(300);
const out = await evaluate(cdp, `(() => {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:pre;visibility:hidden';
  document.body.appendChild(probe);
  const res = {};
  const strings = ${JSON.stringify(strings)};
  const fonts = ${JSON.stringify([font])};
  for (const f of fonts) {
    probe.style.font = f;
    res[f] = strings.map((s) => { probe.textContent = s; return Math.round(probe.getBoundingClientRect().width * 100) / 100; });
  }
  probe.remove();
  return res;
})()`);
console.log(JSON.stringify(out, null, 2));
cdp.close();
