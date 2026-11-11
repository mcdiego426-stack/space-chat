/* Space Chat — service worker: guarda la app para abrir rápido y muestra notificaciones. */
var CACHE = 'space-chat-v1';
var ARCHIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARCHIVOS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Primero la red (para tener siempre lo último); si no hay internet, lo guardado.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) {
    var copia = r.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
    return r;
  }).catch(function () { return caches.match(e.request); }));
});

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { cuerpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Space Chat', {
    body: d.cuerpo || 'Tienes un mensaje nuevo',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tel || 'space-chat',
    data: { tel: d.tel || '' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var destino = './#chat/' + (e.notification.data && e.notification.data.tel || '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { if ('focus' in cs[i]) { cs[i].navigate(destino); return cs[i].focus(); } }
    return self.clients.openWindow(destino);
  }));
});
