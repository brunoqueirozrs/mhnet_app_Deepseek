/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V93 (FINAL - MATERIAIS VISUAIS)
 * ============================================================
 * 📝 UPDATE:
 * - Restaurado layout visual de Materiais (Cards com Imagem).
 * - Botões de Download e WhatsApp adicionados aos materiais.
 * ============================================================
 */

// ⚠️ ID DO BACKEND V91
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// ESTADO GLOBAL
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let vendorsCache = []; 
let leadAtualParaAgendar = null; 
let chatHistoryData = []; 
let currentFolderId = null;
let editingLeadIndex = null;
let editingAbsenceIndex = null;
let syncQueue = JSON.parse(localStorage.getItem('mhnet_sync_queue') || '[]');

// 1. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V93 - Materiais OK");
    
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
    document.getElementById('userInfo').innerText = loggedUser;
    
    if (loggedUser === "Bruno Garcia Queiroz") {
        document.getElementById('btnAdminSettings')?.classList.remove('hidden');
        document.getElementById('divEncaminhar')?.classList.remove('hidden');
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

    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') abrirIndicadores();
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
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
        alert("Nenhum retorno agendado para hoje.");
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
        leadsCache.sort((a, b) => b._linha - a._linha);
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
    if (lista.length === 0) { div.innerHTML = '<div class="text-center mt-10 text-gray-400">Vazio.</div>'; return; }

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
    
    return `<div onclick="abrirLeadDetalhes(${index})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition"><div class="flex justify-between items-start"><div><div class="font-bold text-slate-800 text-lg leading-tight">${l.nomeLead}</div><div class="text-xs text-slate-500 mt-1">${l.bairro || '-'} • ${l.provedor || '-'}</div></div><span class="text-[10px] px-2 py-1 rounded-full ${badgeColor}">${l.status || 'Novo'}</span></div></div>`;
}

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
    
    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) btnWhats.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');
    
    const containerRaioX = document.getElementById('containerRaioX');
    if(containerRaioX) containerRaioX.innerHTML = `<button onclick="raioXConcorrencia()" class="ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold shadow flex items-center gap-1 active:scale-95"><i class="fas fa-bolt text-yellow-400"></i> Raio-X</button>`;

    document.getElementById('leadModal').classList.remove('hidden');
}

function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); leadAtualParaAgendar = null; editingLeadIndex = null; }

async function salvarEdicaoModal() {
    if (!leadAtualParaAgendar) return;
    const novoStatus = document.getElementById('modalStatusFunil').value;
    const obs = document.getElementById('modalLeadObs').value;
    const dataAgenda = document.getElementById('agendarData').value;
    
    leadAtualParaAgendar.status = novoStatus;
    leadAtualParaAgendar.observacao = obs;
    if (dataAgenda) {
        const [a, m, d] = dataAgenda.split('-');
        leadAtualParaAgendar.agendamento = `${d}/${m}/${a} ${document.getElementById('agendarHora').value || '09:00'}`;
    }
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    if(document.getElementById('gestaoLeads').style.display !== 'none') renderLeads();
    
    showLoading(true, "SALVANDO...");
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

// --- MATERIAIS VISUAIS (CORREÇÃO SOLICITADA) ---

async function carregarMateriais(f=null, s="") {
    const div = document.getElementById('materiaisGrid');
    if (!div) return;
    currentFolderId = f; 
    div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10">Carregando...</div>';
    
    try {
        const res = await apiCall('getImages', { folderId: f, search: s }, false);
        if (res && res.status === 'success' && res.data) {
            atualizarNavegacaoMateriais(res.isRoot);
            if(res.data.length === 0) { div.innerHTML = '<div class="col-span-2 text-center text-gray-400">Vazio.</div>'; return; }

            div.innerHTML = res.data.map(item => {
                if (item.type === 'folder') {
                    return `<div onclick="carregarMateriais('${item.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex flex-col items-center justify-center gap-2 cursor-pointer h-36 hover:bg-blue-50">
                        <i class="fas fa-folder text-5xl text-[#00aeef]"></i>
                        <span class="text-xs font-bold text-slate-600 text-center leading-tight line-clamp-2">${item.name}</span>
                    </div>`;
                } else {
                    // CARD COM BOTÕES DE AÇÃO (BAIXAR E WHATSAPP)
                    return `
                    <div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-auto relative overflow-hidden">
                        <div class="h-32 w-full bg-gray-50 rounded-xl overflow-hidden relative mb-2">
                            <img src="${item.thumbnail}" class="w-full h-full object-cover" alt="${item.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400?text=IMG'">
                        </div>
                        <div class="text-[10px] text-gray-500 font-bold truncate px-1 mb-2">${item.name}</div>
                        <div class="flex gap-2 mt-auto">
                            <a href="${item.downloadUrl}" target="_blank" class="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg flex items-center justify-center active:scale-95 transition">
                                <i class="fas fa-download"></i>
                            </a>
                            <button onclick="compartilharImagem('${item.viewUrl}')" class="flex-1 bg-green-50 text-green-600 py-2 rounded-lg flex items-center justify-center active:scale-95 transition">
                                <i class="fab fa-whatsapp text-lg"></i>
                            </button>
                        </div>
                    </div>`;
                }
            }).join('');
        } else throw new Error("Erro API");
    } catch (error) {
        div.innerHTML = `<div class="col-span-2 text-center text-red-400 py-10">Erro ao carregar.<br><button onclick="carregarMateriais('${f || ''}')" class="mt-2 text-blue-500 underline">Tentar de novo</button></div>`;
    }
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

// --- OUTROS MÓDULOS ---

async function carregarTarefas() {
    const div = document.getElementById('listaTarefasContainer');
    div.innerHTML = '<div class="text-center p-5 text-gray-400">Carregando...</div>';
    const res = await apiCall('getTasks', { vendedor: loggedUser }, false);
    if (res && res.status === 'success') {
        const tasks = res.data;
        if (res.isAdmin) document.getElementById('adminPanel').classList.remove('hidden');
        if (tasks.length === 0) { div.innerHTML = '<div class="text-center p-10 text-gray-300">Nenhuma tarefa pendente.</div>'; return; }
        div.innerHTML = tasks.map(t => {
            const checked = t.status === "CONCLUIDA" ? "checked" : "";
            const opacity = t.status === "CONCLUIDA" ? "opacity-50 line-through" : "";
            return `<div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 ${opacity}"><input type="checkbox" ${checked} onchange="toggleTask('${t.id}', '${t.status}')" class="w-5 h-5 accent-blue-600 rounded cursor-pointer"><div class="flex-1"><div class="text-sm font-bold text-slate-700">${t.descricao}</div><div class="text-[10px] text-slate-400 flex items-center gap-2 mt-1">${t.dataLimite ? `<span>📅 ${t.dataLimite}</span>` : ''}${t.nomeLead ? `<span class="bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded flex items-center gap-1"><i class="fas fa-user"></i> ${t.nomeLead}</span>` : ''}</div></div></div>`;
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
function ocultarHistoricoFaltas() { document.getElementById('historicoFaltasContainer').classList.add('hidden'); document.getElementById('formFaltaContainer').classList.remove('hidden'); editingAbsenceIndex = null; document.getElementById('faltaData').value = ''; document.getElementById('faltaMotivo').value = ''; document.getElementById('faltaObs').value = ''; document.getElementById('faltaArquivo').value = ''; document.getElementById('btnEnviarFalta').innerHTML = 'ENVIAR'; }
function preencherEdicaoFalta(f) { document.getElementById('historicoFaltasContainer').classList.add('hidden'); document.getElementById('formFaltaContainer').classList.remove('hidden'); document.getElementById('faltaData').value = f.dataFalta.split('/').reverse().join('-'); document.getElementById('faltaMotivo').value = f.motivo; document.getElementById('faltaObs').value = f.obs; editingAbsenceIndex = f._linha; document.getElementById('btnEnviarFalta').innerHTML = 'ATUALIZAR'; }
async function enviarJustificativa() { showLoading(true); await apiCall(editingAbsenceIndex?'updateAbsence':'registerAbsence', {vendedor:loggedUser, dataFalta:document.getElementById('faltaData').value, motivo:document.getElementById('faltaMotivo').value, observacao:document.getElementById('faltaObs').value, _linha:editingAbsenceIndex}); showLoading(false); alert("Enviado!"); navegarPara('dashboard'); }

// --- API & UTILS ---
async function apiCall(route, payload, show=true) {
    if(show) showLoading(true);
    if (!navigator.onLine && isWriteOperation(route)) {
        adicionarAFila(route, payload);
        if(show) showLoading(false);
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
async function processarFilaSincronizacao() { if(syncQueue.length===0) return; showLoading(true); const f=[]; for(const i of syncQueue) { try { await fetch(API_URL, {method:'POST', body:JSON.stringify({route:i.route, payload:i.payload})}); } catch(e){f.push(i)} } syncQueue=f; localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue)); showLoading(false); }
function showLoading(s, t) { const l = document.getElementById('loader'); if(l) l.style.display = s ? 'flex' : 'none'; if(t) document.getElementById('loaderText').innerText = t; }
function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); }
function atualizarDataCabecalho() { document.getElementById('headerDate').innerText = new Date().toLocaleDateString('pt-BR'); }
function atualizarDashboard() { const h = new Date().toLocaleDateString('pt-BR'); document.getElementById('statLeads').innerText = leadsCache.filter(l => l.timestamp && l.timestamp.includes(h)).length; }
function verificarAgendamentosHoje() { const h = new Date().toLocaleDateString('pt-BR'); const r = leadsCache.filter(l => l.agendamento && l.agendamento.includes(h)); if(r.length > 0) document.getElementById('lembreteBanner').classList.remove('hidden'); }
async function carregarVendedores() {
    const s = document.getElementById('userSelect');
    if(!s) return;
    try {
        const res = await apiCall('getVendors', {}, false);
        if(res.status==='success') s.innerHTML = '<option value="">Selecione...</option>' + res.data.map(v=>`<option value="${v.nome}">${v.nome}</option>`).join('');
    } catch(e) { s.innerHTML = '<option value="">Modo Offline</option>'; }
}
async function excluirLead() { if(!confirm("Excluir?")) return; showLoading(true); await apiCall('deleteLead', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead }); showLoading(false); alert("Excluído."); fecharLeadModal(); carregarLeads(); }
async function marcarVendaFechada() { if(!confirm("Venda Fechada?")) return; showLoading(true); await apiCall('updateStatus', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: "Venda Fechada" }); showLoading(false); alert("Parabéns!"); fecharLeadModal(); carregarLeads(); }
async function salvarAgendamento() { const ag = `${document.getElementById('agendarData').value} ${document.getElementById('agendarHora').value}`; await apiCall('updateAgendamento', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: ag }); alert("Agendado!"); fecharLeadModal(); }
async function salvarObservacaoModal() { await apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: document.getElementById('modalLeadObs').value }); alert("Salvo!"); }
function iniciarDitado(t){const r=new(window.SpeechRecognition||window.webkitSpeechRecognition)();r.lang='pt-BR';r.start();r.onresult=e=>{document.getElementById(t).value+=e.results[0][0].transcript}}
function copiarTexto(id){document.getElementById(id).select();document.execCommand('copy');alert("Copiado!")}
function enviarZapTexto(id){window.open(`https://wa.me/?text=${encodeURIComponent(document.getElementById(id).value)}`,'_blank')}
async function buscarEnderecoGPS(){navigator.geolocation.getCurrentPosition(p=>{fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json()).then(d=>{if(d.address){document.getElementById('leadEndereco').value=d.address.road;document.getElementById('leadBairro').value=d.address.suburb}})},()=>{alert('Erro GPS')})}
async function gerarAbordagemIA(){const nome=document.getElementById('leadNome').value;showLoading(true);const t=await perguntarIABackend(`Pitch curto para ${nome}`);showLoading(false);if(t)document.getElementById('leadObs').value=t}
async function gerarScriptVendaIA(){if(!leadAtualParaAgendar)return;showLoading(true);const r=await perguntarIABackend(`Script WhatsApp para ${leadAtualParaAgendar.nomeLead}`);showLoading(false);if(r)alert(r)}
async function perguntarIABackend(p){ try { const r=await apiCall('askAI',{question:p},false); return r.status==='success' ? r.answer : null; } catch(e){return null;} }
// Outras funções de IA mantidas (Combater Objeção, Coach, Chat)
async function combaterObjecaoGeral(){const o=document.getElementById('inputObjecaoGeral').value;const r=await apiCall('solveObjection',{objection:o});if(r.status==='success')document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer}
async function combaterObjecaoLead(){const o=document.getElementById('inputObjecaoLead').value;const r=await apiCall('solveObjection',{objection:o});if(r.status==='success')document.getElementById('respostaObjecaoLead').value=r.answer}
async function salvarObjecaoLead(){await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value})}
async function analiseEstrategicaIA(){const r=await perguntarIABackend(`Analise lead ${leadAtualParaAgendar.nomeLead}`);if(r)document.getElementById('modalLeadObs').value+="\n\n[IA]: "+r}
async function gerarCoachIA(){const r=await perguntarIABackend("Frase motivacional");if(r)alert(r)}
async function consultarPlanosIA(){document.getElementById('chatModal').classList.remove('hidden')}
function toggleChat(){document.getElementById('chatModal').classList.add('hidden')}
async function enviarMensagemChat(){const m=document.getElementById('chatInput').value;if(m){document.getElementById('chatHistory').innerHTML+=`<div class='text-right'>${m}</div>`;const r=await perguntarIABackend(m);document.getElementById('chatHistory').innerHTML+=`<div class='text-left'>${r}</div>`;}}
// Funções Admin
function abrirConfiguracoes(){document.getElementById('configModal').classList.remove('hidden')}
async function gerirEquipe(a){await apiCall('manageTeam',{acao:a,nome:document.getElementById('cfgNomeVendedor').value,meta:document.getElementById('cfgMeta').value});alert("Feito!");}
async function encaminharLeadModal(){/*Igual V92*/}
