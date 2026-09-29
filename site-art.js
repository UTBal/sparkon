import {loadCardArt,renderCardInstance} from '/games/js/cards.js';
import {CONCEPTS} from '/games/js/collection.mjs';
await loadCardArt();
const gallery=document.getElementById('edition-gallery');
let edition='premium';
function renderGallery(){
 if(!gallery)return;
 gallery.replaceChildren();
 for(const c of CONCEPTS){const wrap=document.createElement('div');wrap.append(renderCardInstance({conceptId:c.id,edition}));const p=document.createElement('p');p.className='art-caption';p.textContent=c.rule;wrap.append(p);gallery.append(wrap);}
 document.querySelectorAll('[data-edition]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.edition===edition)));
}
document.querySelectorAll('[data-edition]').forEach(b=>b.addEventListener('click',()=>{edition=b.dataset.edition;renderGallery();}));
renderGallery();
// Public homepage art sample only: never used for owned inventory or game hands.
const showcase=document.querySelector('[data-public-art]');
if(showcase){
 const original=showcase.firstElementChild;
 function show(){const skin=window.SparkONSkin?.get()||'premium';showcase.replaceChildren();if(skin==='original'){showcase.append(original);}else{const a=document.createElement('a');a.href='/editions.html';a.setAttribute('aria-label',`Explore ${skin} card artwork`);a.append(renderCardInstance({conceptId:'pi',edition:skin}));showcase.append(a);}}
 show();window.addEventListener('sparkon:skinchange',show);
}
