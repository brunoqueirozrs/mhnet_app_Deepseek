/**
 * MHNET VENDAS - SERVICE WORKER V183
 */
const CACHE_NAME = 'mhnet-v183';
const BYPASS = ['script.google.com', 'api.anthropic.com', 'nominatim.openstreetmap.org'];
const STATIC  = ['./', './index.html', './app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.url.startsWith('chrome-extension')) return;
  if (BYPASS.some(b => e.request.url.includes(b))) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
      return cached || network;
    })
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
