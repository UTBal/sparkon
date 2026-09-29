
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
