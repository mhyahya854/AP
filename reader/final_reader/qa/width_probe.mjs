import { attach, evaluate, goto, viewport, wait } from './cdp.mjs';
const cdp = await attach('9361');
await viewport(cdp, 390, 844);
await goto(cdp, process.argv[2], 4000);
await wait(1200);
for (const w of [390, 320, 768, 1400]) {
  await viewport(cdp, w, 900);
  await wait(1200);
  const r = await evaluate(cdp, `(() => {
    const g = (s) => { const e = document.querySelector(s); if (!e) return null;
      const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return [Math.round(b.width), cs.display, cs.gridTemplateColumns, cs.flex, cs.minWidth]; };
    return { inner: innerWidth, app: g('#b2-app'), header: g('#b2-topbar'),
             left: g('.tb-left'), right: g('.tb-right'), main: g('main'),
             footer: g('#b2-bottombar'), page: g('#TMP-0005'),
             fit: document.getElementById('b2-app').className,
             fitZoom: getComputedStyle(document.documentElement).getPropertyValue('--fit-continuous'),
             docScroll: document.documentElement.scrollWidth };
  })()`);
  console.log(w, JSON.stringify(r));
}
cdp.close();
