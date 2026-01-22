/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V158 (FIX CRASH & MATERIAIS)
 * ============================================================
 * 📝 CORREÇÕES:
 * 1. CRASH LOGIN: 'atualizarDataCabecalho' agora é segura (não trava se o ID faltar).
 * 2. MATERIAIS: Navegação de pastas e botão voltar corrigidos.
 * 3. SYNC: Backend V172 e Index V158 alinhados.
 * ============================================================
 */

// ⚠️ ID DO BACKEND V172 (Substitua pelo ID da sua última implantação se diferente)
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

// Lista de Vendedores de Backup (Offline)
const VENDEDORES_OFFLINE = [
    "Bruno Garcia Queiroz",
];

function isAdminUser() {
    if (!loggedUser) return false;
    return loggedUser.trim().toUpperCase().includes("BRUNO GARCIA");
}

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V158 - Init");
    
    // Exporta funções para o HTML
    exporFuncoesGlobais();
    
    // Carrega vendedores
    carregarVendedores();
    
    // Carrega cache
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { try { leadsCache = JSON.parse(saved); } catch(e) {} }
    
    if (loggedUser) {
         initApp();
         if(navigator.onLine) processarFilaSincronizacao();
    } else {
         const menu = document.getElementById('userMenu');
         if(menu) menu.style.display = 'flex';
         const content = document.getElementById('mainContent');
         if(content) content.style.display = 'none';
    }
});

function exporFuncoesGlobais() {
    window.setLoggedUser = setLoggedUser;
    window.logout = logout;
    window.navegarPara = navegarPara;
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
    window.abrirConfiguracoes = abrirConfiguracoes;
    window.gerirEquipe = gerirEquipe;
    window.buscarEnderecoGPS = buscarEnderecoGPS;
    window.abrirIndicadores = abrirIndicadores;
    window.verHistoricoFaltas = verHistoricoFaltas;
    window.enviarJustificativa = enviarJustificativa;
    window.ocultarHistoricoFaltas = ocultarHistoricoFaltas;
    window.carregarMateriais = carregarMateriais;
    window.buscarMateriais = buscarMateriais;
    window.filtrarMateriaisBtn = filtrarMateriaisBtn;
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
    window.abrirModalTarefa = abrirModalTarefa;
    window.salvarTarefa = salvarTarefa;
    window.toggleTask = toggleTask;
    window.limparTarefasConcluidas = limparTarefasConcluidas;
    window.fecharInstallPrompt = fecharInstallPrompt;
    window.instalarPWA = instalarPWA;
}

window.addEventListener('online', () => processarFilaSincronizacao());

// ============================================================
// 2. CORE & NAVEGAÇÃO
// ============================================================
function initApp() {
    const userMenu = document.getElementById('userMenu');
    const mainContent = document.getElementById('mainContent');
    const userInfo = document.getElementById('userInfo');

    if(userMenu) userMenu.style.display = 'none';
    if(mainContent) mainContent.style.display = 'flex';
    if(userInfo) userInfo.innerText = loggedUser;
    
    // Libera Admin
    if (isAdminUser()) {
        const btn = document.getElementById('btnAdminSettings');
        if(btn) btn.classList.remove('hidden');
        const panel = document.getElementById('adminPanel');
        if(panel) panel.classList.remove('hidden');
    }
    
    // FIX CRASH: Atualiza data de forma segura
    atualizarDataCabecalho();
    
    carregarLeads(false); 
    carregarTarefas(false); 
    navegarPara('dashboard');
}

// FIX: Função Segura para Data
function atualizarDataCabecalho() {
    const el = document.getElementById('headerDate');
    if (el) {
        el.innerText = new Date().toLocaleDateString('pt-BR');
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

    // Hooks
    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') renderTarefas(); 
    if (pageId === 'indicadores') abrirIndicadores();
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        // Se a busca não tiver filtro ativo, reseta para mostrar tudo
        if(busca && !busca.placeholder.includes("Filtrado") && !busca.placeholder.includes("Retornos")) {
             verTodosLeads();
        }
    }
    if (pageId === 'cadastroLead') {
        if (editingLeadIndex === null) {
            document.querySelectorAll('#cadastroLead input, #cadastroLead textarea').forEach(el => el.value = '');
            const selStatus = document.getElementById('leadStatus'); if(selStatus) selStatus.value = 'Novo';
            if(isAdminUser()) {
                const divEnc = document.getElementById('divEncaminhar');
                if(divEnc) divEnc.classList.remove('hidden');
            }
        }
    }
    if (pageId === 'materiais') {
        // Carrega a raiz se não tiver pasta atual
        if (!currentFolderId) setTimeout(() => carregarMateriais(null), 100);
    }
    if (pageId === 'faltas') ocultarHistoricoFaltas();
}

// ============================================================
// 3. AUTENTICAÇÃO E VENDEDORES
// ============================================================

function setLoggedUser() {
    const select = document.getElementById('userSelect');
    const valor = select.value;
    
    if (valor && valor !== "" && valor !== "Carregando...") { 
        loggedUser = valor; 
        localStorage.setItem('loggedUser', valor); 
        initApp(); 
    } else {
        // Fallback se a lista estiver vazia (erro de conexão no boot)
        if (select.options.length <= 1) {
            alert("Carregando lista offline...");
            const ops = VENDEDORES_OFFLINE.map(v => `<option value="${v}">${v}</option>`).join('');
            select.innerHTML = '<option value="">Selecione...</option>' + ops;
        } else {
            alert('Selecione seu nome.');
        }
    }
}

function logout() { 
    if(confirm("Sair do sistema?")) {
        localStorage.removeItem('loggedUser'); 
        location.reload(); 
    }
}

async function carregarVendedores() { 
    const s = document.getElementById('userSelect');
    if(!s) return;
    
    // Timeout para fallback
    const timer = setTimeout(() => {
        if(s.options.length <= 1) {
            const ops = VENDEDORES_OFFLINE.map(v => `<option value="${v}">${v}</option>`).join('');
            s.innerHTML = '<option value="">Modo Offline</option>' + ops;
        }
    }, 4000);

    try {
        const r = await apiCall('getVendors', {}, false);
        clearTimeout(timer);
        
        if (r.status === 'success' && r.data) {
            vendorsCache = r.data;
            const o = r.data.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
            s.innerHTML = '<option value="">Selecione...</option>' + o;
            
            // Popula outros selects
            const dest1 = document.getElementById('modalLeadDestino');
            const dest2 = document.getElementById('leadVendedorDestino');
            if(dest1) dest1.innerHTML = '<option value="">Selecione...</option>' + o;
            if(dest2) dest2.innerHTML = '<option value="">Selecione...</option>' + o;
        }
    } catch(e) {
        // Erro silencioso, o timeout cuida do fallback
    } 
}

// ============================================================
// 4. LEADS
// ============================================================

function verTodosLeads() {
    navegarPara('gestaoLeads');
    const input = document.getElementById('searchLead');
    if(input) { input.value = ""; input.placeholder = "Buscar..."; }
    
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const btnTodos = document.getElementById('btnFilterTodos');
    if(btnTodos) btnTodos.classList.add('active');
    
    renderLeads();
}

function filtrarLeadsHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const leadsHoje = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje));
    if (leadsHoje.length === 0) { alert("📅 Nenhum lead hoje!"); return; }
    
    navegarPara('gestaoLeads');
    const input = document.getElementById('searchLead');
    if(input) input.placeholder = `📅 Hoje (${leadsHoje.length})`;
    renderListaLeads(leadsHoje);
}

function filtrarRetornos() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    if (retornos.length === 0) { alert("Nenhum retorno hoje."); return; }
    
    navegarPara('gestaoLeads');
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
        
        if (isAdminUser()) {
             const adminPanel = document.getElementById('adminPanel');
             if(adminPanel) adminPanel.classList.remove('hidden');
        }
        
        if(document.getElementById('listaLeadsGestao') && document.getElementById('gestaoLeads').style.display !== 'none') {
            renderLeads();
        }
        atualizarDashboard();
        verificarAgendamentosHoje();
    }
}

function renderLeads() {
    const el = document.getElementById('searchLead');
    const term = el ? el.value.toLowerCase() : '';
    const lista = leadsCache.filter(l => 
        String(l.nomeLead||'').toLowerCase().includes(term) || 
        String(l.bairro||'').toLowerCase().includes(term)
    );
    renderListaLeads(lista);
}

function renderListaLeads(lista) {
    const div = document.getElementById('listaLeadsGestao');
    if (!div) return;
    if (lista.length === 0) { div.innerHTML = '<div class="text-center p-10 text-gray-400">Vazio.</div>'; return; }
    
    div.innerHTML = lista.map((l) => {
        const idx = leadsCache.indexOf(l);
        let cor = "bg-slate-100 text-slate-600";
        if(l.status==='Venda Fechada') cor="bg-green-100 text-green-700";
        if(l.status==='Agendado') cor="bg-orange-100 text-orange-700";
        
        return `<div onclick="abrirLeadDetalhes(${idx})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition">
            <div class="flex justify-between items-start">
                <div>
                    <div class="font-bold text-slate-800 text-lg leading-tight">${l.nomeLead}</div>
                    <div class="text-xs text-slate-500 mt-1">${l.bairro || '-'}</div>
                </div>
                <span class="text-[10px] px-2 py-1 rounded-full font-bold ${cor}">${l.status || 'Novo'}</span>
            </div>
            ${l.agendamento ? `<div class="mt-2 text-xs text-orange-600 font-bold"><i class="fas fa-clock"></i> ${l.agendamento.split(' ')[0]}</div>` : ''}
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
    
    // Data
    if(l.agendamento) {
        const p = l.agendamento.split(' ');
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
    if (isAdminUser()) {
        const area = document.getElementById('adminEncaminharArea');
        if(area) {
            area.classList.remove('hidden');
            const sel = document.getElementById('modalLeadDestino');
            if(sel && sel.options.length <= 1 && vendorsCache.length > 0) {
                 sel.innerHTML = '<option value="">Selecione...</option>' + vendorsCache.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
            }
        }
    }

    renderTarefasNoModal(l.nomeLead);
    const modal = document.getElementById('leadModal');
    if(modal) modal.classList.remove('hidden');
}

function fecharLeadModal() { document.getElementById('leadModal')?.classList.add('hidden'); }

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
// 6. MATERIAIS (CORRIGIDO)
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
            
            // Botão Voltar
            const btnVoltar = document.getElementById('btnVoltarMateriais'); 
            const titleEl = document.getElementById('tituloMateriais');
            
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

function renderMateriais(items) {
    const div = document.getElementById('materiaisGrid');
    if(!div) return;
    if(items.length === 0) { div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10">Vazio.</div>'; return; }
    
    div.innerHTML = items.map(item => {
        if (item.type === 'folder') {
            return `<div onclick="carregarMateriais('${item.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex flex-col items-center justify-center gap-2 cursor-pointer h-36"><i class="fas fa-folder text-5xl text-[#00aeef]"></i><span class="text-xs font-bold text-slate-600 text-center line-clamp-2">${item.name}</span></div>`;
        } else {
            return `<div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-auto relative"><div class="h-32 w-full bg-gray-50 rounded-xl overflow-hidden mb-2"><img src="${item.thumbnail}" class="w-full h-full object-cover"></div><div class="text-[10px] text-gray-500 font-bold truncate px-1 mb-2">${item.name}</div><div class="flex gap-2"><a href="${item.downloadUrl}" target="_blank" class="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg flex items-center justify-center"><i class="fas fa-download"></i></a><button onclick="window.open('https://wa.me/?text=${encodeURIComponent(item.viewUrl)}', '_blank')" class="flex-1 bg-green-50 text-green-600 py-2 rounded-lg flex items-center justify-center"><i class="fab fa-whatsapp"></i></button></div></div>`;
        }
    }).join('');
}

// ============================================================
// 7. UTILS & ADMIN
// ============================================================

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
function atualizarDashboard(){ const el = document.getElementById('statLeads'); if(el) el.innerText=leadsCache.filter(l=>l.timestamp && l.timestamp.includes(new Date().toLocaleDateString('pt-BR'))).length; }
function verificarAgendamentosHoje(){const h=new Date().toLocaleDateString('pt-BR');const r=leadsCache.filter(l=>l.agendamento&&l.agendamento.includes(h));if(r.length>0)document.getElementById('lembreteBanner').classList.remove('hidden')}
function filtrarMateriaisBtn(termo) { const input = document.getElementById('searchMateriais'); if(input) { input.value = (termo === 'Todos') ? '' : termo; buscarMateriais(); } }
function buscarMateriais(){const t=document.getElementById('searchMateriais').value.toLowerCase();renderMateriais(materialsCache.filter(m=>m.name.toLowerCase().includes(t)))}
function renderTarefasNoModal(n){const c=document.getElementById('sectionTarefasLead');const l=document.getElementById('listaTarefasLead');const t=tasksCache.filter(x=>x.nomeLead===n&&x.status!=='CONCLUIDA');if(t.length>0){c.classList.remove('hidden');l.innerHTML=t.map(x=>`<div class="bg-blue-50 p-2 text-xs flex gap-2"><input type="checkbox" onchange="toggleTask('${x.id}','${x.status}')"> ${x.descricao}</div>`).join('')}else{c.classList.add('hidden')}}
async function toggleTask(i,s){const t=tasksCache.find(x=>x.id===i);if(t){t.status=s==='PENDENTE'?'CONCLUIDA':'PENDENTE';renderTarefas();if(leadAtualParaAgendar)renderTarefasNoModal(leadAtualParaAgendar.nomeLead)}await apiCall('toggleTask',{taskId:i,status:s,vendedor:loggedUser},false)}
async function carregarTarefas(show=true){if(!navigator.onLine&&tasksCache.length>0){if(show)renderTarefas();return}const r=await apiCall('getTasks',{vendedor:loggedUser},false);if(r.status==='success'){tasksCache=r.data;if(show)renderTarefas()}}
function renderTarefas(){const d=document.getElementById('listaTarefasContainer');if(!d)return;if(tasksCache.length===0){d.innerHTML='<div class="text-center p-5 text-gray-400">Sem tarefas.</div>';return}tasksCache.sort((a,b)=>(a.status==='PENDENTE'?-1:1));d.innerHTML=tasksCache.map(t=>`<div class="bg-white p-3 rounded shadow mb-2 flex gap-3 ${t.status==='CONCLUIDA'?'opacity-50 line-through':''}"><input type="checkbox" ${t.status==='CONCLUIDA'?'checked':''} onchange="toggleTask('${t.id}','${t.status}')" class="w-5 h-5 rounded cursor-pointer"><div class="flex-1 text-sm font-bold text-slate-700">${t.descricao}<div class="text-[10px] text-slate-400">${t.dataLimite||''} ${t.nomeLead?'• '+t.nomeLead:''}</div></div></div>`).join('')}
async function salvarTarefa(){const d=document.getElementById('taskDesc').value;const dt=document.getElementById('taskDate').value;const l=document.getElementById('taskLeadSelect').value;if(!d)return alert("Descrição?");await apiCall('addTask',{vendedor:loggedUser,descricao:d,dataLimite:dt,nomeLead:l});document.getElementById('taskModal').classList.add('hidden');document.getElementById('taskDesc').value='';carregarTarefas()}
function abrirModalTarefa(){document.getElementById('taskModal').classList.remove('hidden');const s=document.getElementById('taskLeadSelect');s.innerHTML='<option value="">Nenhum</option>';leadsCache.forEach(l=>{s.innerHTML+=`<option value="${l.nomeLead}">${l.nomeLead}</option>`})}
async function enviarLead() { const p={vendedor:loggedUser, nomeLead:document.getElementById('leadNome').value, telefone:document.getElementById('leadTelefone').value, endereco:document.getElementById('leadEndereco').value, bairro:document.getElementById('leadBairro').value, cidade:document.getElementById('leadCidade').value, provedor:document.getElementById('leadProvedor').value, interesse:document.getElementById('leadInteresse').value, status:document.getElementById('leadStatus').value, observacao:document.getElementById('leadObs').value, novoVendedor:document.getElementById('leadVendedorDestino')?.value||""}; let r='addLead'; if(editingLeadIndex!==null){ r='updateLeadFull'; p._linha=leadsCache[editingLeadIndex]._linha; p.nomeLeadOriginal=leadsCache[editingLeadIndex].nomeLead; } else if(p.novoVendedor){ r='forwardLead'; p.origem=loggedUser; } const res=await apiCall(r,p); if(res.status==='success'||res.local){alert("Salvo!");localStorage.setItem('mhnet_leads_cache',JSON.stringify(leadsCache));editingLeadIndex=null;navegarPara('gestaoLeads')}else alert("Erro.") }
// Restante das funções de IA e Faltas (Mantenha o código original dessas funções se já as tinha, ou peça para eu completar se faltar algo)
function fecharInstallPrompt() { document.getElementById('installPrompt').classList.add('hidden'); }
async function instalarPWA() { if(window.deferredPrompt) { window.deferredPrompt.prompt(); const {outcome} = await window.deferredPrompt.userChoice; if(outcome==='accepted') document.getElementById('installPrompt').classList.add('hidden'); window.deferredPrompt=null; } }
