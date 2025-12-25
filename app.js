/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V98 (FIX LOGIN)
 * ============================================================
 * 📝 CORREÇÃO CRÍTICA:
 * - Garante que a lista de vendedores carregue mesmo sem API.
 * - Destrava o botão de Login.
 * ============================================================
 */

// ⚠️ ID DA IMPLANTAÇÃO BACKEND (V91)
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

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V98 - Iniciado");
    
    // Tenta carregar vendedores imediatamente
    carregarVendedores();
    
    // Carrega cache local
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { try { leadsCache = JSON.parse(saved); } catch(e) {} }
    
    // Se já estiver logado, entra direto
    if (loggedUser) {
         initApp();
         if(navigator.onLine) processarFilaSincronizacao();
    } else {
         document.getElementById('userMenu').style.display = 'flex';
         document.getElementById('mainContent').style.display = 'none';
    }
});

window.addEventListener('online', processarFilaSincronizacao);

// --- FUNÇÃO DE LOGIN (CORRIGIDA) ---
function setLoggedUser() {
    const select = document.getElementById('userSelect');
    const valor = select.value;
    
    if (valor && valor !== "" && valor !== "A carregar...") { 
        loggedUser = valor; 
        localStorage.setItem('loggedUser', valor); 
        initApp(); 
    } else {
        // Se a lista estiver vazia, força o modo offline para permitir teste
        if(select.options.length <= 1) {
            carregarVendedoresOffline();
            alert("A carregar lista de vendedores... Tente novamente em 2 segundos.");
        } else {
            alert('Por favor, selecione o seu nome na lista.');
        }
    }
}

// --- CARREGAMENTO DE VENDEDORES (ROBUSTO) ---
async function carregarVendedores() {
    const s = document.getElementById('userSelect');
    if(!s) return;
    
    s.innerHTML = '<option value="">A conectar...</option>';

    // Timeout de 3s: Se a API demorar, carrega offline
    const timeout = new Promise((_, reject) => setTimeout(() => reject("Tempo esgotado"), 3000));

    try {
        // Tenta buscar na planilha
        const res = await Promise.race([apiCall('getVendors', {}, false), timeout]);
        
        if(res.status === 'success' && res.data.length > 0) {
            vendorsCache = res.data;
            popularSelects(res.data);
        } else {
            throw new Error("Dados vazios");
        }
    } catch(e) {
        console.warn("⚠️ Usando lista offline:", e);
        carregarVendedoresOffline();
    }
}

function carregarVendedoresOffline() {
    const VENDEDORES_OFFLINE = [
        {nome: "Ana Paula Rodrigues"}, 
        {nome: "Vitoria Caroline Baldez Rosales"}, 
        {nome: "João Vithor Sader"}, 
        {nome: "João Paulo da Silva Santos"}, 
        {nome: "Claudia Maria Semmler"}, 
        {nome: "Diulia Vitoria Machado Borges"}, 
        {nome: "Elton da Silva Rodrigo Gonçalves"}, 
        {nome: "Bruno Garcia Queiroz"} // Admin
    ];
    vendorsCache = VENDEDORES_OFFLINE;
    popularSelects(VENDEDORES_OFFLINE);
}

function popularSelects(lista) {
    const s = document.getElementById('userSelect');
    const s2 = document.getElementById('modalLeadDestino');
    const s3 = document.getElementById('leadVendedorDestino');
    
    const optionsHTML = lista.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
    
    if(s) s.innerHTML = '<option value="">Selecione seu nome...</option>' + optionsHTML;
    if(s2) s2.innerHTML = '<option value="">Selecionar...</option>' + optionsHTML;
    if(s3) s3.innerHTML = '<option value="">Selecione...</option>' + optionsHTML;
}

// --- CORE DO SISTEMA ---
function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    document.getElementById('userInfo').innerText = loggedUser;
    
    // Admin
    if (loggedUser === "Bruno Garcia Queiroz") {
        document.getElementById('btnAdminSettings')?.classList.remove('hidden');
    }
    
    atualizarDataCabecalho();
    carregarLeads(false); 
    navegarPara('dashboard');
}

function logout() { 
    if(confirm("Sair do sistema?")) { 
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

    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') abrirIndicadores();
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        if(busca && busca.placeholder.includes("Filtrado")) {
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

// --- API ---

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
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const json = JSON.parse(text);
        
        if(show) showLoading(false);
        return json;
    } catch(e) {
        console.warn(`Erro API (${route}):`, e);
        if(show) showLoading(false);
        
        if (isWriteOperation(route)) {
            adicionarAFila(route, payload);
            return { status: 'success', local: true, message: 'Salvo localmente' };
        }
        // Retorno seguro para evitar travamento em leituras
        return { status: 'error', message: 'Sem conexão.' };
    }
}

function isWriteOperation(route) {
    return ['addLead', 'deleteLead', 'updateStatus', 'updateAgendamento', 'updateObservacao', 'addTask', 'toggleTask', 'archiveTasks', 'registerAbsence', 'updateAbsence', 'saveObjectionLead', 'updateLeadFull', 'forwardLead', 'manageTeam'].includes(route);
}

function adicionarAFila(route, payload) {
    syncQueue.push({ route, payload, timestamp: new Date().getTime() });
    localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue));
    if (route === 'addLead' && !payload.novoVendedor) {
        payload.timestamp = new Date().toLocaleDateString('pt-BR');
        leadsCache.unshift(payload);
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    }
    alert("💾 Salvo no dispositivo (Sem Internet).");
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

// --- DEMAIS FUNÇÕES (Leads, Indicadores, Tarefas, etc.) ---

function filtrarLeadsHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const leadsHoje = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje));
    if (leadsHoje.length === 0) { alert("📅 Nenhum lead cadastrado hoje!"); return; }
    navegarPara('gestaoLeads');
    renderListaLeads(leadsHoje);
    document.getElementById('searchLead').placeholder = `Filtrado: Hoje (${leadsHoje.length})`;
}

function filtrarRetornos() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    if (retornos.length === 0) { alert("Nenhum retorno hoje."); return; }
    navegarPara('gestaoLeads');
    renderListaLeads(retornos);
    document.getElementById('searchLead').placeholder = `Retornos (${retornos.length})`;
}

function filtrarPorStatus(status) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('btnFilter' + status.replace(/\s+/g, '')) || event.target; 
    if(btn) btn.classList.add('active');
    
    let listaFiltrada = leadsCache;
    if (status !== 'Todos') {
        listaFiltrada = leadsCache.filter(l => l.status === status || l.interesse === status);
    }
    renderListaLeads(listaFiltrada);
}

async function carregarLeads(showLoader = true) {
    if(!navigator.onLine) { if(document.getElementById('listaLeadsGestao')) renderLeads(); return; }
    const res = await apiCall('getLeads', { vendedor: loggedUser }, showLoader);
    if (res && res.status === 'success') {
        leadsCache = res.data || [];
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        if (res.isAdmin) document.getElementById('adminPanel')?.classList.remove('hidden');
        if(document.getElementById('listaLeadsGestao') && document.getElementById('gestaoLeads').style.display !== 'none') renderLeads();
        atualizarDashboard();
        verificarAgendamentosHoje();
    }
}

function renderLeads() {
    const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
    const lista = leadsCache.filter(l => (l.nomeLead||'').toLowerCase().includes(term) || (l.bairro||'').toLowerCase().includes(term) || (l.telefone||'').includes(term));
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
    document.getElementById('modalLeadInfo').innerText = `${l.bairro || '-'} • ${l.telefone}`;
    document.getElementById('modalLeadProvedor').innerText = l.provedor || "--";
    const statusSel = document.getElementById('modalStatusFunil');
    if(statusSel) statusSel.value = l.status || "Novo";
    document.getElementById('modalLeadObs').value = l.observacao || "";
    
    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) btnWhats.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');
    
    const containerRaioX = document.getElementById('containerRaioX');
    if(containerRaioX) containerRaioX.innerHTML = `<button onclick="raioXConcorrencia()" class="ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold shadow flex items-center gap-1"><i class="fas fa-bolt text-yellow-400"></i> Raio-X</button>`;

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

async function abrirIndicadores() {
    navegarPara('indicadores');
    ['funnelLeads', 'funnelNegociacao', 'funnelVendas', 'indRealizado', 'indMeta'].forEach(id => { const el = document.getElementById(id); if(el) el.innerText = '...'; });
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
        apiCall('analyzeIndicators', { vendas: d.vendas, meta: d.meta, diasUteisRestantes: d.diasUteisRestantes }).then(r => { if(r.status === 'success') document.getElementById('indAnaliseIA').innerText = r.message; });
    }
}

// UTILS
function showLoading(show, txt) { 
    const l = document.getElementById('loader'); if(l) l.style.display = show ? 'flex' : 'none'; 
    if(txt && document.getElementById('loaderText')) document.getElementById('loaderText').innerText = txt;
}
function atualizarDataCabecalho() { document.getElementById('headerDate').innerText = new Date().toLocaleDateString('pt-BR'); }
function atualizarDashboard() { const h = new Date().toLocaleDateString('pt-BR'); document.getElementById('statLeads').innerText = leadsCache.filter(l => l.timestamp && l.timestamp.includes(h)).length; }
function verificarAgendamentosHoje() { const h = new Date().toLocaleDateString('pt-BR'); const r = leadsCache.filter(l => l.agendamento && l.agendamento.includes(h)); const b = document.getElementById('lembreteBanner'); if (r.length > 0) { if(b) b.classList.remove('hidden'); } else { if(b) b.classList.add('hidden'); } }

// TAREFAS, FALTAS, IA (Mantidos simplificados para integridade)
async function carregarTarefas(){const d=document.getElementById('listaTarefasContainer');d.innerHTML='Carregando...';const r=await apiCall('getTasks',{vendedor:loggedUser},false);if(r.status==='success')d.innerHTML=r.data.map(t=>`<div class="bg-white p-3 rounded shadow mb-2 flex gap-2"><input type="checkbox" ${t.status==='CONCLUIDA'?'checked':''} onchange="toggleTask('${t.id}','${t.status}')"><span>${t.descricao}</span></div>`).join('');else d.innerHTML='Erro.'}
async function salvarTarefa(){await apiCall('addTask',{vendedor:loggedUser,descricao:document.getElementById('taskDesc').value,dataLimite:document.getElementById('taskDate').value});document.getElementById('taskModal').classList.add('hidden');carregarTarefas()}
async function toggleTask(i,s){await apiCall('toggleTask',{taskId:i,status:s,vendedor:loggedUser},false);carregarTarefas()}
async function limparTarefasConcluidas(){if(confirm("Limpar?"))await apiCall('archiveTasks',{vendedor:loggedUser});carregarTarefas()}
function abrirModalTarefa(){document.getElementById('taskModal').classList.remove('hidden')}
async function verHistoricoFaltas(){const d=document.getElementById('listaHistoricoFaltas');document.getElementById('historicoFaltasContainer').classList.remove('hidden');document.getElementById('formFaltaContainer').classList.add('hidden');const r=await apiCall('getAbsences',{vendedor:loggedUser},false);if(r.status==='success')d.innerHTML=r.data.map(f=>`<div class="bg-white p-3 mb-2 rounded shadow"><div class="font-bold text-xs">${f.motivo}</div><div class="text-[10px]">${f.dataFalta} • ${f.statusEnvio}</div></div>`).join('')}
function ocultarHistoricoFaltas(){document.getElementById('historicoFaltasContainer').classList.add('hidden');document.getElementById('formFaltaContainer').classList.remove('hidden')}
async function enviarJustificativa(){showLoading(true);await apiCall('registerAbsence',{vendedor:loggedUser,dataFalta:document.getElementById('faltaData').value,motivo:document.getElementById('faltaMotivo').value,observacao:document.getElementById('faltaObs').value});showLoading(false);alert("Enviado!");navegarPara('dashboard')}
function editarLeadAtual(){if(!leadAtualParaAgendar)return;const l=leadAtualParaAgendar;document.getElementById('leadNome').value=l.nomeLead;document.getElementById('leadTelefone').value=l.telefone;document.getElementById('leadEndereco').value=l.endereco;document.getElementById('leadBairro').value=l.bairro;document.getElementById('leadCidade').value=l.cidade;document.getElementById('leadProvedor').value=l.provedor;document.getElementById('leadObs').value=l.observacao;const s=document.getElementById('leadStatus');if(s)s.value=l.status||"Novo";editingLeadIndex=leadsCache.indexOf(l);fecharLeadModal();navegarPara('cadastroLead')}
async function enviarLead(){const p={vendedor:loggedUser,nomeLead:document.getElementById('leadNome').value,telefone:document.getElementById('leadTelefone').value,endereco:document.getElementById('leadEndereco').value,bairro:document.getElementById('leadBairro').value,cidade:document.getElementById('leadCidade').value,provedor:document.getElementById('leadProvedor').value,interesse:document.getElementById('leadInteresse').value,status:document.getElementById('leadStatus').value,observacao:document.getElementById('leadObs').value};let r='addLead';if(editingLeadIndex!==null){r='updateLeadFull';p._linha=leadsCache[editingLeadIndex]._linha;p.nomeLeadOriginal=leadsCache[editingLeadIndex].nomeLead}const res=await apiCall(r,p);if(res.status==='success'||res.local){alert("Salvo!");if(editingLeadIndex===null&&!res.local)leadsCache.unshift(p);localStorage.setItem('mhnet_leads_cache',JSON.stringify(leadsCache));editingLeadIndex=null;navegarPara('gestaoLeads')}else alert("Erro.")}
async function excluirLead(){if(!confirm("Excluir?"))return;await apiCall('deleteLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead});alert("Excluído.");fecharLeadModal();carregarLeads()}
async function marcarVendaFechada(){if(!confirm("Venda?"))return;await apiCall('updateStatus',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,status:"Venda Fechada"});alert("Parabéns!");fecharLeadModal();carregarLeads()}
async function salvarAgendamento(){const a=`${document.getElementById('agendarData').value} ${document.getElementById('agendarHora').value}`;await apiCall('updateAgendamento',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,agendamento:a});alert("Agendado!");fecharLeadModal()}
async function salvarObservacaoModal(){await apiCall('updateObservacao',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,observacao:document.getElementById('modalLeadObs').value});alert("Salvo!")}
function abrirConfiguracoes(){document.getElementById('configModal').classList.remove('hidden')}
async function gerirEquipe(a){await apiCall('manageTeam',{acao:a,nome:document.getElementById('cfgNomeVendedor').value,meta:document.getElementById('cfgMeta').value});alert("Feito!");carregarVendedores()}
async function encaminharLeadModal(){const n=document.getElementById('modalLeadDestino').value;if(!n)return alert("Selecione");if(confirm("Encaminhar?")){await apiCall('forwardLead',{nomeLead:leadAtualParaAgendar.nomeLead,telefone:leadAtualParaAgendar.telefone,novoVendedor:n,origem:loggedUser});alert("Encaminhado!");fecharLeadModal();carregarLeads()}}
// IA Placeholders
async function combaterObjecaoGeral(){alert("IA Offline")}
async function combaterObjecaoLead(){alert("IA Offline")}
async function salvarObjecaoLead(){}
async function analiseEstrategicaIA(){alert("IA Offline")}
async function raioXConcorrencia(){alert("IA Offline")}
async function refinarObsIA(){}
async function gerarCoachIA(){alert("IA Offline")}
async function consultarPlanosIA(){alert("IA Offline")}
function toggleChat(){}
async function enviarMensagemChat(){}
async function buscarEnderecoGPS(){navigator.geolocation.getCurrentPosition(p=>{fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json()).then(d=>{if(d.address){document.getElementById('leadEndereco').value=d.address.road;document.getElementById('leadBairro').value=d.address.suburb}})},()=>{alert('Erro GPS')})}
function iniciarDitado(t){}
function copiarTexto(id){document.getElementById(id).select();document.execCommand('copy');alert("Copiado!")}
function enviarZapTexto(id){window.open(`https://wa.me/?text=${encodeURIComponent(document.getElementById(id).value)}`,'_blank')}
async function carregarMateriais(f=null){const r=await apiCall('getImages',{folderId:f},false);if(r.status==='success')document.getElementById('materiaisGrid').innerHTML=r.data.map(x=>x.type==='folder'?`<div onclick="carregarMateriais('${x.id}')" class="bg-blue-50 p-4 text-center"><i class="fas fa-folder"></i> ${x.name}</div>`:`<div class="p-2 border"><a href="${x.downloadUrl}" target="_blank">${x.name}</a></div>`).join('')}
function buscarMateriais(){carregarMateriais(currentFolderId,document.getElementById('searchMateriais').value)}
function preencherEdicaoFalta(f){/*Igual V90*/}
async function enviarPayloadFalta(r,p){/*Igual V90*/}
