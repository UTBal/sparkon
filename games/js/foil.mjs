const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=v=>Math.max(0,Math.min(1,v));
document.querySelectorAll('.foil-card').forEach(card=>{
  let bounds, touching=false, x=.5, y=.5;
  function paint(px,py){
    x=clamp(px);y=clamp(py);
    card.style.setProperty('--light-x',`${x*100}%`);
    card.style.setProperty('--light-y',`${y*100}%`);
    card.style.setProperty('--rx',`${reduced.matches?0:(.5-y)*14}deg`);
    card.style.setProperty('--ry',`${reduced.matches?0:(x-.5)*14}deg`);
    card.classList.add('is-lit');
  }
  function reset(){touching=false;bounds=null;card.classList.remove('is-lit');card.style.setProperty('--rx','0deg');card.style.setProperty('--ry','0deg');}
  card.addEventListener('pointerenter',()=>{bounds=card.getBoundingClientRect();});
  card.addEventListener('pointerdown',e=>{bounds=card.getBoundingClientRect();touching=true;if(e.pointerType!=='mouse')card.setPointerCapture(e.pointerId);paint((e.clientX-bounds.left)/bounds.width,(e.clientY-bounds.top)/bounds.height);});
  card.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'&&!touching)return;bounds??=card.getBoundingClientRect();paint((e.clientX-bounds.left)/bounds.width,(e.clientY-bounds.top)/bounds.height);});
  ['pointerleave','pointerup','pointercancel','lostpointercapture','blur'].forEach(event=>card.addEventListener(event,reset));
  card.addEventListener('keydown',e=>{const offsets={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]};if(offsets[e.key]){e.preventDefault();paint(x+offsets[e.key][0],y+offsets[e.key][1]);}else if(e.key==='Escape')reset();});
  reduced.addEventListener('change',reset);
});
