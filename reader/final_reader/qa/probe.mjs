// Load the fixture, report console errors and reader state, save a screenshot.
//   node probe.mjs <file-url> <out.png> [width] [height]
import { attach, evaluate, goto, shot, startConsoleCapture, viewport, wait } from './cdp.mjs';

const url = process.argv[2];
const out = process.argv[3];
const width = Number(process.argv[4] || 1400);
const height = Number(process.argv[5] || 1000);

const cdp = await attach('9361');
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
const problems = startConsoleCapture(cdp);
await viewport(cdp, width, height);
await goto(cdp, url, 2500);

const state = await evaluate(cdp, `(() => {
  const q = (s) => document.querySelector(s);
  const rows = document.querySelectorAll('#contents-nav .nav-child').length;
  const links = document.querySelectorAll('#contents-nav a[href^="#"]').length;
  return {
    title: document.title,
    theme: document.documentElement.getAttribute('data-theme'),
    appClasses: q('#b2-app') ? q('#b2-app').className : null,
    articles: document.querySelectorAll('.book-page').length,
    navRows: rows, navLinks: links,
    rail: !!q('#contents-rail'), header: !!q('#b2-topbar'), footer: !!q('#b2-bottombar'),
    toolbar: !!q('.toolbar'), modeSelect: !!q('#mode'), badge: !!q('.mode-badge'),
    counter: !!q('#counter'), rightAside: !!q('#reader-controls'),
    ui: !!window.book2ReaderUI, qa: typeof window.book2QA,
    uiRows: window.book2ReaderUI ? window.book2ReaderUI.rows() : null,
    refIndex: window.book2ReaderUI ? window.book2ReaderUI.refIndexSize() : null,
    locator: window.book2ReaderUI ? window.book2ReaderUI.locator() : null,
    mainH: q('main') ? q('main').clientHeight : null,
    bodyOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    qaFailures: typeof window.book2QA === 'function' ? window.book2QA().length : null,
    headingsRole: document.querySelectorAll('[role="heading"]').length,
    bodyFontPx: getComputedStyle(document.body).fontSize,
  };
})()`);

await wait(600);
await shot(cdp, out);
console.log(JSON.stringify({ state, problems }, null, 2));
cdp.close();
