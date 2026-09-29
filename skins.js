/* One site-wide screen preference. It never edits cards, inventory or auth. */
(() => {
 'use strict';
 const key='sparkonScreenSkin';
 const normalize=v=>v==='basic'?'original':['original','premium','hero'].includes(v)?v:'premium';
 let current='premium';
 try{current=normalize(localStorage.getItem(key)||sessionStorage.getItem(key));}catch{}
 function paint(){
  document.documentElement.dataset.theme=current;
  document.querySelectorAll('header img.logo').forEach(img=>{img.src=current==='original'?'/games/assets/logo-original.svg':'/games/assets/logo.svg';});
  document.querySelectorAll('[data-sparkon-skin]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sparkonSkin===current)));
  for(const [id,value]of [['skinOriginal','original'],['skinPremium','premium'],['skinHero','hero']])document.getElementById(id)?.setAttribute('aria-pressed',String(current===value));
  if(document.getElementById('tvSkin'))document.getElementById('tvSkin').value=current;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=current==='original'?'#f5f5f7':'#000000';
 }
 function set(value,persist=true){
  current=normalize(value);
  try{sessionStorage.setItem(key,current==='original'?'basic':current);if(persist)localStorage.setItem(key,current);}catch{}
  paint();window.dispatchEvent(new CustomEvent('sparkon:skinchange',{detail:{skin:current}}));
 }
 window.SparkONSkin=Object.freeze({get:()=>current,set});
 // Set before page paint; scripts that still read the legacy session key see the same choice.
 set(current,false);
 document.addEventListener('DOMContentLoaded',()=>{
  if(!document.querySelector('[data-skin]')){
   const bar=document.createElement('div');bar.className='site-skin-bar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Screen style');
   for(const skin of ['original','premium','hero']){const b=document.createElement('button');b.type='button';b.dataset.sparkonSkin=skin;b.textContent=skin[0].toUpperCase()+skin.slice(1);b.addEventListener('click',()=>set(skin));bar.append(b);}
   const header=document.querySelector('body > header');const inner=header?.querySelector('.in');if(inner)inner.append(bar);else if(header)header.append(bar);else document.body.prepend(bar);
  }
  document.getElementById('skinOriginal')?.closest('section')?.classList.add('legacy-skin-panel');
  document.querySelector('.astra-tv-skin')?.classList.add('legacy-skin-panel');
  paint();
 });
 window.addEventListener('storage',e=>{if(e.key===key)set(e.newValue,false);});
})();
