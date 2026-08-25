var CACHE = 'tb-runtime-v2';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);

  // Свои файлы: сначала сеть (всегда свежее), копия кладётся в кэш для оффлайна
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request).then(function(resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function(c) { c.put(event.request, copy); });
        }
        return resp;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Чужие ресурсы (шрифты, Firebase, GitHub API) — сеть, при офлайне кэш
  event.respondWith(
    fetch(event.request).then(function(resp) {
      if (resp && resp.ok && (resp.type === 'basic' || resp.type === 'cors')) {
        var copy2 = resp.clone();
        caches.open(CACHE).then(function(c) { c.put(event.request, copy2); });
      }
      return resp;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
