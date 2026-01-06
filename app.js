/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V136 (FINAL CONSOLIDATED)
 * ============================================================
 * 📝 RESUMO:
 * - Código expandido para facilitar leitura e manutenção.
 * - Login Offline: Função 'carregarVendedoresOffline' restaurada.
 * - Materiais: Filtros por botão funcionais.
 * - Admin: Verificação robusta de gestor.
 * - Sincronização: Backend V110 + HTML V134/V126.
 * ============================================================
 */

// ⚠️ ID DO BACKEND V110
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// --- ESTADO GLOBAL ---
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let vendorsCache = []; 
let tasksCache = [];
let materialsCache = [];
let leadAtualParaAgendar = null; 
let currentFolderId = null;
let editingLeadIndex = null;
let editingAbsenceIndex = null;
let syncQueue = JSON.parse(localStorage.getItem('mhnet_sync_queue') || '[]');
let chatHistoryData = [];

// Configuração Admin
const ADMIN_NAME_CHECK = "BRUNO GARCIA QUEIROZ";

function isAdminUser() {
    if (!loggedUser) return false;
    return loggedUser.trim().toUpperCase().includes("BRUNO GARCIA");
}

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V136 - Ready");
    
    // EXPORTAÇÃO GLOBAL
    exporFuncoesGlobais();
    
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

function exporFuncoesGlobais() {
    window.setLoggedUser = setLoggedUser;
    window.logout = logout;
    window.navegarPara = navegarPara;
    
    // Leads
    window.verTodosLeads = verTodosLeads;
    window.filtrarLeadsHoje = filtrarLeadsHoje;
    window.filtrarRetornos = filtrarRetornos;
    window.filtrarPorStatus = filtrarPorStatus;
    window.carregarLeads = carregarLeads;
    window.renderLeads = renderLeads;
    window.abrirLeadDetalhes = abrirLeadDetalhes;
    window.fecharLeadModal = fecharLeadModal;
    window.editarLeadAtual = editarLeadAtual;
    window.excluirLead = excluirLead;
    window.salvarEdicaoModal = salvarEdicaoModal;
    window.encaminharLeadModal = encaminharLeadModal;
    window.enviarLead = enviarLead;
    window.marcarVendaFechada = marcarVendaFechada;
    window.salvarAgendamento = salvarAgendamento;
    
    // Admin & Utils
    window.abrirConfiguracoes = abrirConfiguracoes;
    window.gerirEquipe = gerirEquipe;
    window.buscarEnderecoGPS = buscarEnderecoGPS;
    window.abrirIndicadores = abrirIndicadores;
    
    // Faltas
    window.verHistoricoFaltas = verHistoricoFaltas;
    window.enviarJustificativa = enviarJustificativa;
    window.ocultarHistoricoFaltas = ocultarHistoricoFaltas;
    
    // Materiais
    window.carregarMateriais = carregarMateriais;
    window.buscarMateriais = buscarMateriais;
    window.filtrarMateriaisBtn = filtrarMateriaisBtn;
    
    // IA
    window.gerarScriptVendaIA = gerarScriptVendaIA;
    window.analiseEstrategicaIA = analiseEstrategicaIA;
    window.combaterObjecaoLead = combaterObjecaoLead;
    window.combaterObjecaoGeral = combaterObjecaoGeral;
    window.salvarObjecaoLead = salvarObjecaoLead;
    window.raioXConcorrencia = raioXConcorrencia;
    window.gerarCoachIA = gerarCoachIA;
    window.consultarPlanosIA = consultarPlanosIA;
    window.toggleChat = toggleChat;
    window.enviarMensagemChat = enviarMensagemChat;
    
    // Tarefas
    window.abrirModalTarefa = abrirModalTarefa;
    window.salvarTarefa = salvarTarefa;
    window.toggleTask = toggleTask;
    window.limparTarefasConcluidas = limparTarefasConcluidas;
    
    // PWA
    window.fecharInstallPrompt = fecharInstallPrompt;
    window.instalarPWA = instalarPWA;
}

window.addEventListener('online', () => processarFilaSincronizacao());

// ============================================================
// 2. CORE & NAVEGAÇÃO
// ============================================================
function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    document.getElementById('userInfo').innerText = loggedUser;
    
    if (isAdminUser()) {
        const btn = document.getElementById('btnAdminSettings');
        if(btn) btn.classList.remove('hidden');
        const panel = document.getElementById('adminPanel');
        if(panel) panel.classList.remove('hidden');
    }
    
    atualizarDataCabecalho();
    carregarLeads(false); 
    carregarTarefas(false); 
    navegarPara('dashboard');
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

    // Hooks
    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') renderTarefas(); 
    if (pageId === 'indicadores') abrirIndicadores();
    
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        // Se não tiver filtro ativo, limpa e mostra tudo
        if(busca && !busca.placeholder.includes("Filtrado") && !busca.placeholder.includes("Retornos")) {
             verTodosLeads();
        }
    }
    
    if (pageId === 'cadastroLead') {
        if (editingLeadIndex === null) {
            document.querySelectorAll('#cadastroLead input, #cadastroLead textarea').forEach(el => el.value = '');
            const selStatus = document.getElementById('leadStatus'); if(selStatus) selStatus.value = 'Novo';
            if(isAdminUser()) document.getElementById('divEncaminhar')?.classList.remove('hidden');
        }
    }
    if (pageId === 'materiais' && !currentFolderId) setTimeout(() => carregarMateriais(null), 100);
    if (pageId === 'faltas') ocultarHistoricoFaltas();
}

// ============================================================
// 3. LEADS & CARTEIRA
// ============================================================

function verTodosLeads() {
    // 1. Muda tela visualmente
    document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
    document.getElementById('gestaoLeads').style.display = 'block';
    
    // 2. Limpa filtros e renderiza
    const input = document.getElementById('searchLead');
    if(input) { 
        input.value = ""; 
        input.placeholder = "Buscar nome, bairro, telefone..."; 
    }
    
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btnFilterTodos')?.classList.add('active');
    
    renderLeads();
}

function filtrarLeadsHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const leadsHoje = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje));
    
    if (leadsHoje.length === 0) { 
        alert("📅 Nenhum lead cadastrado hoje!\nVamos pra cima! 🚀");
        return; 
    }
    
    navegarPara('gestaoLeads');
    const input = document.getElementById('searchLead');
    if(input) {
        input.value = "";
        input.placeholder = `📅 Hoje (${leadsHoje.length})`;
    }
    
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    renderListaLeads(leadsHoje);
}

function filtrarRetornos() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    
    if (retornos.length === 0) { 
        alert("Nenhum retorno hoje."); 
        return; 
    }
    
    navegarPara('gestaoLeads');
    const input = document.getElementById('searchLead');
    if(input) {
        input.value = "";
        input.placeholder = `🔔 Retornos (${retornos.length})`;
    }
    renderListaLeads(retornos);
}

function filtrarPorStatus(status) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    
    const idMap = {
        'Todos': 'btnFilterTodos', 'Novo': 'btnFilterNovo', 'Em Negociação': 'btnFilterNegociação',
        'Agendado': 'btnFilterAgendado', 'Venda Fechada': 'btnFilterVendaFechada', 'Perda': 'btnFilterPerda'
    };
    
    const btn = document.getElementById(idMap[status]) || event.target;
    if(btn) btn.classList.add('active');
    
    const input = document.getElementById('searchLead');
    if(input) input.value = "";

    let listaFiltrada = leadsCache;
    if (status !== 'Todos') {
        listaFiltrada = leadsCache.filter(l => l.status === status || l.interesse === status);
    }
    renderListaLeads(listaFiltrada);
}

async function carregarLeads(showLoader = true) {
    if(!navigator.onLine) { 
        if(document.getElementById('listaLeadsGestao')) renderLeads(); 
        return; 
    }

    const userToSend = isAdminUser() ? ADMIN_NAME_CHECK : loggedUser;
    const res = await apiCall('getLeads', { vendedor: userToSend }, showLoader);
    
    if (res && res.status === 'success') {
        leadsCache = res.data || [];
        leadsCache.sort((a, b) => b._linha - a._linha);
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        
        if (isAdminUser()) {
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
    const elBusca = document.getElementById('searchLead');
    const term = elBusca ? String(elBusca.value).toLowerCase() : '';
    
    const lista = leadsCache.filter(l => 
        String(l.nomeLead || '').toLowerCase().includes(term) || 
        String(l.bairro || '').toLowerCase().includes(term) || 
        String(l.telefone || '').includes(term) ||
        String(l.cidade || '').toLowerCase().includes(term)
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
    else if (l.status === 'Agendado') badgeColor = "bg-orange-100 text-orange-600 font-bold";
    else if (l.status === 'Novo') badgeColor = "bg-indigo-50 text-indigo-600 font-bold";
    
    const nome = String(l.nomeLead || 'Sem Nome');
    const bairro = String(l.bairro || '-');
    const prov = String(l.provedor || '');

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition">
        <div class="flex justify-between items-start">
            <div>
                <div class="font-bold text-slate-800 text-lg leading-tight">${nome}</div>
                <div class="text-xs text-slate-500 mt-1">${bairro}</div>
            </div>
            <div class="flex flex-col items-end gap-1">
                <span class="text-[10px] px-2 py-1 rounded-full ${badgeColor}">${l.status || 'Novo'}</span>
                ${prov ? `<span class="text-[9px] text-blue-500 font-bold">${prov}</span>` : ''}
            </div>
        </div>
    </div>`;
}

// ============================================================
// 4. DETALHES LEAD (MODAL SEGURO)
// ============================================================
function abrirLeadDetalhes(index) {
    const l = leadsCache[index];
    if(!l) return console.error("Lead inválido:", index);
    
    leadAtualParaAgendar = l;
    
    const setText = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = String(txt || ''); };
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = String(val || ''); };

    setText('modalLeadNome', l.nomeLead);
    setText('modalLeadBairro', l.bairro);
    setText('modalLeadCidade', l.cidade);
    setText('modalLeadTelefone', l.telefone);
    setText('modalLeadProvedor', l.provedor || "--");
    
    setVal('modalStatusFunil', l.status || "Novo");
    setVal('modalLeadObs', l.observacao);
    setVal('inputObjecaoLead', l.objecao);
    setVal('respostaObjecaoLead', l.respostaObjecao);

    const dtInput = document.getElementById('agendarData');
    const hrInput = document.getElementById('agendarHora');
    if(dtInput) {
        if(l.agendamento) {
            const p = String(l.agendamento).split(' ');
            if(p[0]) { const [d,m,a] = p[0].split('/'); dtInput.value = `${a}-${m}-${d}`; }
            if(p[1] && hrInput) hrInput.value = p[1];
        } else {
            dtInput.value = '';
        }
    }

    const btnWhats = document.getElementById('btnModalWhats');
    if(btnWhats) btnWhats.onclick = () => window.open(`https://wa.me/55${String(l.telefone).replace(/\D/g,'')}`, '_blank');
    const btnTag = document.getElementById('btnModalWhatsTag');
    if(btnTag) btnTag.onclick = () => window.open(`https://wa.me/55${String(l.telefone).replace(/\D/g,'')}`, '_blank');
    
    const containerRaioX = document.getElementById('containerRaioX');
    if(containerRaioX) containerRaioX.innerHTML = `<button onclick="raioXConcorrencia()" class="ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] shadow">Raio-X</button>`;

    if (isAdminUser()) {
        const area = document.getElementById('adminEncaminharArea');
        if(area) {
            area.classList.remove('hidden');
            const sel = document.getElementById('modalLeadDestino');
            if(sel && sel.options.length <= 1 && vendorsCache.length > 0) {
                 sel.innerHTML = '<option value="">Selecione vendedor...</option>' + vendorsCache.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
            }
        }
    } else {
        document.getElementById('adminEncaminharArea')?.classList.add('hidden');
    }

    renderTarefasNoModal(l.nomeLead);
    document.getElementById('leadModal')?.classList.remove('hidden');
}

function fecharLeadModal() { document.getElementById('leadModal')?.classList.add('hidden'); leadAtualParaAgendar = null; editingLeadIndex = null; }

async function salvarEdicaoModal() {
    if (!leadAtualParaAgendar) return;
    
    const s = document.getElementById('modalStatusFunil')?.value || "Novo";
    const o = document.getElementById('modalLeadObs')?.value || "";
    const d = document.getElementById('agendarData')?.value;
    
    leadAtualParaAgendar.status = s;
    leadAtualParaAgendar.observacao = o;
    if (d) {
        const [a, m, day] = d.split('-');
        leadAtualParaAgendar.agendamento = `${day}/${m}/${a} ${document.getElementById('agendarHora')?.value || '09:00'}`;
    }
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    if(document.getElementById('gestaoLeads').style.display !== 'none') renderLeads();
    
    showLoading(true, "ATUALIZANDO...");
    await Promise.all([
        apiCall('updateStatus', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: s }, false),
        apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: o }, false)
    ]);
    if (d) await apiCall('updateAgendamento', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: leadAtualParaAgendar.agendamento }, false);
    
    showLoading(false);
    fecharLeadModal();
}

// ============================================================
// 5. TAREFAS
// ============================================================

async function carregarTarefas(show = true) {
    if(!navigator.onLine && tasksCache.length > 0) { if(show) renderTarefas(); return; }
    const res = await apiCall('getTasks', { vendedor: loggedUser }, false);
    if (res && res.status === 'success') {
        tasksCache = res.data;
        if(show) renderTarefas();
    }
}

function renderTarefas() {
    const div = document.getElementById('listaTarefasContainer');
    if (!div) return;
    
    if (tasksCache.length === 0) {
        div.innerHTML = `<div class="text-center p-8 text-gray-400">Nenhuma tarefa pendente.</div>`;
        return;
    }
    
    tasksCache.sort((a, b) => (a.status === 'PENDENTE' ? -1 : 1));

    div.innerHTML = tasksCache.map(t => {
        const checked = t.status === "CONCLUIDA" ? "checked" : "";
        const opacity = t.status === "CONCLUIDA" ? "opacity-50 line-through" : "";
        return `
        <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 mb-2 ${opacity}">
            <input type="checkbox" ${checked} onchange="toggleTask('${t.id}', '${t.status}')" class="w-5 h-5 rounded cursor-pointer">
            <div class="flex-1">
                <div class="text-sm font-bold text-slate-700">${t.descricao}</div>
                <div class="text-[10px] text-slate-400 mt-1">${t.dataLimite || ''} ${t.nomeLead ? '• '+t.nomeLead : ''}</div>
            </div>
        </div>`;
    }).join('');
}

function renderTarefasNoModal(nomeLead) {
    const container = document.getElementById('sectionTarefasLead');
    const lista = document.getElementById('listaTarefasLead');
    if(!container || !lista) return;

    const tarefas = tasksCache.filter(t => t.nomeLead === nomeLead && t.status !== 'CONCLUIDA');
    
    if (tarefas.length > 0) {
        container.classList.remove('hidden');
        lista.innerHTML = tarefas.map(t => `
            <div class="bg-white p-2 rounded border border-slate-200 flex items-center gap-2">
                <input type="checkbox" onchange="toggleTask('${t.id}', '${t.status}')" class="w-4 h-4">
                <span class="text-xs text-slate-700">${t.descricao}</span>
            </div>
        `).join('');
    } else {
        container.classList.add('hidden');
    }
}

async function toggleTask(id, currentStatus) {
    const t = tasksCache.find(x => x.id === id);
    if(t) { t.status = currentStatus === 'PENDENTE' ? 'CONCLUIDA' : 'PENDENTE'; renderTarefas(); if(leadAtualParaAgendar) renderTarefasNoModal(leadAtualParaAgendar.nomeLead); }
    await apiCall('toggleTask', { taskId: id, status: currentStatus, vendedor: loggedUser }, false);
    carregarTarefas(false);
}

function abrirModalTarefa() {
    document.getElementById('taskModal').classList.remove('hidden');
    const sel = document.getElementById('taskLeadSelect');
    if(sel) {
        sel.innerHTML = '<option value="">Nenhum (Avulso)</option>';
        leadsCache.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.nomeLead; opt.innerText = l.nomeLead; sel.appendChild(opt);
        });
    }
}

async function salvarTarefa() {
    const desc = document.getElementById('taskDesc').value;
    const date = document.getElementById('taskDate').value;
    const leadVal = document.getElementById('taskLeadSelect').value;
    if(!desc) return alert("Digite a descrição.");
    
    showLoading(true);
    await apiCall('addTask', { vendedor: loggedUser, descricao: desc, dataLimite: date, nomeLead: leadVal });
    showLoading(false);
    document.getElementById('taskModal').classList.add('hidden');
    document.getElementById('taskDesc').value = '';
    carregarTarefas();
}

async function limparTarefasConcluidas() {
    if(!confirm("Limpar concluídas?")) return;
    tasksCache = tasksCache.filter(t => t.status !== 'CONCLUIDA');
    renderTarefas();
    await apiCall('archiveTasks', { vendedor: loggedUser });
    showLoading(false);
    carregarTarefas();
}

// ============================================================
// 6. MATERIAIS, FALTAS E IA
// ============================================================
async function carregarMateriais(f=null, s="") {
    const div = document.getElementById('materiaisGrid');
    if (!div) return;
    currentFolderId = f; 
    div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10">Carregando...</div>';
    
    try {
        const res = await apiCall('getImages', { folderId: f, search: s }, false);
        if (res && res.status === 'success' && res.data) {
            materialsCache = res.data;
            const btnVoltar = document.querySelector('#materiais button'); 
            const titleEl = document.querySelector('#materiais h2');
            if(btnVoltar) {
                if(res.isRoot) { btnVoltar.onclick = () => navegarPara('dashboard'); if(titleEl) titleEl.innerText = "Materiais"; } 
                else { btnVoltar.onclick = () => carregarMateriais(null); if(titleEl) titleEl.innerText = "Voltar"; }
            }
            renderMateriais(materialsCache);
        } else { throw new Error("Erro API"); }
    } catch (error) {
        div.innerHTML = `<div class="col-span-2 text-center text-red-400">Erro ao carregar.</div>`;
    }
}

function filtrarMateriaisBtn(termo) {
    const input = document.getElementById('searchMateriais');
    if(input) {
        input.value = (termo === 'Todos') ? '' : termo;
        buscarMateriais();
        document.querySelectorAll('#materiais .filter-btn').forEach(b => b.classList.remove('active', 'bg-[#00aeef]', 'text-white'));
        document.querySelectorAll('#materiais .filter-btn').forEach(b => b.classList.add('bg-white', 'text-slate-500'));
        event.target.classList.add('active', 'bg-[#00aeef]', 'text-white');
        event.target.classList.remove('bg-white', 'text-slate-500');
    }
}

function buscarMateriais() {
    const term = document.getElementById('searchMateriais').value.toLowerCase();
    const filtrados = materialsCache.filter(m => m.name.toLowerCase().includes(term));
    renderMateriais(filtrados);
}

function renderMateriais(items) {
    const div = document.getElementById('materiaisGrid');
    if(items.length === 0) { div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10">Vazio.</div>'; return; }
    
    div.innerHTML = items.map(item => {
        if (item.type === 'folder') {
            return `<div onclick="carregarMateriais('${item.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex flex-col items-center justify-center gap-2 cursor-pointer h-36"><i class="fas fa-folder text-5xl text-[#00aeef]"></i><span class="text-xs font-bold text-slate-600 text-center line-clamp-2">${item.name}</span></div>`;
        } else {
            return `
            <div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-auto relative">
                <div class="h-32 w-full bg-gray-50 rounded-xl overflow-hidden mb-2"><img src="${item.thumbnail}" class="w-full h-full object-cover"></div>
                <div class="text-[10px] text-gray-500 font-bold truncate px-1 mb-2">${item.name}</div>
                <div class="flex gap-2">
                    <a href="${item.downloadUrl}" target="_blank" class="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg flex items-center justify-center"><i class="fas fa-download"></i></a>
                    <button onclick="window.open('https://wa.me/?text=${encodeURIComponent(item.viewUrl)}', '_blank')" class="flex-1 bg-green-50 text-green-600 py-2 rounded-lg flex items-center justify-center"><i class="fab fa-whatsapp"></i></button>
                </div>
            </div>`;
        }
    }).join('');
}

// IA & CHAT
function consultarPlanosIA() {
    document.getElementById('chatModal').classList.remove('hidden');
    const history = document.getElementById('chatHistory');
    if(history && history.innerHTML.trim() === '') {
        history.innerHTML = `<div class="text-center p-2 text-xs text-gray-400">Olá! Sou a IA da MHNET. Pergunte-me sobre planos, técnicas de venda ou dúvidas.</div>`;
    }
}
function toggleChat() { document.getElementById('chatModal').classList.add('hidden'); }

async function enviarMensagemChat() {
    const input = document.getElementById('chatInput');
    const m = input.value.trim();
    if(m){
        document.getElementById('chatHistory').innerHTML+=`<div class='text-right p-2 mb-1 bg-blue-50 rounded'>${m}</div>`;
        input.value = '';
        const r = await perguntarIABackend(m);
        document.getElementById('chatHistory').innerHTML+=`<div class='text-left p-2 bg-gray-100 rounded mb-1'>${r}</div>`;
    }
}

// 7. UTILS E ADMIN
async function apiCall(route, payload, show=true) {
    if(show) showLoading(true);
    if (!navigator.onLine && isWriteOperation(route)) {
        adicionarAFila(route, payload);
        if(show) showLoading(false);
        if (route === 'toggleTask') return { status: 'success', local: true };
        return { status: 'success', local: true, message: 'Offline Salvo' };
    }
    try {
        const res = await fetch(API_URL, { method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({ route: route, payload: payload }) });
        const json = await res.json();
        if(show) showLoading(false);
        return json;
    } catch(e) {
        if(show) showLoading(false);
        if (isWriteOperation(route)) { adicionarAFila(route, payload); return { status: 'success', local: true }; }
        return { status: 'error', message: 'Conexão' };
    }
}
function isWriteOperation(route) { return ['addLead', 'deleteLead', 'updateStatus', 'updateAgendamento', 'updateObservacao', 'addTask', 'toggleTask', 'archiveTasks', 'registerAbsence', 'updateAbsence', 'saveObjectionLead', 'updateLeadFull', 'forwardLead', 'manageTeam'].includes(route); }
function adicionarAFila(r, p) { syncQueue.push({route:r, payload:p}); localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue)); alert("Salvo Offline!"); }
async function processarFilaSincronizacao() { if(syncQueue.length===0) return; showLoading(true); const f=[]; for(const i of syncQueue) { try { await fetch(API_URL, {method:'POST', body:JSON.stringify({route:i.route, payload:i.payload})}); } catch(e){f.push(i)} } syncQueue=f; localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue)); showLoading(false); if (syncQueue.length === 0 && document.getElementById('gestaoLeads').style.display !== 'none') carregarLeads(false); }
async function carregarVendedores() { const s=document.getElementById('userSelect'); if(!s)return; try{const r=await apiCall('getVendors',{},false);if(r.status==='success'){const o=r.data.map(v=>`<option value="${v.nome}">${v.nome}</option>`).join('');s.innerHTML='<option value="">Selecione...</option>'+o; document.getElementById('modalLeadDestino').innerHTML='<option value="">Selecione...</option>'+o;}}catch(e){carregarVendedoresOffline();} }
function carregarVendedoresOffline() { const o = ["Bruno Garcia Queiroz", "Ana Paula Rodrigues", "Vendedor Teste"].map(v=>`<option value="${v}">${v}</option>`).join(''); document.getElementById('userSelect').innerHTML = '<option value="">Modo Offline</option>'+o; }
function showLoading(s,t){const l=document.getElementById('loader');if(l)l.style.display=s?'flex':'none';if(t)document.getElementById('loaderText').innerText=t}
function setLoggedUser(){const v=document.getElementById('userSelect').value;if(v&&v!=="A carregar..."){loggedUser=v;localStorage.setItem('loggedUser',v);initApp()}else alert("Selecione!")}
function logout(){localStorage.removeItem('loggedUser');location.reload()}
function atualizarDataCabecalho(){document.getElementById('headerDate').innerText=new Date().toLocaleDateString('pt-BR')}
function atualizarDashboard(){const h=new Date().toLocaleDateString('pt-BR');document.getElementById('statLeads').innerText=leadsCache.filter(l=>l.timestamp&&l.timestamp.includes(h)).length}
function verificarAgendamentosHoje(){const h=new Date().toLocaleDateString('pt-BR');const r=leadsCache.filter(l=>l.agendamento&&l.agendamento.includes(h));if(r.length>0)document.getElementById('lembreteBanner').classList.remove('hidden');else document.getElementById('lembreteBanner').classList.add('hidden')}
function editarLeadAtual(){if(!leadAtualParaAgendar)return;const l=leadAtualParaAgendar;document.getElementById('leadNome').value=l.nomeLead;document.getElementById('leadTelefone').value=l.telefone;document.getElementById('leadEndereco').value=l.endereco;document.getElementById('leadBairro').value=l.bairro;document.getElementById('leadCidade').value=l.cidade;document.getElementById('leadProvedor').value=l.provedor;document.getElementById('leadObs').value=l.observacao;const s=document.getElementById('leadStatus');if(s)s.value=l.status||"Novo";if(isAdminUser())document.getElementById('divEncaminhar').classList.remove('hidden');editingLeadIndex=leadsCache.indexOf(l);fecharLeadModal();navegarPara('cadastroLead')}
async function enviarLead() { const p={vendedor:loggedUser, nomeLead:document.getElementById('leadNome').value, telefone:document.getElementById('leadTelefone').value, endereco:document.getElementById('leadEndereco').value, bairro:document.getElementById('leadBairro').value, cidade:document.getElementById('leadCidade').value, provedor:document.getElementById('leadProvedor').value, interesse:document.getElementById('leadInteresse').value, status:document.getElementById('leadStatus').value, observacao:document.getElementById('leadObs').value, novoVendedor:document.getElementById('leadVendedorDestino')?.value||""}; let r='addLead'; if(editingLeadIndex!==null){ r='updateLeadFull'; p._linha=leadsCache[editingLeadIndex]._linha; p.nomeLeadOriginal=leadsCache[editingLeadIndex].nomeLead; } else if(p.novoVendedor){ r='forwardLead'; p.origem=loggedUser; } const res=await apiCall(r,p); if(res.status==='success'||res.local){alert(editingLeadIndex!==null?"Atualizado!":"Salvo!");if(editingLeadIndex===null&&!res.local&&!p.novoVendedor){p.timestamp=new Date().toLocaleDateString('pt-BR');leadsCache.unshift(p)}localStorage.setItem('mhnet_leads_cache',JSON.stringify(leadsCache));editingLeadIndex=null;navegarPara('gestaoLeads')}else alert("Erro.") }
function abrirConfiguracoes(){document.getElementById('configModal').classList.remove('hidden')}
async function gerirEquipe(a){await apiCall('manageTeam',{acao:a,nome:document.getElementById('cfgNomeVendedor').value,meta:document.getElementById('cfgMeta').value});alert("Feito!");carregarVendedores()}
async function encaminharLeadModal(){const n=document.getElementById('modalLeadDestino').value;if(!n)return alert("Selecione");if(confirm("Encaminhar?")){await apiCall('forwardLead',{nomeLead:leadAtualParaAgendar.nomeLead,telefone:leadAtualParaAgendar.telefone,novoVendedor:n,origem:loggedUser});alert("Encaminhado!");fecharLeadModal();carregarLeads()}}
async function buscarEnderecoGPS(){navigator.geolocation.getCurrentPosition(p=>{fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json()).then(d=>{if(d.address){document.getElementById('leadEndereco').value=d.address.road;document.getElementById('leadBairro').value=d.address.suburb;document.getElementById('leadCidade').value=d.address.city||d.address.town}})},()=>{alert('Erro GPS')})}
function iniciarDitado(t){}
function copying(id){document.getElementById(id).select();document.execCommand('copy');alert("Copiado!")}
async function gerarScriptVendaIA(){if(!leadAtualParaAgendar)return;showLoading(true);const r=await perguntarIABackend(`Script WhatsApp para ${leadAtualParaAgendar.nomeLead}`);showLoading(false);if(r)alert("Copiado: "+r)}
async function perguntarIABackend(p){ try { const r=await apiCall('askAI',{question:p},false); return r.status==='success' ? r.answer : null; } catch(e){return null;} }
async function abrirIndicadores(){navegarPara('indicadores');['funnelLeads','funnelNegociacao','funnelVendas'].forEach(id=>document.getElementById(id).innerText='...');const r=await apiCall('getIndicators',{vendedor:loggedUser},false);if(r.status==='success'){const d=r.data;document.getElementById('funnelLeads').innerText=d.totalLeads;document.getElementById('funnelNegociacao').innerText=d.negociacao;document.getElementById('funnelVendas').innerText=d.vendas;}}
async function excluirLead(){if(!confirm("Excluir?"))return;await apiCall('deleteLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead});alert("Excluído.");fecharLeadModal();carregarLeads()}
async function marcarVendaFechada(){if(!confirm("Venda Fechada?"))return;await apiCall('updateStatus',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,status:"Venda Fechada"});alert("Parabéns!");fecharLeadModal();carregarLeads()}
async function salvarAgendamento(){const a=`${document.getElementById('agendarData').value} ${document.getElementById('agendarHora').value}`;await apiCall('updateAgendamento',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,agendamento:a});alert("Agendado!");fecharLeadModal()}
async function salvarObservacaoModal(){await apiCall('updateObservacao',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,observacao:document.getElementById('modalLeadObs').value});alert("Salvo!")}
async function combaterObjecaoGeral(){const o=document.getElementById('inputObjecaoGeral').value;const r=await apiCall('solveObjection',{objection:o});if(r.status==='success')document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer}
async function combaterObjecaoLead(){const o=document.getElementById('inputObjecaoLead').value;const r=await apiCall('solveObjection',{objection:o});if(r.status==='success')document.getElementById('respostaObjecaoLead').value=r.answer}
async function salvarObjecaoLead(){await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value});alert("Salvo!")}
async function analiseEstrategicaIA(){const r=await perguntarIABackend(`Analise lead ${leadAtualParaAgendar.nomeLead}`);if(r)document.getElementById('modalLeadObs').value+="\n\n[IA]: "+r}
async function raioXConcorrencia(){const p=document.getElementById('modalLeadProvedor').innerText;const r=await perguntarIABackend(`Raio-X ${p}`);if(r)document.getElementById('modalLeadObs').value += "\n\n[RX]: " + r}
async function gerarCoachIA(){const r=await perguntarIABackend("Frase motivacional");if(r)alert(r)}
function ajustarMicrofone(){const btn=document.getElementById('btnMicNome');if(btn){btn.removeAttribute('onclick');btn.onclick=()=>iniciarDitado('leadObs');}}
async function verHistoricoFaltas(){const d=document.getElementById('listaHistoricoFaltas');document.getElementById('historicoFaltasContainer').classList.remove('hidden');document.getElementById('formFaltaContainer').classList.add('hidden');const r=await apiCall('getAbsences',{vendedor:loggedUser},false);if(r.status==='success')d.innerHTML=r.data.map(f=>`<div class="bg-white p-3 rounded-xl border mb-2"><div class="font-bold text-xs">${f.motivo}</div><div class="text-[10px]">${f.dataFalta} • ${f.status}</div></div>`).join('');else d.innerHTML='Sem histórico.'}
function ocultarHistoricoFaltas(){document.getElementById('historicoFaltasContainer').classList.add('hidden');document.getElementById('formFaltaContainer').classList.remove('hidden')}
