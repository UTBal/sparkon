
document.querySelectorAll('.tilt').forEach(function(el){
  el.addEventListener('pointermove',function(e){
    var r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
    el.classList.add('live');
    el.style.setProperty('--mx',(x*100)+'%');el.style.setProperty('--my',(y*100)+'%');
    el.querySelectorAll('.card').forEach(function(c){c.style.setProperty('--mx',(x*100)+'%');c.style.setProperty('--my',(y*100)+'%')});
    el.style.transform='perspective(900px) rotateY('+((x-.5)*16)+'deg) rotateX('+((.5-y)*16)+'deg) scale(1.03)';
  });
  el.addEventListener('pointerleave',function(){el.classList.remove('live');el.style.transform='';});
});

/* R18: keyboard-accessible card / challenge flips */
document.querySelectorAll('.flip').forEach(function(el){
  if (el.getAttribute('data-flip-ready') === '1') return;
  el.setAttribute('data-flip-ready', '1');
  el.setAttribute('role', 'button');
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Flip card to see the other side');
  el.setAttribute('aria-expanded', el.classList.contains('flipped') ? 'true' : 'false');
  el.removeAttribute('onclick');
  function toggleFlip(e){
    if (e) { e.preventDefault(); e.stopPropagation(); }
    el.classList.toggle('flipped');
    var on = el.classList.contains('flipped');
    el.setAttribute('aria-expanded', on ? 'true' : 'false');
    /* Keep the inactive face out of the reading order when possible */
    var faces = el.querySelectorAll('.inner > div');
    if (faces.length >= 2) {
      faces[0].setAttribute('aria-hidden', on ? 'true' : 'false');
      faces[1].setAttribute('aria-hidden', on ? 'false' : 'true');
    }
  }
  var faces0 = el.querySelectorAll('.inner > div');
  if (faces0.length >= 2) {
    faces0[0].setAttribute('aria-hidden', 'false');
    faces0[1].setAttribute('aria-hidden', 'true');
  }
  el.addEventListener('click', toggleFlip);
  el.addEventListener('keydown', function(e){
    if (e.key === 'Enter' || e.key === ' ') toggleFlip(e);
  });
});

/* R19: labelled mobile menu */
document.querySelectorAll('header.top').forEach(function(header){
  var nav = header.querySelector('nav');
  if (!nav) return;
  if (!nav.id) nav.id = 'site-nav';
  var btn = header.querySelector('.nav-toggle');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', nav.id);
    btn.setAttribute('aria-label', 'Open menu');
    btn.textContent = 'Menu';
    var logo = header.querySelector('.logo');
    if (logo && logo.parentNode) logo.parentNode.insertBefore(btn, nav);
  }
  function setOpen(open){
    header.classList.toggle('nav-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    btn.textContent = open ? 'Close' : 'Menu';
  }
  btn.addEventListener('click', function(){
    setOpen(!header.classList.contains('nav-open'));
  });
  nav.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){ setOpen(false); });
  });
});
