/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V95 (FINAL INTEGRADO)
 * ============================================================
 * 📝 RESUMO TÉCNICO:
 * - Arquivo lógico separado para facilitar manutenção.
 * - Sincronizado com HTML V95 e Backend V91.
 * - Inclui Modo Offline, Funil, Gestão de Equipe e IA.
 * ============================================================
 */

// ⚠️ ID DA IMPLANTAÇÃO BACKEND V91 (Confirmado)
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
    console.log("🚀 MHNET App V95 - Logic Loaded");
    
    carregarVendedores();
    
    // Recupera cache local para exibição instantânea
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { try { leadsCache = JSON.parse(saved); } catch(e) {} }
    
    if (loggedUser) {
         initApp();
         // Se tiver rede ao abrir, tenta sincronizar pendências
         if(navigator.onLine) processarFilaSincronizacao();
    } else {
         document.getElementById('userMenu').style.display = 'flex';
         document.getElementById('mainContent').style.display = 'none';
    }
});

// Listener de Conexão (Auto-Sync)
window.addEventListener('online', () => {
    console.log("🌐 Online - Sincronizando...");
    processarFilaSincronizacao();
});

// ============================================================
// 2. CORE & NAVEGAÇÃO
// ============================================================

function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    document.getElementById('userInfo').innerText = loggedUser;
    
    // Ativa Modo Gestor se for o Bruno
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
        alert('Selecione um vendedor na lista!');
    }
}

function logout() { 
    if(confirm("Deseja sair do sistema?")) { 
        localStorage.removeItem('loggedUser'); 
        location.reload(); 
    } 
}

function navegarPara(pageId) {
    // Oculta todas as páginas
    document.querySelectorAll('.page').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('fade-in');
    });

    // Mostra a página alvo
    const target = document.getElementById(pageId);
    if(target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('fade-in'), 10);
    }
    
    const scroller = document.getElementById('main-scroll');
    if(scroller) scroller.scrollTo(0,0);

    // Hooks (Lógica específica ao entrar na tela)
    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') abrirIndicadores();
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        // Limpa filtro se não for vindo de "Leads Hoje"
        if(busca && !busca.placeholder.includes("Filtrado")) {
            busca.value = "";
            busca.placeholder = "Buscar nome, bairro, telefone...";
        }
        renderLeads();
    }
    if (pageId === 'cadastroLead') {
        ajustarMicrofone();
        if (editingLeadIndex === null) {
            // Limpa form para cadastro novo
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
    
    // Atualização Otimista Local (Para Leads Novos aparecerem na hora mesmo offline)
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
        carregarLeads(false); // Atualiza lista se estiver nela
    }
}

// ============================================================
// 4. LEADS, FILTROS E FUNIL
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
    renderListaLeads(retornos);
    document.getElementById('searchLead').placeholder = `Retornos de Hoje (${retornos.length})`;
}

function filtrarPorStatus(status) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const btnId = 'btnFilter' + status.replace(/\s+/g, '');
    const btn = document.getElementById(btnId) || event.target; 
    if(btn) btn.classList.add('active');
    
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
    if (lista.length === 0) { div.innerHTML = '<div class="text-center mt-10 text-gray-400">Nenhum lead.</div>'; return; }

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
    
    // Flag Provedor
    const badgeProv = l.provedor ? `<span class="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[9px] border border-indigo-100"><i class="fas fa-wifi"></i> ${l.provedor}</span>` : '';

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition">
        <div class="flex justify-between items-start">
            <div>
                <div class="font-bold text-slate-800 text-lg leading-tight">${l.nomeLead}</div>
                <div class="text-xs text-slate-500 mt-1">${l.bairro || '-'} • ${l.cidade || '-'}</div>
                <div class="mt-2">${badgeProv}</div>
            </div>
            <span class="text-[10px] px-2 py-1 rounded-full ${badgeColor}">${l.status || l.interesse || 'Novo'}</span>
        </div>
    </div>`;
}

// --- DETALHES LEAD ---
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
    
    // Raio-X Dinâmico
    const containerRaioX = document.getElementById('containerRaioX');
    if(containerRaioX) {
        containerRaioX.innerHTML = `<button onclick="raioXConcorrencia()" class="ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold shadow flex items-center gap-1 active:scale-95"><i class="fas fa-bolt text-yellow-400"></i> Raio-X</button>`;
    }
    
    document.getElementById('leadModal').classList.remove('hidden');
}

function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); leadAtualParaAgendar = null; editingLeadIndex = null; }

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
        const [a, m, d] = dataAgenda.split('-');
        leadAtualParaAgendar.agendamento = `${d}/${m}/${a} ${horaAgenda || '09:00'}`;
    }
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    if(document.getElementById('gestaoLeads').style.display !== 'none') renderLeads();
    
    showLoading(true, "SALVANDO...");
    
    // Updates em paralelo
    await Promise.all([
        apiCall('updateStatus', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: novoStatus }, false),
        apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: obs }, false)
    ]);
    
    if (dataAgenda) {
        await apiCall('updateAgendamento', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: leadAtualParaAgendar.agendamento }, false);
    }
    
    showLoading(false);
    fecharLeadModal();
}

async function salvarStatusFunil() {
    // Chamado apenas ao mudar o select, se quiser salvar instantaneamente sem fechar
    // Mas agora temos o botão "Salvar e Fechar", então essa função pode ser redundante ou usada para update silencioso
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
    
    if (loggedUser === "Bruno Garcia Queiroz") document.getElementById('divEncaminhar').classList.remove('hidden');

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
        alert("Erro: " + (res?.message || "Falha"));
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

// --- UTILS & IA ---
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
    } catch(e) { s.innerHTML = '<option value="">Modo Offline</option>'; }
}

function showLoading(s, t) { const l = document.getElementById('loader'); if(l) l.style.display = s ? 'flex' : 'none'; if(t) document.getElementById('loaderText').innerText = t; }
function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); }
function atualizarDataCabecalho() { document.getElementById('headerDate').innerText = new Date().toLocaleDateString('pt-BR'); }
function atualizarDashboard() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    document.getElementById('statLeads').innerText = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje)).length;
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

// --- TAREFAS, FALTAS, IA (Copiados e Mantidos) ---
async function carregarTarefas(){const d=document.getElementById('listaTarefasContainer');d.innerHTML='Carregando...';const r=await apiCall('getTasks',{vendedor:loggedUser},false);if(r.status==='success')d.innerHTML=r.data.map(t=>`<div class="bg-white p-3 rounded shadow mb-2 flex gap-2"><input type="checkbox" ${t.status==='CONCLUIDA'?'checked':''} onchange="toggleTask('${t.id}','${t.status}')"><span>${t.descricao}</span></div>`).join('')}
function abrirModalTarefa(){document.getElementById('taskModal').classList.remove('hidden')}
async function salvarTarefa(){await apiCall('addTask',{vendedor:loggedUser,descricao:document.getElementById('taskDesc').value,dataLimite:document.getElementById('taskDate').value});document.getElementById('taskModal').classList.add('hidden');carregarTarefas()}
async function toggleTask(i,s){await apiCall('toggleTask',{taskId:i,status:s,vendedor:loggedUser},false);carregarTarefas()}
async function limparTarefasConcluidas(){await apiCall('archiveTasks',{vendedor:loggedUser});carregarTarefas()}
async function verHistoricoFaltas(){const d=document.getElementById('listaHistoricoFaltas');document.getElementById('historicoFaltasContainer').classList.remove('hidden');document.getElementById('formFaltaContainer').classList.add('hidden');const r=await apiCall('getAbsences',{vendedor:loggedUser},false);if(r.status==='success')d.innerHTML=r.data.map(f=>`<div class="bg-white p-3 mb-2 rounded shadow"><div class="font-bold text-xs">${f.motivo}</div><div class="text-[10px]">${f.dataFalta} • ${f.statusEnvio}</div></div>`).join('')}
function ocultarHistoricoFaltas(){document.getElementById('historicoFaltasContainer').classList.add('hidden');document.getElementById('formFaltaContainer').classList.remove('hidden')}
async function enviarJustificativa(){showLoading(true);await apiCall('registerAbsence',{vendedor:loggedUser,dataFalta:document.getElementById('faltaData').value,motivo:document.getElementById('faltaMotivo').value,observacao:document.getElementById('faltaObs').value});showLoading(false);alert("Enviado!");navegarPara('dashboard')}
async function carregarMateriais(f=null){const r=await apiCall('getImages',{folderId:f},false);if(r.status==='success')renderMateriais(r.data)}
function renderMateriais(i){document.getElementById('materiaisGrid').innerHTML=i.map(x=>`<div class="bg-white p-2 rounded border"><a href="${x.downloadUrl}" target="_blank">${x.name}</a></div>`).join('')}
function buscarMateriais(){carregarMateriais(currentFolderId,document.getElementById('searchMateriais').value)}
function copiarTexto(id){document.getElementById(id).select();document.execCommand('copy');alert("Copiado!")}
function enviarZapTexto(id){window.open(`https://wa.me/?text=${encodeURIComponent(document.getElementById(id).value)}`,'_blank')}
async function combaterObjecaoGeral(){const o=document.getElementById('inputObjecaoGeral').value;showLoading(true);const r=await apiCall('solveObjection',{objection:o});showLoading(false);if(r.status==='success'){document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer;document.getElementById('resultadoObjecaoGeral').classList.remove('hidden')}}
async function combaterObjecaoLead(){const o=document.getElementById('inputObjecaoLead').value;showLoading(true);const r=await apiCall('solveObjection',{objection:o});showLoading(false);if(r.status==='success')document.getElementById('respostaObjecaoLead').value=r.answer}
async function salvarObjecaoLead(){await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value});alert("Salvo!")}
async function analiseEstrategicaIA(){showLoading(true);const r=await perguntarIABackend(`Analise lead ${leadAtualParaAgendar.nomeLead}`);showLoading(false);if(r) { document.getElementById('modalLeadObs').value += "\n\n[IA]: " + r; alert("Adicionado!"); } }
async function raioXConcorrencia(){const p=document.getElementById('modalLeadProvedor').innerText;showLoading(true);const r=await perguntarIABackend(`Raio-X ${p}`);showLoading(false);if(r)document.getElementById('modalLeadObs').value += "\n\n[RX]: " + r}
async function refinarObsIA(){const o=document.getElementById('leadObs');showLoading(true);const r=await perguntarIABackend(`Reescreva: "${o.value}"`);showLoading(false);if(r)o.value=r}
async function gerarCoachIA(){const r=await apiCall('askAI',{question:'Frase motivacional'});if(r.status==='success')alert(r.answer)}
async function consultarPlanosIA(){document.getElementById('chatModal').classList.remove('hidden')}
function toggleChat(){document.getElementById('chatModal').classList.add('hidden')}
async function enviarMensagemChat(){const i=document.getElementById('chatInput');const m=i.value;i.value='';const r=await apiCall('askAI',{question:m});document.getElementById('chatHistory').innerHTML+=`<div class="bg-gray-100 p-2 mb-1">${r.answer}</div>`}
async function buscarEnderecoGPS(){navigator.geolocation.getCurrentPosition(p=>{fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json()).then(d=>{if(d.address){document.getElementById('leadEndereco').value=d.address.road;document.getElementById('leadBairro').value=d.address.suburb;document.getElementById('leadCidade').value=d.address.city}})},()=>{alert('Erro GPS')})}
function iniciarDitado(t){const r=new(window.SpeechRecognition||window.webkitSpeechRecognition)();r.lang='pt-BR';r.start();r.onresult=e=>{document.getElementById(t).value+=e.results[0][0].transcript}}
async function perguntarIABackend(p){ try { const r=await apiCall('askAI',{question:p},false); return r.status==='success' ? r.answer : null; } catch(e){return null;} }
