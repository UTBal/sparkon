/** Astra art direction v7. Content supplied separately; no collection/scoring writes. */
import { CONCEPTS } from './collection.mjs';
const asset='/games/assets/';
const premiumNew=['percent','newton2','ohm','density','oxygen','photosynthesis','speed','friction'];
const heroNew=['percent','gold','ohm','density','oxygen','photosynthesis','speed'];
const heroOriginal={newton2:[505,98],'kinetic-energy':[912,98],pythagoras:[100,610],dna:[505,610],friction:[912,610]};
let publicCards=new Map();
export async function loadAstraContent(){
 const response=await fetch('/games/data/pack.public.json');
 if(!response.ok)throw new Error('Public card content unavailable');
 const pack=await response.json();publicCards=new Map(pack.cards.map(c=>[c.id,c]));
}
export function artFor(id,edition){
 if(id==='pi')return {image:asset+edition+'-pi.png',full:true};
 const c=CONCEPTS.find(c=>c.id===id);
 if(edition==='premium'&&Number.isInteger(c?.art))return {image:asset+'premium-concept.png',oldPremium:c.art};
 if(edition==='hero'&&heroOriginal[id])return {image:asset+'hero-edition.png',oldHero:heroOriginal[id]};
 const i=(edition==='hero'?heroNew:premiumNew).indexOf(id);
 if(i<0)throw new Error('Astra artwork missing: '+edition+'/'+id);
 return {image:asset+(edition==='hero'?'hero-expansion-v7.png':'premium-expansion-v7.png'),col:i%4,row:Math.floor(i/4)};
}
function element(tag,cls,text){const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;}
export function renderAstraCard(instance){
 const id=instance.conceptId,ed=instance.edition;
 const c=CONCEPTS.find(c=>c.id===id);
 if(!c&&id!=='pi')throw new Error('Unknown science concept: '+id);
 const content=publicCards.get(id)||{title:c?.name,subject:c?.subject,rule:c?.rule};
 const spec=artFor(id,ed);
 const card=element('article','astra-card astra-'+ed);
 card.dataset.conceptId=id;card.dataset.artDirector='Astra';card.dataset.edition=ed;
 card.setAttribute('aria-label',`${content.title||'π — The constant'} · ${ed}`);
 const frame=element('div','astra-frame');card.append(frame);
 if(spec.full){
  card.classList.add('astra-pi');
  const img=element('img','astra-pi-image');img.src=spec.image;img.alt=`${ed} π collectible design; C = 2πr and A = πr²`;
  frame.append(img);
 }else{
  const top=element('div','astra-top');
  const logo=element('img','astra-wordmark');logo.src=asset+'logo.svg';logo.alt='SparkON';
  top.append(logo,element('span','astra-subject',content.subject));
  const art=element('div','astra-art');art.setAttribute('aria-hidden','true');
  if(spec.oldPremium!==undefined){
   const img=element('img','astra-original-crop');img.src=spec.image;img.alt='';img.style.left=`${-((28+438*spec.oldPremium)/400)*100}%`;art.append(img);
  }else{
   art.style.backgroundImage=`url("${spec.image}")`;
   if(spec.oldHero){const[x,y]=spec.oldHero;art.style.backgroundSize=`${1373/355*100}% ${1145/300*100}%`;art.style.backgroundPosition=`${x/(1373-355)*100}% ${y/(1145-300)*100}%`;}
   else {art.style.backgroundSize='400% 200%';art.style.backgroundPosition=`${spec.col/3*100}% ${spec.row*100}%`;}
  }
  const copy=element('div','astra-copy');
  copy.append(element('p','astra-series',ed==='hero'?'HERO ARCHIVE':'PREMIUM ARCHIVE'),element('h3','astra-title',content.title),element('p','astra-formula',c.formula));
  const foot=element('div','astra-foot');foot.append(element('span','',ed==='hero'?'✧ HERO':'✦ PREMIUM'),element('span','',String(CONCEPTS.indexOf(c)+1).padStart(2,'0')+' / 12'));
  frame.append(top,art,copy,foot);
 }
 const glint=element('div','astra-glint');glint.setAttribute('aria-hidden','true');frame.append(glint);
 // The caller may put the card in a button. No nested controls or keyboard traps.
 return card;
}
// Delegated effect supports cards added later by live room snapshots and pack reveals.
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
let active=null,raf=0,next=null;
function reset(){if(active){active.style.removeProperty('--rx');active.style.removeProperty('--ry');active.classList.remove('astra-lit');}active=null;next=null;cancelAnimationFrame(raf);raf=0;}
function paint(e){
 const card=e.target.closest?.('.astra-card')||e.target.closest?.('.hand-pick')?.querySelector('.astra-card');
 if(!card)return;
 if(active&&active!==card)reset();active=card;
 const r=card.getBoundingClientRect(),x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
 next={card,x,y};if(raf)return;
 raf=requestAnimationFrame(()=>{raf=0;if(!next)return;const{card,x,y}=next;card.style.setProperty('--lx',x*100+'%');card.style.setProperty('--ly',y*100+'%');card.style.setProperty('--rx',reduce.matches?'0deg':(0.5-y)*10+'deg');card.style.setProperty('--ry',reduce.matches?'0deg':(x-0.5)*10+'deg');card.classList.add('astra-lit');});
}
document.addEventListener('pointermove',paint,{passive:true});
document.addEventListener('pointerdown',paint,{passive:true});
document.addEventListener('pointerout',e=>{if(active&&!active.contains(e.relatedTarget)&&!active.closest('.hand-pick')?.contains(e.relatedTarget))reset();},{passive:true});
['pointerup','pointercancel'].forEach(t=>document.addEventListener(t,reset,{passive:true}));
window.addEventListener('blur',reset);reduce.addEventListener('change',reset);
