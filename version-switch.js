/*! Eureka version switcher — toggles /v1/ ↔ /v2/ from the Demo site control. */
(function () {
  // Small recycle mark inline with the Demo site label.
  var RECYCLE_ICON = '<span class="demo-icon" aria-hidden="true">♻</span>';

  // Pages that exist in only one version (path relative to that version root).
  var ONLY_IN = {
    v2: { 'cards/pi.html': true }
  };

  function parsePath(pathname) {
    var m = pathname.match(/^(.*)\/(v[12])(?:\/(.*))?$/);
    if (!m) return null;
    var rest = m[3] || '';
    if (rest === '' || rest.charAt(rest.length - 1) === '/') {
      rest = rest + 'index.html';
    }
    return { prefix: m[1], version: m[2], rest: rest };
  }

  function counterpartHref() {
    var parsed = parsePath(location.pathname);
    if (!parsed) return null;
    var other = parsed.version === 'v1' ? 'v2' : 'v1';
    var only = ONLY_IN[parsed.version];
    if (only && only[parsed.rest]) {
      return parsed.prefix + '/' + other + '/index.html';
    }
    return parsed.prefix + '/' + other + '/' + parsed.rest;
  }

  function go() {
    var href = counterpartHref();
    if (!href) return;
    var dest = href + location.search + location.hash;

    if (location.protocol === 'file:') {
      location.href = dest;
      return;
    }

    var indexFallback = href.replace(/\/[^/]*$/, '/index.html');
    fetch(href, { method: 'HEAD', cache: 'no-store' })
      .then(function (r) {
        location.href = r.ok ? dest : indexFallback + location.search + location.hash;
      })
      .catch(function () {
        location.href = indexFallback + location.search + location.hash;
      });
  }

  function enhance(el) {
    if (el.getAttribute('data-version-switch') === '1') return;
    el.setAttribute('data-version-switch', '1');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('title', 'Switch to the other Eureka version');
    el.setAttribute('aria-label', 'Demo site — switch Eureka version');
    el.innerHTML = RECYCLE_ICON + '<span class="demo-label">Demo site</span>';
    el.addEventListener('click', function (e) {
      e.preventDefault();
      go();
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });
  }

  function init() {
    document.querySelectorAll('.demo').forEach(enhance);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
