/* ===== Book 2 reader UI layer (2026-10-12) =================================
   Appended as a second classic script. It reuses the existing reader's global
   bindings (app, main, pages, counter, navLinks, setCurrent, move, markHit,
   setLeftOpen, setRightOpen) and never touches source content.
   Features: three view modes, font / text size / line spacing / zoom, panel
   preferences persisted in localStorage, position preserved across modes.
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
                   zoom: 100, left: 'open', right: 'open' };
  var prefs = Object.assign({}, DEFAULTS);
  var stored = false;
  try {
    var raw = localStorage.getItem(SKEY);
    if (raw) { prefs = Object.assign(prefs, JSON.parse(raw)); stored = true; }
  } catch (e) { /* storage unavailable: run with defaults */ }
  var narrow = function () { return window.innerWidth <= 850; };
  if (!stored && narrow()) { prefs.left = 'closed'; prefs.right = 'closed'; }

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
    var lt = $('#left-toggle'), rt = $('#right-toggle');
    if (lt) { lt.setAttribute('aria-expanded', String(prefs.left === 'open')); }
    if (rt) { rt.setAttribute('aria-expanded', String(prefs.right === 'open')); }
  }

  /* ---- panel toggles remember their state ---- */
  var baseSetLeftOpen = setLeftOpen, baseSetRightOpen = setRightOpen;
  setLeftOpen = function (open) {
    baseSetLeftOpen(open); prefs.left = open ? 'open' : 'closed'; save();
    window.requestAnimationFrame(function () { computeFit(); applyMode({ keepPosition: false }); });
  };
  setRightOpen = function (open) {
    baseSetRightOpen(open); prefs.right = open ? 'open' : 'closed'; save();
    window.requestAnimationFrame(function () { computeFit(); applyMode({ keepPosition: false }); });
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
      prefs = Object.assign({}, DEFAULTS, { left: prefs.left, right: prefs.right });
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
    computeFit();
    if (changed && prefs.mode === 'spread') { applyMode({ keepPosition: false }); }
    else { applyPageClasses(effectiveMode()); }
  });

  /* ---- start ---- */
  applyTypography();
  applyPanels();
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
})();
