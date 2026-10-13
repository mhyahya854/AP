/* ===== Book 2 reader semantics + mobile drawer layer (2026-10-12 overnight) ====
   Additive.  It never edits content and never rewrites reader/ui.js.

   1. Honest pagination vocabulary: the 1,899 units the reader pages through are
      SOURCE CAPTURES, not printed pages.  The capture-based mode says so, and
      the printed-spread mode is withdrawn because no printed page boundary
      exists anywhere in the available source.
   2. A new SECTION mode pages through the book's own verified headings (the 383
      audited anchors), which is a real unit of the book rather than an
      arbitrary screenshot boundary.  It reuses the single DOM: sections are
      shown by hiding the blocks outside the section, never by duplicating it.
   3. Mobile drawers: on a narrow viewport the two drawers can no longer
      overlap.  Opening one closes the other, and a narrow load keeps the
      Contents drawer only.  The stored desktop preference is never overwritten.
   ================================================================== */
(function () {
  'use strict';
  var app = document.querySelector('.app');
  var main = document.querySelector('main');
  if (!app || !main) { return; }
  var counter = document.querySelector('#counter');
  var modeSel = document.querySelector('#mode');
  var note = document.querySelector('#mode-note');
  var badge = document.querySelector('#mode-badge');
  var pageEls = Array.prototype.slice.call(document.querySelectorAll('.book-page'));
  var SKEY = 'book2.reader.v1';

  function prefs() {
    try { return JSON.parse(localStorage.getItem(SKEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function save(p) { try { localStorage.setItem(SKEY, JSON.stringify(p)); } catch (e) {} }

  /* ---------- 1. honest labels for the capture-based mode ---------------- */
  var CAPTURE_NOTE = 'Source captures are the 1,899 page images the book was rebuilt from. Each is a '
    + 'screenshot of a scrolling page, so a capture is not a printed page.';
  var SPREAD_WITHDRAWN = 'No printed page boundaries exist in the available source, so a two-page '
    + 'printed spread is not offered. Section shows one real heading section at a time.';

  if (counter && window.MutationObserver) {
    var relabel = function () {
      if (state.mode === 'section') {
        /* reader/ui.js keeps its own capture-based counter; in Section mode the
           section label is the only honest one, so re-assert it. */
        if (counter.textContent !== sectionLabel) { counter.textContent = sectionLabel; }
        return;
      }
      var t = (counter.textContent || '').trim();
      var m = /^Pages?\s+(\d+)(?:\u2013(\d+))?\s*\/\s*(\d+)$/.exec(t);
      if (!m) { return; }
      var label = m[2] ? ('Source captures ' + m[1] + '\u2013' + m[2] + ' of ' + m[3])
                       : ('Source capture ' + m[1] + ' of ' + m[3]);
      if (counter.textContent !== label) { counter.textContent = label; }
    };
    new MutationObserver(relabel).observe(counter, { childList: true, characterData: true, subtree: true });
  }
  var sectionLabel = '';

  /* ---------- 2. section model over the verified headings ---------------- */
  var headings = [];
  var built = false;
  var secIndex = 0;
  var state = { mode: 'continuous' };

  function childrenOf(reg) {
    var c = pageEls[reg].querySelector('.content') || pageEls[reg];
    return Array.prototype.slice.call(c.children);
  }

  /* A heading set as stacked display lines ("BUSINESS" <br> "WITH" ...) loses
     its spaces in textContent.  Restore the spaces, and when the region's
     audited nav label is the same title, prefer that wording. */
  function headingTitle(el) {
    var clone = el.cloneNode(true);
    var brs = clone.querySelectorAll('br');
    var i;
    for (i = 0; i < brs.length; i++) {
      brs[i].parentNode.replaceChild(document.createTextNode(' '), brs[i]);
    }
    var t = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    var reg = el.closest('.book-page');
    var lab = (reg && reg.getAttribute('data-nav-label')) || '';
    var norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
    if (lab && t && norm(lab) === norm(t)) { t = lab; }
    return t.slice(0, 90);
  }

  /* Each heading is located by (region index, index of the top-level child of
     that region's .content that contains it).  Sections are then contiguous
     ranges of (region, child) - a direct index, no global block list. */
  function buildSections() {
    if (built) { return; }
    built = true;
    var i, hs = Array.prototype.slice.call(document.querySelectorAll('[id^="book-heading-"]'))
      .filter(function (el) { return el.getAttribute('role') === 'heading'; });
    for (i = 0; i < hs.length; i++) {
      var el = hs[i];
      var reg = pageEls.indexOf(el.closest('.book-page'));
      if (reg < 0) { continue; }
      var kids = childrenOf(reg);
      var ci = -1, k;
      for (k = 0; k < kids.length; k++) {
        if (kids[k] === el || kids[k].contains(el)) { ci = k; break; }
      }
      if (ci < 0) { continue; }
      headings.push({ el: el, region: reg, child: ci, title: headingTitle(el) });
    }
    headings.sort(function (a, b) {
      return a.region !== b.region ? a.region - b.region : a.child - b.child;
    });
  }

  function setDisplay(el, hide) {
    var cur = (el.style.display === 'none');
    if (cur !== hide) { el.style.display = hide ? 'none' : ''; }
  }

  function showSection(i) {
    buildSections();
    if (!headings.length) { return; }
    secIndex = Math.max(0, Math.min(headings.length - 1, i));
    var start = headings[secIndex];
    var nxt = headings[secIndex + 1];
    var endRegion = nxt ? nxt.region : pageEls.length - 1;
    var endChild = nxt ? nxt.child : childrenOf(endRegion).length;
    var r, k, kids;
    for (r = 0; r < pageEls.length; r++) {
      setDisplay(pageEls[r], r < start.region || r > endRegion);
    }
    for (r = start.region; r <= endRegion; r++) {
      kids = childrenOf(r);
      for (k = 0; k < kids.length; k++) {
        var hide = false;
        if (r === start.region && k < start.child) { hide = true; }
        if (r === endRegion && k >= endChild) { hide = true; }
        setDisplay(kids[k], hide);
      }
    }
    if (counter) {
      sectionLabel = 'Section ' + (secIndex + 1) + ' of ' + headings.length
        + ' \u00b7 ' + headings[secIndex].title;
      counter.textContent = sectionLabel;
    }
    if (badge) { badge.textContent = 'Section ' + (secIndex + 1) + '/' + headings.length; }
    if (headings[secIndex].el) {
      try { headings[secIndex].el.scrollIntoView({ block: 'start' }); }
      catch (e) { headings[secIndex].el.scrollIntoView(); }
    }
  }

  function clearSection() {
    var r, k, kids;
    for (r = 0; r < pageEls.length; r++) {
      pageEls[r].style.display = '';
      kids = childrenOf(r);
      for (k = 0; k < kids.length; k++) { kids[k].style.display = ''; }
    }
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode === 'section') {
      app.classList.remove('mode-single', 'mode-spread');
      app.classList.add('mode-continuous');
      app.setAttribute('data-mode', 'section');
      app.setAttribute('data-effective-mode', 'section');
      buildSections();
      showSection(secIndex);
      if (note) { note.textContent = 'Sections follow the book\u2019s own verified headings ('
        + headings.length + ' anchors). These are the book\u2019s real sections, not printed pages: '
        + 'the available source carries no printed page numbers.'; }
    } else {
      clearSection();
      if (mode === 'continuous') {
        app.classList.remove('mode-single', 'mode-spread');
        app.classList.add('mode-continuous');
        app.setAttribute('data-mode', 'continuous');
        app.setAttribute('data-effective-mode', 'continuous');
        if (note) { note.textContent = 'Continuous reading: the whole book on one flowing sheet.'; }
        if (badge) { badge.textContent = 'Continuous'; }
        if (counter) {                                  /* refresh the stale capture label */
          var cur = document.querySelector('.book-page.is-current') || pageEls[0];
          var groups = document.querySelectorAll('.nav-group');
          if (cur && groups.length) {
            counter.textContent = 'Section ' + cur.dataset.groupIndex + ' / ' + groups.length
              + ' \u00b7 ' + (cur.dataset.groupTitle || '');
          }
        }
      } else if (mode === 'single') {
        app.classList.remove('mode-continuous', 'mode-spread');
        app.classList.add('mode-single');
        app.setAttribute('data-mode', 'single');
        app.setAttribute('data-effective-mode', 'single');
        if (note) { note.textContent = CAPTURE_NOTE; }
        if (badge) { badge.textContent = 'Source capture'; }
      }
    }
    var p = prefs(); p.mode = mode; save(p);
  }

  var uiMove = move;
  move = function (n) {
    if (state.mode === 'section') {
      buildSections();
      showSection(secIndex + n);
      var el = headings[secIndex] && headings[secIndex].el;
      if (el) {
        try { el.scrollIntoView({ block: 'start' }); } catch (e) { el.scrollIntoView(); }
        var bar = document.querySelector('.toolbar');
        if (bar) { main.scrollTop = Math.max(0, main.scrollTop - bar.getBoundingClientRect().height - 8); }
      }
      save(function () { var p = prefs(); p.mode = 'section'; return p; }());
      return;
    }
    uiMove(n);
  };

  if (modeSel) {
    modeSel.addEventListener('change', function () { setMode(modeSel.value); });
  }
  document.addEventListener('keydown', function (e) {
    if (state.mode !== 'section') { return; }
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') { return; }
    var t = e.target;
    if (t && t.matches && t.matches('input,textarea,select')) { return; }
    e.preventDefault(); e.stopImmediatePropagation();
    move(e.key === 'ArrowRight' ? 1 : -1);
  }, true);

  /* ---------- 3. mobile drawers must not overlap ------------------------- */
  var NARROW = 850;
  function narrow() { return window.innerWidth <= NARROW; }

  function setPanel(which, open, persist) {
    var p = prefs();
    if (which === 'left') {
      app.classList.toggle('left-closed', !open);
      var lt = document.querySelector('#left-toggle');
      if (lt) { lt.setAttribute('aria-expanded', String(!!open)); }
      if (persist) { p.left = open ? 'open' : 'closed'; save(p); }
    } else {
      app.classList.toggle('right-closed', !open);
      var rt = document.querySelector('#right-toggle');
      if (rt) { rt.setAttribute('aria-expanded', String(!!open)); }
      if (persist) { p.right = open ? 'open' : 'closed'; save(p); }
    }
  }

  function applyStoredPanels() {
    var p = prefs();
    var left = p.left !== 'closed', right = p.right !== 'closed';
    if (narrow() && left && right) { right = false; }   /* transient: do not persist */
    setPanel('left', left, false);
    setPanel('right', right, false);
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) { return; }
    if (!narrow()) { return; }
    /* capture phase: runs before the toggle has flipped, so never gate on the
       current class - just make sure the other drawer is closed afterwards. */
    if (t.closest('#left-toggle')) {
      window.setTimeout(function () { if (!app.classList.contains('left-closed')) { setPanel('right', false, false); } }, 0);
    } else if (t.closest('#right-toggle')) {
      window.setTimeout(function () { if (!app.classList.contains('right-closed')) { setPanel('left', false, false); } }, 0);
    }
  }, true);

  var lastNarrow = narrow();
  window.addEventListener('resize', function () {
    var now = narrow();
    if (now !== lastNarrow) {
      lastNarrow = now;
      applyStoredPanels();
      if (note && state.mode === 'continuous') {
        note.textContent = 'Continuous reading: the whole book on one flowing sheet.';
      } else if (note && state.mode === 'single') {
        note.textContent = CAPTURE_NOTE;
      }
    }
  });

  /* reader/ui.js clears the layout classes whenever it re-applies its own mode;
     in Section mode that would drop the section clipping, so re-assert it. */
  if (window.MutationObserver) {
    var fixing = false;
    new MutationObserver(function () {
      if (fixing || state.mode !== 'section') { return; }
      if (!app.classList.contains('mode-continuous')) {
        fixing = true;
        app.classList.add('mode-continuous');
        app.setAttribute('data-mode', 'section');
        app.setAttribute('data-effective-mode', 'section');
        fixing = false;
      }
    }).observe(app, { attributes: true, attributeFilter: ['class', 'data-mode', 'data-effective-mode'] });
  }

  /* ---------- 4. start ---------------------------------------------------- */
  applyStoredPanels();

  /* ---------- vertical photo credits -------------------------------------- */
  /* In the source a credit often runs vertically down the right edge of the
     photograph, and the reconstruction keeps it in a narrow side cell, which
     breaks the words in half ("Productio/ns").  Detect exactly those credits
     (a credit line in a cell far narrower than its own table) and let the
     stylesheet set them vertically, as the source prints them.  Nothing is
     hidden, removed or rewritten: only a class and the writing mode change. */
  var CREDIT_RE = /(Getty Images|Alamy|Shutterstock|AP Images|Reuters|Bloomberg|Courtesy|Photographer|iStock|Unsplash|Pexels)$/i;
  var styleEl = document.createElement('style');
  styleEl.textContent = '.b2-vcredit{writing-mode:vertical-rl;text-orientation:mixed;'
    + 'white-space:nowrap;margin:0 auto;line-height:1.15}';
  document.head.appendChild(styleEl);

  function tagVerticalCredits() {
    /* The real defect is a credit whose longest word is wider than the cell the
       source's vertical side credit was squeezed into, so the browser has to
       break the word in half ("Productio/ns").  Measure exactly that, word by
       word, in the credit's own font: a credit that fits is never touched. */
    var ps = document.querySelectorAll('.book-page .content p'), n = 0;
    var probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden';
    document.body.appendChild(probe);
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      var t = (p.textContent || '').replace(/\s+/g, ' ').trim();
      if (!t || t.length > 90 || !CREDIT_RE.test(t)) { continue; }
      var cs = window.getComputedStyle(p);
      var avail = p.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (!(avail > 0)) { continue; }
      probe.style.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var words = t.split(' '), widest = 0;
      for (var w = 0; w < words.length; w++) {
        probe.textContent = words[w];
        widest = Math.max(widest, probe.getBoundingClientRect().width);
      }
      if (widest > avail + 0.5 && !p.classList.contains('b2-vcredit')) {
        p.classList.add('b2-vcredit');
      }
      if (p.classList.contains('b2-vcredit')) { n++; }
    }
    probe.remove();
    return n;
  }
  var verticalCredits = tagVerticalCredits();
  var creditTimer = 0;
  /* At parse time the tables have not been laid out yet, so widths read as 0
     and nothing looks squeezed.  Re-measure once the images have loaded. */
  window.addEventListener('load', function () { verticalCredits = tagVerticalCredits(); });
  [400, 1200, 2500].forEach(function (ms) {
    window.setTimeout(function () { verticalCredits = tagVerticalCredits(); }, ms);
  });
  window.addEventListener('resize', function () {
    window.clearTimeout(creditTimer);
    creditTimer = window.setTimeout(function () { verticalCredits = tagVerticalCredits(); }, 250);
  });

  var stored = prefs();
  var want = stored.mode;
  if (want === 'spread') {                       /* the printed-spread claim is withdrawn */
    want = 'continuous';
    stored.mode = 'continuous'; save(stored);
    if (note) { note.textContent = SPREAD_WITHDRAWN; }
  }
  if (want === 'section' || want === 'single' || want === 'continuous') {
    if (modeSel) { modeSel.value = want; }
    setMode(want);
  }
  if (note && !note.textContent) {
    note.textContent = state.mode === 'section' ? note.textContent : CAPTURE_NOTE;
  }
  window.book2Semantics = { section: function (i) { setMode('section'); showSection(i); },
                            sections: function () { buildSections(); return headings.length; },
                            mode: function () { return state.mode; },
                            verticalCredits: function () { return verticalCredits; },
                            retagCredits: function () { verticalCredits = tagVerticalCredits(); return verticalCredits; } };
})();
