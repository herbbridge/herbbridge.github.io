/*
 * HerbSafe service worker: lets the installed app open without the internet.
 * - App files: served from the cache, refreshed in the background.
 * - Database files (data/*.json): network first, so updates show straight away;
 *   the saved copy is used only when offline.
 * Nothing is sent anywhere: this only caches files HerbSafe already loads.
 * Change VERSION whenever the list of app files changes.
 */
var VERSION = 'herbsafe-v12';
var FONTS = 'herbsafe-fonts-v1';
var APP_FILES = [
  './', 'index.html', 'css/styles.css', 'js/lookup.js', 'js/i18n.js', 'js/app.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'data/herbs.json', 'data/drugs.json', 'data/interactions.json', 'data/official.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(VERSION).then(function (cache) { return cache.addAll(APP_FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
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
