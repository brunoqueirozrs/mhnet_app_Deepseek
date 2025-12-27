const CACHE_NAME = 'mhnet-v114-fix'; // Versão incrementada para limpar cache antigo
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// 1. Instalação
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Tenta cachear apenas arquivos locais
      return cache.addAll(ASSETS).catch(err => console.log("Cache local parcial:", err));
    })
  );
});

// 2. Ativação (Limpeza agressiva de caches antigos)
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

// 3. Interceptação (Ignora CDNs externos para evitar erro CORS)
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // LISTA DE EXCLUSÃO: Não cachear estes domínios pelo SW
  if (url.includes('script.google.com') || 
      url.includes('api.callmebot') || 
      url.includes('cdn.tailwindcss.com') || 
      url.includes('cdnjs.cloudflare.com')) {
    return; // Deixa o navegador lidar com a rede normalmente
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => {
         // Se offline e não tem cache, não retorna erro para não quebrar a app
         return new Response('', { status: 408, statusText: 'Offline' });
      });
    })
  );
});
