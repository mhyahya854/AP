// Focused probe of the mobile header/drawer and the two restored frontmatter links.
import { attach, evaluate, goto, viewport, wait } from './cdp.mjs';

const url = process.argv[2];
const cdp = await attach('9361');
await viewport(cdp, 390, 844);
await goto(cdp, url, 4000);
await wait(600);

const out = await evaluate(cdp, `(() => {
  const box = (s) => { const e = document.querySelector(s); if (!e) return null;
    const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height),
             display: cs.display, vis: cs.visibility }; };
  const right = Array.from(document.querySelectorAll('.tb-right .tb-btn')).map((b) => ({
    id: b.id, w: Math.round(b.getBoundingClientRect().width), x: Math.round(b.getBoundingClientRect().left),
    display: getComputedStyle(b).display }));
  return {
    header: box('#b2-topbar'), left: box('.tb-left'), rightWrap: box('.tb-right'),
    menu: box('#menu-open'), back: box('#back-btn'), right,
    rail: box('#contents-rail'), railDisplay: getComputedStyle(document.querySelector('#contents-rail')).display,
    footer: box('#b2-bottombar'),
    links: { title: document.querySelectorAll('#contents-nav a[href="#TMP-0007"]').length,
             copyright: document.querySelectorAll('#contents-nav a[href="#TMP-0009"]').length,
             total: document.querySelectorAll('#contents-nav a[href^="#"]').length,
             unlinked: document.querySelectorAll('#contents-nav .nav-child:not(a)').length },
    hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`);
console.log('MOBILE', JSON.stringify(out, null, 1));

await viewport(cdp, 320, 720);
await wait(900);
const out2 = await evaluate(cdp, `(() => {
  const b = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect();
    return { x: Math.round(r.left), w: Math.round(r.width) }; };
  return { right: Array.from(document.querySelectorAll('.tb-right .tb-btn')).map((e) => ({ id: e.id, w: Math.round(e.getBoundingClientRect().width) })),
           rightWrap: b('.tb-right'), hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
           locator: document.getElementById('locator').textContent,
           footer: b('#b2-bottombar') };
})()`);
console.log('NARROW', JSON.stringify(out2, null, 1));

/* the two restored frontmatter links must land on their pages */
await viewport(cdp, 1400, 1000);
await wait(600);
const nav = await evaluate(cdp, `(async () => {
  const click = async (id) => {
    const a = document.querySelector('#contents-nav a[href="#' + id + '"]');
    if (!a) return { id, ok: false };
    a.click();
    await new Promise((r) => setTimeout(r, 1400));
    const t = document.getElementById(id);
    const tb = t.getBoundingClientRect();
    return { id, ok: true, hash: location.hash, top: Math.round(tb.top),
             visible: tb.bottom > 52 && tb.top < 950,
             active: (() => { const c = document.querySelector('#contents-nav [aria-current]');
                              return c ? c.textContent.replace(/\\s+/g, ' ').trim() : null; })(),
             locator: document.getElementById('locator').textContent };
  };
  return { title: await click('TMP-0007'), copyright: await click('TMP-0009') };
})()`);
console.log('FRONTMATTER LINKS', JSON.stringify(nav, null, 1));
cdp.close();
