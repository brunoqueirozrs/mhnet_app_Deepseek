// sw.js - VERSÃO DEFINITIVA CORRIGIDA
const CACHE = 'mhnet-v202';
const BYPASS = ['script.google.com','generativelanguage.googleapis.com','nominatim.openstreetmap.org','callmebot.com'];
const PRECACHE = ['./', './index.html', './app.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  console.log('[SW] Instalando...');
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(url => c.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  console.log('[SW] Ativando...');
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  
  // Ignorar requisições para APIs externas e extensões
  if (url.startsWith('chrome-extension') || 
      BYPASS.some(b => url.includes(b)) || 
      e.request.method !== 'GET') {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // 🔥 CORREÇÃO: Retornar cache sem clonar
        return cached;
      }
      
      // 🔥 CORREÇÃO CRÍTICA: Clonar a requisição ANTES de fazer o fetch
      const fetchRequest = e.request.clone();
      
      return fetch(fetchRequest).then(res => {
        // Verificar se a resposta é válida
        if (!res || res.status !== 200) {
          return res;
        }
        
        // 🔥 CORREÇÃO CRÍTICA: Clonar a resposta ANTES de cachear
        const responseToCache = res.clone();
        
        caches.open(CACHE).then(cache => {
          cache.put(e.request, responseToCache);
        }).catch(err => console.warn('[SW] Erro ao cachear:', err));
        
        return res;
      }).catch(err => {
        console.warn('[SW] Fetch falhou:', err);
        // Retornar resposta offline amigável
        return new Response(
          JSON.stringify({ status: 'error', message: 'Sem conexão com a internet' }),
          { 
            status: 503,
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      });
    })
  );
});
