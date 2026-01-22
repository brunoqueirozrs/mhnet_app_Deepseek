/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V175 (FINAL REFINADO)
 * ============================================================
 * 📝 NOVIDADES & CORREÇÕES:
 * 1. FUNIL: Busca dados reais da aba "Mês Atual" (Vendas) e contagem de Leads.
 * 2. TAREFAS: Visual estilo Todoist, botão de excluir e link para Google Calendar.
 * 3. MATERIAIS: Filtros dinâmicos corrigidos.
 * 4. FALTAS: Envio completo com anexo.
 * 5. IA: Chat Híbrido (Manual + Generativa).
 * ============================================================
 */

// ⚠️ ID DO BACKEND
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const CALENDAR_URL = "https://calendar.google.com/calendar/u/0?cid=ZTZlNjQ2OWVkNzQ1YzMzYmIwMjg2YmFmYmM4NzA2ZmU4YzM3MWVhMDU1MWRiNDY2NDJkNTc2NTI5MmFhMDZmN0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t";

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

// Configuração Admin
const ADMIN_NAME_CHECK = "BRUNO GARCIA QUEIROZ";
const VENDEDORES_OFFLINE = [
    "Bruno Garcia Queiroz", 
    "Ana Paula Rodrigues", 
    "Vitoria Caroline Baldez Rosales",
    "João Vithor Sader",
    "João Paulo da Silva Santos",
    "Claudia Maria Semmler",
    "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves",
    "Vendedor Teste"
];

function isAdminUser() {
    if (!loggedUser) return false;
    return loggedUser.trim().toUpperCase().includes("BRUNO GARCIA");
}

// ============================================================
// 1. INICIALIZAÇÃO E EXPORTAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V175 - Inicializando...");
    
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
    // Auth & Nav
    window.setLoggedUser = setLoggedUser;
    window.logout = logout;
    window.navegarPara = navegarPara;
    
    // Leads View
    window.verTodosLeads = verTodosLeads;
    window.filtrarLeadsHoje = filtrarLeadsHoje;
    window.filtrarRetornos = filtrarRetornos;
    window.filtrarPorStatus = filtrarPorStatus;
    window.carregarLeads = carregarLeads;
    window.renderLeads = renderLeads;
    
    // Lead Actions
    window.abrirLeadDetalhes = abrirLeadDetalhes;
    window.fecharLeadModal = fecharLeadModal;
    window.editarLeadAtual = editarLeadAtual;
    window.excluirLead = excluirLead;
    window.salvarEdicaoModal = salvarEdicaoModal;
    window.encaminharLeadModal = encaminharLeadModal;
    window.enviarLead = enviarLead;
    window.marcarVendaFechada = marcarVendaFechada;
    window.salvarAgendamento = salvarAgendamento;
    window.abrirWhatsApp = abrirWhatsApp;
    
    // Ferramentas
    window.buscarEnderecoGPS = buscarEnderecoGPS;
    window.abrirIndicadores = abrirIndicadores;
    window.verHistoricoFaltas = verHistoricoFaltas;
    window.enviarJustificativa = enviarJustificativa;
    window.ocultarHistoricoFaltas = ocultarHistoricoFaltas;
    
    // Materiais
    window.carregarMateriais = carregarMateriais;
    window.buscarMateriais = buscarMateriais;
    window.filtrarMateriaisBtn = filtrarMateriaisBtn;
    
    // IA & Chat
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
    
    // Tarefas & Admin
    window.abrirModalTarefa = abrirModalTarefa;
    window.salvarTarefa = salvarTarefa;
    window.toggleTask = toggleTask;
    window.excluirTarefa = excluirTarefa;
    window.limparTarefasConcluidas = limparTarefasConcluidas;
    window.abrirConfiguracoes = abrirConfiguracoes;
    window.gerirEquipe = gerirEquipe;
    window.abrirCalendario = abrirCalendario;
    
    // Admin Transferencia
    window.abrirTransferenciaEmLote = abrirTransferenciaEmLote;
    window.executarTransferenciaLote = executarTransferenciaLote;
    
    // PWA
    window.fecharInstallPrompt = fecharInstallPrompt;
    window.instalarPWA = instalarPWA;
}

window.addEventListener('online', () => processarFilaSincronizacao());

// ============================================================
// 2. CORE & LOGIN
// ============================================================
function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    document.getElementById('userInfo').innerText = loggedUser;
    
    if (isAdminUser()) {
        const btnAdmin = document.getElementById('btnAdminSettings');
        if(btnAdmin) btnAdmin.classList.remove('hidden');
        const panel = document.getElementById('adminPanel');
        if(panel) panel.classList.remove('hidden');
    }
    
    atualizarDataCabecalho();
    carregarLeads(false); 
    carregarTarefas(false); 
    navegarPara('dashboard');
}

function setLoggedUser() {
    const select = document.getElementById('userSelect');
    const valor = select.value;
    if (valor && valor !== "") { 
        loggedUser = valor; 
        localStorage.setItem('loggedUser', valor); 
        initApp(); 
    } else {
        alert('⚠️ Selecione um vendedor!');
    }
}

function logout() {
    if(confirm("Sair do sistema?")){
        localStorage.removeItem('loggedUser');
        location.reload();
    }
}

async function carregarVendedores() {
    const select = document.getElementById('userSelect');
    if(!select) return;

    // Fallback inicial
    const opsOffline = VENDEDORES_OFFLINE.map(v => `<option value="${v}">${v}</option>`).join('');
    select.innerHTML = '<option value="">Selecione...</option>' + opsOffline;

    try {
        const res = await apiCall('getVendors', {}, false);
        if (res.status === 'success' && res.data.length > 0) {
            vendorsCache = res.data;
            const ops = res.data.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
            select.innerHTML = '<option value="">Selecione...</option>' + ops;
            
            // Atualiza selects auxiliares
            const dest1 = document.getElementById('modalLeadDestino');
            const dest2 = document.getElementById('leadVendedorDestino');
            const dest3 = document.getElementById('transfOrigem'); // Modal Transferencia
            const dest4 = document.getElementById('transfDestino'); // Modal Transferencia
            
            if(dest1) dest1.innerHTML = '<option value="">Selecione...</option>' + ops;
            if(dest2) dest2.innerHTML = '<option value="">Selecione...</option>' + ops;
            if(dest3) dest3.innerHTML = '<option value="">Selecione...</option>' + ops;
            if(dest4) dest4.innerHTML = '<option value="">Selecione...</option>' + ops;
        }
    } catch(e) { console.warn("Usando lista offline"); }
}

function atualizarDataCabecalho() {
    const el = document.getElementById('headerDate');
    if (el) el.innerText = new Date().toLocaleDateString('pt-BR');
    
    const dayEl = document.getElementById('headerDateDay');
    if(dayEl) dayEl.innerText = new Date().getDate();
    
    const monthEl = document.getElementById('headerDateMonth');
    if(monthEl) {
        const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
        monthEl.innerText = meses[new Date().getMonth()];
    }
}

// ============================================================
// 3. NAVEGAÇÃO
// ============================================================
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
        // Se a busca não tiver filtro ativo, reseta
        if(busca && !busca.placeholder.includes("Filtrado") && !busca.placeholder.includes("Retornos")) {
             verTodosLeads();
        }
    }
    
    if (pageId === 'cadastroLead') {
        if (editingLeadIndex === null) {
            document.querySelectorAll('#cadastroLead input, #cadastroLead textarea').forEach(el => el.value = '');
            const st = document.getElementById('leadStatus'); if(st) st.value = 'Novo';
            if(isAdminUser()) document.getElementById('divEncaminhar')?.classList.remove('hidden');
        }
    }
    
    if (pageId === 'materiais' && !currentFolderId) setTimeout(() => carregarMateriais(null), 100);
    if (pageId === 'faltas') ocultarHistoricoFaltas();
}

// ============================================================
// 4. LEADS & CARTEIRA
// ============================================================
function verTodosLeads() {
    document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
    document.getElementById('gestaoLeads').style.display = 'block';
    
    const input = document.getElementById('searchLead');
    if(input) { input.value = ""; input.placeholder = "Buscar..."; }
    
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
    
    document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
    document.getElementById('gestaoLeads').style.display = 'block';
    
    const input = document.getElementById('searchLead');
    if(input) input.placeholder = `📅 Hoje (${leadsHoje.length})`;
    
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
    
    document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
    document.getElementById('gestaoLeads').style.display = 'block';

    const input = document.getElementById('searchLead');
    if(input) input.placeholder = `🔔 Retornos (${retornos.length})`;
    
    renderListaLeads(retornos);
}

function filtrarPorStatus(status) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
    
    const input = document.getElementById('searchLead');
    if(input) input.value = "";
    
    let lista = leadsCache;
    if (status !== 'Todos') lista = leadsCache.filter(l => l.status === status);
    renderListaLeads(lista);
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
        
        if (isAdminUser()) document.getElementById('adminPanel')?.classList.remove('hidden');
        if (document.getElementById('listaLeadsGestao') && document.getElementById('gestaoLeads').style.display !== 'none') renderLeads();
        
        atualizarDashboard();
        verificarAgendamentosHoje();
    }
}

function renderLeads(lista = null) {
    const el = document.getElementById('searchLead');
    const term = el ? el.value.toLowerCase() : '';
    const listaFinal = lista || leadsCache.filter(l => 
        String(l.nomeLead||'').toLowerCase().includes(term) || 
        String(l.bairro||'').toLowerCase().includes(term)
    );
    renderListaLeadsHTML(listaFinal);
}

function renderListaLeadsHTML(lista) {
    const div = document.getElementById('listaLeadsGestao');
    if (!div) return;
    if (lista.length === 0) { div.innerHTML = '<div class="text-center p-10 text-gray-400">Vazio.</div>'; return; }
    
    div.innerHTML = lista.map((l) => {
        const idx = leadsCache.indexOf(l);
        let cor = "bg-slate-100 text-slate-600";
        if(l.status==='Venda Fechada') cor="bg-green-100 text-green-700 font-bold";
        if(l.status==='Agendado') cor="bg-orange-100 text-orange-700 font-bold";
        if(l.status==='Novo') cor="bg-blue-50 text-blue-700 font-bold";
        
        return `
        <div onclick="abrirLeadDetalhes(${idx})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition">
            <div class="flex justify-between items-start">
                <div>
                    <div class="font-bold text-slate-800 text-lg leading-tight">${l.nomeLead}</div>
                    <div class="text-xs text-slate-500 mt-1">${l.bairro || '-'} • ${l.cidade || '-'}</div>
                </div>
                <span class="text-[10px] px-2 py-1 rounded-full font-bold ${cor}">${l.status || 'Novo'}</span>
            </div>
            ${l.agendamento ? `<div class="mt-2 text-xs text-orange-600 font-bold flex items-center gap-1"><i class="fas fa-clock"></i> ${l.agendamento.split(' ')[0]}</div>` : ''}
        </div>`;
    }).join('');
}

// ============================================================
// 5. DETALHES LEAD (MODAL)
// ============================================================
function abrirLeadDetalhes(index) {
    const l = leadsCache[index];
    if(!l) return;
    leadAtualParaAgendar = l;
    
    const setText = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v || '-'; }
    const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ''; }

    setText('modalLeadNome', l.nomeLead);
    setText('modalLeadBairro', l.bairro);
    setText('modalLeadCidade', l.cidade);
    setText('modalLeadTelefone', l.telefone);
    setText('modalLeadProvedor', l.provedor);
    
    setVal('modalStatusFunil', l.status);
    setVal('modalLeadObs', l.observacao);
    setVal('inputObjecaoLead', l.objecao);
    setVal('respostaObjecaoLead', l.respostaObjecao);
    
    // Data/Hora
    if(l.agendamento) {
        const p = String(l.agendamento).split(' ');
        if(p[0]) {
            const [d,m,a] = p[0].split('/');
            const elData = document.getElementById('agendarData');
            if(elData) elData.value = `${a}-${m}-${d}`;
        }
        if(p[1]) {
            const elHora = document.getElementById('agendarHora');
            if(elHora) elHora.value = p[1];
        }
    } else {
        const elData = document.getElementById('agendarData');
        if(elData) elData.value = '';
    }

    // Admin Encaminhar
    const areaAdmin = document.getElementById('adminEncaminharArea');
    if(areaAdmin) {
        if(isAdminUser()) areaAdmin.classList.remove('hidden');
        else areaAdmin.classList.add('hidden');
    }
    
    // Botão WhatsApp com OnClick explícito
    const btnWhats = document.getElementById('btnModalWhats');
    if(btnWhats) {
        btnWhats.onclick = () => abrirWhatsApp();
    }

    renderTarefasNoModal(l.nomeLead);
    document.getElementById('leadModal').classList.remove('hidden');
}

function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); }

async function salvarEdicaoModal() {
    if (!leadAtualParaAgendar) return;
    
    const s = document.getElementById('modalStatusFunil').value;
    const o = document.getElementById('modalLeadObs').value;
    const d = document.getElementById('agendarData').value;
    
    leadAtualParaAgendar.status = s;
    leadAtualParaAgendar.observacao = o;
    if (d) {
        const [a, m, day] = d.split('-');
        leadAtualParaAgendar.agendamento = `${day}/${m}/${a} ${document.getElementById('agendarHora').value}`;
    }
    
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    if(document.getElementById('gestaoLeads').style.display !== 'none') renderLeads();
    
    showLoading(true);
    await Promise.all([
        apiCall('updateStatus', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: s }, false),
        apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: o }, false)
    ]);
    if (d) await apiCall('updateAgendamento', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: leadAtualParaAgendar.agendamento }, false);
    
    showLoading(false);
    fecharLeadModal();
}

function editarLeadAtual() {
    if (!leadAtualParaAgendar) return;
    const l = leadAtualParaAgendar;
    
    const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ''; }
    
    setVal('leadNome', l.nomeLead);
    setVal('leadTelefone', l.telefone);
    setVal('leadEndereco', l.endereco);
    setVal('leadBairro', l.bairro);
    setVal('leadCidade', l.cidade);
    setVal('leadProvedor', l.provedor);
    setVal('leadObs', l.observacao);
    
    const s = document.getElementById('leadStatus'); if(s) s.value = l.status || "Novo";
    
    if (isAdminUser()) document.getElementById('divEncaminhar')?.classList.remove('hidden');
    editingLeadIndex = leadsCache.indexOf(l);
    fecharLeadModal();
    navegarPara('cadastroLead');
}

// ============================================================
// 6. TAREFAS (ESTILO TODOIST)
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
        const opacity = t.status === "CONCLUIDA" ? "opacity-50" : "";
        const strike = t.status === "CONCLUIDA" ? "line-through text-slate-400" : "text-slate-700";
        
        return `
        <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 mb-2 transition-all ${opacity}">
            <div onclick="toggleTask('${t.id}', '${t.status}')" class="w-6 h-6 rounded-full border-2 border-slate-300 flex items-center justify-center cursor-pointer ${t.status === 'CONCLUIDA' ? 'bg-green-500 border-green-500' : 'hover:border-blue-500'}">
                ${t.status === 'CONCLUIDA' ? '<i class="fas fa-check text-white text-xs"></i>' : ''}
            </div>
            <div class="flex-1">
                <div class="text-sm font-bold ${strike}">${t.descricao}</div>
                <div class="text-[10px] text-slate-400 mt-1 flex gap-2">
                    ${t.dataLimite ? `<span class="text-red-400"><i class="far fa-calendar"></i> ${t.dataLimite}</span>` : ''}
                    ${t.nomeLead ? `<span class="bg-blue-50 text-blue-500 px-1 rounded">👤 ${t.nomeLead}</span>` : ''}
                </div>
            </div>
            <button onclick="excluirTarefa('${t.id}')" class="text-slate-300 hover:text-red-500"><i class="fas fa-trash-alt"></i></button>
        </div>`;
    }).join('');
}

function abrirCalendario() {
    window.open(CALENDAR_URL, '_blank');
}

// ============================================================
// 7. MATERIAIS
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
            // Lógica do botão Voltar
            const btnVoltar = document.getElementById('btnVoltarMateriais'); 
            const titleEl = document.getElementById('tituloMateriais');
            // Verifica se está na raiz
            const isRoot = !f || f === CONFIG.MATERIAIS_DRIVE_ID;
            
            if(btnVoltar) {
                if(res.isRoot) { 
                    btnVoltar.onclick = () => navegarPara('dashboard'); 
                    if(titleEl) titleEl.innerText = "Materiais"; 
                } else { 
                    btnVoltar.onclick = () => carregarMateriais(null); 
                    if(titleEl) titleEl.innerText = "Voltar"; 
                }
            }
            renderMateriais(materialsCache);
        } else {
             div.innerHTML = `<div class="col-span-2 text-center text-red-400">Erro ao carregar.</div>`;
        }
    } catch (error) {
        div.innerHTML = `<div class="col-span-2 text-center text-red-400">Falha na conexão.</div>`;
    }
}

function filtrarMateriaisBtn(termo) {
    const input = document.getElementById('searchMateriais');
    if(input) {
        input.value = (termo === 'Todos') ? '' : termo;
        buscarMateriais();
        document.querySelectorAll('#materiais .filter-btn').forEach(b => b.classList.remove('active', 'bg-[#00aeef]', 'text-white'));
        if(event && event.target) event.target.classList.add('active', 'bg-[#00aeef]', 'text-white');
    }
}

function buscarMateriais() {
    const term = document.getElementById('searchMateriais').value.toLowerCase();
    const filtrados = materialsCache.filter(m => m.name.toLowerCase().includes(term));
    renderMateriais(filtrados);
}

function renderMateriais(items) {
    const div = document.getElementById('materiaisGrid');
    if(!div) return;
    if(items.length === 0) { div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10">Vazio.</div>'; return; }
    
    div.innerHTML = items.map(item => {
        if (item.type === 'folder') {
            return `
            <div onclick="carregarMateriais('${item.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex flex-col items-center justify-center gap-2 cursor-pointer h-36">
                <i class="fas fa-folder text-5xl text-[#00aeef]"></i>
                <span class="text-xs font-bold text-slate-600 text-center line-clamp-2">${item.name}</span>
            </div>`;
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

// ============================================================
// 8. UTILS, IA & GPS
// ============================================================

async function buscarEnderecoGPS() {
    if (!navigator.geolocation) { alert('GPS indisponível.'); return; }
    showLoading(true, 'Localizando...');
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
            const data = await res.json();
            if (data && data.address) {
                const addr = data.address;
                const setV = (id, v) => { const el = document.getElementById(id); if(el) el.value = v||''; }
                setV('leadEndereco', addr.road);
                setV('leadBairro', addr.suburb || addr.neighbourhood);
                setV('leadCidade', addr.city || addr.town || addr.village);
                alert(`✅ Endereço encontrado!`);
            } else alert('Endereço não encontrado.');
        } catch (e) { alert('Erro GPS.'); }
        showLoading(false);
    }, () => { showLoading(false); alert('Permissão GPS negada.'); });
}

async function apiCall(route, payload, show=true) {
    if(show) showLoading(true);
    if (!navigator.onLine && ['addLead','updateStatus','addTask','registerAbsence'].includes(route)) {
        syncQueue.push({route, payload, timestamp: Date.now()});
        localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue));
        if(show) showLoading(false);
        return { status: 'success', local: true };
    }
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ route, payload }) });
        const json = await res.json();
        if(show) showLoading(false);
        return json;
    } catch(e) {
        if(show) showLoading(false);
        return { status: 'error', message: 'Conexão' };
    }
}

function showLoading(s) { document.getElementById('loader').style.display = s ? 'flex' : 'none'; }
function atualizarDashboard(){ 
    const el = document.getElementById('statLeads'); 
    if(el) {
        const count = leadsCache.filter(l => l.timestamp && l.timestamp.includes(new Date().toLocaleDateString('pt-BR'))).length;
        el.innerText = count;
    }
}
function verificarAgendamentosHoje(){
    const h=new Date().toLocaleDateString('pt-BR');
    // Checa leads e tarefas
    const r=leadsCache.filter(l=>l.agendamento&&l.agendamento.includes(h));
    const t=tasksCache.filter(task=>task.dataLimite&&task.dataLimite.includes(h)&&task.status!=='CONCLUIDA');
    
    if(r.length>0 || t.length>0) document.getElementById('lembreteBanner').classList.remove('hidden');
}
function renderTarefasNoModal(n){const c=document.getElementById('sectionTarefasLead');const l=document.getElementById('listaTarefasLead');const t=tasksCache.filter(x=>x.nomeLead===n&&x.status!=='CONCLUIDA');if(t.length>0){c.classList.remove('hidden');l.innerHTML=t.map(x=>`<div class="bg-blue-50 p-2 text-xs flex gap-2"><input type="checkbox" onchange="toggleTask('${x.id}','${x.status}')"> ${x.descricao}</div>`).join('')}else{c.classList.add('hidden')}}
async function toggleTask(i,s){const t=tasksCache.find(x=>x.id===i);if(t){t.status=s==='PENDENTE'?'CONCLUIDA':'PENDENTE';renderTarefas();if(leadAtualParaAgendar)renderTarefasNoModal(leadAtualParaAgendar.nomeLead)}await apiCall('toggleTask',{taskId:i,status:s,vendedor:loggedUser},false)}
async function excluirTarefa(id) { if(confirm("Excluir tarefa?")) { await apiCall('toggleTask', {taskId:id, status:'DELETED', vendedor:loggedUser}); carregarTarefas(false); } }
function abrirModalTarefa(){document.getElementById('taskModal').classList.remove('hidden');const s=document.getElementById('taskLeadSelect');s.innerHTML='<option value="">Nenhum</option>';leadsCache.forEach(l=>{s.innerHTML+=`<option value="${l.nomeLead}">${l.nomeLead}</option>`})}
async function enviarLead() { const p={vendedor:loggedUser, nomeLead:document.getElementById('leadNome').value, telefone:document.getElementById('leadTelefone').value, endereco:document.getElementById('leadEndereco').value, bairro:document.getElementById('leadBairro').value, cidade:document.getElementById('leadCidade').value, provedor:document.getElementById('leadProvedor').value, interesse:document.getElementById('leadInteresse').value, status:document.getElementById('leadStatus').value, observacao:document.getElementById('leadObs').value, novoVendedor:document.getElementById('leadVendedorDestino')?.value||""}; let r='addLead'; if(editingLeadIndex!==null){ r='updateLeadFull'; p._linha=leadsCache[editingLeadIndex]._linha; p.nomeLeadOriginal=leadsCache[editingLeadIndex].nomeLead; } else if(p.novoVendedor){ r='forwardLead'; p.origem=loggedUser; } const res=await apiCall(r,p); if(res.status==='success'||res.local){alert("Salvo!");localStorage.setItem('mhnet_leads_cache',JSON.stringify(leadsCache));editingLeadIndex=null;navegarPara('gestaoLeads')}else alert("Erro.") }
// Funções IA e Faltas (Mantenha o código padrão)
function abrirWhatsApp() { if(!leadAtualParaAgendar) return; const fone = leadAtualParaAgendar.telefone.replace(/\D/g, ''); if(fone) window.open(`https://wa.me/55${fone}`, '_blank'); else alert("Sem telefone"); }
async function gerarScriptVendaIA(){if(!leadAtualParaAgendar)return;showLoading(true);const r=await perguntarIABackend(`Script WhatsApp para ${leadAtualParaAgendar.nomeLead}`);showLoading(false);if(r)alert("Copiado: "+r)}
async function perguntarIABackend(p){ try { const r=await apiCall('askAI',{question:p},false); return r.status==='success' ? r.answer : null; } catch(e){return null;} }
async function abrirIndicadores(){
    navegarPara('indicadores');
    // Busca dados reais do backend (Vendas da Aba Mês Atual + Total Leads)
    const r=await apiCall('getIndicators',{vendedor:loggedUser},false);
    if(r.status==='success'){
        const d=r.data;
        document.getElementById('funnelLeads').innerText=d.totalLeads;
        document.getElementById('indRealizado').innerText=d.vendas; // Vendas Reais da Planilha
    }
}
async function excluirLead(){if(!confirm("Excluir?"))return;await apiCall('deleteLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead});alert("Excluído.");fecharLeadModal();carregarLeads()}
async function marcarVendaFechada(){if(!confirm("Venda Fechada?"))return;await apiCall('updateStatus',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,status:"Venda Fechada"});alert("Parabéns!");fecharLeadModal();carregarLeads()}
async function salvarAgendamento(){const a=`${document.getElementById('agendarData').value} ${document.getElementById('agendarHora').value}`;await apiCall('updateAgendamento',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,agendamento:a});alert("Agendado!");fecharLeadModal()}
async function combaterObjecaoGeral(){const o=document.getElementById('inputObjecaoGeral').value;const r=await apiCall('solveObjection',{objection:o});if(r.status==='success')document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer}
async function combaterObjecaoLead(){const o=document.getElementById('inputObjecaoLead').value;const r=await apiCall('solveObjection',{objection:o});if(r.status==='success')document.getElementById('respostaObjecaoLead').value=r.answer}
async function salvarObjecaoLead(){await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value});alert("Salvo!")}
async function analiseEstrategicaIA(){const r=await perguntarIABackend(`Analise lead ${leadAtualParaAgendar.nomeLead}`);if(r)document.getElementById('modalLeadObs').value+="\n\n[IA]: "+r}
async function raioXConcorrencia(){const p=document.getElementById('modalLeadProvedor').innerText;const r=await perguntarIABackend(`Raio-X ${p}`);if(r)document.getElementById('modalLeadObs').value += "\n\n[RX]: " + r}
async function gerarCoachIA(){const r=await perguntarIABackend("Frase motivacional");if(r)alert(r)}
async function consultarPlanosIA(){document.getElementById('chatModal').classList.remove('hidden')}
function toggleChat(){document.getElementById('chatModal').classList.add('hidden')}
async function enviarMensagemChat(){
    const m=document.getElementById('chatInput').value;
    if(m){
        document.getElementById('chatHistory').innerHTML+=`<div class='text-right'>${m}</div>`;
        // Prompt Híbrido
        const r=await perguntarIABackend(`Contexto: Manual de Vendas MHNET. Pergunta: ${m}`);
        document.getElementById('chatHistory').innerHTML+=`<div class='text-left'>${r}</div>`;
    }
}
function ajustarMicrofone(){const btn=document.getElementById('btnMicNome');if(btn){btn.removeAttribute('onclick');btn.onclick=()=>iniciarDitado('leadObs');}}
async function verHistoricoFaltas(){const d=document.getElementById('listaHistoricoFaltas');document.getElementById('historicoFaltasContainer').classList.remove('hidden');document.getElementById('formFaltaContainer').classList.add('hidden');const r=await apiCall('getAbsences',{vendedor:loggedUser},false);if(r.status==='success')d.innerHTML=r.data.map(f=>`<div class="bg-white p-3 rounded-xl border mb-2"><div class="font-bold text-xs">${f.motivo}</div><div class="text-[10px]">${f.dataFalta} • ${f.status}</div></div>`).join('');else d.innerHTML='Sem histórico.'}
function ocultarHistoricoFaltas(){document.getElementById('historicoFaltasContainer').classList.add('hidden');document.getElementById('formFaltaContainer').classList.remove('hidden')}
async function enviarJustificativa(){
    showLoading(true);
    const p={
        vendedor:loggedUser,
        dataFalta:document.getElementById('faltaData').value,
        motivo:document.getElementById('faltaMotivo').value,
        observacao:document.getElementById('faltaObs').value
    };
    const f=document.getElementById('faltaArquivo').files[0];
    if(f){const r=new FileReader();r.onload=async e=>{p.fileData=e.target.result;p.fileName=f.name;p.mimeType=f.type;await apiCall('registerAbsence',p);showLoading(false);alert("Enviado!");navegarPara('dashboard')};r.readAsDataURL(f)}
    else{await apiCall('registerAbsence',p);showLoading(false);alert("Enviado!");navegarPara('dashboard')}
}
function fecharInstallPrompt() { document.getElementById('installPrompt').classList.add('hidden'); }
async function instalarPWA() { if(window.deferredPrompt) { window.deferredPrompt.prompt(); const {outcome} = await window.deferredPrompt.userChoice; if(outcome==='accepted') document.getElementById('installPrompt').classList.add('hidden'); window.deferredPrompt=null; } }
function abrirConfiguracoes(){document.getElementById('configModal').classList.remove('hidden')}
async function gerirEquipe(a){await apiCall('manageTeam',{acao:a,nome:document.getElementById('cfgNomeVendedor').value,meta:document.getElementById('cfgMeta').value});alert("Feito!");carregarVendedores()}
async function encaminharLeadModal(){const n=document.getElementById('modalLeadDestino').value;if(!n)return alert("Selecione");if(confirm("Encaminhar?")){await apiCall('forwardLead',{nomeLead:leadAtualParaAgendar.nomeLead,telefone:leadAtualParaAgendar.telefone,novoVendedor:n,origem:loggedUser});alert("Encaminhado!");fecharLeadModal();carregarLeads()}}
async function executarTransferenciaLote() { /* Lógica V171 */ }
