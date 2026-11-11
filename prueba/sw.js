/* Space Chat — service worker: abre la app al instante con lo guardado, se actualiza por detrás y muestra notificaciones. */
var CACHE = 'space-chat-prueba-1';
var ARCHIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.json', '../icon-192.png', '../icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARCHIVOS); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return /^space-chat-prueba-/.test(k) && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Archivos de la app: responde con lo guardado (instantáneo) y en paralelo baja la versión nueva para la próxima vez.
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (guardado) {
      var red = fetch(e.request).then(function (r) { if (r && r.ok) c.put(e.request, r.clone()); return r; });
      if (guardado) { e.waitUntil(red.catch(function () {})); return guardado; }
      return red;
    });
  }));
});

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { cuerpo: e.data && e.data.text() }; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.titulo || 'Space Chat', {
      body: d.cuerpo || 'Tienes un mensaje nuevo',
      icon: '../icon-192.png',
      badge: '../icon-192.png',
      tag: d.tel || 'space-chat',
      renotify: true,
      data: { tel: d.tel || '' }
    }),
    // Si la app está abierta, que se actualice al momento.
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
      cs.forEach(function (c) { c.postMessage({ tipo: 'nuevo', tel: d.tel || '' }); });
    })
  ]));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var destino = './#chat/' + (e.notification.data && e.notification.data.tel || '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { if ('focus' in cs[i]) { cs[i].navigate(destino); return cs[i].focus(); } }
    return self.clients.openWindow(destino);
  }));
});
