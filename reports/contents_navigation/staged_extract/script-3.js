/* ===== Book 2 continuous-reading wave (2026-10-12) =======================
   Additive only.  It re-uses the verified reader's own preferences
   (`window.book2ReaderPrefs`) and never touches content.
   ====================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;

  /* The reconstruction's paragraphs carry their own inline type sizes, so the
     base control (which only moves --body-size) cannot scale them.  The text
     size is therefore also exposed as a multiplier on the reading surface, so
     the control genuinely resizes every text node. */
  function prefs() {
    try { return (typeof window.book2ReaderPrefs === 'function') ? window.book2ReaderPrefs() : null; }
    catch (e) { return null; }
  }
  function syncTextScale() {
    var p = prefs();
    var size = (p && p.size) ? p.size : 100;
    if (!p) {
      var el = document.getElementById('zoom');
      if (el) { size = Number(el.value) || 100; }
    }
    root.style.setProperty('--b2-text', String(size / 100));
  }
  var slider = document.getElementById('zoom');
  if (slider) { slider.addEventListener('input', syncTextScale); slider.addEventListener('change', syncTextScale); }
  ['click', 'change', 'keyup'].forEach(function (t) {
    document.addEventListener(t, function (ev) {
      var t2 = ev.target;
      if (!t2 || !t2.closest) { return; }
      if (t2.closest('#reader-controls')) { window.setTimeout(syncTextScale, 0); }
    }, true);
  });
  syncTextScale();

  /* Some regions were recovered from OCR, so their headings kept no run
     formatting and were rendering at body size.  Mark those (and only those)
     so the stylesheet can give them the book's heading presentation.  The
     heading level is the one the verified navigation manifest already
     assigned (role=heading / aria-level), so nothing is invented. */
  function markUnstyledHeadings() {
    var hs = document.querySelectorAll('[id^="book-heading-"]');
    var n = 0;
    for (var i = 0; i < hs.length; i++) {
      var el = hs[i];
      if (el.tagName === 'SUMMARY') { continue; }
      var own = el.getAttribute('style') || '';
      if (own.indexOf('font-size') >= 0) { continue; }
      if (el.querySelector('[style*="font-size"]')) { continue; }
      el.classList.add('b2-h');
      el.setAttribute('data-b2-level', el.getAttribute('aria-level') || '3');
      n++;
    }
    return n;
  }
  var unstyled = markUnstyledHeadings();

  window.book2Wave = { syncTextScale: syncTextScale, markUnstyledHeadings: markUnstyledHeadings,
                       unstyledHeadingsMarked: unstyled };
})();
