/* ======================================================================
   Book 2 final reader — application layer (2026-10-16)

   Replaces the previous toolbar/sidebar/mode scripts.  Continuous reading
   only: the 1,899 verified source regions are never hidden, reordered or
   rewritten, every `#book-heading-nnnn` / `#TMP-nnnn` / `#book-group-nn`
   anchor keeps working, and the Contents rail is the same verified markup.
   ====================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var app = doc.getElementById('b2-app');
  var main = doc.getElementById('reader-main') || doc.querySelector('main');
  var panel = doc.getElementById('contents-panel');
  var nav = doc.getElementById('contents-nav');
  if (!app || !main || !nav) { return; }

  var pageEls = Array.prototype.slice.call(doc.querySelectorAll('.book-page'));
  var SKEY = 'book2.reader.v2';
  var OLDKEY = 'book2.reader.v1';
  var LEADING = { compact: '1.15', normal: '1.35', relaxed: '1.7' };
  var DEFAULTS = { theme: 'light', font: 'original', size: 100, spacing: 'normal',
                   panel: 'closed', bookmarks: [] };
  var prefs = Object.assign({}, DEFAULTS);
  try {
    var rawV2 = localStorage.getItem(SKEY);
    if (rawV2) { prefs = Object.assign(prefs, JSON.parse(rawV2)); }
    else {
      var rawV1 = localStorage.getItem(OLDKEY);
      if (rawV1) {
        var old = JSON.parse(rawV1);
        if (old.theme) { prefs.theme = old.theme; }
        if (old.font) { prefs.font = old.font; }
        if (typeof old.size === 'number') { prefs.size = old.size; }
        if (old.spacing) { prefs.spacing = old.spacing; }
      }
    }
  } catch (e) { /* storage unavailable: run with defaults */ }
  if (!Array.isArray(prefs.bookmarks)) { prefs.bookmarks = []; }
  function save() { try { localStorage.setItem(SKEY, JSON.stringify(prefs)); } catch (e) {} }

  function $(id) { return doc.getElementById(id); }
  function narrow() { return window.innerWidth <= 900; }

  /* ------------------------------------------------------------ geometry -- */
  var PAGE_PX = 793.7;          /* 210 mm at 96 dpi */
  var MIN_READABLE = 620;
  function availWidth() {
    var cs = window.getComputedStyle(main);
    var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    return Math.max(0, main.clientWidth - pad - 2);
  }
  function computeFit() {
    var w = availWidth();
    var fit = Math.min(1, w / PAGE_PX);
    root.style.setProperty('--fit-continuous', fit.toFixed(4));
    app.classList.toggle('fit-reflow', w < MIN_READABLE);
  }
  function readingTop() { return 12; }   /* comfortable gap under the header */
  function mainTop() { return main.getBoundingClientRect().top; }

  /* --------------------------------------------------------- preferences -- */
  function applyTypography() {
    root.style.setProperty('--reader-leading', LEADING[prefs.spacing] || LEADING.normal);
    root.style.setProperty('--b2-text', String((prefs.size || 100) / 100));
    if (prefs.font && prefs.font !== 'original') { app.setAttribute('data-font', prefs.font); }
    else { app.removeAttribute('data-font'); }
    var sv = $('size-val'); if (sv) { sv.textContent = (prefs.size || 100) + '%'; }
    var sl = $('size'); if (sl && String(sl.value) !== String(prefs.size)) { sl.value = String(prefs.size); }
    var f = $('font'); if (f && f.value !== (prefs.font || 'original')) { f.value = prefs.font || 'original'; }
    var sp = $('spacing'); if (sp && sp.value !== (prefs.spacing || 'normal')) { sp.value = prefs.spacing || 'normal'; }
  }

  /* --------------------------------------------------------------- theme -- */
  var themeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var DARK_SKIP = 'img,svg,figure.b2-source-figure,.mobile-diagram-scroll,'
    + '.swot-0605,.source-composition-0542,.source-composition-0678,'
    + '.source-composition-0776,.source-composition-0783,'
    + '.source-composition-0837,.source-composition-0844';
  var NAMED = { black: '#000000', white: '#ffffff', gray: '#808080', grey: '#808080',
    silver: '#c0c0c0', dimgray: '#696969', dimgrey: '#696969', maroon: '#800000',
    red: '#ff0000', navy: '#000080', blue: '#0000ff', teal: '#008080', green: '#008000',
    purple: '#800080', olive: '#808000', fuchsia: '#ff00ff', magenta: '#ff00ff',
    aqua: '#00ffff', cyan: '#00ffff', lime: '#00ff00', yellow: '#ffff00' };
  var STYLE_COLOR_RE = /(^|[;{])(\s*)(color|background|background-color)(\s*:\s*)(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})/g;
  function hexToRgb(hex) {
    var h = hex.slice(1);
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    if (h.length === 8) { h = h.slice(0, 6); }
    if (h.length !== 6 || !/^[0-9a-f]{6}$/.test(h)) { return null; }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) {
      s = (l > 0.5) ? d / (2 - max - min) : d / (max + min);
      if (max === r) { h = (g - b) / d + (g < b ? 6 : 0); }
      else if (max === g) { h = (b - r) / d + 2; }
      else { h = (r - g) / d + 4; }
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    var q = (l < 0.5) ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    function ch(t) {
      if (t < 0) { t += 1; }
      if (t > 1) { t -= 1; }
      if (t < 1 / 6) { return p + (q - p) * 6 * t; }
      if (t < 1 / 2) { return q; }
      if (t < 2 / 3) { return p + (q - p) * (2 / 3 - t) * 6; }
      return p;
    }
    function hx(x) { var v = Math.round(x * 255); return (v < 16 ? '0' : '') + v.toString(16); }
    var r, g, b;
    if (!s) { r = g = b = l; } else { r = ch(h + 1 / 3); g = ch(h); b = ch(h - 1 / 3); }
    return '#' + hx(r) + hx(g) + hx(b);
  }
  function darkColor(value, isBackground) {
    var v = String(value).trim().toLowerCase();
    if (NAMED[v]) { v = NAMED[v]; }
    if (v.charAt(0) !== '#') { return null; }
    var rgb = hexToRgb(v);
    if (!rgb) { return null; }
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]), l = hsl[2];
    if (isBackground) {
      if (l <= 0.45) { return null; }
      l = Math.max(0.10, Math.min(0.40, 1 - l));
    } else {
      if (l >= 0.86) { return null; }
      l = Math.max(0.60, Math.min(0.94, 1 - l));
    }
    var out = hslToHex(hsl[0], hsl[1], l);
    return (out === v) ? null : out;
  }
  function darkStyleString(style) {
    var changed = false;
    var out = style.replace(STYLE_COLOR_RE, function (whole, lead, space, prop, colon, value) {
      var mapped = darkColor(value, prop !== 'color');
      if (!mapped) { return whole; }
      changed = true;
      return lead + space + prop + colon + mapped;
    });
    return changed ? out : null;
  }
  function writeStyleAttr(el, style) {
    var display = el.style.display;
    el.setAttribute('style', style);
    if (display) { el.style.display = display; }
  }
  var styledNodes = null, styledLight = null, styledDark = null;
  var themeStats = { mapped: 0, build_ms: 0, apply_ms: 0 };
  function buildStyledIndex() {
    var t0 = performance.now();
    styledNodes = []; styledLight = []; styledDark = [];
    var all = main.querySelectorAll('[style]');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest && el.closest(DARK_SKIP)) { continue; }
      var s = el.getAttribute('style');
      if (!s) { continue; }
      var dark = darkStyleString(s);
      if (!dark) { continue; }
      styledNodes.push(el); styledLight.push(s); styledDark.push(dark);
    }
    themeStats.build_ms = Math.round((performance.now() - t0) * 10) / 10;
    themeStats.mapped = styledNodes.length;
  }
  var themeApplied = null;
  function applyThemeMode(mode) {
    var t0 = performance.now();
    root.setAttribute('data-theme', mode);
    if (mode === 'dark') {
      if (styledNodes === null) { buildStyledIndex(); }
      for (var i = 0; i < styledNodes.length; i++) { writeStyleAttr(styledNodes[i], styledDark[i]); }
    } else if (styledNodes) {
      for (var j = 0; j < styledNodes.length; j++) { writeStyleAttr(styledNodes[j], styledLight[j]); }
    }
    themeStats.apply_ms = Math.round((performance.now() - t0) * 10) / 10;
  }
  function resolvedTheme() {
    var c = prefs.theme || 'light';
    if (c === 'system') { return (themeQuery && themeQuery.matches) ? 'dark' : 'light'; }
    return (c === 'dark') ? 'dark' : 'light';
  }
  function applyTheme() {
    var mode = resolvedTheme();
    if (mode !== themeApplied) { themeApplied = mode; applyThemeMode(mode); }
    ['light', 'dark', 'system'].forEach(function (t) {
      var b = $('theme-' + t);
      if (b) { b.setAttribute('aria-pressed', String((prefs.theme || 'light') === t)); }
    });
    var st = $('type-status');
    if (st) {
      st.textContent = (prefs.theme === 'system')
        ? ('Following this device: ' + mode + ' mode.')
        : '';
    }
  }
  if (themeQuery) {
    var onScheme = function () { if ((prefs.theme || 'light') === 'system') { applyTheme(); } };
    if (themeQuery.addEventListener) { themeQuery.addEventListener('change', onScheme); }
    else if (themeQuery.addListener) { themeQuery.addListener(onScheme); }
  }

  /* ------------------------------------------------------------- panels --- */
  function syncPanelButtons() {
    var open = app.classList.contains('panel-open');
    ['rail-open', 'menu-open'].forEach(function (id) {
      var b = $(id); if (b) { b.setAttribute('aria-expanded', String(open)); }
    });
    var c = $('panel-close'); if (c) { c.setAttribute('aria-expanded', String(open)); }
  }
  function setPanel(open, opts) {
    opts = opts || {};
    var pos = capturePosition();
    if (narrow()) {
      app.classList.toggle('drawer-open', !!open);
      app.classList.remove('panel-open');
      var sc = $('scrim'); if (sc) { sc.hidden = !open; }
    } else {
      app.classList.toggle('panel-open', !!open);
      app.classList.remove('drawer-open');
      var sc2 = $('scrim'); if (sc2) { sc2.hidden = true; }
      if (opts.persist !== false) { prefs.panel = open ? 'open' : 'closed'; save(); }
    }
    syncPanelButtons();
    window.requestAnimationFrame(function () {
      computeFit();
      restorePosition(pos);
    });
  }
  function capturePosition() {
    if (!pageEls.length) { return null; }
    var top = main.getBoundingClientRect().top + readingTop();
    var i = -1;
    for (var k = 0; k < pageEls.length; k++) {
      var b = pageEls[k].getBoundingClientRect();
      if (b.height > 0 && b.width > 0 && b.top <= top + 1) { i = k; }
    }
    if (i < 0) { return null; }
    var r = pageEls[i].getBoundingClientRect();
    if (!(r.height > 0)) { return null; }
    var f = Math.max(0, Math.min(1, (top - r.top) / r.height));
    return { i: i, f: f, y: r.top + f * r.height };
  }
  function restorePosition(pos) {
    if (!pos || !pageEls[pos.i]) { return; }
    var r = pageEls[pos.i].getBoundingClientRect();
    if (!(r.height > 0)) { return; }
    var y = r.top + (typeof pos.f === 'number' ? pos.f : 0) * r.height;
    if (Math.abs(y - pos.y) > 0.5) { main.scrollTop = main.scrollTop + (y - pos.y); }
  }

  /* ------------------------------------------------------------ popovers -- */
  var POPOVER_BTN = { 'search-pop': 'search-btn', 'type-pop': 'type-btn',
                      'bm-pop': 'bm-btn', 'more-pop': 'more-btn' };
  function closePopovers(except) {
    Object.keys(POPOVER_BTN).forEach(function (id) {
      if (id === except) { return; }
      var p = $(id); if (!p || p.hidden) { return; }
      p.hidden = true;
      var b = $(POPOVER_BTN[id]); if (b) { b.setAttribute('aria-expanded', 'false'); }
    });
  }
  function togglePopover(id) {
    var p = $(id); if (!p) { return; }
    var willOpen = p.hidden;
    closePopovers(willOpen ? id : null);
    p.hidden = !willOpen;
    var b = $(POPOVER_BTN[id]); if (b) { b.setAttribute('aria-expanded', String(willOpen)); }
    if (willOpen) {
      var focusable = p.querySelector('input,select,button');
      if (focusable) { focusable.focus(); }
    }
  }
  Object.keys(POPOVER_BTN).forEach(function (pid) {
    var b = $(POPOVER_BTN[pid]);
    if (b) { b.addEventListener('click', function () { togglePopover(pid); }); }
    var p = $(pid);
    if (p) {
      p.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); closePopovers(null); b && b.focus(); }
      });
    }
  });
  doc.addEventListener('pointerdown', function (e) {
    var t = e.target;
    if (!t || !t.closest) { return; }
    if (t.closest('.popover') || t.closest('.tb-right')) { return; }
    closePopovers(null);
  }, true);

  /* --------------------------------------------------------------- rail --- */
  var railOpen = $('rail-open'), menuOpen = $('menu-open'), panelClose = $('panel-close'), scrim = $('scrim');
  if (railOpen) { railOpen.addEventListener('click', function () { setPanel(true); }); }
  if (menuOpen) { menuOpen.addEventListener('click', function () { setPanel(true); }); }
  if (panelClose) { panelClose.addEventListener('click', function () { setPanel(false); if (narrow() && menuOpen) { menuOpen.focus(); } else if (railOpen) { railOpen.focus(); } }); }
  if (scrim) { scrim.addEventListener('click', function () { setPanel(false); }); }

  /* -------------------------------------------------------- active state -- */
  var navRows = [];
  function collectRows() {
    navRows = [];
    var seen = {};
    var anchors = nav.querySelectorAll('a[href^="#"]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var id = decodeHash(a.getAttribute('href').slice(1));
      var el = id ? doc.getElementById(id) : null;
      if (!el) { continue; }
      var region = regionIndex(el);
      if (region < 0) { continue; }
      var labelEl = a.querySelector('.nav-page');
      var row = a.closest('.nav-child') || a;
      navRows.push({ a: a, row: row, id: id, el: el, region: region,
                     label: labelEl ? labelEl.textContent.trim() : '' });
      seen[id] = true;
    }
    navRows.sort(function (x, y) {
      if (x.region !== y.region) { return x.region - y.region; }
      return docPosition(x.el) - docPosition(y.el);
    });
  }
  function regionIndex(el) {
    var p = el && el.closest ? el.closest('.book-page') : null;
    return p ? pageEls.indexOf(p) : -1;
  }
  function docPosition(el) {
    var r = el.getBoundingClientRect();
    return r.top + main.scrollTop;
  }
  var pinned = null, marking = false;
  function markActive(row) {
    marking = true;
    for (var i = 0; i < navRows.length; i++) {
      navRows[i].row.classList.remove('is-current');
      navRows[i].row.removeAttribute('aria-current');
    }
    if (row) {
      row.classList.add('is-current');
      row.setAttribute('aria-current', 'true');
      openAncestors(row);
      railReveal(row);
    }
    marking = false;
  }
  function openAncestors(el) {
    var d = el && el.closest ? el.closest('details') : null;
    while (d) {
      if (!d.open) { d.open = true; }
      var p = d.parentElement;
      d = (p && p.closest) ? p.closest('details') : null;
    }
  }
  function railReveal(el) {
    var rb = nav.getBoundingClientRect(), cb = el.getBoundingClientRect();
    if (cb.top < rb.top + 4 || cb.bottom > rb.bottom - 4) {
      try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { el.scrollIntoView(); }
    }
  }

  /* --------------------------------------------------- scroll position ---- */
  function topRegionIndex() {
    var top = main.getBoundingClientRect().top + readingTop();
    var lo = 0, hi = pageEls.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (pageEls[mid].getBoundingClientRect().top <= top + 1) { lo = mid + 1; } else { hi = mid; }
    }
    return Math.max(0, lo - 1);
  }
  var lastRegion = -1, rafId = 0, held = false, holdTimer = 0;
  function queueSync() { if (!rafId) { rafId = window.requestAnimationFrame(sync); } }
  function sync() {
    rafId = 0;
    if (held || !pageEls.length) { return; }
    var i = topRegionIndex();
    updateProgress();
    if (i !== lastRegion) { lastRegion = i; if (!pinned) { markActiveRowForRegion(i); } }
    if (!pinned) { updateLocator(i); }
  }
  function markActiveRowForRegion(i) {
    var best = null;
    for (var k = 0; k < navRows.length; k++) {
      if (navRows[k].region <= i) { best = navRows[k]; } else { break; }
    }
    markActive(best ? best.row : null);
  }
  function holdSync() {
    held = true;
    window.clearTimeout(holdTimer);
    holdTimer = window.setTimeout(function () { held = false; queueSync(); }, 900);
  }
  main.addEventListener('scroll', queueSync, { passive: true });
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (ev) {
    main.addEventListener(ev, function () { pinned = null; held = false; }, { passive: true });
  });

  /* ---------------------------------------------------------- progress --- */
  var progressEl = $('progress'), fillEl = $('progress-fill');
  var lastPct = -1;
  function progressPct() {
    var max = main.scrollHeight - main.clientHeight;
    return max <= 0 ? 0 : Math.max(0, Math.min(100, (main.scrollTop / max) * 100));
  }
  function updateProgress() {
    var pct = progressPct();
    if (Math.abs(pct - lastPct) < 0.05) { return; }
    lastPct = pct;
    if (fillEl) { fillEl.style.width = pct.toFixed(2) + '%'; }
    if (progressEl) {
      progressEl.setAttribute('aria-valuenow', String(Math.round(pct)));
      progressEl.setAttribute('aria-valuetext', Math.round(pct) + ' percent through the book');
      progressEl.style.setProperty('--marker', pct.toFixed(2) + '%');
    }
  }
  function seekToFraction(f) {
    var max = main.scrollHeight - main.clientHeight;
    main.scrollTop = Math.max(0, Math.min(max, f * max));
    queueSync();
  }
  if (progressEl) {
    var dragging = false;
    function fracFromEvent(e) {
      var r = progressEl.getBoundingClientRect();
      return (e.clientX - r.left) / Math.max(1, r.width);
    }
    progressEl.addEventListener('pointerdown', function (e) {
      dragging = true;
      if (progressEl.setPointerCapture) { try { progressEl.setPointerCapture(e.pointerId); } catch (err) {} }
      pinned = null; held = false;
      seekToFraction(Math.max(0, Math.min(1, fracFromEvent(e))));
    });
    progressEl.addEventListener('pointermove', function (e) {
      if (dragging) { seekToFraction(Math.max(0, Math.min(1, fracFromEvent(e)))); }
    });
    progressEl.addEventListener('pointerup', function () { dragging = false; });
    progressEl.addEventListener('pointercancel', function () { dragging = false; });
    progressEl.addEventListener('click', function (e) {
      pinned = null; held = false;
      seekToFraction(Math.max(0, Math.min(1, fracFromEvent(e))));
    });
    progressEl.addEventListener('keydown', function (e) {
      var step = (e.key === 'PageUp' || e.key === 'PageDown') ? 0.1 : 0.02;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); seekToFraction(progressPct() / 100 + step); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); seekToFraction(progressPct() / 100 - step); }
      else if (e.key === 'Home') { e.preventDefault(); seekToFraction(0); }
      else if (e.key === 'End') { e.preventDefault(); seekToFraction(1); }
    });
  }

  /* ------------------------------------------------------------ locator --- */
  var locatorEl = $('locator');
  var refIndex = null;
  function buildRefIndex() {
    refIndex = [];
    for (var i = 0; i < navRows.length; i++) {
      var r = navRows[i];
      if (!r.label) { continue; }
      refIndex.push({ region: r.region, pos: docPosition(r.el), id: r.id, label: r.label, el: r.el });
    }
    refIndex.sort(function (a, b) { return a.pos - b.pos; });
  }
  function nearestRef(region) {
    if (!refIndex || !refIndex.length) { return null; }
    var top = main.scrollTop + readingTop() + 1;
    var lo = 0, hi = refIndex.length;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (refIndex[mid].pos <= top) { lo = mid + 1; } else { hi = mid; }
    }
    var best = null;
    for (var k = Math.max(0, lo - 1); k >= 0 && k > lo - 4; k--) {
      if (refIndex[k].region <= region) { best = refIndex[k]; break; }
    }
    return best;
  }
  function updateLocator(region) {
    if (!locatorEl) { return; }
    var ref = nearestRef(region);
    if (ref) {
      locatorEl.textContent = ref.label;
      locatorEl.setAttribute('data-kind', 'printed');
      locatorEl.setAttribute('title', 'Nearest verified printed reference: ' + ref.label + ' — ' + rowTitle(ref.el));
      locatorEl.setAttribute('data-ref', ref.id);
    } else {
      locatorEl.textContent = '—';
      locatorEl.setAttribute('data-kind', 'unknown');
      locatorEl.setAttribute('title', 'No verified printed reference above this position.');
      locatorEl.removeAttribute('data-ref');
    }
  }
  function rowTitle(el) {
    var p = el && el.closest ? el.closest('.book-page') : null;
    return p ? (p.getAttribute('data-nav-label') || p.id) : '';
  }
  if (locatorEl) {
    locatorEl.addEventListener('click', function () {
      var id = locatorEl.getAttribute('data-ref');
      if (id) { landOn(id); }
    });
    locatorEl.style.cursor = 'pointer';
    locatorEl.setAttribute('role', 'button');
    locatorEl.setAttribute('tabindex', '0');
    locatorEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var id = locatorEl.getAttribute('data-ref');
        if (id) { landOn(id); }
      }
    });
  }

  /* ------------------------------------------------------------ history --- */
  var history = [];
  var MAXH = 40;
  function currentAnchor() {
    if (location.hash) { return decodeHash(location.hash.slice(1)); }
    var i = lastRegion >= 0 ? lastRegion : topRegionIndex();
    var p = pageEls[i];
    return p ? p.id : '';
  }
  function pushHistory() {
    var id = currentAnchor();
    if (!id) { return; }
    if (history.length && history[history.length - 1] === id) { return; }
    history.push(id);
    if (history.length > MAXH) { history.shift(); }
    syncHistoryUI();
  }
  function syncHistoryUI() {
    var back = $('back-btn'), chip = $('history-chip');
    var has = history.length > 1;
    if (back) {
      back.disabled = !has;
      if (has) { back.title = 'Back to: ' + (rowLabelFor(history[history.length - 2]) || history[history.length - 2]); }
      else { back.title = 'No earlier reading location yet'; }
    }
    if (chip) { chip.classList.toggle('is-shown', has); }
  }
  function rowLabelFor(id) {
    for (var i = 0; i < navRows.length; i++) { if (navRows[i].id === id) { return navRows[i].row.textContent.trim(); } }
    return '';
  }
  function goBack() {
    if (history.length < 2) { return; }
    var here = currentAnchor();
    var target = null;
    while (history.length > 1) {
      var prev = history.pop();
      if (prev !== here && prev !== target) { target = prev; break; }
    }
    if (!target) { syncHistoryUI(); return; }
    landOn(target, { silentHistory: true });
    syncHistoryUI();
  }
  var backBtn = $('back-btn');
  if (backBtn) { backBtn.addEventListener('click', goBack); }
  var chipBtn = $('history-chip');
  if (chipBtn) { chipBtn.addEventListener('click', goBack); }

  /* ------------------------------------------------------------ landing --- */
  function decodeHash(raw) { try { return decodeURIComponent(raw); } catch (e) { return raw; } }
  function exactScroll(el) {
    if (!el) { return; }
    main.scrollTop = main.scrollTop + el.getBoundingClientRect().top
      - (main.getBoundingClientRect().top + readingTop());
  }
  function landOn(id, opts) {
    opts = opts || {};
    var el = id ? doc.getElementById(id) : null;
    if (!el) { return false; }
    if (!opts.silentHistory) { pushHistory(); }
    var row = null;
    for (var i = 0; i < navRows.length; i++) { if (navRows[i].id === id) { row = navRows[i]; break; } }
    exactScroll(el);
    settle(el);
    if (row) {
      pinned = { row: row.row, until: Date.now() + 30000 };
      markActive(row.row);
      lastRegion = row.region;
      updateLocator(row.region);
    }
    var cur = currentAnchor();
    if (cur !== id) { try { history.replaceState(null, '', '#' + encodeURIComponent(id)); } catch (e) { location.hash = id; } }
    return true;
  }
  function settle(el) {
    var n = 0;
    (function step() {
      if (n++ > 3) { return; }
      window.requestAnimationFrame(function () {
        if (pinned === null) { return; }
        exactScroll(el);
        step();
      });
    })();
  }
  function hashFromLink(a) {
    var h = a.getAttribute('href') || '';
    return h.charAt(0) === '#' ? decodeHash(h.slice(1)) : '';
  }
  nav.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a || !nav.contains(a)) { return; }
    var id = hashFromLink(a);
    var el = id ? doc.getElementById(id) : null;
    if (a.closest('summary')) { e.preventDefault(); }
    if (!el) { return; }
    pushHistory();
    pinned = null;
    landOn(id, { silentHistory: true });
    if (narrow()) { setPanel(false); }
  }, true);
  window.addEventListener('hashchange', function () {
    if (!location.hash) { return; }
    pinned = null;
    landOn(decodeHash(location.hash.slice(1)), { silentHistory: true });
  });
  window.addEventListener('popstate', function () {
    if (!location.hash) { return; }
    pinned = null;
    landOn(decodeHash(location.hash.slice(1)), { silentHistory: true });
  });

  /* ------------------------------------------------- expand / collapse --- */
  var ex = $('nav-expand'), col = $('nav-collapse');
  if (ex) { ex.addEventListener('click', function () { setAllGroups(true); }); }
  if (col) { col.addEventListener('click', function () { setAllGroups(false); }); }
  function setAllGroups(open) {
    var ds = nav.querySelectorAll('details');
    for (var i = 0; i < ds.length; i++) { ds[i].open = open; }
  }

  /* ------------------------------------------------------------ prev/next - */
  function verifiedRows() {
    var out = [];
    for (var i = 0; i < navRows.length; i++) { if (navRows[i].id) { out.push(navRows[i]); } }
    return out;
  }
  function stepVerified(dir) {
    var rows = verifiedRows();
    if (!rows.length) { return; }
    var here = docPosition(rows[0].el);
    var target = null;
    for (var i = 0; i < rows.length; i++) {
      var p = docPosition(rows[i].el);
      if (dir > 0 && p > main.scrollTop + readingTop() + 4) { target = rows[i]; break; }
      if (dir < 0 && p < main.scrollTop + readingTop() - 4) { target = rows[i]; }
    }
    if (!target) { return; }
    pushHistory();
    landOn(target.id, { silentHistory: true });
  }
  var prevB = $('loc-prev'), nextB = $('loc-next');
  if (prevB) { prevB.addEventListener('click', function () { stepVerified(-1); }); }
  if (nextB) { nextB.addEventListener('click', function () { stepVerified(1); }); }

  /* ---------------------------------------------------------- bookmarks --- */
  function labelForAnchor(id) {
    var el = doc.getElementById(id);
    if (!el) { return id; }
    var p = el.closest ? el.closest('.book-page') : null;
    var lab = p ? (p.getAttribute('data-nav-label') || '') : '';
    var ref = null;
    for (var i = 0; i < navRows.length; i++) { if (navRows[i].id === id) { ref = navRows[i]; break; } }
    var page = ref && ref.label ? (' · p. ' + ref.label) : '';
    return (lab || id) + page;
  }
  function renderBookmarks() {
    var list = $('bm-list'), empty = $('bm-empty'), foot = $('foot-bm');
    if (!list) { return; }
    list.innerHTML = '';
    var here = currentAnchor();
    var isSaved = false;
    prefs.bookmarks.forEach(function (bm, idx) {
      if (bm.id === here) { isSaved = true; }
      var li = doc.createElement('li');
      var go = doc.createElement('button');
      go.type = 'button'; go.className = 'pop-go';
      go.textContent = bm.label || labelForAnchor(bm.id);
      go.addEventListener('click', function () { pushHistory(); landOn(bm.id, { silentHistory: true }); });
      var x = doc.createElement('button');
      x.type = 'button'; x.className = 'pop-x'; x.textContent = '\u00d7';
      x.setAttribute('aria-label', 'Remove bookmark: ' + (bm.label || bm.id));
      x.addEventListener('click', function () {
        prefs.bookmarks.splice(idx, 1); save(); renderBookmarks();
      });
      li.appendChild(go); li.appendChild(x);
      list.appendChild(li);
    });
    if (empty) { empty.hidden = prefs.bookmarks.length > 0; }
    if (foot) { foot.setAttribute('aria-pressed', String(isSaved)); }
  }
  function toggleBookmark() {
    var id = currentAnchor();
    if (!id) { return; }
    var at = -1;
    prefs.bookmarks.forEach(function (bm, i) { if (bm.id === id) { at = i; } });
    if (at >= 0) { prefs.bookmarks.splice(at, 1); }
    else { prefs.bookmarks.push({ id: id, label: labelForAnchor(id), at: Date.now() }); }
    save(); renderBookmarks();
  }
  var bmAdd = $('bm-add'), footBm = $('foot-bm');
  if (bmAdd) { bmAdd.addEventListener('click', toggleBookmark); }
  if (footBm) { footBm.addEventListener('click', toggleBookmark); }

  /* ------------------------------------------------------------- search --- */
  var searchInput = $('search-input'), searchStatus = $('search-status'), searchHits = $('search-hits');
  function textContainer(node, page) {
    for (var el = node.parentElement; el && el !== page; el = el.parentElement) {
      if (/^(P|LI|TD|TH|DD|DT|H[1-6]|SUMMARY|FIGCAPTION|CAPTION|PRE|BLOCKQUOTE|DETAILS|DIV|SECTION|TEXT|TITLE)$/.test(el.tagName.toUpperCase())) { return el; }
    }
    return page;
  }
  function findMatch(page, q) {
    var walker = doc.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    var node, container = null, content = '';
    while ((node = walker.nextNode())) {
      var next = textContainer(node, page);
      if (next !== container) {
        if (container && content.toLocaleLowerCase().indexOf(q) >= 0) { return container; }
        container = next; content = '';
      }
      content += node.textContent;
    }
    return (container && content.toLocaleLowerCase().indexOf(q) >= 0) ? container : null;
  }
  function snippet(el, q) {
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    var i = t.toLocaleLowerCase().indexOf(q);
    if (i < 0) { return t.slice(0, 90); }
    return (i > 24 ? '…' : '') + t.slice(Math.max(0, i - 24), i + 70) + '…';
  }
  var searchRun = 0, hitEl = null;
  var hitStyle = doc.createElement('style');
  hitStyle.textContent = '.book-page .b2-search-hit{outline:3px solid #f0a500;outline-offset:2px}';
  doc.head.appendChild(hitStyle);
  function clearHit() { if (hitEl) { hitEl.classList.remove('b2-search-hit'); hitEl = null; } }
  function runSearch() {
    var q = (searchInput && searchInput.value || '').trim().toLocaleLowerCase();
    var run = ++searchRun;
    clearHit();
    searchHits.innerHTML = '';
    if (q.length < 2) { searchStatus.textContent = ''; return; }
    searchStatus.textContent = 'Searching…';
    var found = 0, i = 0;
    (function scan() {
      if (run !== searchRun) { return; }
      var stop = Math.min(i + 40, pageEls.length);
      for (; i < stop && found < 30; i++) {
        var page = pageEls[i];
        if (page.textContent.toLocaleLowerCase().indexOf(q) < 0) { continue; }
        var match = findMatch(page, q);
        if (!match) { continue; }
        found++;
        var li = doc.createElement('li');
        var b = doc.createElement('button');
        b.type = 'button';
        var strong = doc.createElement('strong');
        strong.textContent = page.getAttribute('data-nav-label') || page.id;
        var meta = doc.createElement('span');
        meta.className = 'hit-meta';
        meta.textContent = snippet(match, q);
        b.appendChild(strong); b.appendChild(meta);
        (function (m, idx) {
          b.addEventListener('click', function () {
            var anc = m.closest('[id^="book-heading-"]') || m.closest('.book-page');
            pushHistory();
            if (anc && anc.id && anc.id.indexOf('book-heading-') === 0) {
              pinned = null; landOn(anc.id, { silentHistory: true });
            } else {
              var r = m.getBoundingClientRect();
              main.scrollTop = main.scrollTop + r.top - (main.getBoundingClientRect().top + readingTop());
              lastRegion = Math.max(0, idx); updateLocator(lastRegion);
            }
            for (var d = m; d && d !== pageEls[idx]; d = d.parentElement) { if (d.tagName === 'DETAILS') { d.open = true; } }
            clearHit();
            hitEl = m;
            m.classList.add('b2-search-hit');
            if (narrow()) { closePopovers(null); }
          });
        })(match, i);
        li.appendChild(b);
        searchHits.appendChild(li);
      }
      if (i < pageEls.length && found < 30) { window.setTimeout(scan, 0); }
      else { searchStatus.textContent = found ? (found + (found >= 30 ? '+ matches' : ' matches')) : 'No match'; }
    })();
  }
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      window.clearTimeout(searchInput._t);
      searchInput._t = window.setTimeout(runSearch, 140);
    });
  }

  /* ----------------------------------------------------- type controls --- */
  ['light', 'dark', 'system'].forEach(function (t) {
    var b = $('theme-' + t);
    if (b) { b.addEventListener('click', function () { prefs.theme = t; save(); applyTheme(); }); }
  });
  var fontSel = $('font');
  if (fontSel) { fontSel.addEventListener('change', function () { prefs.font = fontSel.value; save(); applyTypography(); }); }
  var sizeEl = $('size');
  if (sizeEl) { sizeEl.addEventListener('input', function () { prefs.size = Number(sizeEl.value) || 100; save(); applyTypography(); }); }
  var spacingSel = $('spacing');
  if (spacingSel) { spacingSel.addEventListener('change', function () { prefs.spacing = spacingSel.value; save(); applyTypography(); }); }
  var typeReset = $('type-reset');
  if (typeReset) {
    typeReset.addEventListener('click', function () {
      prefs.font = 'original'; prefs.size = 100; prefs.spacing = 'normal';
      save(); applyTypography();
    });
  }

  /* ------------------------------------------------------ more menu ------ */
  function closeAnd(fn) { return function () { closePopovers(null); fn(); }; }
  var mp = $('more-prefs'); if (mp) { mp.addEventListener('click', closeAnd(function () { togglePopover('type-pop'); })); }
  var ma = $('more-a11y');
  if (ma) {
    ma.addEventListener('click', closeAnd(function () {
      pushHistory();
      if (!landOn('book-heading-0002', { silentHistory: true })) { landOn('TMP-0003', { silentHistory: true }); }
    }));
  }
  var ms = $('more-start'); if (ms) { ms.addEventListener('click', closeAnd(function () { pushHistory(); landOn('TMP-0001', { silentHistory: true }); })); }
  var mc = $('more-contents');
  if (mc) { mc.addEventListener('click', closeAnd(function () { setPanel(true); })); }
  var mk = $('more-keys');
  if (mk) {
    mk.addEventListener('click', function () {
      var n = $('more-keys-note'); if (n) { n.hidden = !n.hidden; }
    });
  }

  /* ------------------------------------------------------------ keyboard -- */
  doc.addEventListener('keydown', function (e) {
    var t = e.target;
    var typing = t && t.matches && t.matches('input,textarea,select');
    if (e.key === 'Escape') {
      var anyOpen = Object.keys(POPOVER_BTN).some(function (id) { var p = $(id); return p && !p.hidden; });
      if (anyOpen) { closePopovers(null); return; }
      if (app.classList.contains('drawer-open')) { setPanel(false); if (menuOpen) { menuOpen.focus(); } return; }
      if (app.classList.contains('panel-open') && !narrow()) { setPanel(false); if (railOpen) { railOpen.focus(); } return; }
      return;
    }
    if (typing) { return; }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); togglePopover('search-pop'); return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) { return; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (t && t.closest && t.closest('a,button,summary')) { return; }
      e.preventDefault();
      stepVerified(e.key === 'ArrowRight' ? 1 : -1);
    } else if (e.key === 'Home' && !(t && t.closest && t.closest('a,button'))) {
      e.preventDefault(); pushHistory(); landOn('TMP-0001', { silentHistory: true });
    }
  });

  /* --------------------------------------------------------------- init -- */
  /* continuous reading only: the app never carries a paginated mode class, so
     no region can be hidden by legacy mode CSS */
  app.classList.add('mode-continuous');
  app.setAttribute('data-mode', 'continuous');
  app.setAttribute('data-effective-mode', 'continuous');
  applyTypography();
  applyTheme();
  computeFit();
  collectRows();
  buildRefIndex();
  setAllGroups(false);
  var firstGroup = nav.querySelector('details.nav-group');
  if (firstGroup) { firstGroup.open = true; }
  var activeGroup = nav.querySelector('details.nav-group:nth-of-type(2)');
  if (activeGroup) { activeGroup.open = true; }
  var savedPanel = prefs.panel === 'open';
  setPanel(savedPanel, { persist: false });
  if (location.hash) {
    pinned = null;
    landOn(decodeHash(location.hash.slice(1)), { silentHistory: true });
  } else {
    lastRegion = 0;
    markActiveRowForRegion(0);
    updateLocator(0);
  }
  updateProgress();
  pushHistory();
  renderBookmarks();
  syncHistoryUI();
  window.addEventListener('load', function () {
    computeFit(); buildRefIndex();
    if (!prefs.bookmarks.length) { renderBookmarks(); }
  });
  var resizeTimer = 0, wasNarrow = narrow();
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      var pos = capturePosition();
      var now = narrow();
      computeFit();
      if (now !== wasNarrow) {
        wasNarrow = now;
        if (now) { setPanel(false, { persist: false }); }
        else { setPanel(prefs.panel === 'open', { persist: false }); }
      }
      restorePosition(pos);
      buildRefIndex();
    }, 160);
  });
  if (window.ResizeObserver) {
    new ResizeObserver(function () { computeFit(); }).observe(main);
  }

  /* --------------------------------------------------------------- qa ----- */
  function qa() {
    var failures = [];
    if (doc.documentElement.scrollWidth > doc.documentElement.clientWidth + 1) { failures.push({ kind: 'document-horizontal' }); }
    if (main.scrollWidth > main.clientWidth + 1) { failures.push({ kind: 'reader-horizontal', dx: main.scrollWidth - main.clientWidth }); }
    for (var i = 0; i < pageEls.length; i++) {
      var p = pageEls[i];
      var r = p.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) { continue; }
      if (p.scrollWidth > p.clientWidth + 1) { failures.push({ id: p.id, kind: 'region-horizontal', dx: p.scrollWidth - p.clientWidth }); }
    }
    return failures;
  }
  window.book2QA = qa;
  window.book2ReaderPrefs = function () { return Object.assign({}, prefs); };
  window.book2Appearance = function () {
    return { pref: prefs.theme || 'light', applied: themeApplied, mapped: themeStats.mapped,
             build_ms: themeStats.build_ms, apply_ms: themeStats.apply_ms };
  };
  window.book2ReaderUI = {
    version: 2,
    panelOpen: function () { return app.classList.contains('panel-open'); },
    drawerOpen: function () { return app.classList.contains('drawer-open'); },
    rows: function () { return navRows.length; },
    bookmarks: function () { return prefs.bookmarks.slice(); },
    locator: function () { return locatorEl ? locatorEl.textContent : ''; },
    refIndexSize: function () { return refIndex ? refIndex.length : 0; },
    search: function (q) { if (searchInput) { searchInput.value = q; runSearch(); } },
    go: function (id) { return landOn(id, { silentHistory: true }); },
    openPanel: function (o) { setPanel(!!o); },
    setTheme: function (t) { prefs.theme = t; save(); applyTheme(); },
    setSize: function (n) { prefs.size = n; save(); applyTypography(); },
    addBookmark: function () { toggleBookmark(); return prefs.bookmarks.slice(); },
    back: goBack,
    history: function () { return history.slice(); }
  };
  window.book2Semantics = { mode: function () { return 'continuous'; } };
  /* mark headings the OCR recovery left unstyled, from the audited levels */
  function markUnstyledHeadings() {
    var hs = doc.querySelectorAll('[id^="book-heading-"]'), n = 0;
    for (var i = 0; i < hs.length; i++) {
      var el = hs[i];
      if (el.tagName === 'SUMMARY') { continue; }
      if ((el.getAttribute('style') || '').indexOf('font-size') >= 0) { continue; }
      if (el.querySelector('[style*="font-size"]')) { continue; }
      el.classList.add('b2-h');
      el.setAttribute('data-b2-level', el.getAttribute('aria-level') || '3');
      n++;
    }
    return n;
  }
  window.book2Wave = { markUnstyledHeadings: markUnstyledHeadings, unstyledHeadingsMarked: markUnstyledHeadings() };
})();
