// service-worker.js - VERSÃO OTIMIZADA

const CACHE_NAME = 'mhnet-v2';
const API_CACHE_NAME = 'mhnet-api-v1';

// ARQUIVOS ESSENCIAIS PARA OFFLINE
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './dashboard.css',
  './manifest.json',
  './logo.jpeg'
];

// URLs DA API PARA INTERCEPTAÇÃO
const API_ENDPOINTS = [
  'https://script.google.com/macros/s/'
];

// ==============================
//  INSTALAÇÃO - CACHE CRÍTICO
// ==============================
self.addEventListener('install', event => {
  console.log('🔄 Service Worker instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cacheando arquivos estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ Cache concluído - Pular espera');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Erro no cache:', error);
      })
  );
});

// ==============================
//  ATIVAÇÃO - LIMPEZA E CONTROLE
// ==============================
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker ativado');
  
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys.map(key => {
          // Remove caches antigos
          if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
            console.log('🗑️ Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => {
      console.log('🎯 Tomando controle dos clients');
      return self.clients.claim();
    })
  );
});

// ==============================
//  ESTRATÉGIA DE CACHE INTELIGENTE
// ==============================
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // 🔄 REQUISIÇÕES PARA API (Google Apps Script)
  if (isApiRequest(request)) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // 📁 RECURSOS ESTÁTICOS (HTML, CSS, JS, Imagens)
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // 🌐 OUTRAS REQUISIÇÕES (Network First)
  event.respondWith(handleOtherRequest(request));
});

// ==============================
//  ESTRATÉGIAS ESPECÍFICAS
// ==============================

// 🔄 PARA API - NETWORK FIRST COM FALLBACK
function handleApiRequest(request) {
  return fetch(request)
    .then(networkResponse => {
      // Se sucesso, atualiza cache
      if (networkResponse.ok) {
        const responseClone = networkResponse.clone();
        caches.open(API_CACHE_NAME)
          .then(cache => cache.put(request, responseClone));
      }
      return networkResponse;
    })
    .catch(() => {
      // Se offline, tenta cache
      return caches.match(request)
        .then(cached => {
          if (cached) {
            console.log('📡 Servindo API do cache (offline)');
            return cached;
          }
          
          // Fallback para dados offline
          return new Response(JSON.stringify({
            status: 'offline',
            message: 'Modo offline - Dados podem não estar atualizados',
            data: []
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        });
    });
}

// 📁 PARA ASSETS - CACHE FIRST
function handleStaticRequest(request) {
  return caches.match(request)
    .then(cached => {
      if (cached) {
        console.log('⚡ Asset do cache:', request.url);
        return cached;
      }
      
      return fetch(request)
        .then(networkResponse => {
          // Cache de novos assets
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(error => {
          console.error('❌ Erro ao buscar asset:', error);
          // Fallback para página offline
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    });
}

// 🌐 OUTRAS REQUISIÇÕES - NETWORK FIRST
function handleOtherRequest(request) {
  return fetch(request)
    .catch(() => caches.match(request))
    .catch(() => {
      // Fallback genérico
      return new Response('🔌 Você está offline', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    });
}

// ==============================
//  DETECÇÃO DE TIPOS DE REQUEST
// ==============================
function isApiRequest(request) {
  return API_ENDPOINTS.some(endpoint => 
    request.url.includes(endpoint)
  );
}

function isStaticAsset(request) {
  return request.url.startsWith(self.location.origin) &&
         !request.url.includes('/macros/s/') &&
         (request.destination === 'script' || 
          request.destination === 'style' || 
          request.destination === 'image' ||
          request.destination === 'document');
}

// ==============================
//  SINCRONIZAÇÃO EM BACKGROUND
// ==============================
self.addEventListener('sync', event => {
  console.log('🔄 Evento de sync:', event.tag);
  
  if (event.tag === 'sync-offline-leads') {
    event.waitUntil(syncOfflineData());
  }
});

// ==============================
//  NOTIFICAÇÕES PUSH
// ==============================
self.addEventListener('push', event => {
  console.log('📲 Push notification recebida');
  
  const options = {
    body: event.data?.text() || 'Nova atualização disponível',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'mhnet-notification',
    actions: [
      { action: 'open', title: 'Abrir App' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('MHNET App', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('./')
    );
  }
});

// ==============================
//  FUNÇÕES DE SINCRONIZAÇÃO
// ==============================
async function syncOfflineData() {
  console.log('🔄 Sincronizando dados offline...');
  
  // Aqui você pode implementar a lógica para:
  // - Sincronizar leads cadastrados offline
  // - Enviar rotas gravadas offline
  // - Atualizar cache da API
  
  // Exemplo simplificado:
  const cache = await caches.open(API_CACHE_NAME);
  const keys = await cache.keys();
  
  console.log(`📊 ${keys.length} requisições em cache para sincronizar`);
  
  // Limpar cache antigo da API (manter apenas 1 hora)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  keys.forEach(request => {
    cache.match(request).then(response => {
      if (response) {
        const date = response.headers.get('date');
        if (date && new Date(date) < oneHourAgo) {
          cache.delete(request);
        }
      }
    });
  });
}

// ==============================
//  GERENCIAMENTO DE MEMÓRIA
// ==============================
// Limpeza periódica do cache
setInterval(() => {
  caches.open(API_CACHE_NAME).then(cache => {
    cache.keys().then(requests => {
      if (requests.length > 50) { // Limite de 50 requests em cache
        cache.delete(requests[0]);
      }
    });
  });
}, 60 * 60 * 1000); // A cada hora
