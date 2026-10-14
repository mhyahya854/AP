
const app=document.querySelector('.app'),main=document.querySelector('main'),pages=[...document.querySelectorAll('.book-page')];
const counter=document.querySelector('#counter'),search=document.querySelector('#search');
const leftToggle=document.querySelector('#left-toggle'),leftClose=document.querySelector('#left-close');
const rightToggle=document.querySelector('#right-toggle'),rightClose=document.querySelector('#right-close');
function setLeftOpen(open){app.classList.toggle('left-closed',!open);leftToggle.setAttribute('aria-expanded',String(open))}
leftToggle.onclick=()=>setLeftOpen(app.classList.contains('left-closed'));
leftClose.onclick=()=>{setLeftOpen(false);leftToggle.focus()};
function setRightOpen(open){app.classList.toggle('right-closed',!open);rightToggle.setAttribute('aria-expanded',String(open))}
rightToggle.onclick=()=>setRightOpen(app.classList.contains('right-closed'));
rightClose.onclick=()=>{setRightOpen(false);rightToggle.focus()};
let current=0;const groups=[...document.querySelectorAll('.nav-group')].map(d=>d.querySelector('a').getAttribute('href').slice(1));const groupStarts=groups.map(id=>document.getElementById(id).closest('.book-page'));function groupOf(p){return Number(p.dataset.groupIndex)-1}const navGroups=[...document.querySelectorAll('nav details.nav-group')];const navLinks=[...document.querySelectorAll('nav a[href^="#"]')].map(a=>{const t=document.getElementById(a.getAttribute('href').slice(1));return t?{a:a,i:pages.indexOf(t.closest('.book-page'))}:null}).filter(x=>x&&x.i>=0).sort((x,y)=>x.i-y.i);
let navGroupSeen=-1,navLinkSeen=-2;
function markNav(i){const p=pages[i];const g=p?Number(p.dataset.groupIndex)-1:-1;
  if(g!==navGroupSeen){navGroupSeen=g;if(g>=0&&navGroups[g])navGroups[g].open=true}
  if(i===navLinkSeen)return;navLinkSeen=i;
  let k=-1;for(let j=0;j<navLinks.length;j++){if(navLinks[j].i<=i)k=j;else break}
  for(const x of navLinks)x.a.removeAttribute('aria-current');
  if(k>=0)navLinks[k].a.setAttribute('aria-current','true')}
function setCurrent(i){current=i;const p=pages[i];if(p){counter.textContent='Section '+(groupOf(p)+1)+' / '+groups.length+' · '+p.dataset.groupTitle;markNav(i)}}
let scrollFrame=0,scrollHeld=false,scrollHoldTimer=0;
function queueScrollSync(){if(!scrollFrame)scrollFrame=requestAnimationFrame(syncVisiblePage)}
function syncVisiblePage(){
  scrollFrame=0;if(scrollHeld||!pages.length)return;
  const top=Math.max(main.getBoundingClientRect().top,document.querySelector('.toolbar').getBoundingClientRect().bottom);
  let lo=0,hi=pages.length;
  while(lo<hi){const mid=(lo+hi)>>1;if(pages[mid].getBoundingClientRect().top<=top+1)lo=mid+1;else hi=mid}
  const i=Math.max(0,lo-1);if(i!==current)setCurrent(i);
}
function releaseScrollSync(){if(!scrollHeld)return;scrollHeld=false;clearTimeout(scrollHoldTimer);queueScrollSync()}
function holdScrollSync(){scrollHeld=true;clearTimeout(scrollHoldTimer);scrollHoldTimer=setTimeout(releaseScrollSync,1200)}
main.addEventListener('scroll',queueScrollSync,{passive:true});
main.addEventListener('scrollend',releaseScrollSync);
for(const event of ['wheel','touchstart','pointerdown'])main.addEventListener(event,releaseScrollSync,{passive:true});
function move(n){if(!pages.length)return;const k=Math.max(0,Math.min(groups.length-1,groupOf(pages[current])+n));const target=groupStarts[k];setCurrent(pages.indexOf(target));holdScrollSync();const box=target.getBoundingClientRect(),bar=document.querySelector('.toolbar').getBoundingClientRect();const delta=box.top-bar.bottom;main.scrollBy({top:delta,behavior:Math.abs(delta)>2500?'auto':'smooth'})}
document.querySelector('#prev').onclick=()=>move(-1);document.querySelector('#next').onclick=()=>move(1);
function indexFromHash(){const t=document.getElementById(decodeURIComponent(location.hash.slice(1)));return t?pages.indexOf(t.closest('.book-page')):-1}
function fragmentTarget(){const raw=location.hash.slice(1);if(!raw)return null;try{return document.getElementById(decodeURIComponent(raw))}catch(e){return null}}
function isTyping(el){return !!el&&!!el.matches&&el.matches('input,textarea,select')}
function focusFragment(){
  const t=fragmentTarget();if(!t||isTyping(document.activeElement))return;
  let f=t;
  if(f.classList.contains('canon-anchor')||f.getClientRects().length===0)f=t.closest('.book-page')||t;
  if(!f||document.activeElement===f)return;
  if(!f.hasAttribute('tabindex'))f.setAttribute('tabindex','-1');
  f.focus({preventScroll:true});
}
function syncFromHash(){const i=indexFromHash();if(i>=0){setCurrent(i);holdScrollSync()}focusFragment()}
document.querySelector('nav').addEventListener('click',e=>{const link=e.target.closest('a[href^="#"]');if(!link)return;const target=document.getElementById(link.getAttribute('href').slice(1));const i=target?pages.indexOf(target.closest('.book-page')):-1;if(i>=0){setCurrent(i);holdScrollSync()}if(matchMedia('(max-width:850px)').matches){setLeftOpen(false);if(i<0)leftToggle.focus()}setTimeout(focusFragment,0)});
window.addEventListener('hashchange',syncFromHash);if(pages.length)setCurrent(0);syncFromHash();if(location.hash)focusFragment();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!app.classList.contains('right-closed')){setRightOpen(false);rightToggle.focus();return}if(e.key==='Escape'&&!app.classList.contains('left-closed')){setLeftOpen(false);leftToggle.focus();return}if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return;const t=e.target;if(!t||t===document||typeof t.closest!=='function')return;if(t.closest('input,textarea,select,button,a,summary,aside,label'))return;if(e.key==='ArrowRight')move(1);if(e.key==='ArrowLeft')move(-1)});
const HEADING_LEVELS={"book-heading-0001":1,"book-heading-0002":3,"book-heading-0003":3,"book-heading-0004":3,"book-heading-0005":3,"book-heading-0006":3,"book-heading-0007":2,"book-heading-0008":3,"book-heading-0009":3,"book-heading-0010":4,"book-heading-0011":4,"book-heading-0012":4,"book-heading-0013":3,"book-heading-0014":3,"book-heading-0015":3,"book-heading-0016":4,"book-heading-0017":4,"book-heading-0018":4,"book-heading-0019":4,"book-heading-0020":4,"book-heading-0021":4,"book-heading-0022":4,"book-heading-0023":4,"book-heading-0024":3,"book-heading-0025":3,"book-heading-0026":3,"book-heading-0027":4,"book-heading-0028":4,"book-heading-0029":4,"book-heading-0030":4,"book-heading-0031":4,"book-heading-0032":4,"book-heading-0033":4,"book-heading-0034":4,"book-heading-0035":4,"book-heading-0036":4,"book-heading-0037":3,"book-heading-0038":3,"book-heading-0039":3,"book-heading-0040":4,"book-heading-0041":4,"book-heading-0042":4,"book-heading-0043":4,"book-heading-0044":4,"book-heading-0045":3,"book-heading-0046":3,"book-heading-0047":3,"book-heading-0048":4,"book-heading-0049":4,"book-heading-0050":4,"book-heading-0051":4,"book-heading-0052":4,"book-heading-0053":4,"book-heading-0054":4,"book-heading-0055":4,"book-heading-0056":4,"book-heading-0057":4,"book-heading-0058":4,"book-heading-0059":3,"book-heading-0060":3,"book-heading-0061":4,"book-heading-0062":4,"book-heading-0063":4,"book-heading-0064":4,"book-heading-0065":4,"book-heading-0066":4,"book-heading-0067":3,"book-heading-0068":3,"book-heading-0069":3,"book-heading-0070":4,"book-heading-0071":4,"book-heading-0072":4,"book-heading-0073":4,"book-heading-0074":4,"book-heading-0075":4,"book-heading-0076":4,"book-heading-0077":4,"book-heading-0078":4,"book-heading-0079":4,"book-heading-0080":4,"book-heading-0081":4,"book-heading-0082":4,"book-heading-0083":4,"book-heading-0084":3,"book-heading-0085":3,"book-heading-0086":3,"book-heading-0087":4,"book-heading-0088":4,"book-heading-0089":4,"book-heading-0090":4,"book-heading-0091":4,"book-heading-0092":4,"book-heading-0093":4,"book-heading-0094":4,"book-heading-0095":3,"book-heading-0096":3,"book-heading-0097":3,"book-heading-0098":4,"book-heading-0099":2,"book-heading-0100":3,"book-heading-0101":4,"book-heading-0102":4,"book-heading-0103":4,"book-heading-0104":4,"book-heading-0105":4,"book-heading-0106":4,"book-heading-0107":4,"book-heading-0108":4,"book-heading-0109":4,"book-heading-0110":4,"book-heading-0111":4,"book-heading-0112":4,"book-heading-0113":3,"book-heading-0114":3,"book-heading-0115":3,"book-heading-0116":4,"book-heading-0117":4,"book-heading-0118":4,"book-heading-0119":4,"book-heading-0120":4,"book-heading-0121":4,"book-heading-0122":4,"book-heading-0123":4,"book-heading-0124":4,"book-heading-0125":4,"book-heading-0126":4,"book-heading-0127":4,"book-heading-0128":4,"book-heading-0129":3,"book-heading-0130":3,"book-heading-0131":4,"book-heading-0132":4,"book-heading-0133":4,"book-heading-0134":4,"book-heading-0135":4,"book-heading-0136":4,"book-heading-0137":4,"book-heading-0138":4,"book-heading-0139":4,"book-heading-0140":4,"book-heading-0141":4,"book-heading-0142":4,"book-heading-0143":3,"book-heading-0144":3,"book-heading-0145":3,"book-heading-0146":4,"book-heading-0147":4,"book-heading-0148":4,"book-heading-0149":4,"book-heading-0150":4,"book-heading-0151":4,"book-heading-0152":4,"book-heading-0153":4,"book-heading-0154":4,"book-heading-0155":4,"book-heading-0156":4,"book-heading-0157":4,"book-heading-0158":4,"book-heading-0159":3,"book-heading-0160":3,"book-heading-0161":3,"book-heading-0162":4,"book-heading-0163":4,"book-heading-0164":4,"book-heading-0165":4,"book-heading-0166":4,"book-heading-0167":4,"book-heading-0168":4,"book-heading-0169":4,"book-heading-0170":4,"book-heading-0171":4,"book-heading-0172":3,"book-heading-0173":3,"book-heading-0174":3,"book-heading-0175":4,"book-heading-0176":4,"book-heading-0177":4,"book-heading-0178":4,"book-heading-0179":4,"book-heading-0180":3,"book-heading-0181":3,"book-heading-0182":4,"book-heading-0183":4,"book-heading-0184":4,"book-heading-0185":4,"book-heading-0186":4,"book-heading-0187":4,"book-heading-0188":4,"book-heading-0189":4,"book-heading-0190":4,"book-heading-0191":3,"book-heading-0192":3,"book-heading-0193":3,"book-heading-0194":4,"book-heading-0195":2,"book-heading-0196":3,"book-heading-0197":4,"book-heading-0198":4,"book-heading-0199":4,"book-heading-0200":4,"book-heading-0201":4,"book-heading-0202":4,"book-heading-0203":4,"book-heading-0204":4,"book-heading-0205":4,"book-heading-0206":4,"book-heading-0207":4,"book-heading-0208":4,"book-heading-0209":4,"book-heading-0210":4,"book-heading-0211":4,"book-heading-0212":3,"book-heading-0213":3,"book-heading-0214":3,"book-heading-0215":4,"book-heading-0216":4,"book-heading-0217":4,"book-heading-0218":4,"book-heading-0219":4,"book-heading-0220":4,"book-heading-0221":4,"book-heading-0222":4,"book-heading-0223":4,"book-heading-0224":4,"book-heading-0225":4,"book-heading-0226":4,"book-heading-0227":3,"book-heading-0228":3,"book-heading-0229":2,"book-heading-0230":3,"book-heading-0231":3,"book-heading-0232":3,"book-heading-0233":3,"book-heading-0234":3,"book-heading-0235":3,"book-heading-0236":3,"book-heading-0237":3,"book-heading-0238":3,"book-heading-0239":3,"book-heading-0240":3,"book-heading-0241":3,"book-heading-0242":3,"book-heading-0243":3,"book-heading-0244":3,"book-heading-0245":3,"book-heading-0246":3,"book-heading-0247":3,"book-heading-0248":3,"book-heading-0249":3,"book-heading-0250":3,"book-heading-0251":3,"book-heading-0252":3,"book-heading-0253":3,"book-heading-0254":3,"book-heading-0255":3,"book-heading-0256":3,"book-heading-0257":3,"book-heading-0258":3,"book-heading-0259":3,"book-heading-0260":3,"book-heading-0261":3,"book-heading-0262":3,"book-heading-0263":3,"book-heading-0264":3,"book-heading-0265":3,"book-heading-0266":3,"book-heading-0267":3,"book-heading-0268":3,"book-heading-0269":3,"book-heading-0270":3,"book-heading-0271":3,"book-heading-0272":3,"book-heading-0273":3,"book-heading-0274":3,"book-heading-0275":3,"book-heading-0276":3,"book-heading-0277":3,"book-heading-0278":3,"book-heading-0279":3,"book-heading-0280":3,"book-heading-0281":3,"book-heading-0282":3,"book-heading-0283":3,"book-heading-0284":3,"book-heading-0285":3,"book-heading-0286":3,"book-heading-0287":3,"book-heading-0288":3,"book-heading-0289":3,"book-heading-0290":3,"book-heading-0291":3,"book-heading-0292":2,"book-heading-0293":3,"book-heading-0294":3,"book-heading-0295":3,"book-heading-0296":3,"book-heading-0297":3,"book-heading-0298":3,"book-heading-0299":3,"book-heading-0300":3,"book-heading-0301":3,"book-heading-0302":3,"book-heading-0303":3,"book-heading-0304":3,"book-heading-0305":3,"book-heading-0306":3,"book-heading-0307":3,"book-heading-0308":3,"book-heading-0309":3,"book-heading-0310":3,"book-heading-0311":3,"book-heading-0312":3,"book-heading-0313":3,"book-heading-0314":3,"book-heading-0315":3,"book-heading-0316":3,"book-heading-0317":3,"book-heading-0318":3,"book-heading-0319":3,"book-heading-0320":3,"book-heading-0321":3,"book-heading-0322":3,"book-heading-0323":3,"book-heading-0324":3,"book-heading-0325":3,"book-heading-0326":3,"book-heading-0327":3,"book-heading-0328":3,"book-heading-0329":3,"book-heading-0330":3,"book-heading-0331":3,"book-heading-0332":3,"book-heading-0333":3,"book-heading-0334":3,"book-heading-0335":3,"book-heading-0336":2,"book-heading-0337":3,"book-heading-0338":3,"book-heading-0339":3,"book-heading-0340":3,"book-heading-0341":3,"book-heading-0342":3,"book-heading-0343":3,"book-heading-0344":3,"book-heading-0345":3,"book-heading-0346":3,"book-heading-0347":3,"book-heading-0348":3,"book-heading-0349":3,"book-heading-0350":3,"book-heading-0351":3,"book-heading-0352":3,"book-heading-0353":3,"book-heading-0354":3,"book-heading-0355":3,"book-heading-0356":3,"book-heading-0357":3,"book-heading-0358":3,"book-heading-0359":3,"book-heading-0360":3,"book-heading-0361":3,"book-heading-0362":3,"book-heading-0363":3,"book-heading-0364":3,"book-heading-0365":3,"book-heading-0366":3,"book-heading-0367":3,"book-heading-0368":3,"book-heading-0369":3,"book-heading-0370":3,"book-heading-0371":3,"book-heading-0372":3,"book-heading-0373":3,"book-heading-0374":3,"book-heading-0375":3,"book-heading-0376":3,"book-heading-0377":3,"book-heading-0378":3,"book-heading-0379":3,"book-heading-0380":3,"book-heading-0381":3,"book-heading-0382":3,"book-heading-0383":3};
for(const id in HEADING_LEVELS){const el=document.getElementById(id);
  if(el){el.setAttribute('role','heading');el.setAttribute('aria-level',String(HEADING_LEVELS[id]))}}
const searchStatus=document.createElement('span');searchStatus.setAttribute('role','status');searchStatus.style.fontSize='12px';search.after(searchStatus);
function textContainer(node,page){
  for(let el=node.parentElement;el&&el!==page;el=el.parentElement)
    if(/^(P|LI|TD|TH|DD|DT|H[1-6]|SUMMARY|FIGCAPTION|CAPTION|PRE|BLOCKQUOTE|DETAILS|DIV|SECTION|TEXT|TITLE)$/.test(el.tagName.toUpperCase()))return el;
  return page;
}
function findMatch(page,q){
  const walker=document.createTreeWalker(page,NodeFilter.SHOW_TEXT);let node,container=null,content='';
  while((node=walker.nextNode())){
    const next=textContainer(node,page);
    if(next!==container){if(container&&content.toLocaleLowerCase().includes(q))return container;container=next;content=''}
    content+=node.textContent;
  }
  return container&&content.toLocaleLowerCase().includes(q)?container:null;
}
function revealMatch(match,page){for(let el=match;el&&el!==page;el=el.parentElement)if(el.tagName==='DETAILS')el.open=true}
let lastHit=null;
function markHit(match){if(lastHit&&lastHit!==match)lastHit.classList.remove('search-hit');lastHit=match;if(match)match.classList.add('search-hit')}
let searchRun=0;
search.oninput=e=>{
  const q=e.target.value.trim().toLocaleLowerCase(),run=++searchRun;
  if(q.length<2){searchStatus.textContent='';markHit(null);return}
  searchStatus.textContent='Searching…';let i=0;
  function scan(){
    if(run!==searchRun)return;
    const stop=Math.min(i+20,pages.length);
    for(;i<stop;i++){
      const page=pages[i];if(!page.textContent.toLocaleLowerCase().includes(q))continue;
      const match=findMatch(page,q);if(!match)continue;
      revealMatch(match,page);markHit(match);setCurrent(i);holdScrollSync();match.scrollIntoView({block:'center'});searchStatus.textContent='Match in '+page.dataset.navLabel;return;
    }
    if(i<pages.length)setTimeout(scan,0);else{searchStatus.textContent='No match';markHit(null)}
  }
  scan();
};
document.querySelector('#zoom').oninput=e=>document.documentElement.style.setProperty('--body-size',(11*Number(e.target.value)/100)+'pt');
function qa(){const failures=[];if(document.documentElement.scrollWidth>document.documentElement.clientWidth+1)failures.push({kind:'document-horizontal'});if(main.scrollWidth>main.clientWidth+1)failures.push({kind:'viewer-horizontal'});for(const p of pages){const r=p.getBoundingClientRect();if(p.scrollWidth>p.clientWidth+1)failures.push({id:p.id,kind:'section-horizontal',dx:p.scrollWidth-p.clientWidth});for(const d of p.querySelectorAll('p,table,img,svg,figure,figcaption,details,.desc-panel,.mobile-diagram-scroll')){if(d.closest('.mobile-diagram-scroll')&& !d.classList.contains('mobile-diagram-scroll'))continue;const closed=d.closest('details:not([open])');if(closed&&d!==closed&&!d.closest('summary'))continue;if(d.getClientRects().length===0)continue;const x=d.getBoundingClientRect();if(x.left<r.left-1||x.right>r.right+1||x.top<r.top-1||x.bottom>r.bottom+1){failures.push({id:p.id,kind:'visible-content-outside-section',tag:d.tagName});break}}}return failures}
window.book2QA=qa;document.querySelector('#qa').onclick=()=>{const a=qa();document.querySelector('#qa-status').textContent=a.length?a.length+' layout failures; see console':'No outer-page overflow in checked elements; inspect internal diagrams separately';console.table(a)};
