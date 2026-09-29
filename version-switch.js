/*! SparkON / Eureka version switcher — toggles SparkON (root or /v2/) ↔ Eureka (/eurekav1/).
 * Works on custom domains (sparkon.cards / sparkon.games — no repo prefix) and on
 * GitHub project Pages (utbal.github.io/sparkon[/…], …/sparkon-games[/…]).
 * Legacy /v1/ paths still switch to SparkON (stubs redirect Eureka → /eurekav1/). */
(function () {
  var RECYCLE_ICON = '<span class="demo-icon" aria-hidden="true">♻</span>';

  // Pages that exist only on SparkON (root / v2). When leaving those, land on Eureka index.
  var ONLY_ON_SPARKON = {
    'cards/pi.html': true,
    'about.html': true,
    'privacy.html': true,
    'terms.html': true
  };

  function normalizeRest(rest) {
    rest = rest || '';
    if (rest === '' || rest.charAt(rest.length - 1) === '/') {
      rest = rest + 'index.html';
    }
    return rest;
  }

  // On *.github.io project sites the first path segment is the repo name.
  // On custom domains (and local root servers) there is no prefix.
  function pagesPrefix(pathname) {
    if (!/(^|\.)github\.io$/i.test(location.hostname)) return '';
    var segs = pathname.split('/').filter(Boolean);
    if (!segs.length) return '';
    if (segs[0] === 'v1' || segs[0] === 'v2' || segs[0] === 'eurekav1') return '';
    return '/' + segs[0];
  }

  // Returns { prefix, kind: 'root'|'v1'|'v2'|'eurekav1', rest } or null.
  // prefix is the repo Pages base, e.g. '' or '/sparkon' (no trailing slash).
  function parsePath(pathname) {
    var prefix = pagesPrefix(pathname);
    var base = prefix || '';
    var rel = pathname;
    if (base && (rel === base || rel.indexOf(base + '/') === 0)) {
      rel = rel.slice(base.length) || '/';
    }

    var m = rel.match(/^\/(eurekav1|v[12])(?:\/(.*))?$/);
    if (m) {
      return { prefix: base, kind: m[1], rest: normalizeRest(m[2]) };
    }

    if (rel === '/' || rel === '') {
      return { prefix: base, kind: 'root', rest: 'index.html' };
    }

    // Root SparkON page: /math.html, /cards/pi.html (after stripping prefix)
    if (rel.charAt(0) === '/') {
      return { prefix: base, kind: 'root', rest: normalizeRest(rel.slice(1)) };
    }
    return null;
  }

  function sparkonHref(parsed, rest) {
    // Prefer repo root as primary SparkON path
    if (!parsed.prefix) return '/' + rest;
    return parsed.prefix + '/' + rest;
  }

  function eurekaHref(parsed, rest) {
    if (!parsed.prefix) return '/eurekav1/' + rest;
    return parsed.prefix + '/eurekav1/' + rest;
  }

  function isEurekaKind(kind) {
    return kind === 'eurekav1' || kind === 'v1';
  }

  function counterpartHref() {
    var parsed = parsePath(location.pathname);
    if (!parsed) return null;

    if (isEurekaKind(parsed.kind)) {
      // Eureka → SparkON root
      return sparkonHref(parsed, parsed.rest);
    }

    // SparkON (root or v2 alias) → Eureka eurekav1
    var rest = parsed.rest;
    if (ONLY_ON_SPARKON[rest]) {
      return eurekaHref(parsed, 'index.html');
    }
    return eurekaHref(parsed, rest);
  }

  function versionRootIndex(href) {
    // Eureka index under optional prefix
    var m1 = href.match(/^(.*\/eurekav1)\//);
    if (m1) return m1[1] + '/index.html';
    var mLegacy = href.match(/^(.*\/v1)\//);
    if (mLegacy) return mLegacy[1] + '/index.html';
    // SparkON root index: /index.html or /sparkon/index.html
    if (href.charAt(0) === '/') {
      var segs = href.split('/').filter(Boolean);
      if (/(^|\.)github\.io$/i.test(location.hostname) && segs.length) {
        return '/' + segs[0] + '/index.html';
      }
      return '/index.html';
    }
    return href.replace(/\/[^/]*$/, '/index.html');
  }

  function go() {
    var href = counterpartHref();
    if (!href) return;
    var dest = href + location.search + location.hash;

    if (location.protocol === 'file:') {
      location.href = dest;
      return;
    }

    var indexFallback = versionRootIndex(href);

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
    el.setAttribute('aria-label', 'Switch between SparkON and Eureka');
    el.innerHTML = RECYCLE_ICON;
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
