/* ===== Book 2 reader UI layer (2026-10-12) =================================
   Appended as a second classic script. It reuses the existing reader's global
   bindings (app, main, pages, counter, navLinks, setCurrent, move, markHit,
   setLeftOpen, setRightOpen) and never touches source content.
   Features: three view modes, font / text size / line spacing / zoom, panel
   preferences persisted in localStorage, position preserved across modes.

   2026-10-14 step 2: an Appearance control (Light / Dark / System) in the
   Reader Tools panel.  The choice is stored with the same preference record,
   is invisible to every other setting and is preserved by both reset buttons.
   Dark mode re-colours the chrome through the stylesheet and maps the
   reconstruction's inline Word colours here - lightness mirrored, hue kept -
   without ever touching an image, an <svg> or a publisher figure.

   2026-10-14 sidebar wave: either sidebar can be collapsed on its own or both
   together on a desktop width, the reading column takes the space back, and a
   collapsed panel returns at its own width and place.  The panel state that is
   remembered is the *desktop* one: the narrow-screen drawer is transient (it
   belongs to reader/ui2.js) and may never overwrite a desktop choice.  A toggle
   also keeps the reader where it was - the reading line, the rail's own scroll
   offset and the active section are all preserved instead of jumping.
   ========================================================================= */
(function () {
  'use strict';
  var SKEY = 'book2.reader.v1';
  var appEl = document.querySelector('.app');
  var mainEl = document.querySelector('main');
  var counterEl = document.querySelector('#counter');
  var sidebarEl = document.querySelector('aside.left');
  var barEl = document.querySelector('.toolbar');
  var pageEls = Array.prototype.slice.call(document.querySelectorAll('.book-page'));
  var LEADING = { compact: '1.06', normal: '1.22', relaxed: '1.5' };
  var DEFAULTS = { mode: 'continuous', font: 'original', size: 100, spacing: 'normal',
                   zoom: 100, left: 'open', right: 'open', theme: 'light' };
  var prefs = Object.assign({}, DEFAULTS);
  var stored = false;
  try {
    var raw = localStorage.getItem(SKEY);
    if (raw) { prefs = Object.assign(prefs, JSON.parse(raw)); stored = true; }
  } catch (e) { /* storage unavailable: run with defaults */ }
  var narrow = function () { return window.innerWidth <= 850; };
  /* `prefs.left` / `prefs.right` are the desktop layout preferences.  On a
     narrow screen the drawers are transient: reader/ui2.js opens the Contents
     drawer and keeps the two panels from overlapping, and whatever it does
     there must not be written back over the desktop choice. */

  var baseSetCurrent = setCurrent;
  var baseMove = move;
  var baseQueueScrollSync = queueScrollSync;
  var baseMarkHit = typeof markHit === 'function' ? markHit : null;
  var page = 0;

  function save() { try { localStorage.setItem(SKEY, JSON.stringify(prefs)); } catch (e) {} }
  function $(sel) { return document.querySelector(sel); }
  /* page surfaces are 210 mm wide (96 dpi) */
  var PAGE_PX = 793.7;
  var MIN_READABLE = 620;   /* below this a surface reflows instead of shrinking */
  function availWidth() {
    if (!mainEl) { return window.innerWidth; }
    var cs = window.getComputedStyle(mainEl);
    var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    return Math.max(0, mainEl.clientWidth - pad - 2);
  }
  function reflowMode() { return availWidth() < MIN_READABLE; }
  function spreadFits() { return ((availWidth() - 26) / 2) >= MIN_READABLE; }
  function computeFit() {
    var w = availWidth();
    var fitOne = Math.min(1, w / PAGE_PX);
    var fitTwo = Math.min(1, (w - 26) / (2 * PAGE_PX));
    document.documentElement.style.setProperty('--fit-continuous', fitOne.toFixed(4));
    document.documentElement.style.setProperty('--fit-single', fitOne.toFixed(4));
    document.documentElement.style.setProperty('--fit-spread', fitTwo.toFixed(4));
    appEl.classList.toggle('fit-reflow', reflowMode());
  }
  function effectiveMode() {
    /* a two-page spread stays available on desktop (the surfaces scale to fit);
       only a genuinely narrow screen falls back to a single page */
    if (prefs.mode === 'spread' && narrow()) { return 'single'; }
    return prefs.mode;
  }
  function updateCounter(mode) {
    if (mode === 'continuous') { return; }  /* the base code sets the group counter */
    if (mode === 'spread') {
      var last = Math.min(page + 2, pageEls.length);
      counterEl.textContent = 'Pages ' + (page + 1) + '\u2013' + last + ' / ' + pageEls.length;
    } else {
      counterEl.textContent = 'Page ' + (page + 1) + ' / ' + pageEls.length;
    }
  }
  function highlightRow(i) {
    var el = null;
    for (var j = 0; j < navLinks.length; j++) { if (navLinks[j].i <= i) { el = navLinks[j].a; } else { break; } }
    for (var k = 0; k < navLinks.length; k++) { navLinks[k].a.classList.remove('is-current'); }
    if (!el) { return; }
    el.classList.add('is-current');
    var box = el.getBoundingClientRect();
    var rail = sidebarEl ? sidebarEl.getBoundingClientRect() : null;
    if (rail && (box.top < rail.top + 4 || box.bottom > rail.bottom - 4)) {
      try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { el.scrollIntoView(); }
    }
  }
  function scrollToTopOfPage(i) {
    var target = pageEls[i];
    if (!target) { return; }
    try { target.scrollIntoView({ block: 'start' }); } catch (e) {}
    var barH = barEl ? barEl.getBoundingClientRect().height : 0;
    if (mainEl) { mainEl.scrollTop = Math.max(0, mainEl.scrollTop - barH - 8); }
  }
  function applyPageClasses(mode) {
    for (var i = 0; i < pageEls.length; i++) {
      pageEls[i].classList.toggle('is-current', mode !== 'continuous' && i === page);
      pageEls[i].classList.toggle('is-next', mode === 'spread' && i === page + 1);
    }
  }
  function setPage(i, opts) {
    opts = opts || {};
    page = Math.max(0, Math.min(pageEls.length - 1, i));
    var mode = effectiveMode();
    applyPageClasses(mode);
    baseSetCurrent(page);
    highlightRow(page);
    updateCounter(mode);
    if (opts.scroll !== false) { scrollToTopOfPage(page); }
    save();
  }
  function applyMode(opts) {
    opts = opts || {};
    computeFit();
    var mode = effectiveMode();
    appEl.classList.toggle('mode-continuous', mode === 'continuous');
    appEl.classList.toggle('mode-single', mode === 'single');
    appEl.classList.toggle('mode-spread', mode === 'spread');
    appEl.setAttribute('data-mode', prefs.mode);
    appEl.setAttribute('data-effective-mode', mode);
    var note = $('#mode-note');
    if (note) {
      if (prefs.mode === 'spread' && mode !== 'spread') {
        note.textContent = 'Two-page spread needs a wider window, so single page is shown. '
                         + 'Your choice is remembered.';
      } else if (reflowMode()) {
        note.textContent = 'This window is narrow, so pages reflow; zoom applies on wider windows.';
      } else {
        note.textContent = '';
      }
    }
    applyPageClasses(mode);
    if (mode === 'continuous') {
      if (opts.keepPosition !== false) { scrollToTopOfPage(page); }
      updateCounter(mode);
    } else {
      setPage(page, { scroll: opts.keepPosition !== false });
    }
    var badge = $('#mode-badge');
    if (badge) {
      badge.textContent = mode === 'spread' ? 'Two-page' : (mode === 'single' ? 'Single page' : 'Continuous');
    }
    save();
  }
  function applyTypography() {
    document.documentElement.style.setProperty('--reader-leading', LEADING[prefs.spacing] || LEADING.normal);
    document.documentElement.style.setProperty('--reader-zoom', String((prefs.zoom || 100) / 100));
    document.documentElement.style.setProperty('--body-size', (11 * (prefs.size || 100) / 100) + 'pt');
    if (prefs.font && prefs.font !== 'original') { appEl.setAttribute('data-font', prefs.font); }
    else { appEl.removeAttribute('data-font'); }
    var sizeVal = $('#size-val'); if (sizeVal) { sizeVal.textContent = (prefs.size || 100) + '%'; }
    var zoomVal = $('#zoom-val'); if (zoomVal) { zoomVal.textContent = (prefs.zoom || 100) + '%'; }
    var slider = $('#zoom'); if (slider) { slider.value = String(prefs.size || 100); }
    var fontSel = $('#font'); if (fontSel) { fontSel.value = prefs.font || 'original'; }
    var spacingSel = $('#spacing'); if (spacingSel) { spacingSel.value = prefs.spacing || 'normal'; }
    var modeSel = $('#mode'); if (modeSel) { modeSel.value = prefs.mode || 'continuous'; }
  }
  function applyPanels() {
    appEl.classList.toggle('left-closed', prefs.left !== 'open');
    appEl.classList.toggle('right-closed', prefs.right !== 'open');
    syncPanelButtons();
  }

  /* ---- panel controls: state, labels, focus, reading position ----------
     Each panel has two controls that mean the same thing: the collapse button
     pinned at the top of the panel and the toolbar toggle that stays visible
     when the panel is hidden.  Both carry `aria-expanded`, so the two can never
     report different states. */
  function syncPanelButtons() {
    var leftOpen = !appEl.classList.contains('left-closed');
    var rightOpen = !appEl.classList.contains('right-closed');
    var lt = $('#left-toggle'), rt = $('#right-toggle');
    var lc = $('#left-close'), rc = $('#right-close');
    if (lt) { lt.setAttribute('aria-expanded', String(leftOpen)); }
    if (rt) { rt.setAttribute('aria-expanded', String(rightOpen)); }
    if (lc) { lc.setAttribute('aria-expanded', String(leftOpen)); }
    if (rc) { rc.setAttribute('aria-expanded', String(rightOpen)); }
  }

  /* The reading line under the viewport top, as (page, fraction down the page).
     Toggling a sidebar changes the width of the reading column, so the pages
     rescale; holding this point still is what keeps the reader on the same
     words (and therefore on the same active section) - it is not a jump to the
     top of the section. */
  function capturePosition() {
    if (!mainEl || !pageEls.length) { return null; }
    var barH = barEl ? barEl.getBoundingClientRect().bottom : 0;
    var top = Math.max(mainEl.getBoundingClientRect().top, barH);
    /* only laid-out regions count: a hidden region reports a zero rectangle at
       the origin, which would otherwise look like the top of the document */
    var i = -1, k;
    for (k = 0; k < pageEls.length; k++) {
      var b = pageEls[k].getBoundingClientRect();
      if (b.height > 0 && b.width > 0 && b.top <= top + 1) { i = k; }
    }
    if (i < 0) { return { i: 0, f: 0, y: top }; }
    var r = pageEls[i].getBoundingClientRect();
    if (!(r.height > 0)) { return { i: i, y: top }; }
    var f = Math.max(0, Math.min(1, (top - r.top) / r.height));
    return { i: i, f: f, y: r.top + f * r.height };
  }
  function restorePosition(pos) {
    if (!pos || !mainEl || !pageEls[pos.i]) { return; }
    var r = pageEls[pos.i].getBoundingClientRect();
    if (!(r.height > 0)) { return; }
    var f = (typeof pos.f === 'number') ? pos.f : 0;
    var y = r.top + f * r.height;
    if (pos.y - y > 0.5 || y - pos.y > 0.5) { mainEl.scrollTop = mainEl.scrollTop + (y - pos.y); }
  }
  function panelOf(which) { return which === 'left' ? sidebarEl : document.querySelector('aside.right'); }

  /* ---- panel toggles remember their (desktop) state ---- */
  var baseSetLeftOpen = setLeftOpen, baseSetRightOpen = setRightOpen;
  function togglePanel(which, open, apply) {
    var pos = capturePosition();
    var rail = panelOf(which);
    var railScroll = rail ? rail.scrollTop : 0;
    apply(open);                         /* the shell sets the class + toolbar aria */
    if (!narrow()) { prefs[which] = open ? 'open' : 'closed'; save(); }
    syncPanelButtons();
    window.requestAnimationFrame(function () {
      computeFit();
      applyMode({ keepPosition: false });
      if (rail && rail.scrollTop !== railScroll) { rail.scrollTop = railScroll; }
      restorePosition(pos);
      syncPanelButtons();
    });
  }
  setLeftOpen = function (open) {
    togglePanel('left', open, baseSetLeftOpen);
  };
  setRightOpen = function (open) {
    togglePanel('right', open, baseSetRightOpen);
  };

  /* ---- current section: extend the base marking with a visible state ---- */
  setCurrent = function (i) {
    baseSetCurrent(i);
    page = i;
    if (effectiveMode() !== 'continuous') { applyPageClasses(effectiveMode()); updateCounter(effectiveMode()); }
    highlightRow(i);
  };

  /* ---- geometry-based scroll sync is meaningless when only one surface is
         laid out; disable it in the paginated modes ---- */
  queueScrollSync = function () { if (effectiveMode() !== 'continuous') { return; } baseQueueScrollSync(); };

  /* ---- mode-aware Previous/Next ---- */
  move = function (n) {
    var mode = effectiveMode();
    if (mode === 'continuous') { baseMove(n); if (typeof current === 'number') { page = current; } return; }
    var step = (mode === 'spread') ? 2 : 1;
    setPage(page + n * step);
  };

  /* ---- search: jump to the page that holds the hit ---- */
  if (baseMarkHit) {
    markHit = function (match) {
      baseMarkHit(match);
      if (match && effectiveMode() !== 'continuous') {
        var pg = match.closest ? match.closest('.book-page') : null;
        var i = pg ? pageEls.indexOf(pg) : -1;
        if (i >= 0) { setPage(i, { scroll: false }); }
      }
    };
  }

  /* ---- page-level arrow keys in single / spread mode ---- */
  document.addEventListener('keydown', function (e) {
    if (effectiveMode() === 'continuous') { return; }
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') { return; }
    var t = e.target;
    if (t && t.matches && t.matches('input,textarea,select')) { return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    move(e.key === 'ArrowRight' ? 1 : -1);
  }, true);

  /* ---- controls ---- */
  var modeSel = $('#mode');
  if (modeSel) { modeSel.addEventListener('change', function () { prefs.mode = modeSel.value; applyMode(); }); }
  var fontSel = $('#font');
  if (fontSel) { fontSel.addEventListener('change', function () { prefs.font = fontSel.value; applyTypography(); save(); }); }
  var spacingSel = $('#spacing');
  if (spacingSel) { spacingSel.addEventListener('change', function () { prefs.spacing = spacingSel.value; applyTypography(); save(); }); }
  var sizeSlider = $('#zoom');
  if (sizeSlider) {
    sizeSlider.addEventListener('input', function () {
      prefs.size = Number(sizeSlider.value) || 100;
      applyTypography(); save();
    });
  }
  var sizeReset = $('#size-reset');
  if (sizeReset) { sizeReset.addEventListener('click', function () { prefs.size = 100; applyTypography(); save(); }); }
  var fontReset = $('#font-reset');
  if (fontReset) {
    fontReset.addEventListener('click', function () {
      prefs.font = 'original'; prefs.size = 100; prefs.spacing = 'normal'; prefs.zoom = 100;
      applyTypography(); save();
    });
  }
  function bumpZoom(delta) {
    prefs.zoom = Math.max(50, Math.min(200, (prefs.zoom || 100) + delta));
    applyTypography(); save();
  }
  var zIn = $('#zoom-in'), zOut = $('#zoom-out'), zReset = $('#zoom-reset');
  if (zIn) { zIn.addEventListener('click', function () { bumpZoom(10); }); }
  if (zOut) { zOut.addEventListener('click', function () { bumpZoom(-10); }); }
  if (zReset) { zReset.addEventListener('click', function () { prefs.zoom = 100; applyTypography(); save(); }); }
  var expand = $('#nav-expand'), collapse = $('#nav-collapse');
  if (expand) {
    expand.addEventListener('click', function () {
      document.querySelectorAll('#contents-nav details').forEach(function (d) { d.open = true; });
    });
  }
  if (collapse) {
    collapse.addEventListener('click', function () {
      document.querySelectorAll('#contents-nav details').forEach(function (d) { d.open = false; });
    });
  }
  var resetView = $('#view-reset');
  if (resetView) {
    resetView.addEventListener('click', function () {
      /* the panel choice and the appearance choice are layout preferences, not
         typography ones: a reset of the view must not silently re-theme the
         reader or reopen a panel the reader deliberately closed */
      prefs = Object.assign({}, DEFAULTS, { left: prefs.left, right: prefs.right, theme: prefs.theme });
      applyTypography(); applyMode({ keepPosition: false }); applyPanels();
      setPage(0, { scroll: true });
    });
  }

  /* ---- responsive ---- */
  var lastNarrow = narrow();
  window.addEventListener('resize', function () {
    var now = narrow();
    var changed = now !== lastNarrow;
    lastNarrow = now;
    var pos = capturePosition();
    computeFit();
    if (changed && prefs.mode === 'spread') { applyMode({ keepPosition: false }); }
    else { applyPageClasses(effectiveMode()); }
    /* reader/ui2.js re-applies the drawer state after this handler on a
       breakpoint change, so the reading position is restored once the
       layout has settled rather than from the stale geometry. */
    window.requestAnimationFrame(function () {
      if (changed) { computeFit(); }
      restorePosition(pos);
    });
  });

  /* ---- appearance: Light / Dark / System --------------------------------
     Two halves, both driven by the choice stored in `prefs.theme`:

       1. `data-theme` on <html> hands the chrome, both rails, the reading
          surface and every structural component to the dark palette in
          reader/ui.css.
       2. The reconstruction carries ~15 000 inline Word colours
          (`<span style="color:#202020">`).  A stylesheet alone cannot mirror
          them, so each such declaration is rewritten once: its lightness is
          mirrored and its hue and saturation are kept, which preserves the
          contrast the publisher printed (dark grey ink on white paper becomes
          light grey ink on dark paper) and keeps the source's teal links,
          magenta LG accents, plum rules and red module headings recognisable.
          Photographs, embedded PNGs, <svg> graphics, the publisher's figures
          and the reconstructed source diagrams are skipped entirely - they
          keep their published colours on their own surfaces - and no image
          byte is ever read or rewritten.

     The transform is applied on demand, in place, and is reversible: the
     original style attribute of every touched element is kept, so switching
     back to Light restores the artifact exactly. */
  var DARK_SKIP = 'img,svg,figure.b2-source-figure,.mobile-diagram-scroll,'
    + '.swot-0605,.source-composition-0542,.source-composition-0678,'
    + '.source-composition-0776,.source-composition-0783,'
    + '.source-composition-0837,.source-composition-0844';
  var NAMED_COLORS = {
    black: '#000000', white: '#ffffff', gray: '#808080', grey: '#808080',
    silver: '#c0c0c0', dimgray: '#696969', dimgrey: '#696969',
    maroon: '#800000', red: '#ff0000', navy: '#000080', blue: '#0000ff',
    teal: '#008080', green: '#008000', purple: '#800080', olive: '#808000',
    fuchsia: '#ff00ff', magenta: '#ff00ff', aqua: '#00ffff', cyan: '#00ffff',
    lime: '#00ff00', yellow: '#ffff00'
  };
  var STYLE_COLOR_RE = /(^|[;{])(\s*)(color|background|background-color)(\s*:\s*)(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})/g;

  function hexToRgb(hex) {
    var h = hex.slice(1);
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    if (h.length === 8) { h = h.slice(0, 6); }        /* #rrggbbaa: alpha ignored */
    if (h.length !== 6 || !/^[0-9a-f]{6}$/.test(h)) { return null; }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, h = 0, s = 0, d = max - min;
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
    var channel = function (t) {
      if (t < 0) { t += 1; }
      if (t > 1) { t -= 1; }
      if (t < 1 / 6) { return p + (q - p) * 6 * t; }
      if (t < 1 / 2) { return q; }
      if (t < 2 / 3) { return p + (q - p) * (2 / 3 - t) * 6; }
      return p;
    };
    var toHex = function (x) {
      var v = Math.round(x * 255);
      return (v < 16 ? '0' : '') + v.toString(16);
    };
    var r, g, b;
    if (!s) { r = g = b = l; }
    else { r = channel(h + 1 / 3); g = channel(h); b = channel(h - 1 / 3); }
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }
  /* one inline colour -> its dark-mode twin (or null: leave it alone) */
  function darkColor(value, isBackground) {
    var v = String(value).trim().toLowerCase();
    if (NAMED_COLORS[v]) { v = NAMED_COLORS[v]; }
    if (v.charAt(0) !== '#') { return null; }         /* url(), transparent, inherit … */
    var rgb = hexToRgb(v);
    if (!rgb) { return null; }
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    var l = hsl[2];
    if (isBackground) {
      /* a dark or mid fill already reads as a surface on a dark page, and the
         publisher's coloured bands (module blue, LG magenta) must stay; only
         light fills are mirrored, and never to pure black */
      if (l <= 0.45) { return null; }
      l = Math.max(0.10, Math.min(0.40, 1 - l));
    } else {
      /* near-white text is the source's way of printing on a coloured band,
         which is preserved above: mirroring it would make it unreadable */
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
  /* written through the style attribute, but any runtime `display` this reader
     set (Section mode hides blocks) survives the swap */
  function writeStyleAttr(el, style) {
    var display = el.style.display;
    el.setAttribute('style', style);
    if (display) { el.style.display = display; }
  }
  var styledNodes = null, styledLight = null, styledDark = null;
  /* diagnostics for the QA harness (the cost of the inline-colour pass must be
     measurable, not guessed) */
  var themeStats = { mode: null, mapped: 0, build_ms: 0, apply_ms: 0 };
  function buildStyledIndex() {
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    styledNodes = []; styledLight = []; styledDark = [];
    var root = mainEl || document.body;
    var all = root.querySelectorAll('[style]');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest && el.closest(DARK_SKIP)) { continue; }
      var s = el.getAttribute('style');
      if (!s) { continue; }
      var dark = darkStyleString(s);
      if (!dark) { continue; }
      styledNodes.push(el); styledLight.push(s); styledDark.push(dark);
    }
    themeStats.build_ms = Math.round((((window.performance && performance.now) ? performance.now() : 0) - t0) * 10) / 10;
    themeStats.mapped = styledNodes.length;
    return styledNodes.length;
  }
  function applyThemeMode(mode) {
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    document.documentElement.setAttribute('data-theme', mode);
    if (mode === 'dark') {
      if (styledNodes === null) { buildStyledIndex(); }
      for (var i = 0; i < styledNodes.length; i++) { writeStyleAttr(styledNodes[i], styledDark[i]); }
    } else if (styledNodes) {
      for (var j = 0; j < styledNodes.length; j++) { writeStyleAttr(styledNodes[j], styledLight[j]); }
    }
    themeStats.mode = mode;
    themeStats.apply_ms = Math.round((((window.performance && performance.now) ? performance.now() : 0) - t0) * 10) / 10;
  }
  var themeQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var themeApplied = null;
  function resolvedTheme() {
    var choice = prefs.theme || 'light';
    if (choice === 'system') { return (themeQuery && themeQuery.matches) ? 'dark' : 'light'; }
    return (choice === 'dark') ? 'dark' : 'light';
  }
  function applyTheme() {
    var mode = resolvedTheme();
    if (mode !== themeApplied) { themeApplied = mode; applyThemeMode(mode); }
    var sel = $('#theme');
    if (sel && sel.value !== (prefs.theme || 'light')) { sel.value = prefs.theme || 'light'; }
    var hint = $('#theme-hint');
    if (hint) {
      hint.textContent = (prefs.theme === 'system')
        ? ('Following this device: ' + mode + ' mode.')
        : '';
    }
  }
  if (themeQuery) {
    var onSchemeChange = function () { if ((prefs.theme || 'light') === 'system') { applyTheme(); } };
    if (themeQuery.addEventListener) { themeQuery.addEventListener('change', onSchemeChange); }
    else if (themeQuery.addListener) { themeQuery.addListener(onSchemeChange); }
  }
  var themeSel = $('#theme');
  if (themeSel) {
    themeSel.addEventListener('change', function () {
      prefs.theme = themeSel.value;
      applyTheme();
      save();
    });
  }

  /* ---- start ---- */
  applyTypography();
  applyPanels();
  applyTheme();
  page = (typeof current === 'number' && current >= 0) ? current : 0;
  applyMode({ keepPosition: false });
  var hasHash = !!location.hash;
  if (effectiveMode() !== 'continuous') { setPage(page, { scroll: !hasHash }); }
  var hint = $('#tools-hint');
  if (hint) {
    hint.textContent = (prefs.mode === 'spread' && narrow())
      ? 'Single page shown (window is narrow)'
      : '';
  }
  window.book2ReaderPrefs = function () { return Object.assign({}, prefs); };
  /* read-only diagnostics for the QA harness: the appearance preference, the
     resolved mode and the cost of the inline-colour pass */
  window.book2Appearance = function () {
    return { pref: prefs.theme || 'light', applied: themeApplied,
             mapped: themeStats.mapped, build_ms: themeStats.build_ms, apply_ms: themeStats.apply_ms };
  };
})();
