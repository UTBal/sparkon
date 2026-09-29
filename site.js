/* SparkON shared site behavior
 * The logo returns to the page's home URL. On home, add a cache-busting
 * query so a logo click performs a fresh document navigation.
 */
(function () {
  function homePath(pathname) {
    pathname = pathname.replace(/\/+$/, '');
    return pathname === '' || pathname === '/index.html' || /\/index\.html$/.test(pathname)
      ? pathname.replace(/\/index\.html$/, '') + '/index.html'
      : pathname + '/index.html';
  }

  document.querySelectorAll('a.logo, a[data-logo-link]').forEach(function (logo) {
    logo.addEventListener('click', function (event) {
      var target = new URL(logo.getAttribute('href') || '/', document.baseURI);
      var currentPath = homePath(window.location.pathname);
      var targetPath = homePath(target.pathname);
      if (currentPath !== targetPath) return;

      event.preventDefault();
      target.search = 't=' + Date.now();
      window.location.href = target.href;
    });
  });
})();

/* SparkON card tilt + holographic shine
 * Desktop: pointermove (mouse hover) — unchanged behavior.
 * Mobile: DeviceOrientation (tilt phone) + touch-drag with pointer capture.
 * iOS 13+: DeviceOrientationEvent.requestPermission() on first .tilt gesture.
 */

(function () {
  var tilts = [];
  var boundTilts = new WeakSet();

  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var orientActive = false;
  var orientStarted = false;
  var permissionAsked = false;

  function applyTilt(el, x, y) {
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    el.classList.add('live');
    el.style.setProperty('--mx', (x * 100) + '%');
    el.style.setProperty('--my', (y * 100) + '%');
    el.querySelectorAll('.card').forEach(function (c) {
      c.style.setProperty('--mx', (x * 100) + '%');
      c.style.setProperty('--my', (y * 100) + '%');
    });
    el.style.transform = reduceMotion ? '' :
      'perspective(900px) rotateY(' + ((x - 0.5) * 16) + 'deg) rotateX(' + ((0.5 - y) * 16) + 'deg) scale(1.03)';
  }

  function clearTilt(el) {
    el.classList.remove('live');
    el.style.transform = '';
  }

  function clearAllTilts() {
    tilts.forEach(clearTilt);
  }

  /* —— Pointer: desktop hover + touch-drag —— */
  function bindTilt(el) {
    if (boundTilts.has(el)) return;
    boundTilts.add(el);
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        requestOrientPermission();
      }
    });

    el.addEventListener('pointermove', function (e) {
      var isMouse = e.pointerType === 'mouse' || e.pointerType === '';
      var dragging = e.buttons > 0 || (typeof el.hasPointerCapture === 'function' && el.hasPointerCapture(e.pointerId));
      if (!isMouse && !dragging) return;

      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var x = (e.clientX - r.left) / r.width;
      var y = (e.clientY - r.top) / r.height;
      el._pointerTilt = true;
      applyTilt(el, x, y);
    });

    function endPointer(e) {
      el._pointerTilt = false;
      /* Keep orientation-driven shine; only clear when gyro is not driving */
      if (!orientActive) clearTilt(el);
    }

    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
    el.addEventListener('lostpointercapture', endPointer);
    el.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'mouse' || e.pointerType === '') endPointer(e);
    });
  }
  function refreshTilts() {
    tilts = Array.prototype.slice.call(document.querySelectorAll('.tilt'));
    tilts.forEach(bindTilt);
  }
  refreshTilts();
  // Collections, galleries and live hands insert cards after the initial page load.
  new MutationObserver(refreshTilts).observe(document.body, {childList:true, subtree:true});

  /* —— Device orientation (phone tilt) —— */
  function onOrient(e) {
    var gamma = e.gamma; /* left-right, ≈ -90..90 */
    var beta = e.beta;   /* front-back, ≈ -180..180 */
    if (gamma == null || beta == null) return;

    orientActive = true;

    /* Map ≈ ±25° around a natural viewing hold (~55° beta) into 0..1 */
    var x = 0.5 + Math.max(-0.5, Math.min(0.5, gamma / 25));
    var y = 0.5 + Math.max(-0.5, Math.min(0.5, (beta - 55) / 25));

    tilts.forEach(function (el) {
      if (el._pointerTilt) return;
      applyTilt(el, x, y);
    });
  }

  function startOrient() {
    if (orientStarted || reduceMotion) return;
    orientStarted = true;
    window.addEventListener('deviceorientation', onOrient, { passive: true });
  }

  function requestOrientPermission() {
    if (permissionAsked || reduceMotion) return;
    permissionAsked = true;

    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(function (state) {
          if (state === 'granted') startOrient();
        })
        .catch(function () {});
    } else if (typeof DeviceOrientationEvent !== 'undefined') {
      startOrient();
    }
  }

  /* Android / desktop-with-orient: no permission API — start immediately */
  if (!reduceMotion &&
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission !== 'function') {
    startOrient();
  }

  /* Pause orientation shine when tab is hidden */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      orientActive = false;
      clearAllTilts();
    }
  });
})();

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
