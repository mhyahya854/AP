
/* ===== Book 2 step 3: exact Contents navigation (2026-10-14) ==============
   Additive.  It never edits content and never rewrites reader/ui.js or
   reader/ui2.js; it drives the navigation the reader already has.

   What it fixes, all measured on the accepted artifact before this layer:

   1. LANDING POSITION.  A fragment jump used a fixed `scroll-margin-top:90px`
      while the sticky toolbar is only 44 px tall on a desktop and ~82 px on a
      phone, so the heading could sit under the bar, and the reader's own
      position-restore could undo the jump entirely once a narrow drawer
      closed.  This layer measures the toolbar, publishes the offset as
      `--b2-nav-offset` for reader/ui3.css, and scrolls the reading container
      itself: one instant correction, then a bounded settle that re-asserts the
      same position if the shell re-lays-out, and never fights a user scroll.

   2. SECTION MODE.  A Contents link whose heading lived in another section did
      nothing: the target was `display:none`, so the browser had nothing to
      scroll to.  A click now resolves the destination's verified section, shows
      that section first, and only then positions the heading.  Section mode is
      kept; the mode never silently changes to Continuous.

   3. SOURCE CAPTURE MODE.  A click now selects the capture that contains the
      destination before positioning the heading inside it.  The mode keeps its
      honest name (Source Capture), never "printed page".

   4. ACTIVE ROW.  The clicked row becomes and stays the active Contents entry
      while the reader is in that row's region, and its unit and module groups
      are opened so the row is visible in the rail.

   5. HASH NAVIGATION.  A saved `#book-heading-nnnn` link is honoured in all
      three modes, on load, and on browser Back/Forward, with the same precise
      landing.

   6. MODE SWITCHES keep the reader's logical location instead of jumping to
      the first section, the last capture or the cover.

   7. GROUP HEADERS.  A `<summary>` link used to navigate *and* toggle its own
      disclosure group.  The navigation is now taken over so the group the
      reader clicked never collapses under them.
   ========================================================================== */
(function () {
  'use strict';
  var app = document.querySelector('.app');
  var mainEl = document.querySelector('main');
  var navEl = document.querySelector('#contents-nav');
  var toolbarEl = document.querySelector('main > .toolbar');
  var modeSel = document.querySelector('#mode');
  if (!app || !mainEl || !navEl) { return; }
  var root = document.documentElement;
  var pageEls = document.querySelectorAll('.book-page');
  var semantics = window.book2Semantics || null;
  var GAP = 14;            /* comfortable gap between toolbar and heading */
  var PIN_MS = 800;        /* how long a clicked row stays pinned active   */
  var userMoved = false;

  /* ---------------------------------------------------------- geometry --- */
  function mode() {
    return app.getAttribute('data-effective-mode') || app.getAttribute('data-mode') || 'continuous';
  }
  function narrow() { return window.innerWidth <= 850; }
  function decodeHash(raw) {
    try { return decodeURIComponent(raw); } catch (e) { return raw; }
  }
  function regionIndex(el) {
    var page = el && el.closest ? el.closest('.book-page') : null;
    return page ? Array.prototype.indexOf.call(pageEls, page) : -1;
  }
  function targetTop() {
    return (toolbarEl ? toolbarEl.getBoundingClientRect().bottom : 0) + GAP;
  }
  function publishOffset() {
    if (!toolbarEl) { return; }
    var off = (toolbarEl.getBoundingClientRect().bottom - mainEl.getBoundingClientRect().top) + GAP;
    if (!isFinite(off) || off < 0) { off = 74; }
    root.style.setProperty('--b2-nav-offset', Math.round(off) + 'px');
  }
  function exactScroll(el) {
    if (!el || !el.getBoundingClientRect) { return false; }
    var delta = el.getBoundingClientRect().top - targetTop();
    if (Math.abs(delta) <= 0.5) { return false; }
    mainEl.scrollTop = mainEl.scrollTop + delta;
    return true;
  }
  /* the shell re-lays the reading column out (and reader/ui.js restores its own
     captured reading line) one frame after a narrow drawer closes; re-assert
     the landing after that has settled, unless the reader moved meanwhile */
  function settle(el, frames) {
    if (!el || !frames || frames <= 0) { return; }
    window.requestAnimationFrame(function () {
      if (userMoved) { return; }
      window.requestAnimationFrame(function () {
        if (userMoved) { return; }
        if (exactScroll(el)) { publishOffset(); }
        settle(el, frames - 1);
      });
    });
  }
  function topVisibleRegion() {
    var want = targetTop(), found = null, i, b;
    for (i = 0; i < pageEls.length; i++) {
      b = pageEls[i].getBoundingClientRect();
      if (b.width > 0 && b.height > 0 && b.top <= want + 1) { found = pageEls[i]; }
    }
    return found;
  }

  /* --------------------------------------------------------- rail state -- */
  function railItems() {
    return navEl.querySelectorAll('.nav-child, a[href^="#"]');
  }
  function rowFor(id) {
    var items = railItems(), i;
    for (i = 0; i < items.length; i++) {
      if (items[i].getAttribute('href') === '#' + id) { return items[i]; }
    }
    return null;
  }
  function openAncestors(el) {
    var d = el && el.closest ? el.closest('details') : null;
    while (d) {
      if (!d.open) { d.open = true; }
      d = d.parentElement && d.parentElement.closest ? d.parentElement.closest('details') : null;
    }
  }
  function railReveal(el) {
    var rail = navEl.parentElement;
    if (!rail) { return; }
    var rb = rail.getBoundingClientRect(), cb = el.getBoundingClientRect();
    if (cb.top < rb.top + 4 || cb.bottom > rb.bottom - 4) {
      try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { el.scrollIntoView(); }
    }
  }
  var pinned = null, marking = false;
  function markActive(row) {
    marking = true;
    var items = railItems(), i;
    for (i = 0; i < items.length; i++) {
      items[i].classList.remove('is-current');
      items[i].removeAttribute('aria-current');
    }
    if (row) {
      row.classList.add('is-current');
      row.setAttribute('aria-current', 'true');
      openAncestors(row);
      railReveal(row);
    }
    marking = false;
  }
  function pinRow(row) {
    if (!row) { return; }
    var href = row.getAttribute('href') || '';
    var el = href ? document.getElementById(decodeHash(href.slice(1))) : null;
    pinned = { row: row, id: decodeHash(href.replace(/^#/, '')), region: el ? regionIndex(el) : -1,
               until: Date.now() + PIN_MS };
    markActive(row);
  }
  function reassertPin() {
    if (!pinned) { return; }
    if (Date.now() > pinned.until || !navEl.contains(pinned.row)) { pinned = null; return; }
    if (pinned.row.getAttribute('aria-current') !== 'true' || !pinned.row.classList.contains('is-current')) {
      markActive(pinned.row);
    }
  }
  if (window.MutationObserver) {
    new MutationObserver(function () {
      if (marking) { return; }
      reassertPin();
    }).observe(navEl, { subtree: true, attributes: true, attributeFilter: ['class', 'aria-current'] });
  }

  /* --------------------------------------------------- one landing path -- */
  function showTarget(el) {
    var m = mode();
    if (m === 'section' && semantics && semantics.showSectionForElement) {
      semantics.showSectionForElement(el, { scroll: false });
    } else if (m === 'single') {
      var ri = regionIndex(el);
      if (ri >= 0 && typeof setCurrent === 'function') { setCurrent(ri); }
    }
  }
  function land(el) {
    if (!el) { return; }
    showTarget(el);
    exactScroll(el);
    settle(el, 3);
  }

  /* ------------------------------------------------------------ clicks --- */
  navEl.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a || !navEl.contains(a)) { return; }
    var href = a.getAttribute('href');
    var id = href ? decodeHash(href.slice(1)) : '';
    var el = id ? document.getElementById(id) : null;
    if (!el) { return; }                       /* nothing to be precise about */
    /* a link inside a <summary> would otherwise also toggle the group it lives
       in; take that navigation over so the group cannot collapse on the click */
    if (a.closest('summary')) {
      e.preventDefault();
      try { location.hash = href; } catch (err) { /* hash stayed put */ }
    }
    var row = a.closest('.nav-child') || a;
    pinned = null;
    land(el);
    pinRow(row);
  }, true);

  /* --------------------------------------------------- hash / history ---- */
  function applyHash() {
    if (!location.hash) { return; }
    var id = decodeHash(location.hash.slice(1));
    var el = id ? document.getElementById(id) : null;
    if (!el) { return; }
    land(el);
    var row = rowFor(id);
    if (row) { pinRow(row); }
  }
  window.addEventListener('hashchange', applyHash);
  window.addEventListener('popstate', applyHash);

  /* ------------------------------------------------- mode-switch memory -- */
  var pendingRegion = -1, pendingEl = null;
  if (modeSel) {
    /* capture phase on the document, so this runs before reader/ui.js and
       reader/ui2.js react: for Section mode the section index is corrected
       *before* ui2 shows it, which avoids painting the wrong section first */
    document.addEventListener('change', function (e) {
      if (e.target !== modeSel) { return; }
      var from = mode();
      var to = modeSel.value;
      var anchorEl = (from === 'section' && semantics) ? semantics.currentSectionEl() : null;
      if (!anchorEl) { anchorEl = topVisibleRegion(); }
      if (!anchorEl) { return; }
      pendingEl = anchorEl;
      pendingRegion = -1;
      if (to === 'section' && semantics) {
        var idx = semantics.sectionForElement(anchorEl);
        if (idx >= 0) {
          semantics.setSectionIndexOnly(idx);
          pendingEl = semantics.currentSectionEl() || anchorEl;
        }
      } else if (to === 'single') {
        pendingRegion = regionIndex(anchorEl);
      }
      window.requestAnimationFrame(function () {
        if (pendingRegion >= 0 && typeof setCurrent === 'function') { setCurrent(pendingRegion); }
        if (pendingEl) { exactScroll(pendingEl); settle(pendingEl, 3); }
        pendingRegion = -1;
        pendingEl = null;
      });
    }, true);
  }

  /* just after a mode switch, keep the reader on the same verified section */
  window.addEventListener('load', function () { publishOffset(); applyHash(); });
  [300, 900, 2200].forEach(function (ms) {
    window.setTimeout(function () { publishOffset(); applyHash(); }, ms);
  });

  /* ---------------------------------------------------------- listeners -- */
  window.addEventListener('resize', publishOffset);
  if (window.ResizeObserver && toolbarEl) { new ResizeObserver(publishOffset).observe(toolbarEl); }
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (evt) {
    mainEl.addEventListener(evt, function () { userMoved = true; }, { passive: true });
  });
  mainEl.addEventListener('scroll', function () {
    if (pinned && pinned.region >= 0) {
      var cur = topVisibleRegion();
      if (cur && regionIndex(cur) !== pinned.region) { pinned = null; }
    }
  }, { passive: true });

  publishOffset();
  /* a stored #book-heading-nnnn link must land precisely in every mode */
  if (location.hash) { applyHash(); }

  window.book2Navigation = {
    offset: function () { return targetTop(); },
    landing: function () { return { mode: mode(), pinned: pinned ? pinned.id : null }; },
    land: function (id) { land(document.getElementById(id)); },
    applyHash: applyHash
  };
})();

