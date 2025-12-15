/**
 * ============================================================
 * SERVICE WORKER - MHNET VENDAS EXTERNAS (v4.0)
 * Responsável pelo funcionamento offline e cache
 * ============================================================
 */

const CACHE_NAME = 'mhnet-app-v4.0'; // Mude este nome para forçar atualização nos clientes

// Arquivos essenciais para o App funcionar offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './dashboard.css',
  './app.js',
  './manifest.json',
  // Se tiver ícones locais, adicione aqui:
  // './icon-192.png',
  // './icon-512.png'
];

// --- 1. INSTALAÇÃO ---
// Baixa e salva os arquivos essenciais
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando arquivos estáticos');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  
  // Força o SW a ativar imediatamente (sem esperar o usuário fechar o app)
  self.skipWaiting();
});

// --- 2. ATIVAÇÃO ---
// Limpa caches antigos de versões anteriores
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Ativando e limpando caches antigos...');
  
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  
  // Garante que o SW controle a página imediatamente
  return self.clients.claim();
});

// --- 3. INTERCEPTAÇÃO DE REDE (FETCH) ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // REGRA 1: Ignorar chamadas para a API do Google Apps Script
  // (Queremos sempre dados frescos da planilha ou erro se estiver offline)
  if (url.hostname.includes('script.googleusercontent.com') || 
      url.hostname.includes('script.google.com')) {
    return; // Deixa o navegador fazer a requisição normal (sem cache)
  }

  // REGRA 2: Estratégia "Stale-While-Revalidate" para arquivos estáticos
  // (Mostra o cache rápido, mas atualiza em segundo plano para a próxima vez)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Se tiver no cache, retorna ele
      if (cachedResponse) {
        // Mas também busca na rede para atualizar o cache (em background)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {
          // Se falhar a atualização em background, tudo bem, o usuário já viu o cache
        });
        
        return cachedResponse;
      }

      // Se não tiver no cache, busca na rede
      return fetch(event.request);
    })
  );
});
