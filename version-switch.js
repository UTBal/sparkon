/*! SparkON / Eureka version switcher — toggles SparkON (root or /v2/) ↔ Eureka (/v1/). */
(function () {
  var RECYCLE_ICON = '<span class="demo-icon" aria-hidden="true">♻</span>';

  // Pages that exist only on SparkON (root / v2). When leaving those, land on Eureka index.
  var ONLY_ON_SPARKON = {
    'cards/pi.html': true,
    'about.html': true
  };

  function normalizeRest(rest) {
    rest = rest || '';
    if (rest === '' || rest.charAt(rest.length - 1) === '/') {
      rest = rest + 'index.html';
    }
    return rest;
  }

  // Returns { prefix, kind: 'root'|'v1'|'v2', rest }
  // prefix is the repo Pages base, e.g. '' or '/sparkon' (no trailing slash).
  function parsePath(pathname) {
    var m = pathname.match(/^(.*)\/(v[12])(?:\/(.*))?$/);
    if (m) {
      return { prefix: m[1], kind: m[2], rest: normalizeRest(m[3]) };
    }
    // Root SparkON pages: /sparkon, /sparkon/, /sparkon/math.html, /sparkon/cards/pi.html
    // Avoid matching /sparkon/v1/... (already handled above).
    var m2 = pathname.match(/^(\/[^/]+)(?:\/(.*))?$/);
    if (m2) {
      var rest = normalizeRest(m2[2]);
      // If somehow still a version folder as first segment, ignore — handled above.
      if (rest === 'v1/index.html' || rest.indexOf('v1/') === 0) return null;
      if (rest === 'v2/index.html' || rest.indexOf('v2/') === 0) return null;
      return { prefix: m2[1], kind: 'root', rest: rest };
    }
    // Bare / or unusual
    if (pathname === '/' || pathname === '') {
      return { prefix: '', kind: 'root', rest: 'index.html' };
    }
    return null;
  }

  function sparkonHref(parsed, rest) {
    // Prefer repo root as primary SparkON path
    return parsed.prefix + '/' + rest;
  }

  function eurekaHref(parsed, rest) {
    return parsed.prefix + '/v1/' + rest;
  }

  function counterpartHref() {
    var parsed = parsePath(location.pathname);
    if (!parsed) return null;

    if (parsed.kind === 'v1') {
      // Eureka → SparkON root (primary). Fall back to index if page is SparkON-only missing on root — root has them.
      return sparkonHref(parsed, parsed.rest);
    }

    // SparkON (root or v2 alias) → Eureka v1
    var rest = parsed.rest;
    if (ONLY_ON_SPARKON[rest]) {
      return eurekaHref(parsed, 'index.html');
    }
    return eurekaHref(parsed, rest);
  }

  function versionRootIndex(href) {
    // Eureka index
    var m1 = href.match(/^(.*\/v1)\//);
    if (m1) return m1[1] + '/index.html';
    // SparkON root index
    var m2 = href.match(/^(\/[^/]+)\//);
    if (m2) return m2[1] + '/index.html';
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
