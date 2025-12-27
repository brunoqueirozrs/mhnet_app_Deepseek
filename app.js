/**
 * ============================================================================
 * MHNET VENDAS - APP.JS V117 (FINAL SINCRONIZADO)
 * ============================================================================
 * ✅ Login Offline com fallback
 * ✅ PWA Instalável
 * ✅ Sincronização completa com Backend V110
 * ✅ Todas as funcionalidades de IA ativas
 * ✅ Interface elegante e responsiva
 * ============================================================================
 */

// ⚠️ ID DO BACKEND
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// ============================================================================
// ESTADO GLOBAL
// ============================================================================
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let vendorsCache = []; 
let tasksCache = [];
let materialsCache = [];
let leadAtualParaAgendar = null; 
let currentFolderId = null;
let editingLeadIndex = null;
let syncQueue = JSON.parse(localStorage.getItem('mhnet_sync_queue') || '[]');

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V117 - Inicializando");
    
    // Carrega vendedores com fallback
    carregarVendedores();
    
    // Carrega cache de leads
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { 
        try { 
            leadsCache = JSON.parse(saved); 
            console.log(`📦 Cache carregado: ${leadsCache.length} leads`);
        } catch(e) {
            console.error('Erro ao carregar cache:', e);
        } 
    }
    
    // Verifica login
    if (loggedUser) {
         console.log(`👤 Usuário logado: ${loggedUser}`);
         initApp();
         if(navigator.onLine) {
             console.log('🌐 Online - Sincronizando...');
             processarFilaSincronizacao();
         }
    } else {
         console.log('🔒 Aguardando login');
         document.getElementById('userMenu').style.display = 'flex';
         document.getElementById('mainContent').style.display = 'none';
    }
});

// Listener de conexão
window.addEventListener('online', () => {
    console.log("🌐 Conexão restabelecida");
    processarFilaSincronizacao();
});

window.addEventListener('offline', () => {
    console.log("📴 Modo offline ativado");
});

// ============================================================================
// CORE & NAVEGAÇÃO
// ============================================================================
function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    document.getElementById('userInfo').innerText = loggedUser;
    
    // Libera painel Admin
    if (loggedUser === "Bruno Garcia Queiroz") {
        document.getElementById('btnAdminSettings')?.classList.remove('hidden');
        console.log('👑 Modo Admin ativado');
    }
    
    atualizarDataCabecalho();
    carregarLeads(false); 
    carregarTarefas(false);
    navegarPara('dashboard');
}

function navegarPara(pageId) {
    // Esconde todas as páginas
    document.querySelectorAll('.page').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('fade-in');
    });

    // Mostra página alvo
    const target = document.getElementById(pageId);
    if(target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('fade-in'), 10);
    }
    
    // Scroll para topo
    const scroller = document.getElementById('main-scroll');
    if(scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });

    // Hooks específicos por página
    if (pageId === 'dashboard') { 
        atualizarDashboard(); 
        verificarAgendamentosHoje(); 
    }
    
    if (pageId === 'tarefas') {
        renderTarefas(); 
    }
    
    if (pageId === 'indicadores') {
        abrirIndicadores();
    }
    
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        // Limpa filtros apenas se vier do menu principal
        if(busca && !busca.placeholder.includes("Filtrado") && !busca.placeholder.includes("Retornos")) {
            busca.value = "";
            busca.placeholder = "Buscar por nome, bairro, telefone...";
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('btnFilterTodos')?.classList.add('active');
        }
        renderLeads();
    }
    
    if (pageId === 'cadastroLead') {
        if (editingLeadIndex === null) {
            // Limpa formulário apenas para novos leads
            document.querySelectorAll('#cadastroLead input, #cadastroLead textarea').forEach(el => {
                if(el.type !== 'file') el.value = '';
            });
            const sel = document.getElementById('leadInteresse'); 
            if(sel) sel.value = 'Médio';
            const status = document.getElementById('leadStatus'); 
            if(status) status.value = 'Novo';
        }
    }
    
    if (pageId === 'materiais' && !currentFolderId) {
        setTimeout(() => carregarMateriais(null), 100);
    }
    
    if (pageId === 'faltas') {
        ocultarHistoricoFaltas();
    }
}

// ============================================================================
// API & SINCRONIZAÇÃO
// ============================================================================
async function apiCall(route, payload, show=true) {
    if(show) showLoading(true);
    
    // Modo offline - adiciona à fila
    if (!navigator.onLine && isWriteOperation(route)) {
        adicionarAFila(route, payload);
        if(show) showLoading(false);
        return { status: 'success', local: true, message: 'Salvo offline' };
    }
    
    try {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            headers: {'Content-Type': 'text/plain;charset=utf-8'}, 
            body: JSON.stringify({ route: route, payload: payload }) 
        });
        
        const json = await res.json();
        
        if(show) showLoading(false);
        return json;
        
    } catch(e) {
        console.error('❌ Erro API:', route, e);
        if(show) showLoading(false);
        
        // Se for operação de escrita, salva offline
        if (isWriteOperation(route)) { 
            adicionarAFila(route, payload); 
            return { status: 'success', local: true }; 
        }
        
        return { status: 'error', message: 'Erro de conexão' };
    }
}

function isWriteOperation(route) { 
    return [
        'addLead', 
        'deleteLead', 
        'updateStatus', 
        'updateAgendamento', 
        'updateObservacao', 
        'addTask', 
        'toggleTask', 
        'archiveTasks', 
        'registerAbsence', 
        'saveObjectionLead', 
        'updateLeadFull', 
        'forwardLead', 
        'manageTeam'
    ].includes(route); 
}

function adicionarAFila(route, payload) { 
    syncQueue.push({route, payload, timestamp: Date.now()}); 
    localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue)); 
    console.log(`💾 Salvo offline: ${route}`);
    alert("✅ Salvo Offline!\n\nSerá sincronizado quando houver conexão.");
}

async function processarFilaSincronizacao() { 
    if(syncQueue.length === 0) return;
    
    console.log(`🔄 Sincronizando ${syncQueue.length} operações...`);
    showLoading(true, 'Sincronizando...');
    
    const falhas = [];
    
    for(const item of syncQueue) { 
        try { 
            const res = await fetch(API_URL, {
                method:'POST', 
                body:JSON.stringify({route:item.route, payload:item.payload})
            });
            
            if(!res.ok) throw new Error('Falha na sincronização');
            
            console.log(`✅ Sincronizado: ${item.route}`);
            
        } catch(e){
            console.error(`❌ Falha: ${item.route}`, e);
            falhas.push(item);
        }
    }
    
    syncQueue = falhas;
    localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue));
    showLoading(false);
    
    if (syncQueue.length === 0) {
        console.log('✅ Sincronização completa!');
        // Recarrega dados após sincronização bem-sucedida
        if(document.getElementById('gestaoLeads').style.display !== 'none') {
            carregarLeads(false);
        }
    } else {
        console.log(`⚠️ ${syncQueue.length} operações ainda pendentes`);
    }
}

// ============================================================================
// VENDEDORES & LOGIN
// ============================================================================
async function carregarVendedores() {
    const select = document.getElementById('userSelect');
    if(!select) return;
    
    try {
        const res = await apiCall('getVendors', {}, false);
        
        if(res.status === 'success' && res.data && res.data.length > 0) {
            vendorsCache = res.data;
            const options = res.data.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
            select.innerHTML = '<option value="">Selecione seu usuário...</option>' + options;
            
            // Atualiza outros selects também
            const modalDest = document.getElementById('modalLeadDestino');
            if(modalDest) modalDest.innerHTML = '<option value="">Selecione...</option>' + options;
            
            console.log(`✅ ${res.data.length} vendedores carregados`);
        } else {
            throw new Error('Nenhum vendedor retornado');
        }
    } catch(e) {
        console.warn('⚠️ Erro ao carregar vendedores, usando fallback offline:', e);
        
        // Fallback offline após 3 segundos
        setTimeout(() => {
            if(select.options.length <= 1) {
                const fallbackVendors = [
                    "Bruno Garcia Queiroz",
                    "Ana Paula Rodrigues", 
                    "Vendedor Teste"
                ];
                
                const options = fallbackVendors.map(v => `<option value="${v}">${v}</option>`).join('');
                select.innerHTML = '<option value="">🔴 MODO OFFLINE (Selecione)</option>' + options;
                console.log('📴 Modo offline - vendedores fixos carregados');
            }
        }, 3000);
    }
}

// ============================================================================
// LEADS - FILTROS E GESTÃO
// ============================================================================
function filtrarLeadsHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const leadsHoje = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje));
    
    if (leadsHoje.length === 0) {
        alert("📅 Nenhum lead cadastrado hoje!\n\n🚀 Vamos pra cima!");
        return; 
    }
    
    const input = document.getElementById('searchLead');
    if(input) {
        input.value = "";
        input.placeholder = `📅 Filtrado: Leads de Hoje (${leadsHoje.length})`;
    }
    
    navegarPara('gestaoLeads');
    renderListaLeads(leadsHoje);
}

function filtrarRetornos() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    
    if (retornos.length === 0) {
        alert("✅ Nenhum retorno agendado para hoje!");
        return;
    }
    
    const input = document.getElementById('searchLead');
    if(input) {
        input.value = "";
        input.placeholder = `🔔 Retornos de Hoje (${retornos.length})`;
    }
    
    navegarPara('gestaoLeads');
    renderListaLeads(retornos);
}

function filtrarPorStatus(status) {
    // Atualiza visual dos botões
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    
    const btnMap = {
        'Todos': 'btnFilterTodos',
        'Novo': 'btnFilterNovo',
        'Em Negociação': 'btnFilterNegociação',
        'Agendado': 'btnFilterAgendado',
        'Venda Fechada': 'btnFilterVendaFechada',
        'Perda': 'btnFilterPerda'
    };
    
    const btnId = btnMap[status];
    const btn = document.getElementById(btnId);
    if(btn) btn.classList.add('active');
    
    // Filtra leads
    const input = document.getElementById('searchLead');
    if(input) input.value = "";
    
    let listaFiltrada = leadsCache;
    if (status !== 'Todos') {
        listaFiltrada = leadsCache.filter(l => l.status === status || l.interesse === status);
        if(input) input.placeholder = `Filtro: ${status} (${listaFiltrada.length})`;
    } else {
        if(input) input.placeholder = "Buscar por nome, bairro, telefone...";
    }
    
    renderListaLeads(listaFiltrada);
}

async function carregarLeads(showLoader = false) {
    if(!navigator.onLine) {
        console.log('📴 Offline - usando cache');
        if(document.getElementById('listaLeadsGestao')) renderLeads();
        return;
    }

    const res = await apiCall('getLeads', { vendedor: loggedUser }, showLoader);
    
    if (res && res.status === 'success') {
        leadsCache = res.data || [];
        leadsCache.sort((a, b) => (b._linha || 0) - (a._linha || 0));
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        
        console.log(`✅ ${leadsCache.length} leads carregados`);
        
        if (res.isAdmin) {
            document.getElementById('adminPanel')?.classList.remove('hidden');
        }
        
        if(document.getElementById('listaLeadsGestao') && document.getElementById('gestaoLeads').style.display !== 'none') {
            renderLeads();
        }
        
        atualizarDashboard();
        verificarAgendamentosHoje();
    }
}

function renderLeads() {
    const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
    
    const lista = leadsCache.filter(l => 
        (l.nomeLead||'').toLowerCase().includes(term) || 
        (l.bairro||'').toLowerCase().includes(term) ||
        (l.telefone||'').includes(term) ||
        (l.cidade||'').toLowerCase().includes(term)
    );
    
    renderListaLeads(lista);
}

function renderListaLeads(lista) {
    const div = document.getElementById('listaLeadsGestao');
    if (!div) return;
    
    if (lista.length === 0) { 
        div.innerHTML = `
            <div class="text-center mt-16 text-gray-400">
                <i class="fas fa-inbox text-6xl mb-4 opacity-50"></i>
                <p class="text-sm font-bold">Nenhum lead encontrado</p>
            </div>
        `; 
        return; 
    }

    div.innerHTML = lista.map((l) => {
        const realIndex = leadsCache.indexOf(l);
        return criarCardLead(l, realIndex);
    }).join('');
}

function criarCardLead(l, index) {
    let badgeColor = "bg-slate-100 text-slate-600";
    let badgeIcon = "fas fa-circle";
    
    if (l.status === 'Venda Fechada') {
        badgeColor = "bg-gradient-to-r from-green-500 to-green-600 text-white";
        badgeIcon = "fas fa-check-circle";
    } else if (l.status === 'Em Negociação') {
        badgeColor = "bg-gradient-to-r from-blue-500 to-blue-600 text-white";
        badgeIcon = "fas fa-handshake";
    } else if (l.status === 'Agendado') {
        badgeColor = "bg-gradient-to-r from-orange-500 to-orange-600 text-white";
        badgeIcon = "fas fa-calendar-check";
    } else if (l.status === 'Perda') {
        badgeColor = "bg-gradient-to-r from-red-500 to-red-600 text-white";
        badgeIcon = "fas fa-times-circle";
    } else if (l.status === 'Novo' || !l.status) {
        badgeColor = "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white";
        badgeIcon = "fas fa-star";
    }

    const badgeProv = l.provedor ? 
        `<span class="text-[9px] bg-blue-50 text-blue-600 px-2 py-1 rounded-full border border-blue-200 ml-2">
            <i class="fas fa-wifi"></i> ${l.provedor}
        </span>` : '';

    const agendaBadge = l.agendamento ? 
        `<span class="text-[9px] text-orange-600 bg-orange-50 px-2 py-1 rounded-full border border-orange-200 flex items-center gap-1 mt-1">
            <i class="fas fa-clock"></i> ${l.agendamento.split(' ')[0]}
        </span>` : '';

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-md cursor-pointer active:scale-95 transition-all hover:shadow-xl hover:border-blue-200">
        <div class="flex justify-between items-start mb-3">
            <div class="flex-1">
                <div class="font-bold text-slate-800 text-lg leading-tight mb-1">${l.nomeLead}</div>
                <div class="text-xs text-slate-500 flex items-center gap-1 mb-2">
                    <i class="fas fa-map-marker-alt text-blue-500"></i>
                    ${l.bairro || '-'} • ${l.cidade || '-'}
                </div>
                ${badgeProv}
            </div>
            
            <div class="flex flex-col items-end gap-1">
                <span class="text-[10px] px-3 py-1.5 rounded-full ${badgeColor} flex items-center gap-1 shadow-sm">
                    <i class="${badgeIcon}"></i> ${l.status || 'Novo'}
                </span>
                ${agendaBadge}
            </div>
        </div>
    </div>`;
}

// ============================================================================
// DETALHES LEAD (MODAL)
// ============================================================================
function abrirLeadDetalhes(index) {
    const l = leadsCache[index];
    if(!l) return;
    
    leadAtualParaAgendar = l;
    editingLeadIndex = index;
    
    // Preenche dados básicos
    document.getElementById('modalLeadNome').innerText = l.nomeLead;
    document.getElementById('modalLeadBairro').innerText = l.bairro || "Sem bairro";
    document.getElementById('modalLeadCidade').innerText = l.cidade || "Sem cidade";
    document.getElementById('modalLeadTelefone').innerText = l.telefone || "Sem telefone";
    document.getElementById('modalLeadProvedor').innerText = l.provedor || "--";
    
    // Status
    const statusSel = document.getElementById('modalStatusFunil');
    if(statusSel) statusSel.value = l.status || "Novo";
    
    // Observações e objeções
    document.getElementById('modalLeadObs').value = l.observacao || "";
    document.getElementById('inputObjecaoLead').value = l.objecao || "";
    document.getElementById('respostaObjecaoLead').value = l.respostaObjecao || "";

    // Botões WhatsApp
    const fone = l.telefone ? l.telefone.replace(/\D/g,'') : '';
    const whatsUrl = fone ? `https://wa.me/55${fone}` : '#';
    
    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) btnWhats.onclick = () => {
        if(fone) window.open(whatsUrl, '_blank');
        else alert('Telefone não cadastrado');
    };
    
    const btnTag = document.getElementById('btnModalWhatsTag');
    if (btnTag) btnTag.onclick = () => {
        if(fone) window.open(whatsUrl, '_blank');
        else alert('Telefone não cadastrado');
    };
    
    // Raio-X
    const containerRaioX = document.getElementById('containerRaioX');
    if(containerRaioX) {
        containerRaioX.innerHTML = `
            <button onclick="raioXConcorrencia()" class="ml-2 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md flex items-center gap-1 active:scale-95 transition hover:bg-slate-700">
                <i class="fas fa-bolt text-yellow-400"></i> Raio-X
            </button>`;
    }
    
    // Admin: Encaminhamento
    if (loggedUser === "Bruno Garcia Queiroz") {
        const areaAdmin = document.getElementById('adminEncaminharArea');
        if(areaAdmin) {
            areaAdmin.classList.remove('hidden');
            const sel = document.getElementById('modalLeadDestino');
            if(sel && vendorsCache.length > 0) {
                sel.innerHTML = '<option value="">Selecione...</option>' + 
                    vendorsCache.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
            }
        }
    }

    // Mostra modal
    document.getElementById('leadModal').classList.remove('hidden');
}

function fecharLeadModal() { 
    document.getElementById('leadModal').classList.add('hidden'); 
    leadAtualParaAgendar = null; 
    editingLeadIndex = null; 
}

async function salvarEdicaoModal() {
    if (!leadAtualParaAgendar) return;
    
    const novoStatus = document.getElementById('modalStatusFunil').value;
    const obs = document.getElementById('modalLeadObs').value;
    const dataAgenda = document.getElementById('agendarData').value;
    const horaAgenda = document.getElementById('agendarHora').value;
    
    // Atualiza cache local
    leadAtualParaAgendar.status = novoStatus;
    leadAtualParaAgendar.observacao = obs;
    
    if (dataAgenda) {
        const [a, m, d] = dataAgenda.split('-');
        leadAtualParaAgendar.agendamento = `${d}/${m}/${a} ${horaAgenda || '09:00'}`;
    }
    
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    
    // Atualiza visual se estiver na tela de leads
    if(document.getElementById('gestaoLeads').style.display !== 'none') {
        renderLeads();
    }
    
    showLoading(true, "SALVANDO...");
    
    // Envia para backend
    await Promise.all([
        apiCall('updateStatus', { 
            vendedor: loggedUser, 
            nomeLead: leadAtualParaAgendar.nomeLead, 
            status: novoStatus 
        }, false),
        apiCall('updateObservacao', { 
            vendedor: loggedUser, 
            nomeLead: leadAtualParaAgendar.nomeLead, 
            observacao: obs 
        }, false)
    ]);
    
    if (dataAgenda) {
        await apiCall('updateAgendamento', { 
            vendedor: loggedUser, 
            nomeLead: leadAtualParaAgendar.nomeLead, 
            agendamento: leadAtualParaAgendar.agendamento 
        }, false);
    }
    
    showLoading(false);
    fecharLeadModal();
    alert('✅ Lead atualizado com sucesso!');
}

function editarLeadAtual() {
    if(!leadAtualParaAgendar) return;
    
    const l = leadAtualParaAgendar;
    
    // Preenche formulário
    document.getElementById('leadNome').value = l.nomeLead;
    document.getElementById('leadTelefone').value = l.telefone;
    document.getElementById('leadEndereco').value = l.endereco || '';
    document.getElementById('leadBairro').value = l.bairro || '';
    document.getElementById('leadCidade').value = l.cidade || '';
    document.getElementById('leadProvedor').value = l.provedor || '';
    document.getElementById('leadObs').value = l.observacao || '';
    
    const statusSel = document.getElementById('leadStatus');
    if(statusSel) statusSel.value = l.status || "Novo";
    
    const interSel = document.getElementById('leadInteresse');
    if(interSel) interSel.value = l.interesse || "Médio";
    
    // Admin: mostra encaminhamento
    if(loggedUser === "Bruno Garcia Queiroz") {
        document.getElementById('divEncaminhar')?.classList.remove('hidden');
    }
    
    fecharLeadModal();
    navegarPara('cadastroLead');
}

async function enviarLead() {
    const nome = document.getElementById('leadNome').value.trim();
    const telefone = document.getElementById('leadTelefone').value.trim();
    
    if(!nome || !telefone) {
        alert('⚠️ Preencha ao menos Nome e Telefone!');
        return;
    }
    
    const payload = {
        vendedor: loggedUser,
        nomeLead: nome,
        telefone: telefone,
        endereco: document.getElementById('leadEndereco').value,
        bairro: document.getElementById('leadBairro').value,
        cidade: document.getElementById('leadCidade').value,
        provedor: document.getElementById('leadProvedor').value,
        interesse: document.getElementById('leadInteresse').value,
        status: document.getElementById('leadStatus').value,
        observacao: document.getElementById('leadObs').value,
        novoVendedor: document.getElementById('leadVendedorDestino')?.value || ""
    };
    
    let route = 'addLead';
    
    if(editingLeadIndex !== null) {
        // Edição
        route = 'updateLeadFull';
        payload._linha = leadsCache[editingLeadIndex]._linha;
        payload.nomeLeadOriginal = leadsCache[editingLeadIndex].nomeLead;
    } else if(payload.novoVendedor) {
        // Encaminhamento direto
        route = 'forwardLead';
        payload.origem = loggedUser;
    }
    
    const res = await apiCall(route, payload);
    
    if(res.status === 'success' || res.local) {
        alert(editingLeadIndex !== null ? "✅ Lead atualizado!" : "✅ Lead salvo!");
        
        // Atualiza cache
        if(editingLeadIndex === null && !res.local && !payload.novoVendedor) {
            payload.timestamp = new Date().toLocaleDateString('pt-BR');
            leadsCache.unshift(payload);
        }
        
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        editingLeadIndex = null;
        navegarPara('gestaoLeads');
    } else {
        alert("❌ Erro ao salvar lead");
    }
}

async function excluirLead() {
    if(!leadAtualParaAgendar) return;
    
    if(!confirm(`⚠️ Excluir lead "${leadAtualParaAgendar.nomeLead}"?`)) return;
    
    await apiCall('deleteLead', {
        vendedor: loggedUser,
        nomeLead: leadAtualParaAgendar.nomeLead,
        _linha: leadAtualParaAgendar._linha
    });
    
    // Remove do cache
    leadsCache = leadsCache.filter(l => l.nomeLead !== leadAtualParaAgendar.nomeLead);
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    
    alert("🗑️ Lead excluído!");
    fecharLeadModal();
    carregarLeads(false);
}

/**
 * ============================================================================
 * APP.JS - PARTE 2: IA, TAREFAS, FALTAS E RECURSOS
 * ============================================================================
 * Cole este código após a PARTE 1 do app.js
 * ============================================================================
 */

// ============================================================================
// IA - FUNÇÕES INTEGRADAS
// ============================================================================

async function gerarScriptVendaIA() {
    if (!leadAtualParaAgendar) {
        alert('Nenhum lead selecionado!');
        return;
    }
    
    showLoading(true, 'Gerando script...');
    
    const prompt = `Crie uma mensagem de WhatsApp profissional para o lead:
Nome: ${leadAtualParaAgendar.nomeLead}
Bairro: ${leadAtualParaAgendar.bairro}
Provedor Atual: ${leadAtualParaAgendar.provedor}

A mensagem deve ser persuasiva e criar urgência. Máximo 150 palavras.`;

    const res = await apiCall('askAI', { question: prompt }, false);
    
    showLoading(false);
    
    if (res.status === 'success' && res.answer) {
        const script = res.answer.replace(/\*\*/g, '');
        
        // Copia para clipboard
        try {
            await navigator.clipboard.writeText(script);
            alert('✅ Script copiado!\n\nCole no WhatsApp do cliente.');
            
            // Abre WhatsApp
            const fone = leadAtualParaAgendar.telefone.replace(/\D/g, '');
            if(fone) window.open(`https://wa.me/55${fone}`, '_blank');
        } catch(e) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = script;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            alert('✅ Script copiado!');
        }
    } else {
        alert('❌ IA temporariamente indisponível');
    }
}

async function raioXConcorrencia() {
    if (!leadAtualParaAgendar) return;
    
    const provedor = leadAtualParaAgendar.provedor || 'Concorrente desconhecido';
    showLoading(true, 'Analisando concorrência...');
    
    const prompt = `Faça um Raio-X do provedor "${provedor}". 
Inclua: pontos fracos, comparativo com MHNET, argumentos de venda.
Máximo 120 palavras.`;

    const res = await apiCall('askAI', { question: prompt }, false);
    
    showLoading(false);
    
    if (res.status === 'success' && res.answer) {
        const obsField = document.getElementById('modalLeadObs');
        if (obsField) {
            const timestamp = new Date().toLocaleString('pt-BR');
            obsField.value += `\n\n⚡ [RAIO-X ${provedor} - ${timestamp}]\n${res.answer.replace(/\*\*/g,'')}`;
        }
        alert(`✅ Análise do ${provedor} adicionada!`);
    } else {
        alert('❌ IA indisponível');
    }
}

async function analiseEstrategicaIA() {
    if (!leadAtualParaAgendar) return;
    
    showLoading(true, 'Analisando estratégia...');
    
    const prompt = `Analise este lead:
Nome: ${leadAtualParaAgendar.nomeLead}
Interesse: ${leadAtualParaAgendar.interesse}
Provedor: ${leadAtualParaAgendar.provedor}
Obs: ${leadAtualParaAgendar.observacao}

Dê: potencial de conversão, abordagem recomendada, objeções possíveis.
Máximo 150 palavras.`;

    const res = await apiCall('askAI', { question: prompt }, false);
    
    showLoading(false);
    
    if (res.status === 'success' && res.answer) {
        const obsField = document.getElementById('modalLeadObs');
        if (obsField) {
            const timestamp = new Date().toLocaleString('pt-BR');
            obsField.value += `\n\n📊 [ANÁLISE IA - ${timestamp}]\n${res.answer.replace(/\*\*/g,'')}`;
        }
        alert('✅ Análise estratégica adicionada!');
    } else {
        alert('❌ IA indisponível');
    }
}

async function combaterObjecaoLead() {
    const input = document.getElementById('inputObjecaoLead');
    const resposta = document.getElementById('respostaObjecaoLead');
    
    if (!input || !input.value.trim()) {
        alert('Digite a objeção do cliente!');
        return;
    }
    
    showLoading(true, 'Gerando resposta...');
    
    const res = await apiCall('solveObjection', { 
        objection: input.value 
    }, false);
    
    showLoading(false);
    
    if (res.status === 'success' && res.answer) {
        resposta.value = res.answer.replace(/[\*#]/g, '');
        alert('✅ Resposta gerada! Revise antes de usar.');
    } else {
        alert('❌ IA indisponível');
    }
}

async function combaterObjecaoGeral() {
    const input = document.getElementById('inputObjecaoGeral');
    const resultado = document.getElementById('resultadoObjecaoGeral');
    
    if (!input || !input.value.trim()) {
        alert('Digite uma objeção!');
        return;
    }
    
    showLoading(true, 'Analisando objeção...');
    
    const res = await apiCall('solveObjection', { 
        objection: input.value 
    }, false);
    
    showLoading(false);
    
    if (res.status === 'success' && res.answer) {
        resultado.innerHTML = `
            <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-xl shadow-md">
                <p class="font-bold text-green-800 mb-2 flex items-center gap-2">
                    <i class="fas fa-lightbulb"></i> Resposta Sugerida:
                </p>
                <p class="text-slate-700 text-sm leading-relaxed">${res.answer.replace(/\*\*/g,'')}</p>
            </div>
        `;
        resultado.classList.remove('hidden');
    } else {
        alert('❌ IA não disponível');
    }
}

async function gerarCoachIA() {
    showLoading(true, 'Gerando motivação...');
    
    const prompt = `Você é um coach de vendas motivacional. 
Gere UMA frase curta e impactante (máx 20 palavras) para motivar um vendedor de internet fibra.`;

    const res = await apiCall('askAI', { question: prompt }, false);
    
    showLoading(false);
    
    if (res.status === 'success' && res.answer) {
        alert(`🚀 ${res.answer.replace(/\*\*/g,'')}`);
    } else {
        // Frases de fallback
        const frases = [
            "💪 Cada 'não' te aproxima do próximo 'sim'!",
            "📞 Sua próxima venda está a uma ligação de distância!",
            "🏆 Atitude vencedora gera resultados vencedores!",
            "🎯 O sucesso começa com a primeira abordagem!"
        ];
        alert(frases[Math.floor(Math.random() * frases.length)]);
    }
}

function consultarPlanosIA() {
    document.getElementById('chatModal').classList.remove('hidden');
    
    const history = document.getElementById('chatHistory');
    if (history && history.children.length === 0) {
        history.innerHTML = `
            <div class="text-center mb-4">
                <div class="inline-block bg-blue-50 text-blue-600 px-4 py-3 rounded-2xl text-sm">
                    <i class="fas fa-robot mr-2"></i>
                    Olá! Sou a IA da MHNET. Como posso ajudar?
                </div>
            </div>
        `;
    }
}

function toggleChat() {
    document.getElementById('chatModal').classList.add('hidden');
}

async function enviarMensagemChat() {
    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    
    if (!input || !input.value.trim()) return;
    
    const mensagem = input.value.trim();
    input.value = '';
    
    // Mensagem do usuário
    history.innerHTML += `
        <div class="text-right mb-3">
            <div class="inline-block bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-tr-none max-w-[85%] text-left text-sm">
                ${mensagem}
            </div>
        </div>
    `;
    
    history.scrollTop = history.scrollHeight;
    
    // Indicador "digitando..."
    const loadingId = 'typing-' + Date.now();
    history.innerHTML += `
        <div id="${loadingId}" class="text-left mb-3">
            <div class="inline-block bg-slate-100 text-slate-600 px-4 py-3 rounded-2xl rounded-tl-none">
                <i class="fas fa-circle-notch fa-spin"></i> Pensando...
            </div>
        </div>
    `;
    history.scrollTop = history.scrollHeight;
    
    // Chama IA
    const res = await apiCall('askAI', { question: mensagem }, false);
    
    // Remove "digitando..."
    document.getElementById(loadingId)?.remove();
    
    if (res.status === 'success' && res.answer) {
        history.innerHTML += `
            <div class="text-left mb-3">
                <div class="inline-block bg-slate-100 text-slate-700 px-4 py-3 rounded-2xl rounded-tl-none max-w-[85%] text-left text-sm">
                    ${res.answer.replace(/\n/g, '<br>').replace(/\*\*/g,'')}
                </div>
            </div>
        `;
    } else {
        history.innerHTML += `
            <div class="text-left mb-3">
                <div class="inline-block bg-red-50 text-red-600 px-4 py-3 rounded-2xl rounded-tl-none max-w-[85%] text-sm">
                    ❌ IA temporariamente indisponível. Tente novamente.
                </div>
            </div>
        `;
    }
    
    history.scrollTop = history.scrollHeight;
}

// ============================================================================
// TAREFAS
// ============================================================================
async function carregarTarefas(show=false) {
    if(!navigator.onLine && tasksCache.length > 0) {
        renderTarefas();
        return;
    }
    
    const res = await apiCall('getTasks', {vendedor: loggedUser}, false);
    
    if(res.status === 'success') {
        tasksCache = res.data || [];
        renderTarefas();
    }
}

function renderTarefas() {
    const div = document.getElementById('listaTarefasContainer');
    if(!div) return;
    
    if(tasksCache.length === 0) {
        div.innerHTML = `
            <div class="text-center p-8 text-gray-400">
                <i class="fas fa-tasks text-6xl mb-4 opacity-50"></i>
                <p class="text-sm font-bold">Nenhuma tarefa pendente</p>
            </div>
        `;
        return;
    }
    
    div.innerHTML = tasksCache.map(t => {
        const checked = t.status === 'CONCLUIDA' ? 'checked' : '';
        const lineThrough = t.status === 'CONCLUIDA' ? 'line-through opacity-50' : '';
        
        return `
            <div class="bg-white p-4 rounded-2xl shadow-md border-2 border-slate-100 flex items-center gap-3 ${lineThrough}">
                <input type="checkbox" ${checked} onchange="toggleTask('${t.id}','${t.status}')" class="w-5 h-5 rounded border-2 border-slate-300 cursor-pointer">
                <div class="flex-1">
                    <p class="text-sm font-bold text-slate-700">${t.descricao}</p>
                    ${t.dataLimite ? `<p class="text-[10px] text-slate-400 mt-1"><i class="fas fa-calendar"></i> ${t.dataLimite}</p>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function abrirModalTarefa() {
    document.getElementById('taskModal').classList.remove('hidden');
}

async function salvarTarefa() {
    const desc = document.getElementById('taskDesc').value.trim();
    const data = document.getElementById('taskDate').value;
    
    if(!desc) {
        alert('Digite uma descrição!');
        return;
    }
    
    await apiCall('addTask', {
        vendedor: loggedUser,
        descricao: desc,
        dataLimite: data
    });
    
    document.getElementById('taskModal').classList.add('hidden');
    document.getElementById('taskDesc').value = '';
    document.getElementById('taskDate').value = '';
    
    carregarTarefas(false);
}

async function toggleTask(id, status) {
    const task = tasksCache.find(t => t.id === id);
    if(task) {
        task.status = status === 'PENDENTE' ? 'CONCLUIDA' : 'PENDENTE';
        renderTarefas();
    }
    
    await apiCall('toggleTask', {
        taskId: id,
        status: status,
        vendedor: loggedUser
    }, false);
}

async function limparTarefasConcluidas() {
    if(!confirm('Limpar tarefas concluídas?')) return;
    
    tasksCache = tasksCache.filter(t => t.status !== 'CONCLUIDA');
    renderTarefas();
    
    await apiCall('archiveTasks', {vendedor: loggedUser});
}

// ============================================================================
// INDICADORES
// ============================================================================
async function abrirIndicadores() {
    navegarPara('indicadores');
    
    ['funnelLeads','funnelNegociacao','funnelVendas'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerText = '...';
    });
    
    const res = await apiCall('getIndicators', {vendedor: loggedUser}, false);
    
    if(res.status === 'success') {
        const d = res.data;
        
        document.getElementById('funnelLeads').innerText = d.totalLeads || 0;
        document.getElementById('funnelNegociacao').innerText = d.negociacao || 0;
        document.getElementById('funnelVendas').innerText = d.vendas || 0;
        document.getElementById('indRealizado').innerText = d.vendas || 0;
        document.getElementById('indMeta').innerText = d.meta || 30;
        document.getElementById('indMes').innerText = d.mes || 'MÊS ATUAL';
        document.getElementById('indCiclo').innerText = d.ciclo || '25-24';
        
        // Coach IA
        const analise = await apiCall('analyzeIndicators', {
            meta: d.meta,
            vendas: d.vendas,
            diasUteisRestantes: d.diasUteisRestantes || 10
        }, false);
        
        if(analise.status === 'success') {
            document.getElementById('indAnaliseIA').innerText = analise.message || "Você está no caminho certo!";
        }
    }
}

// ============================================================================
// FALTAS/RH
// ============================================================================
async function enviarJustificativa() {
    const data = document.getElementById('faltaData').value;
    const motivo = document.getElementById('faltaMotivo').value;
    const obs = document.getElementById('faltaObs').value;
    
    if(!data || !motivo) {
        alert('Preencha data e motivo!');
        return;
    }
    
    showLoading(true, 'Enviando...');
    
    await apiCall('registerAbsence', {
        vendedor: loggedUser,
        dataFalta: data,
        motivo: motivo,
        observacao: obs
    });
    
    showLoading(false);
    alert('✅ Justificativa enviada!\n\nO gestor receberá por WhatsApp e e-mail.');
    navegarPara('dashboard');
}

async function verHistoricoFaltas() {
    const div = document.getElementById('listaHistoricoFaltas');
    document.getElementById('historicoFaltasContainer').classList.remove('hidden');
    document.getElementById('formFaltaContainer').classList.add('hidden');
    
    const res = await apiCall('getAbsences', {vendedor: loggedUser}, false);
    
    if(res.status === 'success' && res.data.length > 0) {
        div.innerHTML = res.data.map(f => `
            <div class="bg-white p-4 mb-3 rounded-2xl shadow-md border border-slate-100">
                <div class="font-bold text-sm text-slate-700 mb-1">${f.motivo}</div>
                <div class="text-[10px] text-slate-500">
                    📅 ${f.dataFalta} • ${f.status || 'ENVIADO'}
                </div>
                ${f.obs ? `<p class="text-xs text-slate-600 mt-2">${f.obs}</p>` : ''}
            </div>
        `).join('');
    } else {
        div.innerHTML = '<div class="text-center p-8 text-gray-400">Nenhum histórico</div>';
    }
}

function ocultarHistoricoFaltas() {
    document.getElementById('historicoFaltasContainer').classList.add('hidden');
    document.getElementById('formFaltaContainer').classList.remove('hidden');
}

// ============================================================================
// MATERIAIS
// ============================================================================
async function carregarMateriais(folderId=null, search="") {
    const div = document.getElementById('materiaisGrid');
    div.innerHTML = '<div class="col-span-2 text-center py-8"><i class="fas fa-circle-notch fa-spin text-3xl text-blue-600"></i></div>';
    
    const res = await apiCall('getImages', {folderId, search}, false);
    
    if(res.status === 'success') {
        currentFolderId = folderId;
        renderMateriais(res.data);
    }
}

function renderMateriais(items) {
    const div = document.getElementById('materiaisGrid');
    
    if(items.length === 0) {
        div.innerHTML = '<div class="col-span-2 text-center py-8 text-gray-400">Nenhum material encontrado</div>';
        return;
    }
    
    div.innerHTML = items.map(item => {
        if(item.type === 'folder') {
            return `
                <div onclick="carregarMateriais('${item.id}')" class="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl shadow-md border-2 border-blue-200 cursor-pointer active:scale-95 transition hover:shadow-xl text-center">
                    <i class="fas fa-folder text-4xl text-blue-600 mb-3"></i>
                    <p class="text-xs font-bold text-blue-800">${item.name}</p>
                </div>
            `;
        } else {
            return `
                <div class="bg-white p-3 rounded-2xl shadow-md border border-slate-100">
                    <img src="${item.thumbnail}" alt="${item.name}" class="w-full h-32 object-cover rounded-xl mb-2">
                    <p class="text-[10px] font-bold text-slate-700 truncate mb-2">${item.name}</p>
                    <div class="flex gap-2">
                        <a href="${item.downloadUrl}" target="_blank" class="flex-1 bg-blue-600 text-white text-[10px] font-bold py-2 px-3 rounded-lg text-center active:scale-95 transition">
                            <i class="fas fa-download"></i>
                        </a>
                        <button onclick="compartilharWhatsApp('${item.downloadUrl}')" class="flex-1 bg-green-500 text-white text-[10px] font-bold py-2 px-3 rounded-lg active:scale-95 transition">
                            <i class="fab fa-whatsapp"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }).join('');
}

function buscarMateriais() {
    const search = document.getElementById('searchMateriais').value;
    carregarMateriais(currentFolderId, search);
}

function compartilharWhatsApp(url) {
    window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank');
}

// ============================================================================
// UTILS
// ============================================================================
function showLoading(show, text='CARREGANDO') {
    const loader = document.getElementById('loader');
    if(loader) loader.style.display = show ? 'flex' : 'none';
    
    const loaderText = document.getElementById('loaderText');
    if(loaderText) loaderText.innerText = text;
}

function atualizarDataCabecalho() {
    const el = document.getElementById('headerDate');
    if(el) el.innerText = new Date().toLocaleDateString('pt-BR');
}

function atualizarDashboard() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const leadsHoje = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje));
    
    const statEl = document.getElementById('statLeads');
    if(statEl) statEl.innerText = leadsHoje.length;
}

function verificarAgendamentosHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    
    const banner = document.getElementById('lembreteBanner');
    if(banner) {
        if(retornos.length > 0) {
            banner.classList.remove('hidden');
        } else {
            banner.classList.add('hidden');
        }
    }
}

async function buscarEnderecoGPS() {
    if (!navigator.geolocation) {
        alert('GPS não disponível neste dispositivo');
        return;
    }
    
    showLoading(true, 'Localizando...');
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            
            if (data && data.address) {
                const addr = data.address;
                
                document.getElementById('leadEndereco').value = addr.road || '';
                document.getElementById('leadBairro').value = addr.suburb || addr.neighbourhood || '';
                document.getElementById('leadCidade').value = addr.city || addr.town || addr.village || '';
                
                alert(`✅ Localização encontrada!\n\n${addr.road || 'Endereço'}, ${addr.suburb || 'Bairro'}`);
            }
        } catch (e) {
            alert('Erro ao buscar endereço');
        }
        showLoading(false);
    }, () => {
        showLoading(false);
        alert('Erro ao acessar GPS');
    }, { enableHighAccuracy: true });
}

function abrirConfiguracoes() {
    document.getElementById('configModal').classList.remove('hidden');
}

async function gerirEquipe(acao) {
    const nome = document.getElementById('cfgNomeVendedor').value;
    const meta = document.getElementById('cfgMeta').value;
    
    if(!nome) {
        alert('Digite o nome do vendedor!');
        return;
    }
    
    await apiCall('manageTeam', {
        acao: acao,
        nome: nome,
        meta: meta
    });
    
    alert(acao === 'add' ? '✅ Vendedor adicionado!' : '🗑️ Vendedor removido!');
    carregarVendedores();
}

async function encaminharLeadModal() {
    const destino = document.getElementById('modalLeadDestino').value;
    
    if(!destino) {
        alert('Selecione um vendedor!');
        return;
    }
    
    if(!confirm(`Encaminhar "${leadAtualParaAgendar.nomeLead}" para ${destino}?`)) return;
    
    await apiCall('forwardLead', {
        nomeLead: leadAtualParaAgendar.nomeLead,
        telefone: leadAtualParaAgendar.telefone,
        novoVendedor: destino,
        origem: loggedUser
    });
    
    alert('✅ Lead encaminhado!');
    fecharLeadModal();
    carregarLeads(false);
}

// Função helper genérica para perguntas à IA
async function perguntarIABackend(pergunta) {
    try {
        const res = await apiCall('askAI', { question: pergunta }, false);
        return (res.status === 'success') ? res.answer : null;
    } catch (e) {
        console.error('Erro IA:', e);
        return null;
    }
}

console.log('✅ MHNET App V117 - Todas as funções carregadas');
