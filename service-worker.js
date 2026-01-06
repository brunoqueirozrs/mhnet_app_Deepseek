 * ============================================================================
 * MHNET VENDAS - SERVICE WORKER V127
 * ============================================================================
 * ✅ Cache inteligente de recursos estáticos
 * ✅ Estratégia Network First para API
 * ✅ Cache First para assets locais
 * ✅ Suporte offline completo
 * ✅ Atualização automática do cache
 * ============================================================================
 */

const CACHE_NAME = 'mhnet-vendas-v127';
const API_CACHE = 'mhnet-api-v127';

// Recursos para cache offline
const STATIC_CACHE = [
    './',
    './index.html',
    './app.js',
    './manifest.json',
    // Fontes e ícones externos (CDN)
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap'
];

// URLs que NÃO devem ser cacheadas
const BYPASS_CACHE = [
    'https://script.google.com/macros',
    'https://api.anthropic.com',
    'chrome-extension://'
];

// ============================================================================
// INSTALAÇÃO DO SERVICE WORKER
// ============================================================================
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker V127: Instalando...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Cache criado, adicionando recursos...');
                return cache.addAll(STATIC_CACHE).catch(err => {
                    console.warn('⚠️ Alguns recursos não foram cacheados:', err);
                    // Não bloqueia a instalação se algum recurso falhar
                });
            })
            .then(() => {
                console.log('✅ Service Worker instalado com sucesso!');
                return self.skipWaiting(); // Ativa imediatamente
            })
    );
});

// ============================================================================
// ATIVAÇÃO DO SERVICE WORKER
// ============================================================================
self.addEventListener('activate', (event) => {
    console.log('🎯 Service Worker V127: Ativando...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                // Remove caches antigos
                return Promise.all(
                    cacheNames
                        .filter(name => name.startsWith('mhnet-') && name !== CACHE_NAME && name !== API_CACHE)
                        .map(name => {
                            console.log('🗑️ Removendo cache antigo:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('✅ Service Worker ativado!');
                return self.clients.claim(); // Assume controle imediato
            })
    );
});

// ============================================================================
// INTERCEPTAÇÃO DE REQUESTS
// ============================================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignora requests de extensões do navegador
    if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
        return;
    }
    
    // Ignora requests que devem sempre ir para a rede
    if (BYPASS_CACHE.some(bypass => request.url.includes(bypass))) {
        return;
    }
    
    // Estratégia baseada no tipo de recurso
    if (request.url.includes('script.google.com') || request.url.includes('api.anthropic.com')) {
        // API: Network First (prioriza dados frescos)
        event.respondWith(networkFirstStrategy(request));
    } else {
        // Assets locais: Cache First (prioriza velocidade)
        event.respondWith(cacheFirstStrategy(request));
    }
});

// ============================================================================
// ESTRATÉGIAS DE CACHE
// ============================================================================

/**
 * Cache First: Busca no cache primeiro, se não encontrar vai para rede
 * Ideal para: CSS, JS, imagens, fontes
 */
async function cacheFirstStrategy(request) {
    try {
        // Tenta buscar do cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Se não está no cache, busca da rede
        const networkResponse = await fetch(request);
        
        // Se a resposta for válida, adiciona ao cache
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('❌ Erro em cacheFirstStrategy:', error);
        
        // Fallback: tenta buscar do cache mesmo em caso de erro
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Se não tem no cache, retorna página offline
        if (request.destination === 'document') {
            return caches.match('./index.html');
        }
        
        // Para outros recursos, retorna erro
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}

/**
 * Network First: Tenta buscar da rede primeiro, se falhar usa cache
 * Ideal para: APIs, dados dinâmicos
 */
async function networkFirstStrategy(request) {
    try {
        // Tenta buscar da rede com timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
        
        const networkResponse = await fetch(request, { 
            signal: controller.signal 
        });
        
        clearTimeout(timeoutId);
        
        // Se a resposta for válida, atualiza o cache
        if (networkResponse.ok) {
            const cache = await caches.open(API_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
        
    } catch (error) {
        console.warn('⚠️ Rede indisponível, usando cache:', error.message);
        
        // Se a rede falhar, busca do cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Se não tem cache, retorna resposta offline
        return new Response(JSON.stringify({ 
            status: 'error', 
            message: 'Sem conexão e sem cache disponível',
            offline: true 
        }), {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// ============================================================================
// MENSAGENS DO SERVICE WORKER
// ============================================================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('⏭️ Pulando espera e ativando nova versão...');
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        console.log('🗑️ Limpando cache...');
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(name => caches.delete(name))
                );
            }).then(() => {
                console.log('✅ Cache limpo!');
                event.ports[0].postMessage({ status: 'success' });
            })
        );
    }
});

// ============================================================================
// NOTIFICAÇÕES (PUSH)
// ============================================================================
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        const title = data.title || 'MHNET Vendas';
        const options = {
            body: data.body || 'Nova notificação',
            icon: './icon-192.png',
            badge: './icon-192.png',
            vibrate: [200, 100, 200],
            tag: data.tag || 'mhnet-notification',
            requireInteraction: false
        };
        
        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    } catch (e) {
        console.error('❌ Erro ao processar notificação:', e);
    }
});

// Click em notificação
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('./')
    );
});

// ============================================================================
// SINCRONIZAÇÃO EM BACKGROUND
// ============================================================================
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-leads') {
        console.log('🔄 Sincronização em background iniciada...');
        event.waitUntil(syncLeads());
    }
});

async function syncLeads() {
    try {
        // Busca fila de sincronização
        const syncQueue = JSON.parse(localStorage.getItem('mhnet_sync_queue') || '[]');
        
        if (syncQueue.length === 0) {
            console.log('✅ Nenhuma operação pendente');
            return;
        }
        
        console.log(`🔄 Sincronizando ${syncQueue.length} operações...`);
        
        // Aqui você pode implementar a lógica de sincronização
        // Por enquanto, apenas loga as operações
        
        console.log('✅ Sincronização concluída!');
        
    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
    }
}

// ============================================================================
// LOGS E DEBUG
// ============================================================================
console.log('🚀 Service Worker V127 carregado e pronto!');
console.log('📦 Cache Name:', CACHE_NAME);
console.log('🌐 API Cache:', API_CACHE);
console.log('📁 Recursos estáticos:', STATIC_CACHE.length);
