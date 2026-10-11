self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
// Network-only: attendance and inventory must never pretend to save offline.
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => new Response('<html lang="es"><meta name="viewport" content="width=device-width"><title>NonHuman</title><body style="font-family:system-ui;padding:48px"><h1>Sin conexion</h1><p>Conectate a internet para consultar el laboratorio y registrar movimientos.</p><button onclick="location.reload()">Reintentar</button></body></html>', {headers:{'Content-Type':'text/html; charset=utf-8'}})));
});
