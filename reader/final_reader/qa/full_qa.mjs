// Full-book acceptance run for the redesigned reader.
//   node full_qa.mjs <file-url> <outdir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { attach, evaluate, goto, shot, startConsoleCapture, viewport, wait } from './cdp.mjs';

const url = process.argv[2];
const outdir = process.argv[3];
mkdirSync(join(outdir, 'screens'), { recursive: true });

const cdp = await attach('9361');
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
const problems = startConsoleCapture(cdp);

const report = { url, steps: [], screens: [], problems: [] };
const t0 = Date.now();
await viewport(cdp, 1400, 1000);
await goto(cdp, url, 4000);
report.load_ms = Date.now() - t0;
report.after_load = await evaluate(cdp, `(() => ({
  ready: document.readyState,
  regions: document.querySelectorAll('.book-page').length,
  rows: window.book2ReaderUI ? window.book2ReaderUI.rows() : null,
  refIndex: window.book2ReaderUI ? window.book2ReaderUI.refIndexSize() : null,
  role: document.querySelectorAll('[role="heading"]').length,
  unstyled: window.book2Wave ? window.book2Wave.unstyledHeadingsMarked : null,
  navLinks: document.querySelectorAll('#contents-nav a[href^="#"]').length,
  legacyToolbar: !!document.querySelector('.toolbar'),
  legacyMode: !!document.querySelector('#mode'),
  badge: !!document.querySelector('.mode-badge'),
  counter: !!document.querySelector('#counter'),
  rightAside: !!document.querySelector('#reader-controls'),
  appClass: document.getElementById('b2-app').className,
  bodyScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}))()`);

function log(name, value) { report.steps.push({ name, value }); }

async function ev(expr) { return evaluate(cdp, expr); }

/* 1. header / footer / rail geometry */
log('frame', await ev(`(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect();
    return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
  return { header: r('#b2-topbar'), rail: r('#contents-rail'), main: r('main'), footer: r('#b2-bottombar'),
           app: r('#b2-app'), panelVisible: !!document.querySelector('#contents-panel') &&
             getComputedStyle(document.querySelector('#contents-panel')).display !== 'none' };
})()`));

/* 2. search */
await ev(`document.getElementById('search-btn').click()`);
await wait(200);
log('search_open', await ev(`!document.getElementById('search-pop').hidden`));
await ev(`window.book2ReaderUI.search('Cotopaxi')`);
await wait(6000);
log('search_hits', await ev(`document.querySelectorAll('#search-hits li').length`));
log('search_status', await ev(`document.getElementById('search-status').textContent`));
await shot(cdp, join(outdir, 'screens', '05-search-panel.png'));
await ev(`(() => { const b = document.querySelector('#search-hits li button'); if (b) b.click(); })()`);
await wait(2500);
log('search_jump', await ev(`(() => ({ hash: location.hash, top: Math.round(document.querySelector('main').scrollTop) }))()`));
await ev(`document.getElementById('search-btn').click()`);
await wait(200);

/* 3. typography panel + themes */
await ev(`document.getElementById('type-btn').click()`);
await wait(200);
log('type_open', await ev(`!document.getElementById('type-pop').hidden`));
await shot(cdp, join(outdir, 'screens', '06-typography-panel.png'));
await ev(`document.getElementById('theme-dark').click()`);
await wait(2500);
log('dark', await ev(`document.documentElement.getAttribute('data-theme')`));
log('dark_stats', await ev(`window.book2Appearance()`));
await ev(`document.getElementById('theme-light').click()`);
await wait(2500);
log('light', await ev(`document.documentElement.getAttribute('data-theme')`));
await ev(`document.getElementById('type-btn').click()`);
await wait(200);

/* 4. bookmarks */
await ev(`document.getElementById('bm-btn').click()`);
await wait(200);
log('bm_open', await ev(`!document.getElementById('bm-pop').hidden`));
await ev(`document.getElementById('bm-add').click()`);
await wait(300);
log('bm_after_add', await ev(`window.book2ReaderUI.bookmarks()`));
await shot(cdp, join(outdir, 'screens', '07-bookmark-panel.png'));
await ev(`document.getElementById('bm-btn').click()`);
await wait(200);

/* 5. more menu */
await ev(`document.getElementById('more-btn').click()`);
await wait(200);
log('more_open', await ev(`!document.getElementById('more-pop').hidden`));
log('more_items', await ev(`document.querySelectorAll('#more-pop .menu-list button').length`));
await ev(`document.getElementById('more-btn').click()`);
await wait(200);

/* 6. contents panel */
await ev(`document.getElementById('rail-open').click()`);
await wait(1200);
log('panel_open', await ev(`(() => {
  const p = document.querySelector('#contents-panel');
  const b = p.getBoundingClientRect();
  return { cls: document.getElementById('b2-app').className, w: Math.round(b.width),
           railVisible: getComputedStyle(document.getElementById('contents-rail')).display !== 'none' };
})()`));
await shot(cdp, join(outdir, 'screens', '02-light-contents-open.png'));
await ev(`document.getElementById('nav-collapse').click()`);
await wait(200);
log('collapse_all', await ev(`document.querySelectorAll('#contents-nav details[open]').length`));
await ev(`document.getElementById('nav-expand').click()`);
await wait(200);
log('expand_all', await ev(`document.querySelectorAll('#contents-nav details[open]').length`));

/* 7. contents navigation to deep verified destinations */
const TARGETS = [
  ['frontmatter-a11y', 'book-heading-0002'],
  ['module-1-1', 'book-heading-0009'],
  ['deep-topic', 'book-heading-0200'],
  ['late-topic', 'book-heading-0370'],
  ['last-heading', 'book-heading-0383'],
  ['region-begin', 'TMP-0178'],
  ['cover', 'TMP-0001'],
];
const navResults = [];
for (const [name, id] of TARGETS) {
  const r = await ev(`(() => {
    const a = document.querySelector('#contents-nav a[href="#${id}"]');
    if (!a) return { missing: true };
    a.click();
    return { clicked: true };
  })()`);
  await wait(1600);
  const after = await ev(`(() => {
    const t = document.getElementById(${JSON.stringify(id)});
    const main = document.querySelector('main');
    const b = t.getBoundingClientRect();
    const hdr = document.getElementById('b2-topbar').getBoundingClientRect();
    const ftr = document.getElementById('b2-bottombar').getBoundingClientRect();
    return { hash: location.hash, top: Math.round(b.top), height: Math.round(b.height),
             headerBottom: Math.round(hdr.bottom), footerTop: Math.round(ftr.top),
             visible: b.bottom > hdr.bottom && b.top < ftr.top,
             active: (() => { const a = document.querySelector('#contents-nav .is-current, #contents-nav [aria-current]');
                              return a ? a.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60) : null; })(),
             locator: document.getElementById('locator').textContent };
  })()`);
  navResults.push({ name, id, ...r, ...after });
}
report.nav = navResults;

/* 8. progress + bookmarks after navigation */
log('progress', await ev(`(() => ({ text: document.getElementById('progress').getAttribute('aria-valuenow'),
  marker: document.getElementById('progress').style.getPropertyValue('--marker') }))()`));
await ev(`(() => { const m = document.querySelector('main'); m.scrollTop = Math.round((m.scrollHeight - m.clientHeight) * 0.5); })()`);
await wait(1500);
log('progress_mid', await ev(`document.getElementById('progress').getAttribute('aria-valuenow')`));
await shot(cdp, join(outdir, 'screens', '08-progress-deep.png'));

/* 9. prev / next */
await ev(`document.getElementById('loc-next').click()`);
await wait(1500);
log('next', await ev(`location.hash`));
await ev(`document.getElementById('loc-prev').click()`);
await wait(1500);
log('prev', await ev(`location.hash`));

/* 10. back to previous location */
log('history', await ev(`window.book2ReaderUI.history().slice(-4)`));
await ev(`document.getElementById('back-btn').click()`);
await wait(1500);
log('back_hash', await ev(`location.hash`));

/* 11. full-book qa helper */
log('qa_failures', await ev(`window.book2QA().length`));

report.problems = problems.slice(0, 30);
writeFileSync(join(outdir, 'full_qa.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
cdp.close();
