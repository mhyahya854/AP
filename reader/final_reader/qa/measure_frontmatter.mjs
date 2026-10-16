// Measure the exact frontmatter strings in the font the reader uses, so the
// side padding can be chosen from the source's real line breaks.
import { attach, evaluate, goto, wait } from './cdp.mjs';

const url = process.argv[2];
const cdp = await attach('9361');
await goto(cdp, url, 1500);
await wait(300);

const CASES = [
  ['copy at 10pt', 'italic 400 13.3333px Cambria,serif',
    ['Acknowledgments and copyrights appear on the same page as the text and art selections they',
     'cover; these acknowledgments and copyrights constitute an extension of the copyright page.']],
  ['copy at 9pt', 'italic 400 12px Cambria,serif',
    ['Acknowledgments and copyrights appear on the same page as the text and art selections they',
     'cover; these acknowledgments and copyrights constitute an extension of the copyright page.']],
  ['ap at 10pt', 'normal 400 13.3333px Cambria,serif',
    ['AP\u00ae is a trademark registered by the College Board, which is not affiliated with, and',
     'BFW is a registered trademark in the U.S. of Bedford, Freeman & Worth Publishing']],
  ['ap at 9pt', 'normal 400 12px Cambria,serif',
    ['AP\u00ae is a trademark registered by the College Board, which is not affiliated with, and',
     'BFW is a registered trademark in the U.S. of Bedford, Freeman & Worth Publishing']],
  ['credits', 'normal 400 13.3333px Cambria,serif',
    ['Program Director, High School: Yolanda Cossio',
     'Senior Director, Rights and Permissions: Hilary Newman',
     'Photo Researcher: Cheryl DuBois, Lumina Datamatics, Inc.']],
  ['credits 11.5', 'normal 400 15.3333px Cambria,serif',
    ['Program Director, High School: Yolanda Cossio',
     'Senior Director, Rights and Permissions: Hilary Newman',
     'Photo Researcher: Cheryl DuBois, Lumina Datamatics, Inc.']],
  ['copy misc', 'normal 400 13.3333px Cambria,serif',
    ['Acknowledgments', 'ISBN 978-1-319-62619-8 (EPUB)',
     'Bedford, Freeman & Worth Publishers', '120 Broadway, New York, NY 10271']],
  ['breaks at 10pt', 'normal 400 13.3333px Cambria,serif',
    ['When an image provides important pedagogical information, alternative text (which',
     'When an image provides important pedagogical information, alternative text (which is',
     'is also known as alt text) is provided for the image. This text is not visible on the page',
     'All of our book designs and illustrations are checked to ensure that they meet contrast',
     'All of our book designs and illustrations are checked to ensure that they meet',
     'requirements for WCAG 2.0 AA. Meeting these standards ensures ease of use for users',
     'via this icon, either as a link or a dropdown starting with the text \u201cExtended description',
     'via this icon, either as a link or a dropdown starting with the text \u201cExtended',
     'In this book, extended descriptions are present for complex images and graphs that may be helpful to',
     'In this book, extended descriptions are present for complex images and graphs that may be helpful to understanding']],
  ['a11y body line1', 'normal 400 13.3333px Cambria,serif',
    ['When an image provides important pedagogical information, alternative text (which',
     'When an image provides important pedagogical information, alternative text (which is']],
  ['a11y icon line1', 'normal 400 13.3333px Cambria,serif',
    ['via this icon, either as a link or a dropdown starting with the text \u201cExtended description',
     'via this icon, either as a link or a dropdown starting with the text \u201cExtended',
     'via this icon, either as a link or a dropdown starting with the text \u201cExtended description\u201d:']],
  ['a11y heading', '700 26px Arial,Helvetica,sans-serif',
    ['Alternative Text']],
  ['title', '700 30px "Arial Narrow",Arial,Helvetica,sans-serif',
    ['BUSINESS WITH PERSONAL FINANCE']],
  ['subtitle', 'normal 400 20px Arial,Helvetica,sans-serif',
    ['for the AP\u00ae Course']],
  ['title authors', '700 13.3333px Cambria,serif',
    ['David A. Anderson', 'Christopher P. Neck']],
  ['copy italic', 'italic 400 13.3333px Cambria,serif',
    ['Acknowledgments and copyrights appear on the same page as the text and art selections they']],
  ['copy address', 'normal 400 13.3333px Cambria,serif',
    ['Bedford, Freeman & Worth Publishers', '120 Broadway, New York, NY 10271']],
];

const out = await evaluate(cdp, `(() => {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;white-space:pre;visibility:hidden';
  document.body.appendChild(probe);
  const res = {};
  const cases = ${JSON.stringify(CASES)};
  for (const [name, font, strings] of cases) {
    probe.style.font = font;
    res[name] = { font, widths: strings.map((s) => { probe.textContent = s; return Math.round(probe.getBoundingClientRect().width * 100) / 100; }) };
  }
  probe.remove();
  return res;
})()`);
console.log(JSON.stringify(out, null, 2));
cdp.close();
