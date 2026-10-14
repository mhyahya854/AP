// Final release QA: keyboard activation, corrected.
//  - a visible Contents link + Enter must navigate
//  - Enter/Space on a <summary> is checked against a control <details> created
//    in the same page, so a harness artefact cannot be reported as a defect
//
//   node reader/release_qa_keys2.mjs [port]
import { attach, evq, gate, outdir, save, wait, jsErrors } from './qa_cdp.mjs';

const dir = outdir();
const cdp = await attach(process.argv[2] || '9356');
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
await gate(cdp, 'key audit 2');

const press = async (key, code, vk) => {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: key, code: code, windowsVirtualKeyCode: vk });
  await cdp.send('Input.dispatchKeyEvent', { type: 'char', key: key, text: key === 'Enter' ? '\r' : ' ',
    unmodifiedText: key === 'Enter' ? '\r' : ' ', windowsVirtualKeyCode: vk });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: key, code: code, windowsVirtualKeyCode: vk });
};

// 1. control <details>, so Enter/Space behaviour is measured against the browser,
//    not against this book.
const control = await evq(cdp, `(() => {
  const d = document.createElement('details');
  d.id = 'qa-control-details';
  const s = document.createElement('summary');
  s.textContent = 'QA control summary';
  const p = document.createElement('p');
  p.textContent = 'QA control body';
  d.appendChild(s);
  d.appendChild(p);
  document.body.appendChild(d);
  d.open = false;
  s.focus();
  return { focused: document.activeElement === s, open: d.open };
})()`);
await press('Enter', 'Enter', 13);
await wait(300);
control.afterEnter = await evq(cdp, "document.getElementById('qa-control-details').open");
await press(' ', 'Space', 32);
await wait(300);
control.afterSpace = await evq(cdp, "document.getElementById('qa-control-details').open");

// 2. the book's own disclosure, same keys.
const book = await evq(cdp, `(() => {
  const d = document.querySelector('details.disclosure');
  const s = d.querySelector('summary');
  s.scrollIntoView({ block: 'center' });
  d.open = false;
  s.focus();
  return { focused: document.activeElement === s, open: d.open };
})()`);
await press('Enter', 'Enter', 13);
await wait(400);
book.afterEnter = await evq(cdp, "(() => { const d = document.querySelector('details.disclosure'); return { open: d.open, h: Math.round(d.getBoundingClientRect().height) }; })()");
await press(' ', 'Space', 32);
await wait(400);
book.afterSpace = await evq(cdp, "(() => { const d = document.querySelector('details.disclosure'); return { open: d.open, h: Math.round(d.getBoundingClientRect().height) }; })()");
await evq(cdp, "(() => { document.querySelector('details.disclosure').open = false; })()");

// 3. a visible Contents link activated with Enter.
const link = await evq(cdp, `(() => {
  const panel = document.querySelector('#contents-panel');
  if (panel.getBoundingClientRect().width < 20) {
    document.querySelector('#left-toggle').click();
  }
  return { openedDrawer: panel.getBoundingClientRect().width < 20 };
})()`);
await wait(700);
const linkPress = await evq(cdp, `(() => {
  const links = [...document.querySelectorAll('#contents-nav a[href^="#book-heading-"]')];
  const visible = links.filter((a) => a.offsetParent !== null && a.getBoundingClientRect().width > 0);
  const a = visible[8] || links[0];
  a.focus();
  return { href: a.getAttribute('href'), focused: document.activeElement === a, visibleCount: visible.length };
})()`);
Object.assign(link, linkPress);
await press('Enter', 'Enter', 13);
await wait(2400);
link.afterEnter = await evq(cdp, `(() => {
  const hash = location.hash;
  const el = document.getElementById(hash.slice(1));
  const tb = document.querySelector('main > .toolbar').getBoundingClientRect();
  const r = el ? el.getBoundingClientRect() : null;
  const active = document.querySelector('#contents-nav .nav-child[aria-current], #contents-nav .nav-child.is-current');
  return { hash: hash, gap: r ? Math.round(r.top - tb.bottom) : null,
    belowToolbar: !!(r && r.top >= tb.bottom - 1), active: active ? active.getAttribute('href') : null };
})()`);

await evq(cdp, "(() => { const d = document.getElementById('qa-control-details'); if (d) d.remove(); })()");
save('keyboard_activation_audit.json', { controlDetails: control, bookDisclosure: book, contentsLink: link }, dir);
console.log(JSON.stringify({ controlDetails: control, bookDisclosure: book, contentsLink: link }, null, 1));
console.log('js errors: ' + jsErrors(cdp).length);
process.exit(0);
