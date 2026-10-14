// Final release QA: real key events, focus indicators, and per-region text
// coverage (which regions carry little or no reconstructed text).
//
//   node reader/release_qa_focus.mjs [port]
import { attach, evq, gate, outdir, save, wait, jsErrors } from './qa_cdp.mjs';

const dir = outdir();
const cdp = await attach(process.argv[2] || '9356');
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
await gate(cdp, 'focus audit');

const styleOf = `(() => {
  const el = document.activeElement;
  if (!el) return null;
  const cs = getComputedStyle(el);
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    cls: String(el.className).slice(0, 40),
    focusVisible: el.matches ? el.matches(':focus-visible') : null,
    outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor,
    boxShadow: cs.boxShadow === 'none' ? null : cs.boxShadow.slice(0, 60),
    text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 30),
  };
})()`;

await evq(cdp, "document.body.click()");
await wait(200);
const tabWalk = [];
for (let i = 0; i < 14; i++) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await wait(130);
  tabWalk.push(await evq(cdp, styleOf));
}

const disclosureKey = await evq(cdp, `(() => {
  const d = document.querySelector('details.disclosure');
  const sum = d.querySelector('summary');
  sum.scrollIntoView({ block: 'center' });
  sum.focus();
  d.open = false;
  return { before: { open: d.open, h: Math.round(d.getBoundingClientRect().height) } };
})()`);
await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await wait(500);
disclosureKey.afterEnter = await evq(cdp, "(() => { const d = document.querySelector('details.disclosure'); return { open: d.open, h: Math.round(d.getBoundingClientRect().height) }; })()");
await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
await wait(500);
disclosureKey.afterSpace = await evq(cdp, "(() => { const d = document.querySelector('details.disclosure'); return { open: d.open, h: Math.round(d.getBoundingClientRect().height) }; })()");
await evq(cdp, "(() => { document.querySelector('details.disclosure').open = false; })()");

const navKey = await evq(cdp, `(() => {
  const a = document.querySelectorAll('#contents-nav a[href^="#book-heading-"]')[5];
  a.focus();
  return { href: a.getAttribute('href'), focused: document.activeElement === a };
})()`);
await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
await wait(2200);
navKey.afterEnter = await evq(cdp, "(() => { const el = document.getElementById(location.hash.slice(1)); const tb = document.querySelector('main > .toolbar').getBoundingClientRect(); const r = el ? el.getBoundingClientRect() : null; return { hash: location.hash, gap: r ? Math.round(r.top - tb.bottom) : null, belowToolbar: !!(r && r.top >= tb.bottom - 1) }; })()");

const coverage = await evq(cdp, `(() => {
  const rows = [...document.querySelectorAll('.book-page')].map((p) => {
    const text = (p.textContent || '').replace(/\\s+/g, ' ').trim();
    return { id: p.id, chars: text.length, imgs: p.querySelectorAll('img').length,
      tables: p.querySelectorAll('table').length, navLabel: p.getAttribute('data-nav-label'),
      group: p.getAttribute('data-group-title') };
  });
  const buckets = { zero: 0, under120: 0, under1000: 0, under5000: 0, over5000: 0 };
  rows.forEach((r) => {
    if (r.chars === 0) buckets.zero += 1;
    else if (r.chars < 120) buckets.under120 += 1;
    else if (r.chars < 1000) buckets.under1000 += 1;
    else if (r.chars < 5000) buckets.under5000 += 1;
    else buckets.over5000 += 1;
  });
  return {
    regions: rows.length,
    totalChars: rows.reduce((n, r) => n + r.chars, 0),
    buckets: buckets,
    emptyRegions: rows.filter((r) => r.chars === 0).map((r) => r.id),
    thinRegions: rows.filter((r) => r.chars > 0 && r.chars < 120).map((r) => ({ id: r.id, chars: r.chars, label: r.navLabel, group: r.group })),
    regionsWithoutImage: rows.filter((r) => r.imgs === 0).length,
    regionsWithImage: rows.filter((r) => r.imgs > 0).length,
    allRows: rows,
  };
})()`, 600000);

save('keyboard_focus_audit.json', { tabWalk: tabWalk, disclosureKey: disclosureKey, navKey: navKey }, dir);
save('content_coverage.json', coverage, dir);
tabWalk.forEach((t, i) => console.log('  tab ' + i + ': ' + (t ? (t.tag + (t.id ? '#' + t.id : ''))
  + ' focusVisible=' + t.focusVisible + ' outline=' + t.outline + ' shadow=' + (t.boxShadow || 'none') : 'null')));
console.log('disclosure keys: ' + JSON.stringify(disclosureKey));
console.log('nav key: ' + JSON.stringify(navKey));
console.log('coverage: ' + JSON.stringify({ regions: coverage.regions, totalChars: coverage.totalChars,
  buckets: coverage.buckets, empty: coverage.emptyRegions.length, thin: coverage.thinRegions.length,
  noImage: coverage.regionsWithoutImage, withImage: coverage.regionsWithImage }));
console.log('js errors: ' + jsErrors(cdp).length);
process.exit(0);
