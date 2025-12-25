/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V94 (FINAL SINCRONIZADO)
 * ============================================================
 * 📝 UPDATE:
 * - Código unificado e completo (sem abreviações).
 * - Sincronizado com HTML V92 e Backend V90.
 * - Inclui todas as funções de Gestão, Faltas e Tarefas.
 * ============================================================
 */

// ⚠️ ID DA IMPLANTAÇÃO BACKEND (V90/V91)
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// --- ESTADO GLOBAL ---
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let vendorsCache = [];
let leadAtualParaAgendar = null; 
let chatHistoryData = []; 
let currentFolderId = null;
let editingLeadIndex = null;
let editingAbsenceIndex = null;
let syncQueue = JSON.parse(localStorage.getItem('mhnet_sync_queue') || '[]');

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V94 - Sistema Pronto");
    
    carregarVendedores();
    
    // Recupera cache local
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { try { leadsCache = JSON.parse(saved); } catch(e) {} }
    
    if (loggedUser) {
         initApp();
         // Tenta sincronizar dados offline se houver rede
         if(navigator.onLine) processarFilaSincronizacao();
    } else {
         document.getElementById('userMenu').style.display = 'flex';
         document.getElementById('mainContent').style.display = 'none';
    }
});

// Listener de Conexão
window.addEventListener('online', () => {
    console.log("🌐 Online");
    processarFilaSincronizacao();
});

// ============================================================
// 2. CORE & NAVEGAÇÃO
// ============================================================

function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    document.getElementById('userInfo').innerText = loggedUser;
    
    // Modo Gestor
    if (loggedUser === "Bruno Garcia Queiroz") {
        const btnAdmin = document.getElementById('btnAdminSettings');
        const divEncaminhar = document.getElementById('divEncaminhar');
        if(btnAdmin) btnAdmin.classList.remove('hidden');
        if(divEncaminhar) divEncaminhar.classList.remove('hidden');
    }
    
    atualizarDataCabecalho();
    carregarLeads(false); 
    navegarPara('dashboard');
}

function setLoggedUser() {
    const v = document.getElementById('userSelect').value;
    if (v) { 
        loggedUser = v; 
        localStorage.setItem('loggedUser', v); 
        initApp(); 
    } else {
        alert('Selecione um vendedor!');
    }
}

function logout() { 
    if(confirm("Deseja sair do sistema?")) { 
        localStorage.removeItem('loggedUser'); 
        location.reload(); 
    } 
}

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

    // Hooks de Página
    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') abrirIndicadores();
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        // Limpa filtro se não for vindo de "Leads Hoje"
        if(busca && !busca.placeholder.includes("Filtrado")) {
            busca.value = "";
            busca.placeholder = "Buscar...";
        }
        renderLeads();
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

// ============================================================
// 3. COMUNICAÇÃO API (OFFLINE SYNC)
// ============================================================

async function apiCall(route, payload, show=true) {
    if(show) showLoading(true);

    // Se offline e for escrita, salva na fila
    if (!navigator.onLine && isWriteOperation(route)) {
        adicionarAFila(route, payload);
        if(show) showLoading(false);
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
        console.warn(`⚠️ Erro API (${route}):`, e);
        if(show) showLoading(false);
        
        if (isWriteOperation(route)) {
            adicionarAFila(route, payload);
            return { status: 'success', local: true, message: 'Salvo localmente (Erro Conexão)' };
        }
        return { status: 'error', message: 'Sem conexão.' };
    }
}

function isWriteOperation(route) {
    return ['addLead', 'deleteLead', 'updateStatus', 'updateAgendamento', 'updateObservacao', 'addTask', 'toggleTask', 'archiveTasks', 'registerAbsence', 'updateAbsence', 'saveObjectionLead', 'updateLeadFull', 'forwardLead', 'manageTeam'].includes(route);
}

function adicionarAFila(route, payload) {
    syncQueue.push({ route, payload, timestamp: new Date().getTime() });
    localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue));
    
    // Atualização Otimista Local (Para Leads)
    if (route === 'addLead' && !payload.novoVendedor) {
        payload.timestamp = new Date().toLocaleDateString('pt-BR');
        leadsCache.unshift(payload);
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    }
    
    alert("💾 Sem internet: Dados salvos no dispositivo!\nSerão enviados quando conectar.");
}

async function processarFilaSincronizacao() {
    if (syncQueue.length === 0) return;
    showLoading(true, "Sincronizando...");
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
    
    if (syncQueue.length === 0 && document.getElementById('gestaoLeads').style.display !== 'none') {
        carregarLeads(false);
    }
}

// ============================================================
// 4. LEADS & FILTROS
// ============================================================

function filtrarLeadsHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const leadsHoje = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje));
    
    if (leadsHoje.length === 0) {
        alert("📅 Nenhum lead cadastrado hoje!\nVamos pra cima! 🚀");
        return; 
    }
    
    navegarPara('gestaoLeads');
    const div = document.getElementById('listaLeadsGestao');
    div.innerHTML = leadsHoje.map((l) => {
        const realIndex = leadsCache.indexOf(l);
        return criarCardLead(l, realIndex);
    }).join('');
    
    document.getElementById('searchLead').placeholder = `Filtrado: Hoje (${leadsHoje.length})`;
}

function filtrarRetornos() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    
    if (retornos.length === 0) {
        alert("Nenhum retorno pendente para hoje.");
        return;
    }
    
    navegarPara('gestaoLeads');
    const div = document.getElementById('listaLeadsGestao');
    div.innerHTML = retornos.map(l => {
        const idx = leadsCache.indexOf(l);
        return criarCardLead(l, idx);
    }).join('');
    document.getElementById('searchLead').placeholder = `Retornos de Hoje (${retornos.length})`;
}

async function carregarLeads(showLoader = true) {
    if(!navigator.onLine) {
        if(document.getElementById('listaLeadsGestao')) renderLeads();
        return;
    }

    const res = await apiCall('getLeads', { vendedor: loggedUser }, showLoader);
    if (res && res.status === 'success') {
        leadsCache = res.data || [];
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        
        if (res.isAdmin) document.getElementById('adminPanel')?.classList.remove('hidden');
        
        if(document.getElementById('listaLeadsGestao') && document.getElementById('gestaoLeads').style.display !== 'none') {
            renderLeads();
        }
        atualizarDashboard();
        verificarAgendamentosHoje();
    }
}

function renderLeads() {
    const div = document.getElementById('listaLeadsGestao');
    if (!div) return;
    const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
    
    const lista = leadsCache.filter(l => 
        (l.nomeLead||'').toLowerCase().includes(term) || 
        (l.bairro||'').toLowerCase().includes(term) ||
        (l.provedor||'').toLowerCase().includes(term)
    );
    
    if (!lista.length) { div.innerHTML = '<div class="text-center mt-10 text-gray-400">Vazio.</div>'; return; }

    div.innerHTML = lista.map((l) => {
        const realIndex = leadsCache.indexOf(l);
        return criarCardLead(l, realIndex);
    }).join('');
}

function criarCardLead(l, index, destaque = false) {
    let badgeColor = "bg-slate-100 text-slate-500";
    if (l.status === 'Venda Fechada') badgeColor = "bg-green-500 text-white font-bold";
    else if (l.status === 'Em Negociação') badgeColor = "bg-blue-100 text-blue-600 font-bold";
    else if (l.status === 'Perda') badgeColor = "bg-red-100 text-red-600 font-bold";
    else if (l.interesse === 'Alto') badgeColor = "bg-orange-100 text-orange-600 font-bold";

    const badgeProvedor = l.provedor ? `<span class="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 ml-2"><i class="fas fa-wifi"></i> ${l.provedor}</span>` : '';

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition">
        <div class="flex justify-between items-start">
            <div>
                <div class="font-bold text-slate-800 text-lg leading-tight">${l.nomeLead}</div>
                <div class="text-xs text-slate-500 mt-1">${l.bairro || 'Sem Bairro'} ${badgeProvedor}</div>
            </div>
            <div class="flex flex-col items-end gap-1">
                <span class="text-[10px] px-2 py-1 rounded-full ${badgeColor}">${l.status || l.interesse || 'Novo'}</span>
                ${l.agendamento ? `<span class="text-[9px] text-orange-500 flex items-center gap-1"><i class="fas fa-clock"></i> ${l.agendamento.split(' ')[0]}</span>` : ''}
            </div>
        </div>
    </div>`;
}

function abrirLeadDetalhes(index) {
    const l = leadsCache[index];
    if(!l) return;
    leadAtualParaAgendar = l;
    
    document.getElementById('modalLeadNome').innerText = l.nomeLead;
    document.getElementById('modalLeadInfo').innerText = `${l.bairro || '-'} • ${l.telefone}`;
    document.getElementById('modalLeadProvedor').innerText = l.provedor || "--";
    
    document.getElementById('modalLeadObs').value = l.observacao || "";
    document.getElementById('inputObjecaoLead').value = l.objecao || "";
    document.getElementById('respostaObjecaoLead').value = l.respostaObjecao || "";

    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) btnWhats.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');
    
    // Injeção botão Raio-X
    const containerProv = document.getElementById('modalLeadProvedor')?.parentElement;
    if(containerProv && !document.getElementById('btnRaioXModal')) {
        const btn = document.createElement('button');
        btn.id = 'btnRaioXModal';
        btn.className = "ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold shadow hover:bg-slate-700 transition flex items-center gap-1";
        btn.innerHTML = '<i class="fas fa-bolt text-yellow-400"></i> Raio-X';
        btn.onclick = (e) => { e.stopPropagation(); raioXConcorrencia(); };
        containerProv.appendChild(btn);
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

function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); leadAtualParaAgendar = null; editingLeadIndex = null; }

// --- CADASTRO, EDIÇÃO E GESTÃO ---

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
        status: document.getElementById('leadStatus').value, 
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

// Admin e Encaminhamento
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
    
    if(res.status === 'success') {
        alert("✅ Lead encaminhado!");
        fecharLeadModal();
        carregarLeads(); 
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
        document.getElementById('funnelLeads').innerText = d.totalLeads;
        document.getElementById('funnelNegociacao').innerText = d.negociacao || 0;
        document.getElementById('funnelVendas').innerText = d.vendas;
        document.getElementById('indMes').innerText = d.mes;
        document.getElementById('indCiclo').innerText = `Ciclo: ${d.ciclo}`;
        document.getElementById('indRealizado').innerText = d.vendas;
        document.getElementById('indMeta').innerText = d.meta;
        const progBar = document.getElementById('indProgresso');
        if(progBar) progBar.style.width = `${Math.min(d.porcentagem, 100)}%`;

        apiCall('analyzeIndicators', { vendas: d.vendas, meta: d.meta, diasUteisRestantes: d.diasUteisRestantes }).then(r => {
             if(r.status === 'success') document.getElementById('indAnaliseIA').innerText = r.message;
        });
    } else {
        document.getElementById('indAnaliseIA').innerText = 'Não foi possível carregar os dados.';
    }
}

// ============================================================
// 7. TAREFAS & FALTAS
// ============================================================

async function carregarTarefas() {
    const div = document.getElementById('listaTarefasContainer');
    div.innerHTML = '<div class="text-center p-5 text-gray-400">Carregando...</div>';
    const res = await apiCall('getTasks', { vendedor: loggedUser }, false);
    if (res && res.status === 'success') {
        const tasks = res.data;
        if (tasks.length === 0) { div.innerHTML = '<div class="text-center p-10 text-gray-300">Nenhuma tarefa pendente.</div>'; return; }
        div.innerHTML = tasks.map(t => {
            const checked = t.status === "CONCLUIDA" ? "checked" : "";
            const opacity = t.status === "CONCLUIDA" ? "opacity-50 line-through" : "";
            return `<div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 ${opacity}"><input type="checkbox" ${checked} onchange="toggleTask('${t.id}', '${t.status}')" class="w-5 h-5 accent-blue-600 rounded cursor-pointer"><div class="flex-1"><div class="text-sm font-bold text-slate-700">${t.descricao}</div><div class="text-[10px] text-slate-400 flex items-center gap-2 mt-1">${t.dataLimite ? `<span>📅 ${t.dataLimite}</span>` : ''}${t.nomeLead ? `<span class="bg-blue-50 text-blue-500 px-1 rounded">👤 ${t.nomeLead}</span>` : ''}${res.isAdmin ? `<span class="text-orange-400 font-bold ml-auto">${t.vendedor}</span>` : ''}</div></div></div>`;
        }).join('');
    } else div.innerHTML = '<div class="text-center text-red-400">Erro.</div>';
}
function abrirModalTarefa() { document.getElementById('taskModal').classList.remove('hidden'); const sel = document.getElementById('taskLeadSelect'); sel.innerHTML = '<option value="">Nenhum (Avulso)</option>'; leadsCache.forEach(l => { const opt = document.createElement('option'); opt.value = l.nomeLead; opt.innerText = l.nomeLead; sel.appendChild(opt); }); }
async function salvarTarefa() { const desc = document.getElementById('taskDesc').value; if(!desc) return; showLoading(true); await apiCall('addTask', { vendedor: loggedUser, descricao: desc, dataLimite: document.getElementById('taskDate').value, nomeLead: document.getElementById('taskLeadSelect').value }); showLoading(false); document.getElementById('taskModal').classList.add('hidden'); carregarTarefas(); }
async function toggleTask(id, s) { await apiCall('toggleTask', { taskId: id, status: s, vendedor: loggedUser }, false); carregarTarefas(); }
async function limparTarefasConcluidas() { if(confirm("Limpar concluídas?")) { showLoading(true); await apiCall('archiveTasks', { vendedor: loggedUser }); showLoading(false); carregarTarefas(); } }

async function verHistoricoFaltas() {
    const div = document.getElementById('listaHistoricoFaltas');
    document.getElementById('historicoFaltasContainer').classList.remove('hidden');
    document.getElementById('formFaltaContainer').classList.add('hidden');
    div.innerHTML = '<div class="text-center p-5 text-gray-400">Carregando...</div>';
    const res = await apiCall('getAbsences', { vendedor: loggedUser }, false);
    if (res.status === 'success' && res.data.length > 0) {
        div.innerHTML = res.data.map(f => `<div onclick='preencherEdicaoFalta(${JSON.stringify(f)})' class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 cursor-pointer"><div class="flex justify-between"><div><div class="font-bold text-xs">${f.motivo}</div><div class="text-[10px] text-slate-400">${f.dataFalta} • ${f.statusEnvio}</div></div><i class="fas fa-pen text-slate-300"></i></div></div>`).join('');
    } else div.innerHTML = '<div class="text-center p-5 text-gray-400 text-xs">Nenhum histórico.</div>';
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
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> ENVIAR SOLICITAÇÃO';
    btn.className = "w-full bg-[#00aeef] text-white font-bold py-4 rounded-xl shadow-xl mt-4 active:scale-95 transition flex items-center justify-center gap-2";
}
function preencherEdicaoFalta(f) {
    document.getElementById('historicoFaltasContainer').classList.add('hidden');
    document.getElementById('formFaltaContainer').classList.remove('hidden');
    const [d, m, a] = f.dataFalta.split('/'); document.getElementById('faltaData').value = `${a}-${m}-${d}`;
    document.getElementById('faltaMotivo').value = f.motivo; document.getElementById('faltaObs').value = f.obs;
    editingAbsenceIndex = f._linha;
    const btn = document.getElementById('btnEnviarFalta'); btn.innerHTML = '<i class="fas fa-sync"></i> ATUALIZAR'; btn.className = "w-full bg-green-500 text-white font-bold py-4 rounded-xl shadow-xl mt-4 active:scale-95 transition flex items-center justify-center gap-2";
}
async function enviarJustificativa() {
    const dt = document.getElementById('faltaData').value;
    const mt = document.getElementById('faltaMotivo').value;
    if(!dt || !mt) return alert("Preencha data e motivo.");
    showLoading(true, "ENVIANDO...");
    const payload = { vendedor: loggedUser, dataFalta: dt, motivo: mt, observacao: document.getElementById('faltaObs').value, _linha: editingAbsenceIndex };
    const route = editingAbsenceIndex ? 'updateAbsence' : 'registerAbsence';
    const file = document.getElementById('faltaArquivo').files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = async function(e) { payload.fileData = e.target.result; payload.fileName = file.name; payload.mimeType = file.type; await enviarPayloadFalta(route, payload); };
        reader.readAsDataURL(file);
    } else { await enviarPayloadFalta(route, payload); }
}
async function enviarPayloadFalta(r, p) { const res = await apiCall(r, p); showLoading(false); if (res.status === 'success') { alert(editingAbsenceIndex ? "Atualizado!" : "Enviado!"); ocultarHistoricoFaltas(); navegarPara('dashboard'); } else alert("Erro."); }

// ============================================================
// 8. UTILITÁRIOS & IA
// ============================================================

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
    const l = document.getElementById('loader'); if(l) l.style.display = show ? 'flex' : 'none'; 
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
async function marcarVendaFechada() { if(!confirm("Venda Fechada?")) return; showLoading(true); await apiCall('updateStatus', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: "Venda Fechada" }); showLoading(false); alert("Parabéns!"); fecharLeadModal(); carregarLeads(); }
async function salvarAgendamento() { const ag = `${document.getElementById('agendarData').value} ${document.getElementById('agendarHora').value}`; await apiCall('updateAgendamento', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: ag }); alert("Agendado!"); fecharLeadModal(); }
async function salvarObservacaoModal() { await apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: document.getElementById('modalLeadObs').value }); alert("Salvo!"); }
async function combaterObjecaoGeral() { const o=document.getElementById('inputObjecaoGeral').value; showLoading(true); const r=await apiCall('solveObjection',{objection:o}); showLoading(false); if(r.status==='success') { document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer; document.getElementById('resultadoObjecaoGeral').classList.remove('hidden'); } }
async function combaterObjecaoLead() { const o=document.getElementById('inputObjecaoLead').value; showLoading(true); const r=await apiCall('solveObjection',{objection:o}); showLoading(false); if(r.status==='success') document.getElementById('respostaObjecaoLead').value=r.answer; }
async function salvarObjecaoLead() { await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value}); alert("Salvo!"); }
async function analiseEstrategicaIA() { showLoading(true); const r=await perguntarIABackend(`Analise lead ${leadAtualParaAgendar.nomeLead}`); showLoading(false); if(r) { document.getElementById('modalLeadObs').value += "\n\n[IA]: " + r.replace(/\*\*/g,''); alert("Análise adicionada!"); } }
async function raioXConcorrencia() { const p = document.getElementById('leadProvedor').value; showLoading(true); const r = await perguntarIABackend(`Cliente usa ${p}. 3 pontos fracos deles e 3 argumentos nossos.`); showLoading(false); if(r) { const o = document.getElementById('leadObs'); o.value += "\n\n" + r; } }
async function refinarObsIA() { const o = document.getElementById('leadObs'); showLoading(true); const r = await perguntarIABackend(`Reescreva: "${o.value}"`); showLoading(false); if(r) o.value = r; }
async function gerarCoachIA() { showLoading(true); const r=await perguntarIABackend("Frase motivacional"); showLoading(false); if(r) alert(`🚀 ${r}`); }
async function perguntarIABackend(p) { try { const r=await apiCall('askAI',{question:p},false); return r.status==='success' ? r.answer : null; } catch(e){return null;} }
async function consultarPlanosIA() { document.getElementById('chatModal').classList.remove('hidden'); }
function toggleChat() { document.getElementById('chatModal').classList.add('hidden'); }
async function enviarMensagemChat() { const i=document.getElementById('chatInput'); const m=i.value; if(!m)return; document.getElementById('chatHistory').innerHTML+=`<div class="text-right p-2 mb-1 bg-blue-50 rounded">${m}</div>`; i.value=''; const r=await perguntarIABackend(m); document.getElementById('chatHistory').innerHTML+=`<div class="text-left p-2 bg-gray-100 mb-1 rounded">${r}</div>`; }
async function buscarEnderecoGPS() { navigator.geolocation.getCurrentPosition(p=>{fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json()).then(d=>{if(d.address){document.getElementById('leadEndereco').value=d.address.road;document.getElementById('leadBairro').value=d.address.suburb}})},()=>{alert('Erro GPS')}) }
function iniciarDitado(t) { const r=new(window.SpeechRecognition||window.webkitSpeechRecognition)(); r.lang='pt-BR'; r.start(); r.onresult=e=>{document.getElementById(t).value+=e.results[0][0].transcript} }
function copiarTexto(id){ document.getElementById(id).select(); document.execCommand('copy'); alert("Copiado!"); }
function enviarZapTexto(id){ window.open(`https://wa.me/?text=${encodeURIComponent(document.getElementById(id).value)}`,'_blank'); }
async function carregarMateriais(f=null){ const r=await apiCall('getImages',{folderId:f},false); if(r.status==='success') renderMateriais(r.data); }
function renderMateriais(i){ document.getElementById('materiaisGrid').innerHTML = i.map(x=>x.type==='folder'?`<div onclick="carregarMateriais('${x.id}')" class="bg-blue-50 p-4 text-center"><i class="fas fa-folder"></i> ${x.name}</div>`:`<div class="p-2 border"><a href="${x.downloadUrl}" target="_blank">${x.name}</a></div>`).join(''); }
function buscarMateriais(){ carregarMateriais(currentFolderId, document.getElementById('searchMateriais').value); }
