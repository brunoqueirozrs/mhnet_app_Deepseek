/**
 * ============================================================
 * MHNET SERVICE WORKER - V110 FINAL
 * ============================================================
 * ✅ Suporte Offline completo
 * ✅ Cache inteligente
 * ✅ Instalação PWA
 * ============================================================
 */

const CACHE_NAME = 'mhnet-v110-pwa';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1️⃣ INSTALAÇÃO
self.addEventListener('install', (e) => {
  console.log('📦 [SW] Instalando v110...');
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('✅ [SW] Cache criado');
      return cache.addAll(ASSETS).catch(err => {
        console.error('❌ [SW] Erro ao cachear:', err);
      });
    })
  );
});

// 2️⃣ ATIVAÇÃO
self.addEventListener('activate', (e) => {
  console.log('🔄 [SW] Ativando v110...');
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🗑️ [SW] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      console.log('✅ [SW] Service Worker ativo!');
      self.clients.claim();
    })
  );
});

// 3️⃣ INTERCEPTAÇÃO DE REDE
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = request.url;

  // ⚠️ IGNORAR URLs não HTTP/HTTPS
  if (!url.startsWith('http')) {
    return;
  }

  // 🌐 SEMPRE TENTAR REDE PARA API
  if (url.includes('script.google.com') || 
      url.includes('api.callmebot') || 
      url.includes('generativelanguage.googleapis.com') ||
      url.includes('nominatim.openstreetmap.org')) {
    e.respondWith(
      fetch(request)
        .catch(() => new Response(
          JSON.stringify({ status: 'error', message: 'Offline' }), 
          { headers: { 'Content-Type': 'application/json' }}
        ))
    );
    return;
  }

  // 💾 CACHE FIRST PARA ASSETS ESTÁTICOS
  e.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(request).then((networkResponse) => {
        // Cacheia novos recursos
        if (request.method === 'GET' && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline sem cache
        return new Response('Offline', { 
          status: 503, 
          statusText: 'Service Unavailable' 
        });
      });
    })
  );
});

// 4️⃣ MENSAGENS DO APP
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
