const CACHE_NAME = 'mhnet-v88-fix';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // 🚨 FIX CRÍTICO: Ignora esquemas não suportados (chrome-extension, file, etc)
  if (!e.request.url.startsWith('http')) return;

  // Ignora chamadas de API (sempre rede)
  if (e.request.url.includes('script.google.com') || e.request.url.includes('api.callmebot')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Cache First para arquivos estáticos
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request);
    })
  );
});
