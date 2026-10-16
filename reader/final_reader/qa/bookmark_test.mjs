// Bookmarks: create, persist across a reload, and restore the exact location.
import { attach, evaluate, goto, viewport, wait } from './cdp.mjs';

const url = process.argv[2];
const cdp = await attach('9361');
await viewport(cdp, 1400, 1000);
await goto(cdp, url, 4000);
await evaluate(cdp, `(() => { try { localStorage.removeItem('book2.reader.v2'); } catch (e) {} })()`);

/* go to a verified deep heading, then bookmark it */
await evaluate(cdp, `window.book2ReaderUI.go('book-heading-0200')`);
await wait(1800);
await evaluate(cdp, `document.getElementById('bm-add').click()`);
await wait(400);
const afterAdd = await evaluate(cdp, `({ bms: window.book2ReaderUI.bookmarks(),
  hash: location.hash, pressed: document.getElementById('foot-bm').getAttribute('aria-pressed') })`);

/* navigate away, then reload the document and check the bookmark survived */
await evaluate(cdp, `window.book2ReaderUI.go('TMP-0001')`);
await wait(1200);
await goto(cdp, url, 4000);
const afterReload = await evaluate(cdp, `({ bms: window.book2ReaderUI.bookmarks(),
  stored: (() => { try { return JSON.parse(localStorage.getItem('book2.reader.v2')).bookmarks.length; }
                   catch (e) { return -1; } })(),
  rendered: document.querySelectorAll('#bm-list li').length })`);

/* open the saved bookmark and verify the landing */
await evaluate(cdp, `document.getElementById('bm-btn').click()`);
await wait(300);
await evaluate(cdp, `(() => { const b = document.querySelector('#bm-list li .pop-go'); if (b) b.click(); })()`);
await wait(1800);
const landed = await evaluate(cdp, `(() => {
  const t = document.getElementById('book-heading-0200');
  const b = t.getBoundingClientRect();
  return { hash: location.hash, top: Math.round(b.top), visible: b.top >= 52 && b.top < 950 };
})()`);

console.log(JSON.stringify({ afterAdd, afterReload, landed }, null, 1));
cdp.close();
