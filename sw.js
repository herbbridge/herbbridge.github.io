/*
 * HerbBridge service worker: lets the installed app open without the internet.
 * - App files: served from the cache, refreshed in the background.
 * - Database files (data/*.json): network first, so updates show straight away;
 *   the saved copy is used only when offline.
 * Nothing is sent anywhere: this only caches files HerbBridge already loads.
 * Change VERSION whenever the list of app files changes.
 */
var VERSION = 'herbbridge-v49';
var FONTS = 'herbbridge-fonts-v1';
var APP_FILES = [
  './', 'index.html', 'css/styles.css', 'js/lookup.js', 'js/i18n.js', 'js/speech.js', 'js/app.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'data/herbs.json', 'data/drugs.json', 'data/interactions.json', 'data/official.json', 'data/reviews.json', 'audio/manifest.json',
  'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-600-normal.woff2', 'fonts/inter-latin-700-normal.woff2',
  'fonts/noto-sans-tc-herbbridge-400.woff2', 'fonts/noto-sans-tc-herbbridge-700.woff2'
];

self.addEventListener('install', function (event) {
  // Also saves any pre-recorded audio listed in audio/manifest.json, so it plays offline.
  event.waitUntil(caches.open(VERSION).then(function (cache) {
    return cache.addAll(APP_FILES).then(function () {
      return fetch('audio/manifest.json').then(function (r) { return r.json(); }).then(function (m) {
        return cache.addAll((m.files || []).map(function (f) { return 'audio/' + String(f).replace(/^audio\//, ''); }));
      }).catch(function () {});
    });
  }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  // Deletes every other cache, including the old herbsafe-* caches from before the rename.
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== FONTS; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function networkFirst(request, cacheName) {
  return fetch(request).then(function (response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(cacheName).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  }).catch(function () {
    return caches.match(request, { ignoreSearch: true });
  });
}

function cacheFirstRefresh(request, cacheName) {
  return caches.match(request, { ignoreSearch: true }).then(function (cached) {
    var refresh = fetch(request).then(function (response) {
      if (response && (response.ok || response.type === 'opaque')) {
        var copy = response.clone();
        caches.open(cacheName).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () { return cached; });
    return cached || refresh;
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      // Opening the app: try the network, fall back to the saved page when offline.
      event.respondWith(fetch(request).catch(function () { return caches.match('index.html'); }));
    } else if (url.pathname.indexOf('/data/') !== -1) {
      event.respondWith(networkFirst(request, VERSION));
    } else if (url.pathname.indexOf('/tests/') === -1) {
      event.respondWith(cacheFirstRefresh(request, VERSION));
    }
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirstRefresh(request, FONTS));
  }
});
