// Final release QA: all 155 Extended Description controls, measured with a
// visibility model that does not trust `details.open`.  Chrome keeps a layout
// box for the slotted content of a closed <details>, so a raw child rect says
// nothing; this test uses the details box, hit-testing at the panel centre and
// checkVisibility() on real text inside the panel.
//
//   node reader/release_qa_disclosures.mjs [port]
import { attach, evq, gate, outdir, save, jsErrors } from './qa_cdp.mjs';

const dir = outdir();
const cdp = await attach(process.argv[2] || '9356');
await cdp.send('Emulation.setDeviceMetricsOverride',
  { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
await gate(cdp, 'disclosure audit');

const data = await evq(cdp, `(async () => {
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const list = [...document.querySelectorAll('details.disclosure')];
  const rows = [];
  for (let i = 0; i < list.length; i += 1) {
    const d = list[i];
    const summary = d.querySelector(':scope > summary');
    const panel = d.querySelector(':scope > .desc-panel');
    const region = d.closest('.book-page');
    const bodyText = panel ? (panel.textContent || '').replace(/\\s+/g, ' ').trim() : '';
    const words = bodyText.split(/\\s+/).filter(Boolean).length;
    d.open = false;
    await sleep(30);
    const summRect = summary.getBoundingClientRect();
    const closedRect = d.getBoundingClientRect();
    const panClosed = panel.getBoundingClientRect();
    let hitClosed = null;
    if (panClosed.width > 2 && panClosed.height > 2) {
      const x = Math.max(1, Math.min(innerWidth - 1, Math.round(panClosed.left + Math.min(40, panClosed.width / 2))));
      const y = Math.max(1, Math.min(innerHeight - 1, Math.round(panClosed.top + Math.min(20, panClosed.height / 2))));
      const el = document.elementFromPoint(x, y);
      hitClosed = el ? (panel.contains(el) ? 'inside-panel' : (d.contains(el) ? 'inside-details' : el.tagName.toLowerCase())) : null;
    }
    const textHost = panel ? panel.querySelector('span, p') : null;
    const checkClosed = textHost && textHost.checkVisibility
      ? textHost.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })
      : null;
    const closedGeometry = {
      detailsH: Math.round(closedRect.height),
      summaryH: Math.round(summRect.height),
      panelBoxH: Math.round(panClosed.height),
      bodyNotContributing: closedRect.height <= summRect.height + 4,
      panelOutsideDetails: panClosed.top >= closedRect.bottom - 2,
      hitClosed: hitClosed,
      checkVisibilityClosed: checkClosed,
    };
    d.open = true;
    await sleep(30);
    const openRect = d.getBoundingClientRect();
    const panOpen = panel.getBoundingClientRect();
    let hitOpen = null;
    if (panOpen.width > 2 && panOpen.height > 2) {
      const x = Math.max(1, Math.min(innerWidth - 1, Math.round(panOpen.left + Math.min(40, panOpen.width / 2))));
      const y = Math.max(1, Math.min(innerHeight - 1, Math.round(panOpen.top + Math.min(14, panOpen.height / 2))));
      const el = document.elementFromPoint(x, y);
      hitOpen = el ? (panel.contains(el) ? 'inside-panel' : (d.contains(el) ? 'inside-details' : el.tagName.toLowerCase())) : null;
    }
    const checkOpen = textHost && textHost.checkVisibility
      ? textHost.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })
      : null;
    const openGeometry = {
      detailsH: Math.round(openRect.height),
      panelBoxH: Math.round(panOpen.height),
      bodyContributes: openRect.height >= summRect.height + Math.max(8, panOpen.height * 0.8),
      hitOpen: hitOpen,
      checkVisibilityOpen: checkOpen,
      overflowX: panel.scrollWidth > panel.clientWidth + 2,
    };
    d.open = false;
    await sleep(20);
    rows.push({
      i: i,
      id: d.id || null,
      region: region ? region.id : null,
      summary: summary ? (summary.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 90) : null,
      summaryCount: d.querySelectorAll(':scope > summary').length,
      panelClass: panel ? String(panel.className) : null,
      bodyChars: bodyText.length,
      bodyWords: words,
      bodyHead: bodyText.slice(0, 60),
      closedGeometry: closedGeometry,
      openGeometry: openGeometry,
      passes: closedGeometry.bodyNotContributing === true
        && closedGeometry.panelOutsideDetails === true
        && hitClosed !== 'inside-panel'
        && openGeometry.bodyContributes === true
        && (openGeometry.hitOpen === 'inside-panel' || openGeometry.hitOpen === 'inside-details')
        && openGeometry.overflowX === false
        && bodyText.length > 40,
    });
  }
  const failing = rows.filter((x) => !x.passes);
  return {
    schema: 'book2.release.disclosure_visibility.v1',
    total: rows.length,
    distinctRegions: new Set(rows.map((x) => x.region)).size,
    passing: rows.length - failing.length,
    failing: failing.map((x) => ({ i: x.i, region: x.region, summary: x.summary, bodyChars: x.bodyChars,
      closed: x.closedGeometry, open: x.openGeometry })),
    shortBodies: rows.filter((x) => x.bodyWords < 8).map((x) => ({ i: x.i, region: x.region,
      summary: x.summary, bodyWords: x.bodyWords, bodyHead: x.bodyHead })),
    wordStats: { min: Math.min(...rows.map((x) => x.bodyWords)), max: Math.max(...rows.map((x) => x.bodyWords)) },
    rows: rows,
  };
})()`, 1200000);

save('disclosure_visibility_audit.json', data, dir);
console.log(JSON.stringify({ total: data.total, passing: data.passing, failing: data.failing.length,
  shortBodies: data.shortBodies.length, wordStats: data.wordStats }, null, 1));
console.log('failing: ' + JSON.stringify(data.failing.slice(0, 4)));
console.log('short bodies: ' + JSON.stringify(data.shortBodies.slice(0, 8)));
console.log('js errors: ' + jsErrors(cdp).length);
process.exit(0);
