/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V105 (FINAL PT-BR)
 * ============================================================
 * 📝 RESUMO TÉCNICO:
 * - Compatível com Backend V93 (IA Real + Gestão).
 * - Compatível com HTML V105 (Funil, Filtros, Modal Completo).
 * - Inclui Modo Offline, Auto-Sync e Tratamento de Erros.
 * - Mensagens e prompts em Português do Brasil.
 * ============================================================
 */

// ⚠️ ATENÇÃO: Se você fez uma nova implantação do Backend V93,
// ATUALIZE ESTE ID PARA O NOVO. Se não, mantenha o anterior.
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// --- ESTADO GLOBAL ---
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let vendorsCache = []; 
let tasksCache = [];
let leadAtualParaAgendar = null; 
let chatHistoryData = []; 
let currentFolderId = null;
let editingLeadIndex = null;
let editingAbsenceIndex = null;
let syncQueue = JSON.parse(localStorage.getItem('mhnet_sync_queue') || '[]');

// ============================================================
// 1. INICIALIZAÇÃO E LISTENERS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V105 - Sistema Pronto");
    
    // 1. Carrega lista de vendedores (API ou Cache Offline)
    carregarVendedores();
    
    // 2. Recupera dados locais para exibição imediata
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { try { leadsCache = JSON.parse(saved); } catch(e) {} }
    
    // 3. Verifica Sessão
    if (loggedUser) {
         initApp();
         // Tenta sincronizar pendências se houver rede
         if(navigator.onLine) processarFilaSincronizacao();
    } else {
         document.getElementById('userMenu').style.display = 'flex';
         document.getElementById('mainContent').style.display = 'none';
    }
});

// Auto-Sync ao recuperar conexão
window.addEventListener('online', () => {
    console.log("🌐 Online - Iniciando Sincronização...");
    processarFilaSincronizacao();
});

// ============================================================
// 2. CORE & NAVEGAÇÃO
// ============================================================

function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    document.getElementById('userInfo').innerText = loggedUser;
    
    // Ativa funcionalidades de Admin (Gestão)
    if (loggedUser === "Bruno Garcia Queiroz") {
        const btnAdmin = document.getElementById('btnAdminSettings');
        const divEncaminhar = document.getElementById('divEncaminhar');
        if(btnAdmin) btnAdmin.classList.remove('hidden');
        if(divEncaminhar) divEncaminhar.classList.remove('hidden');
    }
    
    atualizarDataCabecalho();
    carregarLeads(false); // Carregamento silencioso inicial
    carregarTarefas(false); // Carregamento de tarefas em background
    navegarPara('dashboard');
}

function setLoggedUser() {
    const v = document.getElementById('userSelect').value;
    if (v && v !== "" && v !== "A carregar..." && v !== "Carregando...") { 
        loggedUser = v; 
        localStorage.setItem('loggedUser', v); 
        initApp(); 
    } else {
        // Fallback se a lista estiver vazia (erro de conexão no boot)
        if (document.getElementById('userSelect').options.length <= 1) {
            carregarVendedoresOffline();
            alert("A lista de vendedores está carregando. Aguarde ou verifique a conexão.");
        } else {
            alert('Por favor, selecione o seu nome na lista.');
        }
    }
}

function logout() { 
    if(confirm("Tem certeza que deseja sair?")) { 
        localStorage.removeItem('loggedUser'); 
        location.reload(); 
    } 
}

function navegarPara(pageId) {
    // Esconde todas as telas
    document.querySelectorAll('.page').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('fade-in');
    });

    // Mostra a tela desejada
    const target = document.getElementById(pageId);
    if(target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('fade-in'), 10);
    }
    
    // Reseta scroll
    const scroller = document.getElementById('main-scroll');
    if(scroller) scroller.scrollTo(0,0);

    // --- HOOKS DE PÁGINA (Ações ao entrar) ---
    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') abrirIndicadores();
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        // Se não for um filtro ativo (ex: Leads Hoje), limpa a busca
        if(busca && !busca.placeholder.includes("Filtrado")) {
            busca.value = "";
            busca.placeholder = "Buscar nome, bairro, telefone...";
            // Reseta filtros visuais
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('btnFilterTodos')?.classList.add('active');
        }
        renderLeads();
    }
    if (pageId === 'cadastroLead') {
        ajustarMicrofone();
        // Se for NOVO cadastro, limpa tudo
        if (editingLeadIndex === null) {
            document.querySelectorAll('#cadastroLead input, #cadastroLead textarea').forEach(el => el.value = '');
            const sel = document.getElementById('leadInteresse'); if(sel) sel.value = 'Médio';
            const status = document.getElementById('leadStatus'); if(status) status.value = 'Novo';
            const dest = document.getElementById('leadVendedorDestino'); if(dest) dest.value = '';
        }
    }
    if (pageId === 'materiais' && !currentFolderId) setTimeout(() => carregarMateriais(null), 100);
    if (pageId === 'faltas') ocultarHistoricoFaltas();
}

// ============================================================
// 3. API & OFFLINE SYNC
// ============================================================

async function apiCall(route, payload, show=true) {
    if(show) showLoading(true);

    // MODO OFFLINE: Se não tem net e é escrita, salva na fila
    if (!navigator.onLine && isWriteOperation(route)) {
        adicionarAFila(route, payload);
        if(show) showLoading(false);
        // Atualiza cache local otimista se for toggle task
        if (route === 'toggleTask') {
             const t = tasksCache.find(x => x.id === payload.taskId);
             if (t) t.status = payload.status === 'PENDENTE' ? 'CONCLUIDA' : 'PENDENTE';
             if (document.getElementById('listaTarefasContainer')) renderTarefas();
        }
        return { status: 'success', local: true, message: 'Salvo localmente (Offline)' };
    }

    try {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            headers: {'Content-Type': 'text/plain;charset=utf-8'}, 
            body: JSON.stringify({ route: route, payload: payload }) 
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const json = JSON.parse(text);
        
        if(show) showLoading(false);
        return json;
    } catch(e) {
        console.warn(`⚠️ Falha API (${route}):`, e);
        if(show) showLoading(false);
        
        // Fallback: Se falhar conexão mas era pra salvar, salva local
        if (isWriteOperation(route)) {
            adicionarAFila(route, payload);
            return { status: 'success', local: true, message: 'Salvo localmente (Erro Conexão)' };
        }
        return { status: 'error', message: 'Sem conexão com o servidor.' };
    }
}

function isWriteOperation(route) {
    return ['addLead', 'deleteLead', 'updateStatus', 'updateAgendamento', 'updateObservacao', 'addTask', 'toggleTask', 'archiveTasks', 'registerAbsence', 'updateAbsence', 'saveObjectionLead', 'updateLeadFull', 'forwardLead', 'manageTeam'].includes(route);
}

function adicionarAFila(route, payload) {
    syncQueue.push({ route, payload, timestamp: new Date().getTime() });
    localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue));
    
    // Atualização Otimista: Se for Lead Novo, já mostra na lista
    if (route === 'addLead' && !payload.novoVendedor) {
        payload.timestamp = new Date().toLocaleDateString('pt-BR');
        leadsCache.unshift(payload);
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    }
    
    alert("💾 Salvo no dispositivo! Será sincronizado assim que a internet voltar.");
}

async function processarFilaSincronizacao() {
    if (syncQueue.length === 0) return;
    showLoading(true, "Sincronizando dados...");
    const falhas = [];
    
    for (const item of syncQueue) {
        try {
            await fetch(API_URL, { 
                method: 'POST', 
                headers: {'Content-Type': 'text/plain;charset=utf-8'},
                body: JSON.stringify({ route: item.route, payload: item.payload }) 
            });
        } catch (e) { falhas.push(item); }
    }
    
    syncQueue = falhas;
    localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue));
    showLoading(false);
    
    if (syncQueue.length === 0) {
        // Se estava na lista de leads, atualiza para garantir dados reais
        if (document.getElementById('gestaoLeads').style.display !== 'none') carregarLeads(false);
        console.log("✅ Sincronização completa.");
    }
}

// ============================================================
// 4. LEADS: FILTROS & VISUALIZAÇÃO
// ============================================================

function filtrarLeadsHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const leadsHoje = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje));
    
    if (leadsHoje.length === 0) {
        alert("📅 Nenhum lead cadastrado hoje!\nVamos pra cima! 🚀");
        return; 
    }
    
    navegarPara('gestaoLeads');
    renderListaLeads(leadsHoje);
    
    // Ajusta UI
    document.getElementById('searchLead').value = "";
    document.getElementById('searchLead').placeholder = `Filtrado: Hoje (${leadsHoje.length})`;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
}

function filtrarRetornos() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    
    if (retornos.length === 0) {
        alert("Nenhum retorno agendado para hoje.");
        return;
    }
    
    navegarPara('gestaoLeads');
    renderListaLeads(retornos);
    document.getElementById('searchLead').placeholder = `Retornos de Hoje (${retornos.length})`;
}

function filtrarPorStatus(status) {
    // Atualiza botões
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const btnId = 'btnFilter' + status.replace(/\s+/g, '');
    const btn = document.getElementById(btnId) || event.target;
    if(btn) btn.classList.add('active');
    
    const input = document.getElementById('searchLead');
    input.value = "";
    
    let listaFiltrada = leadsCache;
    if (status !== 'Todos') {
        listaFiltrada = leadsCache.filter(l => l.status === status || l.interesse === status);
        input.placeholder = `Filtro: ${status} (${listaFiltrada.length})`;
    } else {
        document.getElementById('searchLead').placeholder = "Buscar nome, bairro, telefone...";
    }
    
    renderListaLeads(listaFiltrada);
}

async function carregarLeads(showLoader = true) {
    if(!navigator.onLine) {
        // Se offline, renderiza o que tem no cache
        if(document.getElementById('listaLeadsGestao')) renderLeads();
        return;
    }

    const res = await apiCall('getLeads', { vendedor: loggedUser }, showLoader);
    if (res && res.status === 'success') {
        leadsCache = res.data || [];
        // Ordena: Leads mais recentes no topo
        leadsCache.sort((a, b) => b._linha - a._linha);
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        
        if (res.isAdmin) {
            const panel = document.getElementById('adminPanel');
            if(panel) panel.classList.remove('hidden');
        }
        
        // Renderiza apenas se a lista estiver visível
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
        (l.telefone||'').includes(term)
    );
    
    renderListaLeads(lista);
}

function renderListaLeads(lista) {
    const div = document.getElementById('listaLeadsGestao');
    if (!div) return;
    
    if (lista.length === 0) { 
        div.innerHTML = '<div class="text-center mt-10 text-gray-400">Vazio.</div>'; 
        return; 
    }

    div.innerHTML = lista.map((l) => {
        const realIndex = leadsCache.indexOf(l);
        return criarCardLead(l, realIndex);
    }).join('');
}

function criarCardLead(l, index) {
    let badgeColor = "bg-slate-100 text-slate-500";
    if (l.status === 'Venda Fechada') badgeColor = "bg-green-500 text-white font-bold";
    else if (l.status === 'Em Negociação') badgeColor = "bg-blue-100 text-blue-600 font-bold";
    else if (l.status === 'Agendado') badgeColor = "bg-orange-100 text-orange-600 font-bold";
    else if (l.status === 'Perda') badgeColor = "bg-red-100 text-red-600 font-bold";
    else if (l.status === 'Novo' || !l.status) badgeColor = "bg-indigo-50 text-indigo-600 font-bold";

    const badgeProv = l.provedor ? `<span class="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 ml-2"><i class="fas fa-wifi"></i> ${l.provedor}</span>` : '';

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition">
        <div class="flex justify-between items-start">
            <div>
                <div class="font-bold text-slate-800 text-lg leading-tight">${l.nomeLead}</div>
                <div class="text-xs text-slate-500 mt-1">${l.bairro || 'Sem Bairro'} ${badgeProv}</div>
            </div>
            <div class="flex flex-col items-end gap-1">
                <span class="text-[10px] px-2 py-1 rounded-full ${badgeColor}">${l.status || 'Novo'}</span>
                ${l.agendamento ? `<span class="text-[9px] text-orange-500 flex items-center gap-1"><i class="fas fa-clock"></i> ${l.agendamento.split(' ')[0]}</span>` : ''}
            </div>
        </div>
    </div>`;
}

// ============================================================
// 5. DETALHES, EDIÇÃO E AÇÕES
// ============================================================

function abrirLeadDetalhes(index) {
    const l = leadsCache[index];
    if(!l) return;
    leadAtualParaAgendar = l;
    
    // Dados Principais
    document.getElementById('modalLeadNome').innerText = l.nomeLead;
    document.getElementById('modalLeadBairro').innerText = l.bairro || "Sem bairro";
    document.getElementById('modalLeadCidade').innerText = l.cidade || "Sem cidade";
    document.getElementById('modalLeadTelefone').innerText = l.telefone || "Sem fone";
    document.getElementById('modalLeadProvedor').innerText = l.provedor || "--";
    
    // Status
    const statusSel = document.getElementById('modalStatusFunil');
    if(statusSel) statusSel.value = l.status || "Novo";
    
    // Campos de Texto
    document.getElementById('modalLeadObs').value = l.observacao || "";
    document.getElementById('inputObjecaoLead').value = l.objecao || "";
    document.getElementById('respostaObjecaoLead').value = l.respostaObjecao || "";

    // Ações
    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) btnWhats.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');
    const btnTag = document.getElementById('btnModalWhatsTag');
    if (btnTag) btnTag.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');
    
    // Raio-X
    const containerRaioX = document.getElementById('containerRaioX');
    if(containerRaioX) {
        containerRaioX.innerHTML = `<button onclick="raioXConcorrencia()" class="ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold shadow flex items-center gap-1 active:scale-95"><i class="fas fa-bolt text-yellow-400"></i> Raio-X</button>`;
    }
    
    // Preenche Dropdown Encaminhar se Admin
    if (loggedUser === "Bruno Garcia Queiroz") {
        const sel = document.getElementById('modalLeadDestino');
        if(sel && vendorsCache.length > 0) {
            sel.innerHTML = '<option value="">Selecionar...</option>' + vendorsCache.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
        }
    }

    document.getElementById('leadModal').classList.remove('hidden');
}

function fecharLeadModal() { 
    document.getElementById('leadModal').classList.add('hidden'); 
    leadAtualParaAgendar = null; 
    editingLeadIndex = null; 
}

// Salvar Edições Rápidas (Modal)
async function salvarEdicaoModal() {
    if (!leadAtualParaAgendar) return;
    
    const novoStatus = document.getElementById('modalStatusFunil').value;
    const obs = document.getElementById('modalLeadObs').value;
    const dataAgenda = document.getElementById('agendarData').value;
    const horaAgenda = document.getElementById('agendarHora').value;
    
    // Atualiza Local
    leadAtualParaAgendar.status = novoStatus;
    leadAtualParaAgendar.observacao = obs;
    if (dataAgenda) {
        const [a, m, d] = dataAgenda.split('-');
        leadAtualParaAgendar.agendamento = `${d}/${m}/${a} ${horaAgenda || '09:00'}`;
    }
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    if(document.getElementById('gestaoLeads').style.display !== 'none') renderLeads();
    
    showLoading(true, "SALVANDO...");
    
    // Updates
    await Promise.all([
        apiCall('updateStatus', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: novoStatus }, false),
        apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: obs }, false)
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
}

// Edição Completa (Tela de Cadastro)
window.editarLeadAtual = function() {
    if (!leadAtualParaAgendar) return;
    const l = leadAtualParaAgendar;
    
    document.getElementById('leadNome').value = l.nomeLead || "";
    document.getElementById('leadTelefone').value = l.telefone || "";
    document.getElementById('leadEndereco').value = l.endereco || "";
    document.getElementById('leadBairro').value = l.bairro || "";
    document.getElementById('leadCidade').value = l.cidade || "";
    document.getElementById('leadProvedor').value = l.provedor || "";
    document.getElementById('leadObs').value = l.observacao || "";
    
    const selInt = document.getElementById('leadInteresse'); if(selInt) selInt.value = l.interesse || "Médio";
    const statusEl = document.getElementById('leadStatus'); if(statusEl) statusEl.value = l.status || "Novo";
    
    // Encaminhamento (Admin)
    if (loggedUser === "Bruno Garcia Queiroz") {
        document.getElementById('divEncaminhar').classList.remove('hidden');
    }

    editingLeadIndex = leadsCache.indexOf(l);
    fecharLeadModal();
    navegarPara('cadastroLead');
};

async function enviarLead() {
    const nome = document.getElementById('leadNome').value.trim();
    const tel = document.getElementById('leadTelefone').value.trim();
    if(!nome || !tel) return alert("Preencha Nome e WhatsApp.");

    const payload = {
        vendedor: loggedUser,
        nomeLead: nome,
        telefone: tel,
        endereco: document.getElementById('leadEndereco').value,
        bairro: document.getElementById('leadBairro').value,
        cidade: document.getElementById('leadCidade').value,
        provedor: document.getElementById('leadProvedor').value,
        interesse: document.getElementById('leadInteresse').value,
        status: document.getElementById('leadStatus').value, 
        observacao: document.getElementById('leadObs').value,
        agendamento: "",
        
        // Encaminhamento (Só Admin)
        novoVendedor: document.getElementById('leadVendedorDestino')?.value || ""
    };
    
    let route = 'addLead';
    
    if (editingLeadIndex !== null) {
        route = 'updateLeadFull'; 
        payload._linha = leadsCache[editingLeadIndex]._linha;
        payload.nomeLeadOriginal = leadsCache[editingLeadIndex].nomeLead;
    } else {
        if (payload.novoVendedor) {
            route = 'forwardLead'; 
            payload.origem = loggedUser;
        }
    }

    const res = await apiCall(route, payload);
    
    if (res && (res.status === 'success' || res.local)) {
        alert(editingLeadIndex !== null ? "Atualizado!" : "Salvo!");
        
        if(editingLeadIndex === null && !res.local && !payload.novoVendedor) {
             payload.timestamp = new Date().toLocaleDateString('pt-BR'); 
             leadsCache.unshift(payload);
        }
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        if(editingLeadIndex !== null) carregarLeads(false);

        editingLeadIndex = null;
        navegarPara('gestaoLeads');
    } else {
        alert("Erro: " + (res?.message || "Falha na conexão"));
    }
}

// --- ADMIN ---
function abrirConfiguracoes() { document.getElementById('configModal').classList.remove('hidden'); }

async function gerirEquipe(acao) {
    const nome = document.getElementById('cfgNomeVendedor').value;
    const meta = document.getElementById('cfgMeta').value;
    if(!nome) return alert("Nome obrigatório");
    showLoading(true);
    const res = await apiCall('manageTeam', { acao, nome, meta });
    showLoading(false);
    if(res.status === 'success') { alert("Atualizado!"); carregarVendedores(); document.getElementById('configModal').classList.add('hidden'); } else alert("Erro ao atualizar.");
}

async function encaminharLeadModal() {
    const novoVendedor = document.getElementById('modalLeadDestino').value;
    if(!novoVendedor) return alert("Selecione um vendedor.");
    
    if(!confirm(`Encaminhar para ${novoVendedor}?`)) return;
    
    showLoading(true, "ENCAMINHANDO...");
    const res = await apiCall('forwardLead', { 
        nomeLead: leadAtualParaAgendar.nomeLead, 
        telefone: leadAtualParaAgendar.telefone,
        novoVendedor: novoVendedor,
        origem: loggedUser
    });
    showLoading(false);
    
    if(res.status === 'success') {
        alert("✅ Lead encaminhado!");
        fecharLeadModal();
        carregarLeads(); // Atualiza lista
    } else {
        alert("Erro: " + (res.message || "Falha"));
    }
}

// ============================================================
// 6. FUNIL & INDICADORES
// ============================================================

async function abrirIndicadores() {
    navegarPara('indicadores');
    // Reseta UI
    ['funnelLeads', 'funnelNegociacao', 'funnelVendas', 'indRealizado', 'indMeta'].forEach(id => {
        const el = document.getElementById(id); if(el) el.innerText = '...';
    });
    document.getElementById('indAnaliseIA').innerText = '🤖 Analisando performance...';
    
    const res = await apiCall('getIndicators', { vendedor: loggedUser }, false);
    
    if (res && res.status === 'success') {
        const d = res.data;
        
        // Funil
        document.getElementById('funnelLeads').innerText = d.totalLeads;
        document.getElementById('funnelNegociacao').innerText = d.negociacao || 0;
        document.getElementById('funnelVendas').innerText = d.vendas;
        
        // Meta e Ciclo
        document.getElementById('indMes').innerText = d.mes;
        document.getElementById('indCiclo').innerText = `Ciclo: ${d.ciclo}`;
        document.getElementById('indRealizado').innerText = d.vendas;
        document.getElementById('indMeta').innerText = d.meta;
        
        // IA Coach
        apiCall('analyzeIndicators', { 
            vendas: d.vendas, meta: d.meta, diasUteisRestantes: d.diasUteisRestantes 
        }, false).then(r => {
             if(r.status === 'success') document.getElementById('indAnaliseIA').innerText = r.message;
        });
    } else {
        document.getElementById('indAnaliseIA').innerText = 'Não foi possível carregar dados.';
    }
}

// ============================================================
// 7. TAREFAS & FALTAS
// ============================================================

async function carregarTarefas() {
    const div = document.getElementById('listaTarefasContainer');
    if (!div) return;
    
    // Se offline, não carrega (tarefas não têm cache local complexo neste modelo simples)
    if (!navigator.onLine && tasksCache.length > 0) { renderTarefas(); return; }

    div.innerHTML = '<div class="text-center p-5 text-gray-400">Carregando...</div>';
    
    const res = await apiCall('getTasks', { vendedor: loggedUser }, false);
    
    if (res && res.status === 'success') {
        tasksCache = res.data; // Atualiza cache memória
        if (res.isAdmin) document.getElementById('adminPanel').classList.remove('hidden');
        renderTarefas();
    } else {
        div.innerHTML = '<div class="text-center text-red-400">Erro ao carregar.</div>';
    }
}

function renderTarefas() {
    const div = document.getElementById('listaTarefasContainer');
    if (tasksCache.length === 0) {
         div.innerHTML = `<div class="flex flex-col items-center justify-center h-40 text-gray-400"><i class="fas fa-clipboard-check text-4xl mb-3 text-slate-200"></i><p>Sem tarefas agendadas</p></div>`;
         return; 
    }
    
    div.innerHTML = tasksCache.map(t => {
        const checked = t.status === "CONCLUIDA" ? "checked" : "";
        const opacity = t.status === "CONCLUIDA" ? "opacity-50 line-through" : "";
        return `
        <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 ${opacity}">
            <input type="checkbox" ${checked} onchange="toggleTask('${t.id}', '${t.status}')" class="w-5 h-5 accent-blue-600 rounded cursor-pointer">
            <div class="flex-1">
                <div class="text-sm font-bold text-slate-700">${t.descricao}</div>
                <div class="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                    ${t.dataLimite ? `<span>📅 ${t.dataLimite}</span>` : ''}
                    ${t.nomeLead ? `<span class="bg-blue-50 text-blue-500 px-1 rounded">👤 ${t.nomeLead}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

function abrirModalTarefa() {
    document.getElementById('taskModal').classList.remove('hidden');
    // Popula select leads
    const sel = document.getElementById('taskLeadSelect');
    sel.innerHTML = '<option value="">Nenhum (Avulso)</option>';
    leadsCache.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.nomeLead; opt.innerText = l.nomeLead; sel.appendChild(opt);
    });
}

async function salvarTarefa() {
    const desc = document.getElementById('taskDesc').value;
    const date = document.getElementById('taskDate').value;
    const leadVal = document.getElementById('taskLeadSelect').value;
    if(!desc) return alert("Digite a descrição.");
    
    showLoading(true, "SALVANDO TAREFA...");
    const res = await apiCall('addTask', { vendedor: loggedUser, descricao: desc, dataLimite: date, nomeLead: leadVal });
    showLoading(false);
    
    if(res && (res.status === 'success' || res.local)) {
        document.getElementById('taskModal').classList.add('hidden');
        document.getElementById('taskDesc').value = '';
        carregarTarefas();
    } else alert("Erro ao salvar tarefa.");
}

async function toggleTask(id, currentStatus) {
    // Otimista
    const t = tasksCache.find(x => x.id === id);
    if(t) {
        t.status = currentStatus === 'PENDENTE' ? 'CONCLUIDA' : 'PENDENTE';
        renderTarefas();
    }
    await apiCall('toggleTask', { taskId: id, status: currentStatus, vendedor: loggedUser }, false);
    carregarTarefas(); // Sincroniza real
}

async function limparTarefasConcluidas() {
    if(!confirm("Limpar concluídas?")) return;
    showLoading(true, "LIMPANDO...");
    await apiCall('archiveTasks', { vendedor: loggedUser });
    showLoading(false);
    carregarTarefas();
}

// Faltas
async function verHistoricoFaltas() {
    const div = document.getElementById('listaHistoricoFaltas');
    document.getElementById('historicoFaltasContainer').classList.remove('hidden');
    document.getElementById('formFaltaContainer').classList.add('hidden');
    div.innerHTML = '<div class="text-center p-5 text-gray-400">Carregando...</div>';
    
    const res = await apiCall('getAbsences', { vendedor: loggedUser }, false);
    
    if (res && res.status === 'success' && res.data.length > 0) {
        div.innerHTML = res.data.map(f => `
            <div onclick='preencherEdicaoFalta(${JSON.stringify(f)})' class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 cursor-pointer active:bg-blue-50">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="font-bold text-xs text-slate-700">${f.motivo}</div>
                        <div class="text-[10px] text-slate-400">${f.dataFalta} • ${f.statusEnvio}</div>
                    </div>
                    <i class="fas fa-pen text-slate-300 text-xs"></i>
                </div>
            </div>`).join('');
    } else {
        div.innerHTML = '<div class="text-center p-5 text-gray-400 text-xs">Nenhum histórico.</div>';
    }
}

function ocultarHistoricoFaltas() {
    document.getElementById('historicoFaltasContainer').classList.add('hidden');
    document.getElementById('formFaltaContainer').classList.remove('hidden');
    editingAbsenceIndex = null;
    document.getElementById('faltaData').value = '';
    document.getElementById('faltaMotivo').value = '';
    document.getElementById('faltaObs').value = '';
    document.getElementById('faltaArquivo').value = '';
    
    const btn = document.getElementById('btnEnviarFalta');
    btn.innerHTML = 'ENVIAR SOLICITAÇÃO';
}

function preencherEdicaoFalta(falta) {
    document.getElementById('historicoFaltasContainer').classList.add('hidden');
    document.getElementById('formFaltaContainer').classList.remove('hidden');
    
    const [d, m, a] = falta.dataFalta.split('/');
    document.getElementById('faltaData').value = `${a}-${m}-${d}`;
    document.getElementById('faltaMotivo').value = falta.motivo;
    document.getElementById('faltaObs').value = falta.obs;
    editingAbsenceIndex = falta._linha; 
    
    const btn = document.getElementById('btnEnviarFalta');
    btn.innerHTML = 'ATUALIZAR';
    
    alert("📝 Editando solicitação.");
}

async function enviarJustificativa() {
    const dataFalta = document.getElementById('faltaData').value;
    const motivo = document.getElementById('faltaMotivo').value;
    const obs = document.getElementById('faltaObs').value;
    const fileInput = document.getElementById('faltaArquivo');
    
    if(!dataFalta || !motivo) return alert("Preencha data e motivo.");
    
    showLoading(true, editingAbsenceIndex ? "ATUALIZANDO..." : "ENVIANDO...");
    
    const payload = {
        vendedor: loggedUser,
        dataFalta: dataFalta,
        motivo: motivo,
        observacao: obs,
        _linha: editingAbsenceIndex
    };
    
    const route = editingAbsenceIndex ? 'updateAbsence' : 'registerAbsence';

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async function(e) {
            payload.fileData = e.target.result; 
            payload.fileName = file.name;
            payload.mimeType = file.type;
            await enviarPayloadFalta(route, payload);
        };
        reader.readAsDataURL(file);
    } else {
        if(editingAbsenceIndex) payload.existingFile = ""; 
        await enviarPayloadFalta(route, payload);
    }
}

async function enviarPayloadFalta(route, payload) {
    const res = await apiCall(route, payload);
    showLoading(false);
    if (res && res.status === 'success') {
        alert(editingAbsenceIndex ? "✅ Atualizado!" : "✅ Enviado!");
        ocultarHistoricoFaltas();
        navegarPara('dashboard');
    } else alert("Erro ao enviar.");
}

// 8. FUNÇÕES DE IA E MATERIAIS

async function carregarMateriais(f=null, s="") {
    const div = document.getElementById('materiaisGrid');
    if (!div) return;
    currentFolderId = f; 
    div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10">Carregando...</div>';
    
    try {
        const res = await apiCall('getImages', { folderId: f, search: s }, false);
        if (res && res.status === 'success' && res.data) {
            atualizarNavegacaoMateriais(res.isRoot);
            renderMateriais(res.data);
        } else { throw new Error(res?.message || "Erro desconhecido"); }
    } catch (error) {
        div.innerHTML = `<div class="col-span-2 text-center text-red-400 py-10"><i class="fas fa-wifi mb-2"></i><br>Falha.<br><button onclick="carregarMateriais('${f || ''}')" class="mt-3 bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-sm">Tentar Novamente</button></div>`;
    }
}

function renderMateriais(items) {
    const div = document.getElementById('materiaisGrid');
    if(!div) return;
    if(items.length === 0) { div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10">Vazio.</div>'; return; }
    div.innerHTML = items.map(item => {
        if (item.type === 'folder') {
            return `<div onclick="carregarMateriais('${item.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex flex-col items-center justify-center gap-2 cursor-pointer h-36 hover:bg-blue-50 group"><i class="fas fa-folder text-5xl text-[#00aeef] drop-shadow-sm group-hover:scale-110 transition"></i><span class="text-xs font-bold text-slate-600 text-center leading-tight line-clamp-2">${item.name}</span></div>`;
        } else {
            return `<div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-48 relative overflow-hidden group">
                <div class="h-32 w-full bg-gray-50 rounded-xl overflow-hidden relative mb-2"><img src="${item.thumbnail}" class="w-full h-full object-cover transition transform group-hover:scale-105" alt="${item.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400?text=IMG'"></div>
                <div class="flex-1 flex items-center justify-between mt-2 px-1"><span class="text-[10px] text-gray-500 font-bold truncate flex-1">${item.name}</span><a href="${item.downloadUrl}" target="_blank" class="text-blue-500 text-xs font-bold">Baixar</a></div>
            </div>`;
        }
    }).join('');
}

function atualizarNavegacaoMateriais(isRoot) {
    const btn = document.querySelector('#materiais button'); 
    const title = document.querySelector('#materiais h2');
    if(btn) {
        if(isRoot) {
            btn.onclick = () => navegarPara('dashboard');
            if(title) title.innerText = "Marketing";
        } else {
            btn.onclick = () => {
                const searchInput = document.getElementById('searchMateriais');
                if (searchInput) searchInput.value = ""; 
                carregarMateriais(null);
            };
            if(title) title.innerText = "Voltar";
        }
    }
}
function buscarMateriais() { carregarMateriais(currentFolderId, document.getElementById('searchMateriais').value); }
function compartilharImagem(u) { window.open(`https://wa.me/?text=${encodeURIComponent(u)}`, '_blank'); }

// 9. FUNÇÕES UTILITÁRIAS & AUXILIARES

async function carregarVendedores() {
    const s = document.getElementById('userSelect');
    const s2 = document.getElementById('modalLeadDestino');
    const s3 = document.getElementById('leadVendedorDestino');
    if(!s) return;
    s.innerHTML = '<option value="">Conectando...</option>';
    
    try {
        const res = await apiCall('getVendors', {}, false);
        if(res.status === 'success') {
            vendorsCache = res.data;
            const opts = res.data.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
            s.innerHTML = '<option value="">Selecione...</option>' + opts;
            if(s2) s2.innerHTML = '<option value="">Selecionar...</option>' + opts;
            if(s3) s3.innerHTML = '<option value="">Selecione...</option>' + opts;
        }
    } catch(e) {
        // Fallback
        const OFF = ["Bruno Garcia Queiroz", "Ana Paula Rodrigues", "Vendedor Teste"];
        const opts = OFF.map(v => `<option value="${v}">${v}</option>`).join('');
        s.innerHTML = '<option value="">Modo Offline</option>' + opts;
    }
}

function showLoading(show, txt) { 
    const l = document.getElementById('loader'); 
    if(l) l.style.display = show ? 'flex' : 'none'; 
    if(txt && document.getElementById('loaderText')) document.getElementById('loaderText').innerText = txt;
}

function atualizarDataCabecalho() {
    const el = document.getElementById('headerDate');
    if(el) el.innerText = new Date().toLocaleDateString('pt-BR');
}

function atualizarDashboard() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const count = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje)).length;
    const el = document.getElementById('statLeads');
    if(el) el.innerText = count;
}

function verificarAgendamentosHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    const banner = document.getElementById('lembreteBanner');
    if (retornos.length > 0) { if(banner) banner.classList.remove('hidden'); } 
    else { if(banner) banner.classList.add('hidden'); }
}

async function excluirLead() { if(!confirm("Excluir?")) return; showLoading(true); await apiCall('deleteLead', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead }); showLoading(false); alert("Excluído."); fecharLeadModal(); carregarLeads(); }
async function marcarVendaFechada() { if(!confirm("Confirmar Venda?")) return; showLoading(true); await apiCall('updateStatus', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: "Venda Fechada" }); showLoading(false); alert("Parabéns!"); fecharLeadModal(); carregarLeads(); }
async function salvarAgendamento() { const ag = `${document.getElementById('agendarData').value} ${document.getElementById('agendarHora').value}`; await apiCall('updateAgendamento', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: ag }); alert("Agendado!"); fecharLeadModal(); }
async function salvarObservacaoModal() { await apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: document.getElementById('modalLeadObs').value }); alert("Salvo!"); }

// IA Wrappers (Simplificados)
async function combaterObjecaoGeral() { const o=document.getElementById('inputObjecaoGeral').value; showLoading(true); const r=await apiCall('solveObjection',{objection:o}); showLoading(false); if(r.status==='success') { document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer.replace(/\*\*/g,'<b>').replace(/\*/g,'<i>'); document.getElementById('resultadoObjecaoGeral').classList.remove('hidden'); } }
async function combaterObjecaoLead() { const o=document.getElementById('inputObjecaoLead').value; showLoading(true); const r=await apiCall('solveObjection',{objection:o}); showLoading(false); if(r.status==='success') document.getElementById('respostaObjecaoLead').value=r.answer.replace(/[\*#]/g,''); }
async function salvarObjecaoLead() { await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value}); alert("Salvo!"); }
async function analiseEstrategicaIA() { showLoading(true); const r=await perguntarIABackend(`Analise lead ${leadAtualParaAgendar.nomeLead}`); showLoading(false); if(r) { document.getElementById('modalLeadObs').value += "\n\n[IA]: " + r.replace(/\*\*/g,''); alert("Análise adicionada!"); } }
async function raioXConcorrencia() { const p = document.getElementById('modalLeadProvedor').innerText; showLoading(true); const r = await perguntarIABackend(`Raio-X ${p}`); showLoading(false); if(r)document.getElementById('modalLeadObs').value += "\n\n[RX]: " + r}
async function refinarObsIA() { const o = document.getElementById('leadObs'); showLoading(true); const r = await perguntarIABackend(`Reescreva: "${o.value}"`); showLoading(false); if(r) o.value = r.replace(/\*\*/g,''); }
async function gerarCoachIA() { showLoading(true); const r=await perguntarIABackend("Frase motivacional curta"); showLoading(false); if(r) alert(`🚀 ${r.replace(/\*\*/g,'')}`); }
async function perguntarIABackend(p) { try { const r=await apiCall('askAI',{question:p},false); return r.status==='success' ? r.answer : null; } catch(e){return null;} }
async function consultarPlanosIA() { document.getElementById('chatModal').classList.remove('hidden'); }
function toggleChat() { document.getElementById('chatModal').classList.add('hidden'); }
async function enviarMensagemChat() { const i=document.getElementById('chatInput'); const m=i.value; if(!m)return; document.getElementById('chatHistory').innerHTML+=`<div class="text-right p-2 mb-1 bg-blue-50 rounded">${m}</div>`; i.value=''; const r=await perguntarIABackend(m); document.getElementById('chatHistory').innerHTML+=`<div class="text-left p-2 bg-gray-100 mb-1 rounded">${r}</div>`; }
async function buscarEnderecoGPS() { navigator.geolocation.getCurrentPosition(p=>{fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json()).then(d=>{if(d.address){document.getElementById('leadEndereco').value=d.address.road;document.getElementById('leadBairro').value=d.address.suburb}})},()=>{alert('Erro GPS')}) }
function iniciarDitado(t) { const r=new(window.SpeechRecognition||window.webkitSpeechRecognition)(); r.lang='pt-BR'; r.start(); r.onresult=e=>{document.getElementById(t).value+=e.results[0][0].transcript} }
function copiarTexto(id){ document.getElementById(id).select(); document.execCommand('copy'); alert("Copiado!"); }
function enviarZapTexto(id){ window.open(`https://wa.me/?text=${encodeURIComponent(document.getElementById(id).value)}`,'_blank'); }
async function gerarAbordagemIA(){const nome=document.getElementById('leadNome').value;showLoading(true);const t=await perguntarIABackend(`Pitch curto para ${nome}`);showLoading(false);if(t)document.getElementById('leadObs').value=t}
async function gerarScriptVendaIA(){if(!leadAtualParaAgendar)return;showLoading(true);const r=await perguntarIABackend(`Script WhatsApp para ${leadAtualParaAgendar.nomeLead}`);showLoading(false);if(r){const e=document.createElement('textarea');e.value=r;document.body.appendChild(e);e.select();document.execCommand('copy');document.body.removeChild(e);alert("Copiado!\n"+r);if(confirm("Abrir Zap?"))window.open(`https://wa.me/55${leadAtualParaAgendar.telefone.replace(/\D/g,'')}?text=${encodeURIComponent(r)}`,'_blank')}}
