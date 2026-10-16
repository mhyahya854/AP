// Report the geometry and computed backgrounds of the reader frame.
//   node geom.mjs <file-url> [width] [height]
import { attach, evaluate, goto, viewport, wait } from './cdp.mjs';

const url = process.argv[2];
const width = Number(process.argv[3] || 1400);
const height = Number(process.argv[4] || 1000);
const cdp = await attach('9361');
await viewport(cdp, width, height);
await goto(cdp, url, 2000);
await wait(400);

const info = await evaluate(cdp, `(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { sel, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width),
             h: Math.round(r.height), bg: cs.backgroundColor, pad: cs.padding,
             zoom: cs.zoom, display: cs.display, scrollW: el.scrollWidth, clientW: el.clientWidth };
  };
  return {
    root: { innerW: innerWidth, innerH: innerHeight },
    app: box('#b2-app'), header: box('#b2-topbar'), rail: box('#contents-rail'),
    main: box('main'), page1: box('#TMP-0001'), page7: box('#TMP-0007'),
    footer: box('#b2-bottombar'),
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    mainBg: getComputedStyle(document.querySelector('main')).backgroundColor,
    pageBg: getComputedStyle(document.querySelector('#TMP-0001')).backgroundColor,
    fitVar: getComputedStyle(document.documentElement).getPropertyValue('--fit-continuous'),
    textVar: getComputedStyle(document.documentElement).getPropertyValue('--b2-text'),
  };
})()`);
console.log(JSON.stringify(info, null, 2));
cdp.close();
