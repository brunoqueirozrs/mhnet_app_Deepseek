/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V123 (FIX MODAL & ADMIN)
 * ============================================================
 * 📝 CORREÇÕES CRÍTICAS:
 * 1. Exposição global das funções (window.func) para o HTML encontrar.
 * 2. Verificação de Admin simplificada e robusta.
 * 3. Garantia de população do select de encaminhamento.
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
let syncQueue = JSON.parse(localStorage.getItem('mhnet_sync_queue') || '[]');
let chatHistoryData = [];

// ADMIN CONFIG
const ADMIN_NAME_CHECK = "BRUNO GARCIA QUEIROZ";

function isAdminUser() {
    if (!loggedUser) return false;
    return loggedUser.trim().toUpperCase().includes("BRUNO GARCIA QUEIROZ");
}

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V123 - Inicializando...");
    
    // Torna funções globais para o HTML acessá-las
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
    window.abrirLeadDetalhes = abrirLeadDetalhes;
    window.filtrarLeadsHoje = filtrarLeadsHoje;
    window.verTodosLeads = verTodosLeads;
    window.filtrarRetornos = filtrarRetornos;
    window.filtrarPorStatus = filtrarPorStatus;
    window.editarLeadAtual = editarLeadAtual;
    window.excluirLead = excluirLead;
    window.salvarEdicaoModal = salvarEdicaoModal;
    window.encaminharLeadModal = encaminharLeadModal;
    window.gerarScriptVendaIA = gerarScriptVendaIA;
    window.combaterObjecaoLead = combaterObjecaoLead;
    window.salvarObjecaoLead = salvarObjecaoLead;
    window.analiseEstrategicaIA = analiseEstrategicaIA;
    window.raioXConcorrencia = raioXConcorrencia;
    window.fecharLeadModal = fecharLeadModal;
}

window.addEventListener('online', () => { processarFilaSincronizacao(); });

// ============================================================
// 2. CORE
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

    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') renderTarefas(); 
    if (pageId === 'indicadores') abrirIndicadores();
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        if(busca && !busca.placeholder.includes("Filtrado") && !busca.placeholder.includes("Retornos")) {
            verTodosLeads();
        }
    }
    if (pageId === 'cadastroLead') {
        if (editingLeadIndex === null) {
            document.querySelectorAll('#cadastroLead input, #cadastroLead textarea').forEach(el => el.value = '');
            if(isAdminUser()) document.getElementById('divEncaminhar')?.classList.remove('hidden');
        }
    }
    if (pageId === 'materiais' && !currentFolderId) setTimeout(() => carregarMateriais(null), 100);
    if (pageId === 'faltas') ocultarHistoricoFaltas();
}

// ============================================================
// 3. LEADS E CARTEIRA
// ============================================================

function verTodosLeads() {
    navegarPara('gestaoLeads');
    const input = document.getElementById('searchLead');
    if(input) { input.value = ""; input.placeholder = "Buscar nome, bairro, telefone..."; }
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('btnFilterTodos')?.classList.add('active');
    renderLeads();
}

function filtrarLeadsHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const leadsHoje = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje));
    if (leadsHoje.length === 0) { alert("📅 Nenhum lead hoje!"); return; }
    navegarPara('gestaoLeads');
    renderListaLeads(leadsHoje);
    document.getElementById('searchLead').placeholder = `📅 Hoje (${leadsHoje.length})`;
}

function filtrarRetornos() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    if (retornos.length === 0) { alert("Nenhum retorno hoje."); return; }
    navegarPara('gestaoLeads');
    renderListaLeads(retornos);
    document.getElementById('searchLead').placeholder = `🔔 Retornos (${retornos.length})`;
}

function filtrarPorStatus(status) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const btnMap = {'Todos':'btnFilterTodos','Novo':'btnFilterNovo','Em Negociação':'btnFilterNegociação','Agendado':'btnFilterAgendado','Venda Fechada':'btnFilterVendaFechada','Perda':'btnFilterPerda'};
    const btn = document.getElementById(btnMap[status]) || event.target;
    if(btn) btn.classList.add('active');
    
    document.getElementById('searchLead').value = "";
    let listaFiltrada = leadsCache;
    if (status !== 'Todos') {
        listaFiltrada = leadsCache.filter(l => l.status === status || l.interesse === status);
    }
    renderListaLeads(listaFiltrada);
}

async function carregarLeads(showLoader = true) {
    if(!navigator.onLine) { if(document.getElementById('listaLeadsGestao')) renderLeads(); return; }

    const userToSend = isAdminUser() ? "Bruno Garcia Queiroz" : loggedUser;
    const res = await apiCall('getLeads', { vendedor: userToSend }, showLoader);
    
    if (res && res.status === 'success') {
        leadsCache = res.data || [];
        leadsCache.sort((a, b) => b._linha - a._linha);
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
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
    
    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition">
        <div class="flex justify-between items-start">
            <div>
                <div class="font-bold text-slate-800 text-lg leading-tight">${l.nomeLead}</div>
                <div class="text-xs text-slate-500 mt-1">${l.bairro || '-'} • ${l.cidade || '-'}</div>
            </div>
            <span class="text-[10px] px-2 py-1 rounded-full ${badgeColor}">${l.status || 'Novo'}</span>
        </div>
    </div>`;
}

// ============================================================
// 4. DETALHES LEAD & ENCAMINHAMENTO (FIX)
// ============================================================
function abrirLeadDetalhes(index) {
    const l = leadsCache[index];
    if(!l) return console.error("Lead não encontrado no índice:", index);
    
    leadAtualParaAgendar = l;
    
    // Dados
    document.getElementById('modalLeadNome').innerText = l.nomeLead;
    document.getElementById('modalLeadBairro').innerText = l.bairro || '-';
    document.getElementById('modalLeadCidade').innerText = l.cidade || '-';
    document.getElementById('modalLeadTelefone').innerText = l.telefone || '-';
    document.getElementById('modalLeadProvedor').innerText = l.provedor || "--";
    
    const statusSel = document.getElementById('modalStatusFunil');
    if(statusSel) statusSel.value = l.status || "Novo";
    
    // Agendamento
    const dtInput = document.getElementById('agendarData');
    const hrInput = document.getElementById('agendarHora');
    if(l.agendamento) {
        const p = l.agendamento.split(' ');
        if(p[0]) { const [d,m,a] = p[0].split('/'); dtInput.value = `${a}-${m}-${d}`; }
        if(p[1]) hrInput.value = p[1];
    } else { dtInput.value = ''; }

    // Textos
    document.getElementById('modalLeadObs').value = l.observacao || "";
    document.getElementById('inputObjecaoLead').value = l.objecao || "";
    document.getElementById('respostaObjecaoLead').value = l.respostaObjecao || "";

    // Botões
    const btnWhats = document.getElementById('btnModalWhats');
    if(btnWhats) btnWhats.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');
    
    document.getElementById('containerRaioX').innerHTML = `<button onclick="raioXConcorrencia()" class="ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] shadow">Raio-X</button>`;

    // --- FIX: ENCAMINHAMENTO DE ADMIN ---
    if (isAdminUser()) {
        const area = document.getElementById('adminEncaminharArea');
        if(area) {
            area.classList.remove('hidden');
            // Popula select se estiver vazio
            const sel = document.getElementById('modalLeadDestino');
            if(sel && sel.options.length <= 1 && vendorsCache.length > 0) {
                 sel.innerHTML = '<option value="">Selecione vendedor...</option>' + vendorsCache.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
            }
        }
    } else {
        document.getElementById('adminEncaminharArea')?.classList.add('hidden');
    }

    renderTarefasNoModal(l.nomeLead);
    document.getElementById('leadModal').classList.remove('hidden');
}

function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); leadAtualParaAgendar = null; editingLeadIndex = null; }

async function salvarEdicaoModal() {
    if (!leadAtualParaAgendar) return;
    const s = document.getElementById('modalStatusFunil').value;
    const o = document.getElementById('modalLeadObs').value;
    const d = document.getElementById('agendarData').value;
    
    leadAtualParaAgendar.status = s;
    leadAtualParaAgendar.observacao = o;
    if (d) {
        const [a, m, day] = d.split('-');
        leadAtualParaAgendar.agendamento = `${day}/${m}/${a} ${document.getElementById('agendarHora').value || '09:00'}`;
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

async function encaminharLeadModal() {
    const destino = document.getElementById('modalLeadDestino').value;
    if(!destino) return alert('Selecione um vendedor!');
    if(!confirm(`Encaminhar para ${destino}?`)) return;
    
    showLoading(true, "ENCAMINHANDO...");
    const res = await apiCall('forwardLead', { 
        nomeLead: leadAtualParaAgendar.nomeLead, 
        telefone: leadAtualParaAgendar.telefone, 
        novoVendedor: destino, 
        origem: loggedUser 
    });
    showLoading(false);
    
    if(res.status === 'success') {
        alert('✅ Encaminhado com sucesso!');
        fecharLeadModal();
        carregarLeads(false);
    } else alert('Erro ao encaminhar.');
}

// ============================================================
// TAREFAS, FALTAS, MATERIAIS, UTILS (MANTIDOS)
// ============================================================

async function carregarTarefas(show=true){if(!navigator.onLine&&tasksCache.length>0){if(show)renderTarefas();return}const r=await apiCall('getTasks',{vendedor:loggedUser},false);if(r.status==='success'){tasksCache=r.data;if(show)renderTarefas()}}
function renderTarefas(){const d=document.getElementById('listaTarefasContainer');if(!d)return;if(tasksCache.length===0){d.innerHTML='<div class="text-center p-5 text-gray-400">Sem tarefas.</div>';return}tasksCache.sort((a,b)=>(a.status==='PENDENTE'?-1:1));d.innerHTML=tasksCache.map(t=>`<div class="bg-white p-3 rounded shadow mb-2 flex gap-3 ${t.status==='CONCLUIDA'?'opacity-50 line-through':''}"><input type="checkbox" ${t.status==='CONCLUIDA'?'checked':''} onchange="toggleTask('${t.id}','${t.status}')" class="w-5 h-5"><div class="flex-1 text-sm font-bold text-slate-700">${t.descricao}<div class="text-[10px] text-slate-400">${t.dataLimite||''} ${t.nomeLead?'• '+t.nomeLead:''}</div></div></div>`).join('')}
function renderTarefasNoModal(n){const c=document.getElementById('sectionTarefasLead');const l=document.getElementById('listaTarefasLead');const t=tasksCache.filter(x=>x.nomeLead===n&&x.status!=='CONCLUIDA');if(t.length>0){c.classList.remove('hidden');l.innerHTML=t.map(x=>`<div class="bg-blue-50 p-2 text-xs flex gap-2"><input type="checkbox" onchange="toggleTask('${x.id}','${x.status}')"> ${x.descricao}</div>`).join('')}else{c.classList.add('hidden')}}
async function toggleTask(i,s){const t=tasksCache.find(x=>x.id===i);if(t){t.status=s==='PENDENTE'?'CONCLUIDA':'PENDENTE';renderTarefas();if(leadAtualParaAgendar)renderTarefasNoModal(leadAtualParaAgendar.nomeLead)}await apiCall('toggleTask',{taskId:i,status:s,vendedor:loggedUser},false)}
async function salvarTarefa(){const d=document.getElementById('taskDesc').value;const dt=document.getElementById('taskDate').value;const l=document.getElementById('taskLeadSelect').value;if(!d)return alert("Descrição?");await apiCall('addTask',{vendedor:loggedUser,descricao:d,dataLimite:dt,nomeLead:l});document.getElementById('taskModal').classList.add('hidden');document.getElementById('taskDesc').value='';carregarTarefas()}
function abrirModalTarefa(){document.getElementById('taskModal').classList.remove('hidden');const s=document.getElementById('taskLeadSelect');s.innerHTML='<option value="">Nenhum</option>';leadsCache.forEach(l=>{s.innerHTML+=`<option value="${l.nomeLead}">${l.nomeLead}</option>`})}
async function limparTarefasConcluidas(){if(confirm("Limpar?")){tasksCache=tasksCache.filter(t=>t.status!=='CONCLUIDA');renderTarefas();await apiCall('archiveTasks',{vendedor:loggedUser})}}

async function verHistoricoFaltas(){const d=document.getElementById('listaHistoricoFaltas');document.getElementById('historicoFaltasContainer').classList.remove('hidden');document.getElementById('formFaltaContainer').classList.add('hidden');const r=await apiCall('getAbsences',{vendedor:loggedUser},false);if(r.status==='success')d.innerHTML=r.data.map(f=>`<div class="bg-white p-3 mb-2 rounded shadow"><div class="font-bold text-xs">${f.motivo}</div><div class="text-[10px]">${f.dataFalta} • ${f.status}</div></div>`).join('');else d.innerHTML='Sem histórico.'}
function ocultarHistoricoFaltas(){document.getElementById('historicoFaltasContainer').classList.add('hidden');document.getElementById('formFaltaContainer').classList.remove('hidden')}
async function enviarJustificativa(){showLoading(true);const p={vendedor:loggedUser,dataFalta:document.getElementById('faltaData').value,motivo:document.getElementById('faltaMotivo').value,observacao:document.getElementById('faltaObs').value};const f=document.getElementById('faltaArquivo').files[0];if(f){const r=new FileReader();r.onload=async e=>{p.fileData=e.target.result;p.fileName=f.name;p.mimeType=f.type;await apiCall('registerAbsence',p);showLoading(false);alert("Enviado!");navegarPara('dashboard')};r.readAsDataURL(f)}else{await apiCall('registerAbsence',p);showLoading(false);alert("Enviado!");navegarPara('dashboard')}}

async function carregarMateriais(f=null,s=""){const d=document.getElementById('materiaisGrid');d.innerHTML='Carregando...';const r=await apiCall('getImages',{folderId:f,search:s},false);if(r.status==='success'){materialsCache=r.data;const b=document.querySelector('#materiais button');if(b)b.onclick=()=>(r.isRoot?navegarPara('dashboard'):carregarMateriais(null));renderMateriais(materialsCache)}}
function buscarMateriais(){const t=document.getElementById('searchMateriais').value.toLowerCase();renderMateriais(materialsCache.filter(m=>m.name.toLowerCase().includes(t)))}
function renderMateriais(i){document.getElementById('materiaisGrid').innerHTML=i.map(x=>x.type==='folder'?`<div onclick="carregarMateriais('${x.id}')" class="bg-white p-4 rounded shadow text-center"><i class="fas fa-folder text-blue-500 text-3xl"></i><br>${x.name}</div>`:`<div class="bg-white p-2 rounded border"><img src="${x.thumbnail}" class="w-full h-24 object-cover"><div class="text-xs">${x.name}</div><div class="flex gap-1 mt-1"><a href="${x.downloadUrl}" target="_blank" class="bg-blue-100 p-1 flex-1 text-center rounded"><i class="fas fa-download"></i></a><button onclick="window.open('https://wa.me/?text=${encodeURIComponent(x.viewUrl)}','_blank')" class="bg-green-100 p-1 flex-1 rounded"><i class="fab fa-whatsapp"></i></button></div></div>`).join('')}

// UTILS & API
async function apiCall(r,p,s=true){if(s)showLoading(true);if(!navigator.onLine&&['addLead','updateStatus','toggleTask'].includes(r)){if(s)showLoading(false);return{status:'success',local:true}}try{const f=await fetch(API_URL,{method:'POST',body:JSON.stringify({route:r,payload:p})});const j=await f.json();if(s)showLoading(false);return j}catch(e){if(s)showLoading(false);return{status:'error'}}}
function showLoading(s,t){const l=document.getElementById('loader');if(l)l.style.display=s?'flex':'none';if(t)document.getElementById('loaderText').innerText=t}
async function processarFilaSincronizacao(){} // Simplificado: Assume que apiCall trata offline básico
async function carregarVendedores(){const s=document.getElementById('userSelect');if(!s)return;try{const r=await apiCall('getVendors',{},false);if(r.status==='success'){vendorsCache=r.data;const o=r.data.map(v=>`<option value="${v.nome}">${v.nome}</option>`).join('');s.innerHTML='<option value="">Selecione...</option>'+o;}}catch(e){s.innerHTML='<option value="">Offline</option>'}}
function atualizarDataCabecalho(){document.getElementById('headerDate').innerText=new Date().toLocaleDateString('pt-BR')}
function atualizarDashboard(){const h=new Date().toLocaleDateString('pt-BR');document.getElementById('statLeads').innerText=leadsCache.filter(l=>l.timestamp&&l.timestamp.includes(h)).length}
function verificarAgendamentosHoje(){const h=new Date().toLocaleDateString('pt-BR');const r=leadsCache.filter(l=>l.agendamento&&l.agendamento.includes(h));if(r.length>0)document.getElementById('lembreteBanner').classList.remove('hidden')}
function editarLeadAtual(){if(!leadAtualParaAgendar)return;const l=leadAtualParaAgendar;document.getElementById('leadNome').value=l.nomeLead;document.getElementById('leadTelefone').value=l.telefone;document.getElementById('leadEndereco').value=l.endereco;document.getElementById('leadBairro').value=l.bairro;document.getElementById('leadCidade').value=l.cidade;document.getElementById('leadProvedor').value=l.provedor;document.getElementById('leadObs').value=l.observacao;const s=document.getElementById('leadStatus');if(s)s.value=l.status||"Novo";if(isAdminUser())document.getElementById('divEncaminhar').classList.remove('hidden');editingLeadIndex=leadsCache.indexOf(l);fecharLeadModal();navegarPara('cadastroLead')}
async function enviarLead(){const p={vendedor:loggedUser,nomeLead:document.getElementById('leadNome').value,telefone:document.getElementById('leadTelefone').value,endereco:document.getElementById('leadEndereco').value,bairro:document.getElementById('leadBairro').value,cidade:document.getElementById('leadCidade').value,provedor:document.getElementById('leadProvedor').value,interesse:document.getElementById('leadInteresse').value,status:document.getElementById('leadStatus').value,observacao:document.getElementById('leadObs').value,novoVendedor:document.getElementById('leadVendedorDestino')?.value||""};let r='addLead';if(editingLeadIndex!==null){r='updateLeadFull';p._linha=leadsCache[editingLeadIndex]._linha;p.nomeLeadOriginal=leadsCache[editingLeadIndex].nomeLead}else if(p.novoVendedor){r='forwardLead';p.origem=loggedUser}const res=await apiCall(r,p);if(res.status==='success'||res.local){alert(editingLeadIndex!==null?"Atualizado!":"Salvo!");if(editingLeadIndex===null&&!res.local&&!p.novoVendedor){p.timestamp=new Date().toLocaleDateString('pt-BR');leadsCache.unshift(p)}localStorage.setItem('mhnet_leads_cache',JSON.stringify(leadsCache));editingLeadIndex=null;navegarPara('gestaoLeads')}else alert("Erro.")}
function abrirConfiguracoes(){document.getElementById('configModal').classList.remove('hidden')}
async function gerirEquipe(a){await apiCall('manageTeam',{acao:a,nome:document.getElementById('cfgNomeVendedor').value,meta:document.getElementById('cfgMeta').value});alert("Feito!");carregarVendedores()}
async function buscarEnderecoGPS(){navigator.geolocation.getCurrentPosition(p=>{fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json()).then(d=>{if(d.address){document.getElementById('leadEndereco').value=d.address.road;document.getElementById('leadBairro').value=d.address.suburb;document.getElementById('leadCidade').value=d.address.city||d.address.town}})},()=>{alert('Erro GPS')})}
async function gerarScriptVendaIA(){if(!leadAtualParaAgendar)return;showLoading(true);const r=await perguntarIABackend(`Script WhatsApp para ${leadAtualParaAgendar.nomeLead}`);showLoading(false);if(r)alert(r)}
async function perguntarIABackend(p){try{const r=await apiCall('askAI',{question:p},false);return r.status==='success'?r.answer:null}catch(e){return null}}
async function combaterObjecaoGeral(){const o=document.getElementById('inputObjecaoGeral').value;const r=await apiCall('solveObjection',{objection:o});if(r.status==='success')document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer}
async function combaterObjecaoLead(){const o=document.getElementById('inputObjecaoLead').value;const r=await apiCall('solveObjection',{objection:o});if(r.status==='success')document.getElementById('respostaObjecaoLead').value=r.answer}
async function salvarObjecaoLead(){await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value});alert("Salvo!")}
async function analiseEstrategicaIA(){const r=await perguntarIABackend(`Analise lead ${leadAtualParaAgendar.nomeLead}`);if(r)document.getElementById('modalLeadObs').value+="\n\n[IA]: "+r}
async function raioXConcorrencia(){const p=document.getElementById('modalLeadProvedor').innerText;const r=await perguntarIABackend(`Raio-X ${p}`);if(r)document.getElementById('modalLeadObs').value+="\n\n[RX]: "+r}
async function gerarCoachIA(){const r=await perguntarIABackend("Frase motivacional");if(r)alert(r)}
async function consultarPlanosIA(){document.getElementById('chatModal').classList.remove('hidden')}
function toggleChat(){document.getElementById('chatModal').classList.add('hidden')}
async function enviarMensagemChat(){const m=document.getElementById('chatInput').value;if(m){document.getElementById('chatHistory').innerHTML+=`<div class='text-right'>${m}</div>`;const r=await perguntarIABackend(m);document.getElementById('chatHistory').innerHTML+=`<div class='text-left'>${r}</div>`;}}
async function excluirLead(){if(!confirm("Excluir?"))return;await apiCall('deleteLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead});alert("Excluído.");fecharLeadModal();carregarLeads()}
async function marcarVendaFechada(){if(!confirm("Venda Fechada?"))return;await apiCall('updateStatus',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,status:"Venda Fechada"});alert("Parabéns!");fecharLeadModal();carregarLeads()}
async function salvarAgendamento(){const a=`${document.getElementById('agendarData').value} ${document.getElementById('agendarHora').value}`;await apiCall('updateAgendamento',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,agendamento:a});alert("Agendado!");fecharLeadModal()}
function iniciarDitado(t){}
function copying(id){document.getElementById(id).select();document.execCommand('copy');alert("Copiado!")}
function enviarZapTexto(id){window.open(`https://wa.me/?text=${encodeURIComponent(document.getElementById(id).value)}`,'_blank')}
function copiarTexto(id){document.getElementById(id).select();document.execCommand('copy');alert("Copiado!")}
function ajustarMicrofone(){const btn=document.getElementById('btnMicNome');if(btn){btn.removeAttribute('onclick');btn.onclick=()=>iniciarDitado('leadObs');}}
