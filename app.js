/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V92 (FINAL GESTÃO & VISUAL)
 * ============================================================
 */

// ⚠️ ID DO BACKEND V91
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let vendorsCache = []; 
let leadAtualParaAgendar = null; 
let currentFolderId = null;
let editingLeadIndex = null;
let editingAbsenceIndex = null;
let syncQueue = JSON.parse(localStorage.getItem('mhnet_sync_queue') || '[]');

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V92 Started");
    carregarVendedores();
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { try { leadsCache = JSON.parse(saved); } catch(e) {} }
    if (loggedUser) { initApp(); if(navigator.onLine) processarFilaSincronizacao(); } 
    else { document.getElementById('userMenu').style.display = 'flex'; }
});

window.addEventListener('online', processarFilaSincronizacao);

// --- FUNÇÕES GLOBAIS ---
window.navegarPara = navegarPara;
window.filtrarLeadsHoje = filtrarLeadsHoje;
window.filtrarRetornos = filtrarRetornos;
window.filtrarPorStatus = filtrarPorStatus;
window.abrirIndicadores = abrirIndicadores;
window.carregarLeads = carregarLeads;
window.renderLeads = renderLeads;
window.editarLeadAtual = editarLeadAtual;
window.excluirLead = excluirLead;
window.enviarLead = enviarLead;
window.salvarAgendamento = salvarAgendamento;
window.salvarObservacaoModal = salvarObservacaoModal;
window.salvarEdicaoModal = salvarEdicaoModal; // NOVA
window.setLoggedUser = setLoggedUser;
window.logout = logout;
window.abrirModalTarefa = abrirModalTarefa;
window.salvarTarefa = salvarTarefa;
window.limparTarefasConcluidas = limparTarefasConcluidas;
window.toggleTask = toggleTask;
window.enviarJustificativa = enviarJustificativa;
window.verHistoricoFaltas = verHistoricoFaltas;
window.ocultarHistoricoFaltas = ocultarHistoricoFaltas;
window.preencherEdicaoFalta = preencherEdicaoFalta;
window.carregarMateriais = carregarMateriais;
window.buscarMateriais = buscarMateriais;
window.combaterObjecaoGeral = combaterObjecaoGeral;
window.combaterObjecaoLead = combaterObjecaoLead;
window.salvarObjecaoLead = salvarObjecaoLead;
window.gerarCoachIA = gerarCoachIA;
window.consultarPlanosIA = consultarPlanosIA;
window.analiseEstrategicaIA = analiseEstrategicaIA;
window.buscarEnderecoGPS = buscarEnderecoGPS;
window.iniciarDitado = iniciarDitado;
window.copiarTexto = copiarTexto;
window.enviarZapTexto = enviarZapTexto;
window.salvarStatusFunil = salvarStatusFunil;
window.fecharLeadModal = fecharLeadModal;
window.abrirLeadDetalhes = abrirLeadDetalhes;

// --- CORE ---
function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    document.getElementById('userInfo').innerText = loggedUser;
    
    if (loggedUser === "Bruno Garcia Queiroz") {
        document.getElementById('btnAdminSettings')?.classList.remove('hidden');
    }
    
    atualizarDataCabecalho();
    carregarLeads(false); 
    navegarPara('dashboard');
}

function navegarPara(pageId) {
    document.querySelectorAll('.page').forEach(el => { el.style.display = 'none'; el.classList.remove('fade-in'); });
    const target = document.getElementById(pageId);
    if(target) { target.style.display = 'block'; setTimeout(() => target.classList.add('fade-in'), 10); }
    
    const scroller = document.getElementById('main-scroll');
    if(scroller) scroller.scrollTo(0,0);

    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') carregarDadosIndicadores(); 
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        if(busca && !busca.placeholder.includes("Filtrado")) { busca.value = ""; busca.placeholder = "Buscar..."; }
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

// --- SALVAR TUDO E FECHAR (MODAL) ---
async function salvarEdicaoModal() {
    if (!leadAtualParaAgendar) return;
    
    const novoStatus = document.getElementById('modalStatusFunil').value;
    const obs = document.getElementById('modalLeadObs').value;
    const dataAgenda = document.getElementById('agendarData').value;
    const horaAgenda = document.getElementById('agendarHora').value;
    
    // Atualiza Cache Local
    leadAtualParaAgendar.status = novoStatus;
    leadAtualParaAgendar.observacao = obs;
    if (dataAgenda) {
        // Formata data para DD/MM/YYYY HH:MM
        const [a, m, d] = dataAgenda.split('-');
        leadAtualParaAgendar.agendamento = `${d}/${m}/${a} ${horaAgenda || '09:00'}`;
    }
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    
    // Feedback visual imediato na lista
    if(document.getElementById('gestaoLeads').style.display !== 'none') renderLeads();
    
    showLoading(true, "SALVANDO TUDO...");
    
    // Envia Status
    await apiCall('updateStatus', { 
        vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: novoStatus 
    }, false);
    
    // Envia Obs
    await apiCall('updateObservacao', {
        vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: obs
    }, false);
    
    // Envia Agendamento (se houver)
    if (dataAgenda) {
        await apiCall('updateAgendamento', {
            vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: leadAtualParaAgendar.agendamento
        }, false);
    }
    
    showLoading(false);
    fecharLeadModal();
}

// ... (MANTER DEMAIS FUNÇÕES DO APP.JS V91 - DETALHES, CARREGAR, ETC) ...
// (Abaixo, apenas as funções que foram ajustadas para o novo modal ou correções)

function abrirLeadDetalhes(index) {
    const l = leadsCache[index];
    if(!l) return;
    leadAtualParaAgendar = l;
    
    document.getElementById('modalLeadNome').innerText = l.nomeLead;
    document.getElementById('modalLeadBairro').innerText = l.bairro || "Sem bairro";
    document.getElementById('modalLeadCidade').innerText = l.cidade || "Sem cidade";
    document.getElementById('modalLeadTelefone').innerText = l.telefone || "Sem fone";
    document.getElementById('modalLeadProvedor').innerText = l.provedor || "--";
    
    const statusSel = document.getElementById('modalStatusFunil');
    if(statusSel) statusSel.value = l.status || "Novo";
    
    document.getElementById('modalLeadObs').value = l.observacao || "";
    document.getElementById('inputObjecaoLead').value = l.objecao || "";
    document.getElementById('respostaObjecaoLead').value = l.respostaObjecao || "";

    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) btnWhats.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');
    
    const containerRaioX = document.getElementById('containerRaioX');
    if(containerRaioX) {
        containerRaioX.innerHTML = `<button onclick="raioXConcorrencia()" class="ml-2 bg-slate-800 text-white px-3 py-1 rounded text-[10px] font-bold shadow flex items-center gap-1 active:scale-95"><i class="fas fa-bolt text-yellow-400"></i> Raio-X</button>`;
    }

    document.getElementById('leadModal').classList.remove('hidden');
}

// ... (RESTANTE DO CÓDIGO IDENTICO AO V91)
// Copie aqui o restante das funções utilitárias, apiCall, carregarLeads, tarefas, faltas, etc.
// Certifique-se de que `apiCall`, `showLoading`, `carregarVendedores` estejam presentes.

async function carregarVendedores() {
    const s = document.getElementById('userSelect');
    if(!s) return;
    s.innerHTML = '<option value="">Conectando...</option>';
    try {
        const res = await apiCall('getVendors', {}, false);
        if(res.status === 'success') {
            const opts = res.data.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
            s.innerHTML = '<option value="">Selecione...</option>' + opts;
        }
    } catch(e) { s.innerHTML = '<option value="">Offline</option>'; }
}

async function apiCall(route, payload, show=true) {
    if(show) showLoading(true);
    if (!navigator.onLine && isWriteOperation(route)) {
        adicionarAFila(route, payload);
        if(show) showLoading(false);
        return { status: 'success', local: true, message: 'Offline Salvo' };
    }
    try {
        const res = await fetch(API_URL, { 
            method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, 
            body: JSON.stringify({ route: route, payload: payload }) 
        });
        const json = await res.json();
        if(show) showLoading(false);
        return json;
    } catch(e) {
        if(show) showLoading(false);
        if (isWriteOperation(route)) {
            adicionarAFila(route, payload);
            return { status: 'success', local: true, message: 'Offline Salvo' };
        }
        return { status: 'error', message: 'Conexão' };
    }
}
function isWriteOperation(route) { return ['addLead', 'deleteLead', 'updateStatus', 'updateAgendamento', 'updateObservacao', 'addTask', 'toggleTask', 'registerAbsence', 'updateAbsence', 'saveObjectionLead'].includes(route); }
function adicionarAFila(route, payload) { syncQueue.push({ route, payload, timestamp: new Date().getTime() }); localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue)); alert("Salvo Offline!"); }
async function processarFilaSincronizacao() { if (syncQueue.length === 0) return; showLoading(true); const falhas = []; for (const item of syncQueue) { try { await fetch(API_URL, { method: 'POST', body: JSON.stringify({ route: item.route, payload: item.payload }) }); } catch (e) { falhas.push(item); } } syncQueue = falhas; localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue)); showLoading(false); }
function showLoading(s, t) { const l = document.getElementById('loader'); if(l) l.style.display = s ? 'flex' : 'none'; if(t) document.getElementById('loaderText').innerText = t; }
function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); }
function atualizarDataCabecalho() { document.getElementById('headerDate').innerText = new Date().toLocaleDateString('pt-BR'); }
function atualizarDashboard() { const h = new Date().toLocaleDateString('pt-BR'); document.getElementById('statLeads').innerText = leadsCache.filter(l => l.timestamp && l.timestamp.includes(h)).length; }
function verificarAgendamentosHoje() { const h = new Date().toLocaleDateString('pt-BR'); const r = leadsCache.filter(l => l.agendamento && l.agendamento.includes(h)); const b = document.getElementById('lembreteBanner'); if (r.length > 0) { if(b) b.classList.remove('hidden'); } else { if(b) b.classList.add('hidden'); } }
// ... Copie o restante das funções de Leads, Tarefas, Faltas e IA do arquivo V91 anterior ...
// (Incluindo filtrarLeadsHoje, filtrarRetornos, filtrarPorStatus, carregarLeads, renderLeads, etc.)
