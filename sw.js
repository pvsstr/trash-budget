var CACHE = 'tb-runtime-v5';

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

  // Чужие ресурсы: кэшируем ТОЛЬКО шрифты gstatic (ответы API не храним)
  if(url.host === 'fonts.gstatic.com' || url.host === 'fonts.googleapis.com'){
    event.respondWith(
      fetch(event.request).then(function(resp){
        if(resp && resp.ok){
          var copy2 = resp.clone();
          caches.open(CACHE).then(function(c){ c.put(event.request, copy2); });
        }
        return resp;
      }).catch(function(){
        return caches.match(event.request);
      })
    );
    return;
  }

  // Остальные внешние запросы — прямо в сеть, без кэша
  event.respondWith(fetch(event.request).catch(function(){
    return caches.match(event.request);
  }));
});
