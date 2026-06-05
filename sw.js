const CACHE = 'mhnet-v202';
const BYPASS = ['script.google.com','generativelanguage.googleapis.com','nominatim.openstreetmap.org','callmebot.com'];
const PRECACHE = ['./', './index.html', './app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(url => c.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.startsWith('chrome-extension') || BYPASS.some(b => url.includes(b)) || e.request.method !== 'GET') {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok) {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => new Response(
        JSON.stringify({ status: 'error', message: 'offline' }),
        { headers: { 'Content-Type': 'application/json' } }
      ));
    })
  );
});
