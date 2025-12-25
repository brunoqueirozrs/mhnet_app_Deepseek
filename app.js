/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V92 (FINAL GESTÃO & VISUAL)
 * ============================================================
 * 📝 UPDATE:
 * - Filtros de Funil (Botões acima da busca).
 * - Busca por Nome, Telefone, Bairro e Cidade.
 * - Detalhes do Lead reorganizados (Tags).
 * - Lógica de atualização de status direto no modal.
 * ============================================================
 */

// ⚠️ ID DO BACKEND V91 (Confirmado)
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// ESTADO GLOBAL
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let vendorsCache = []; 
let leadAtualParaAgendar = null; 
let currentFolderId = null;
let editingLeadIndex = null;
let editingAbsenceIndex = null;
let syncQueue = JSON.parse(localStorage.getItem('mhnet_sync_queue') || '[]');

// 1. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V92 Started");
    
    carregarVendedores();
    
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { try { leadsCache = JSON.parse(saved); } catch(e) {} }
    
    if (loggedUser) {
         initApp();
         if(navigator.onLine) processarFilaSincronizacao();
    } else {
         document.getElementById('userMenu').style.display = 'flex';
         document.getElementById('mainContent').style.display = 'none';
    }
});

window.addEventListener('online', processarFilaSincronizacao);

// 2. CORE
function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    
    // Nome completo do vendedor
    document.getElementById('userInfo').innerText = loggedUser; 
    
    // Botões de Admin (Se for o Gestor)
    if (loggedUser === "Bruno Garcia Queiroz") {
        const btnAdmin = document.getElementById('btnAdminSettings');
        if(btnAdmin) btnAdmin.classList.remove('hidden');
        // Libera campo de encaminhamento no cadastro
        const divEncaminhar = document.getElementById('divEncaminhar');
        if(divEncaminhar) divEncaminhar.classList.remove('hidden');
    }
    
    atualizarDataCabecalho();
    carregarLeads(false); 
    navegarPara('dashboard');
}

// 3. NAVEGAÇÃO
function navegarPara(pageId) {
    document.querySelectorAll('.page').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('fade-in');
    });

    const target = document.getElementById(pageId);
    if(target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('fade-in'), 10);
    }
    
    const scroller = document.getElementById('main-scroll');
    if(scroller) scroller.scrollTo(0,0);

    // Hooks Específicos
    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') abrirIndicadores();
    if (pageId === 'gestaoLeads') {
        // Reseta filtros ao entrar na tela (exceto se vier de filtro específico)
        const busca = document.getElementById('searchLead');
        if(busca && !busca.placeholder.includes("Filtrado")) {
            busca.value = "";
            busca.placeholder = "Nome, Bairro, Cidade, Tel...";
            // Reseta botões de filtro
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('btnFilterTodos')?.classList.add('active');
            renderLeads(); 
        }
    }
    if (pageId === 'cadastroLead') {
        ajustarMicrofone();
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

// 4. FUNIL & INDICADORES
async function abrirIndicadores() {
    navegarPara('indicadores');
    ['funnelLeads', 'funnelNegociacao', 'funnelVendas', 'indRealizado', 'indMeta'].forEach(id => {
        const el = document.getElementById(id); if(el) el.innerText = '...';
    });
    document.getElementById('indAnaliseIA').innerText = '🤖 Analisando performance...';
    
    const res = await apiCall('getIndicators', { vendedor: loggedUser }, false);
    
    if (res && res.status === 'success') {
        const d = res.data;
        document.getElementById('funnelLeads').innerText = d.totalLeads;
        document.getElementById('funnelNegociacao').innerText = d.negociacao || 0;
        document.getElementById('funnelVendas').innerText = d.vendas;
        
        document.getElementById('indMes').innerText = d.mes;
        document.getElementById('indCiclo').innerText = `Ciclo: ${d.ciclo}`;
        document.getElementById('indRealizado').innerText = d.vendas;
        document.getElementById('indMeta').innerText = d.meta;
        
        // Coach IA
        apiCall('analyzeIndicators', { 
            vendas: d.vendas, meta: d.meta, diasUteisRestantes: d.diasUteisRestantes 
        }, false).then(r => {
             if(r.status === 'success') document.getElementById('indAnaliseIA').innerText = r.message;
        });
    } else {
        document.getElementById('indAnaliseIA').innerText = 'Não foi possível carregar os dados.';
    }
}

// 5. GESTÃO DE LEADS

// Filtro: Leads Hoje (Dashboard)
function filtrarLeadsHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    
    // Filtra no cache local
    const leadsHoje = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje));
    
    if (leadsHoje.length === 0) {
        alert("📅 Nenhum lead cadastrado hoje!\nVamos pra cima! 🚀");
        return; 
    }
    
    navegarPara('gestaoLeads');
    
    // Atualiza input de busca para mostrar o estado do filtro
    const input = document.getElementById('searchLead');
    input.value = "";
    input.placeholder = `Filtrado: Hoje (${leadsHoje.length})`;
    
    // Renderiza a lista filtrada
    renderListaLeads(leadsHoje);
}

// Filtro: Retornos (Dashboard/Sino)
function filtrarRetornos() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    
    if (retornos.length === 0) {
        alert("Nenhum retorno agendado para hoje.");
        return;
    }
    
    navegarPara('gestaoLeads');
    
    const input = document.getElementById('searchLead');
    input.value = "";
    input.placeholder = `Retornos de Hoje (${retornos.length})`;
    
    renderListaLeads(retornos);
}

// Filtro: Botões de Status (Funil)
function filtrarPorStatus(status) {
    // Atualiza visual dos botões
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    // Tenta ativar o botão clicado (pelo texto ou lógica)
    const btnId = 'btnFilter' + status.replace(/\s+/g, '');
    const btn = document.getElementById(btnId) || event.target;
    if(btn) btn.classList.add('active');
    
    const input = document.getElementById('searchLead');
    input.value = "";
    
    let listaFiltrada = leadsCache;
    
    if (status !== 'Todos') {
        // Filtra por status exato ou interesse (para compatibilidade antiga)
        listaFiltrada = leadsCache.filter(l => l.status === status || (!l.status && l.interesse === status));
        input.placeholder = `Filtro: ${status} (${listaFiltrada.length})`;
    } else {
        input.placeholder = "Nome, Bairro, Cidade, Tel...";
    }
    
    renderListaLeads(listaFiltrada);
}

async function carregarLeads(showLoader = true) {
    if(!navigator.onLine) {
        if(document.getElementById('listaLeadsGestao')) renderLeads();
        return;
    }
    const res = await apiCall('getLeads', { vendedor: loggedUser }, showLoader);
    if (res && res.status === 'success') {
        leadsCache = res.data || [];
        // Ordena por inserção (mais recente primeiro)
        leadsCache.sort((a, b) => b._linha - a._linha);
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        
        if (res.isAdmin) document.getElementById('adminPanel')?.classList.remove('hidden');
        
        // Só renderiza se a tela estiver visível
        if(document.getElementById('listaLeadsGestao') && document.getElementById('gestaoLeads').style.display !== 'none') {
            renderLeads();
        }
        atualizarDashboard();
        verificarAgendamentosHoje();
    }
}

// Função Principal de Renderização (Busca Geral)
function renderLeads() {
    const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
    
    // Busca por Nome, Bairro, Cidade ou Telefone
    const lista = leadsCache.filter(l => 
        (l.nomeLead||'').toLowerCase().includes(term) || 
        (l.bairro||'').toLowerCase().includes(term) ||
        (l.cidade||'').toLowerCase().includes(term) ||
        (l.telefone||'').includes(term)
    );
    
    renderListaLeads(lista);
}

// Renderiza o array de leads passado
function renderListaLeads(lista) {
    const div = document.getElementById('listaLeadsGestao');
    if (!div) return;
    
    if (lista.length === 0) { 
        div.innerHTML = '<div class="text-center mt-10 text-gray-400">Nenhum lead encontrado.</div>'; 
        return; 
    }

    div.innerHTML = lista.map((l) => {
        // Encontra o índice real no cache global para o clique funcionar corretamente
        const realIndex = leadsCache.indexOf(l);
        return criarCardLead(l, realIndex);
    }).join('');
}

function criarCardLead(l, index) {
    let badgeColor = "bg-slate-100 text-slate-500";
    // Cores baseadas no Funil
    if (l.status === 'Venda Fechada') badgeColor = "bg-green-500 text-white font-bold";
    else if (l.status === 'Em Negociação') badgeColor = "bg-blue-100 text-blue-600 font-bold";
    else if (l.status === 'Agendado') badgeColor = "bg-orange-100 text-orange-600 font-bold";
    else if (l.status === 'Perda') badgeColor = "bg-red-100 text-red-600 font-bold";
    else if (l.status === 'Novo' || !l.status) badgeColor = "bg-indigo-100 text-indigo-600 font-bold";

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition">
        <div class="flex justify-between items-start">
            <div>
                <div class="font-bold text-slate-800 text-lg leading-tight">${l.nomeLead}</div>
                <div class="text-xs text-slate-500 mt-1">${l.bairro || '-'} • ${l.cidade || '-'}</div>
                <div class="mt-2 text-[10px] text-indigo-500 font-bold"><i class="fas fa-wifi"></i> ${l.provedor || 'Sem provedor'}</div>
            </div>
            <div class="flex flex-col items-end gap-1">
                <span class="text-[10px] px-2 py-1 rounded-full ${badgeColor}">${l.status || 'Novo'}</span>
                ${l.agendamento ? `<span class="text-[9px] text-orange-500 flex items-center gap-1"><i class="fas fa-clock"></i> ${l.agendamento.split(' ')[0]}</span>` : ''}
            </div>
        </div>
    </div>`;
}

// --- DETALHES DO LEAD (MODAL) ---

function abrirLeadDetalhes(index) {
    const l = leadsCache[index];
    if(!l) return;
    leadAtualParaAgendar = l;
    
    // Topo (Nome, Tags)
    document.getElementById('modalLeadNome').innerText = l.nomeLead;
    document.getElementById('modalLeadBairro').innerText = l.bairro || "Sem bairro";
    document.getElementById('modalLeadCidade').innerText = l.cidade || "Sem cidade";
    document.getElementById('modalLeadTelefone').innerText = l.telefone || "Sem fone";
    
    // Provedor e Raio-X
    document.getElementById('modalLeadProvedor').innerText = l.provedor || "--";
    
    // Status (Funil) - Preenche o select com o status atual
    const statusSel = document.getElementById('modalStatusFunil');
    if(statusSel) statusSel.value = l.status || "Novo";
    
    // Campos de Texto
    document.getElementById('modalLeadObs').value = l.observacao || "";
    document.getElementById('inputObjecaoLead').value = l.objecao || "";
    document.getElementById('respostaObjecaoLead').value = l.respostaObjecao || "";

    // Ação WhatsApp Tag
    const btnTag = document.getElementById('btnModalWhatsTag');
    if(btnTag) btnTag.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');
    const btnWhats = document.getElementById('btnModalWhats');
    if(btnWhats) btnWhats.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');

    // Botão Raio-X (Injeção Dinâmica)
    const containerRaioX = document.getElementById('containerRaioX');
    if(containerRaioX) {
        containerRaioX.innerHTML = `<button onclick="raioXConcorrencia()" class="ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold shadow flex items-center gap-1 active:scale-95"><i class="fas fa-bolt text-yellow-400"></i> Raio-X</button>`;
    }

    document.getElementById('leadModal').classList.remove('hidden');
}

function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); leadAtualParaAgendar = null; editingLeadIndex = null; }

// --- SALVAR STATUS PELO MODAL ---
async function salvarStatusFunil() {
    if(!leadAtualParaAgendar) return;
    const novoStatus = document.getElementById('modalStatusFunil').value;
    
    // Atualiza visualmente no cache local
    leadAtualParaAgendar.status = novoStatus;
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    
    // Se a lista estiver aberta ao fundo, atualiza ela
    if(document.getElementById('gestaoLeads').style.display !== 'none') {
        renderLeads();
    }
    
    // Salva no backend
    showLoading(true, "ATUALIZANDO STATUS...");
    const res = await apiCall('updateStatus', { 
        vendedor: loggedUser, 
        nomeLead: leadAtualParaAgendar.nomeLead, 
        status: novoStatus 
    });
    showLoading(false);
    
    if(res.status !== 'success' && !res.local) {
        alert("Erro ao salvar status. Tente novamente.");
    }
}

// --- CADASTRO E EDIÇÃO ---

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
}

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
        status: document.getElementById('leadStatus').value, // Funil
        observacao: document.getElementById('leadObs').value,
        agendamento: "",
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
        
        // Se novo e não for encaminhamento, insere no topo local
        if(editingLeadIndex === null && !res.local && !payload.novoVendedor) {
             payload.timestamp = new Date().toLocaleDateString('pt-BR'); 
             leadsCache.unshift(payload);
        }
        
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        
        // Recarrega do servidor se editou
        if(editingLeadIndex !== null) carregarLeads(false);

        editingLeadIndex = null;
        navegarPara('gestaoLeads');
    } else {
        alert("Erro: " + (res?.message || "Falha"));
    }
}

// --- GESTÃO DE EQUIPE (ADMIN) ---
function abrirConfiguracoes() { document.getElementById('configModal').classList.remove('hidden'); }

async function gerirEquipe(acao) {
    const nome = document.getElementById('cfgNomeVendedor').value;
    const meta = document.getElementById('cfgMeta').value;
    if(!nome) return alert("Nome obrigatório");
    showLoading(true);
    const res = await apiCall('manageTeam', { acao, nome, meta });
    showLoading(false);
    if(res.status === 'success') { alert("Atualizado!"); carregarVendedores(); document.getElementById('configModal').classList.add('hidden'); } else alert("Erro.");
}

async function encaminharLeadModal() {
    const novoVendedor = document.getElementById('modalLeadDestino').value;
    if(!novoVendedor) return alert("Selecione um vendedor.");
    if(!confirm(`Encaminhar para ${novoVendedor}?`)) return;
    
    showLoading(true, "ENCAMINHANDO...");
    const res = await apiCall('forwardLead', { 
        nomeLead: leadAtualParaAgendar.nomeLead, telefone: leadAtualParaAgendar.telefone,
        novoVendedor: novoVendedor, origem: loggedUser
    });
    showLoading(false);
    if(res.status === 'success') { alert("✅ Lead encaminhado!"); fecharLeadModal(); carregarLeads(); } 
    else { alert("Erro: " + (res.message || "Falha")); }
}

// --- API & UTILS ---

async function apiCall(route, payload, show=true) {
    if(show) showLoading(true);

    if (!navigator.onLine && isWriteOperation(route)) {
        adicionarAFila(route, payload);
        if(show) showLoading(false);
        return { status: 'success', local: true, message: 'Offline Salvo' };
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
        console.warn(`Erro API (${route})`, e);
        if(show) showLoading(false);
        
        if (isWriteOperation(route)) {
            adicionarAFila(route, payload);
            return { status: 'success', local: true, message: 'Offline Salvo' };
        }
        return { status: 'error', message: 'Conexão' };
    }
}

function isWriteOperation(route) {
    return ['addLead', 'deleteLead', 'updateStatus', 'updateAgendamento', 'updateObservacao', 'addTask', 'toggleTask', 'archiveTasks', 'registerAbsence', 'updateAbsence', 'saveObjectionLead', 'updateLeadFull', 'forwardLead', 'manageTeam'].includes(route);
}

function adicionarAFila(route, payload) {
    syncQueue.push({ route, payload, timestamp: new Date().getTime() });
    localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue));
    alert("💾 Salvo Offline! Será enviado quando conectar.");
}

async function processarFilaSincronizacao() {
    if (syncQueue.length === 0) return;
    showLoading(true, "Sincronizando...");
    const falhas = [];
    for (const item of syncQueue) {
        try {
            await fetch(API_URL, { 
                method: 'POST', 
                body: JSON.stringify({ route: item.route, payload: item.payload }) 
            });
        } catch (e) { falhas.push(item); }
    }
    syncQueue = falhas;
    localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue));
    showLoading(false);
}

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
    } catch(e) { s.innerHTML = '<option value="">Offline</option>'; }
}

function showLoading(show, txt) { 
    const l = document.getElementById('loader'); 
    if(l) l.style.display = show ? 'flex' : 'none'; 
    if(txt) document.getElementById('loaderText').innerText = txt;
}
function atualizarDataCabecalho() { document.getElementById('headerDate').innerText = new Date().toLocaleDateString('pt-BR'); }
function atualizarDashboard() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const count = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje)).length;
    document.getElementById('statLeads').innerText = count;
}
function verificarAgendamentosHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    const banner = document.getElementById('lembreteBanner');
    if (retornos.length > 0) { if(banner) banner.classList.remove('hidden'); } else { if(banner) banner.classList.add('hidden'); }
}
async function excluirLead() { if(!confirm("Excluir?")) return; showLoading(true); await apiCall('deleteLead', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead }); showLoading(false); alert("Excluído."); fecharLeadModal(); carregarLeads(); }
async function marcarVendaFechada() { if(!confirm("Confirmar Venda?")) return; showLoading(true); await apiCall('updateStatus', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: "Venda Fechada" }); showLoading(false); alert("Parabéns!"); fecharLeadModal(); carregarLeads(); }
async function salvarAgendamento() { const ag = `${document.getElementById('agendarData').value} ${document.getElementById('agendarHora').value}`; await apiCall('updateAgendamento', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: ag }); alert("Agendado!"); fecharLeadModal(); }
async function salvarObservacaoModal() { await apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: document.getElementById('modalLeadObs').value }); alert("Salvo!"); }

// TAREFAS
async function carregarTarefas() {
    const div = document.getElementById('listaTarefasContainer');
    div.innerHTML = 'Carregando...';
    const res = await apiCall('getTasks', { vendedor: loggedUser }, false);
    if (res && res.status === 'success') {
        const tasks = res.data;
        if (tasks.length === 0) { div.innerHTML = '<div class="text-center p-10 text-gray-300">Nenhuma tarefa.</div>'; return; }
        div.innerHTML = tasks.map(t => `<div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 ${t.status==='CONCLUIDA'?'opacity-50 line-through':''}"><input type="checkbox" ${t.status==='CONCLUIDA'?'checked':''} onchange="toggleTask('${t.id}','${t.status}')" class="w-5 h-5"><div class="flex-1 text-sm font-bold text-slate-700">${t.descricao}</div></div>`).join('');
    } else div.innerHTML = 'Erro.';
}
function abrirModalTarefa() { document.getElementById('taskModal').classList.remove('hidden'); }
async function salvarTarefa() { const desc = document.getElementById('taskDesc').value; if(!desc) return; showLoading(true); await apiCall('addTask', { vendedor: loggedUser, descricao: desc, dataLimite: document.getElementById('taskDate').value }); showLoading(false); document.getElementById('taskModal').classList.add('hidden'); carregarTarefas(); }
async function toggleTask(id, s) { await apiCall('toggleTask', { taskId: id, status: s, vendedor: loggedUser }, false); carregarTarefas(); }
async function limparTarefasConcluidas() { if(confirm("Limpar?")) { showLoading(true); await apiCall('archiveTasks', { vendedor: loggedUser }); showLoading(false); carregarTarefas(); } }

// FALTAS
async function verHistoricoFaltas() {
    const div = document.getElementById('listaHistoricoFaltas');
    document.getElementById('historicoFaltasContainer').classList.remove('hidden');
    document.getElementById('formFaltaContainer').classList.add('hidden');
    div.innerHTML = 'Carregando...';
    const res = await apiCall('getAbsences', { vendedor: loggedUser }, false);
    if (res.status === 'success' && res.data.length > 0) {
        div.innerHTML = res.data.map(f => `<div onclick='preencherEdicaoFalta(${JSON.stringify(f)})' class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2"><div class="font-bold text-xs">${f.motivo}</div><div class="text-[10px] text-slate-400">${f.dataFalta} • ${f.statusEnvio}</div></div>`).join('');
    } else div.innerHTML = 'Sem histórico.';
}
function ocultarHistoricoFaltas() { document.getElementById('historicoFaltasContainer').classList.add('hidden'); document.getElementById('formFaltaContainer').classList.remove('hidden'); editingAbsenceIndex = null; }
function preencherEdicaoFalta(f) { document.getElementById('historicoFaltasContainer').classList.add('hidden'); document.getElementById('formFaltaContainer').classList.remove('hidden'); document.getElementById('faltaData').value = f.dataFalta.split('/').reverse().join('-'); document.getElementById('faltaMotivo').value = f.motivo; document.getElementById('faltaObs').value = f.obs; editingAbsenceIndex = f._linha; }
async function enviarJustificativa() { const dt = document.getElementById('faltaData').value; const mt = document.getElementById('faltaMotivo').value; if(!dt || !mt) return alert("Preencha dados."); showLoading(true); const payload = { vendedor: loggedUser, dataFalta: dt, motivo: mt, observacao: document.getElementById('faltaObs').value, _linha: editingAbsenceIndex }; const route = editingAbsenceIndex ? 'updateAbsence' : 'registerAbsence'; const file = document.getElementById('faltaArquivo').files[0]; if(file) { const reader = new FileReader(); reader.onload = async function(e) { payload.fileData = e.target.result; payload.fileName = file.name; payload.mimeType = file.type; await enviarPayloadFalta(route, payload); }; reader.readAsDataURL(file); } else await enviarPayloadFalta(route, payload); }
async function enviarPayloadFalta(r, p) { const res = await apiCall(r, p); showLoading(false); if (res.status === 'success') { alert("Enviado!"); ocultarHistoricoFaltas(); navegarPara('dashboard'); } else alert("Erro."); }

// IA / MATERIAIS
async function carregarMateriais(f=null,s=""){ const d=document.getElementById('materiaisGrid'); d.innerHTML='Carregando...'; const r=await apiCall('getImages',{folderId:f,search:s},false); if(r.status==='success') renderMateriais(r.data); }
function renderMateriais(i){ const d=document.getElementById('materiaisGrid'); d.innerHTML=i.map(x=>x.type==='folder'?`<div onclick="carregarMateriais('${x.id}')" class="bg-blue-50 p-4 text-center cursor-pointer"><i class="fas fa-folder text-blue-500"></i> ${x.name}</div>`:`<div class="p-2 border"><a href="${x.downloadUrl}" target="_blank">${x.name}</a></div>`).join(''); }
function buscarMateriais(){ carregarMateriais(currentFolderId, document.getElementById('searchMateriais').value); }
async function combaterObjecaoGeral(){ const o=document.getElementById('inputObjecaoGeral').value; showLoading(true); const r=await apiCall('solveObjection',{objection:o}); showLoading(false); if(r.status==='success') { document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer; document.getElementById('resultadoObjecaoGeral').classList.remove('hidden'); } }
async function combaterObjecaoLead(){ const o=document.getElementById('inputObjecaoLead').value; showLoading(true); const r=await apiCall('solveObjection',{objection:o}); showLoading(false); if(r.status==='success') document.getElementById('respostaObjecaoLead').value=r.answer; }
async function salvarObjecaoLead(){ await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value}); alert("Salvo!"); }
async function analiseEstrategicaIA(){ showLoading(true); const r=await perguntarIABackend(`Analise lead ${leadAtualParaAgendar.nomeLead}`); showLoading(false); if(r) { document.getElementById('modalLeadObs').value += "\n\n[IA]: " + r; alert("Adicionado!"); } }
async function raioXConcorrencia(){ const p = document.getElementById('modalLeadProvedor').innerText; showLoading(true); const r = await perguntarIABackend(`Raio-X concorrente ${p}`); showLoading(false); if(r) { document.getElementById('modalLeadObs').value += "\n\n[RX]: " + r; } }
async function refinarObsIA(){ const o=document.getElementById('leadObs'); showLoading(true); const r=await perguntarIABackend(`Reescreva: "${o.value}"`); showLoading(false); if(r) o.value = r; }
async function gerarCoachIA(){ const r=await perguntarIABackend("Frase motivacional"); if(r) alert(`🚀 ${r}`); }
async function perguntarIABackend(p){ try { const r=await apiCall('askAI',{question:p},false); return r.status==='success' ? r.answer : null; } catch(e){return null;} }
async function consultarPlanosIA(){ document.getElementById('chatModal').classList.remove('hidden'); }
function toggleChat(){ document.getElementById('chatModal').classList.add('hidden'); }
async function enviarMensagemChat(){ const i=document.getElementById('chatInput'); const m=i.value; if(!m)return; document.getElementById('chatHistory').innerHTML+=`<div class="text-right bg-blue-50 p-2 mb-1">${m}</div>`; i.value=''; const r=await perguntarIABackend(m); document.getElementById('chatHistory').innerHTML+=`<div class="text-left bg-gray-100 p-2 mb-1">${r}</div>`; }
async function buscarEnderecoGPS(){ navigator.geolocation.getCurrentPosition(p=>{ fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json()).then(d=>{ if(d.address){ document.getElementById('leadEndereco').value=d.address.road; document.getElementById('leadBairro').value=d.address.suburb; document.getElementById('leadCidade').value=d.address.city; } }) },()=>{alert('Erro GPS')}) }
function iniciarDitado(t){ const r=new(window.SpeechRecognition||window.webkitSpeechRecognition)(); r.lang='pt-BR'; r.start(); r.onresult=e=>{document.getElementById(t).value+=e.results[0][0].transcript} }
function copiarTexto(id){ document.getElementById(id).select(); document.execCommand('copy'); alert("Copiado!"); }
function enviarZapTexto(id){ window.open(`https://wa.me/?text=${encodeURIComponent(document.getElementById(id).value)}`,'_blank'); }
