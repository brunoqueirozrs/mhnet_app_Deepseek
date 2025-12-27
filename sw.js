const CACHE_NAME = 'mhnet-v113-stable';
// Apenas arquivos locais são vitais para o SW instalar sem erro
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// 1. Instalação (Cache Apenas Local)
self.addEventListener('install', (e) => {
  console.log('[SW] Instalando V113...');
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Tenta cachear arquivos locais. Se falhar, não quebra a instalação.
      return cache.addAll(ASSETS).catch(err => console.error("Erro cache local:", err));
    })
  );
});

// 2. Ativação (Limpeza)
self.addEventListener('activate', (e) => {
  console.log('[SW] Ativado');
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

// 3. Interceptação (Estratégia Híbrida)
self.addEventListener('fetch', (e) => {
  // Ignora APIs e Google Scripts (sempre online)
  if (e.request.url.includes('script.google.com') || e.request.url.includes('api.callmebot')) {
    return;
  }

  // Estratégia Stale-While-Revalidate para arquivos estáticos
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // Se tiver no cache, retorna. Senão, busca na rede.
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        // Se a resposta for válida, atualiza o cache (mesmo arquivos externos como CDN, se permitido)
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
         // Se estiver offline e não tiver no cache, retorna algo vazio para não quebrar
         return new Response('', { status: 408, statusText: 'Offline' });
      });

      return cachedResponse || fetchPromise;
    })
  );
});
