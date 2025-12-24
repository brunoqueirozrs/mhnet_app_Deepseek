const CACHE_NAME = 'mhnet-v90-offline-sync';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. Instalação: Baixa e guarda os ficheiros essenciais
self.addEventListener('install', (e) => {
  console.log('[SW] A instalar v90...');
  self.skipWaiting(); // Força o SW a assumir o controlo imediatamente
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cache criado');
      return cache.addAll(ASSETS);
    })
  );
});

// 2. Ativação: Limpa versões antigas do cache para libertar espaço
self.addEventListener('activate', (e) => {
  console.log('[SW] Ativado');
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[SW] A remover cache antigo:', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// 3. Interceptação de Rede (O Coração do Offline)
self.addEventListener('fetch', (e) => {
  // Ignora requisições para a API (Google Script/CallMeBot)
  // Deixamos o app.js lidar com a falta de internet para dados dinâmicos (Fila de Sincronização)
  if (e.request.url.includes('script.google.com') || e.request.url.includes('api.callmebot')) {
    return; 
  }

  // Estratégia Cache-First para a Interface (HTML, CSS, JS)
  // Tenta pegar do cache (rápido). Se não tiver, vai à rede.
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => {
          // Se falhar (sem net) e não estiver no cache, não faz nada (ou poderia retornar uma página de erro customizada)
          // Para imagens, poderíamos retornar um placeholder, mas por enquanto deixamos vazio para não quebrar o layout.
          return new Response('', { status: 408, statusText: 'Offline' });
      });
    })
  );
});
