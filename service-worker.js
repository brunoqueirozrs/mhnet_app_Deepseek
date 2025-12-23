const CACHE_NAME = 'mhnet-v86-final'; // Incremento para forçar atualização
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. Instalação: Baixa os arquivos essenciais para funcionar offline
self.addEventListener('install', (e) => {
  console.log('🔧 Service Worker: Instalando...');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 Service Worker: Cache criado');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting(); // Força o SW a ativar imediatamente
});

// 2. Ativação: Limpa caches de versões antigas para liberar espaço e atualizar
self.addEventListener('activate', (e) => {
  console.log('✅ Service Worker: Ativo');
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('🗑️ Service Worker: Removendo cache antigo:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// 3. Fetch (Interceptação): Decide se pega do cache ou da rede
self.addEventListener('fetch', (e) => {
  // Ignora requisições para a API (Google Script/CallMeBot) para sempre pegar dados frescos
  if (e.request.url.includes('script.google.com') || e.request.url.includes('api.callmebot')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Para outros arquivos (HTML, JS, CSS), tenta cache primeiro, depois rede (Stale-while-revalidate)
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // Se tem no cache, retorna ele
      if (cachedResponse) {
        return cachedResponse;
      }
      // Se não, busca na rede
      return fetch(e.request);
    })
  );
});
