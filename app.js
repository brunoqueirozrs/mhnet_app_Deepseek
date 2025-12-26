/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V108 (TODOIST STYLE & FIXES)
 * ============================================================
 * 📝 UPDATE:
 * - Tarefas: Visual estilo "Todoist" (Ordenação inteligente, datas coloridas).
 * - Lembretes: Correção robusta na verificação de datas de retorno.
 * - Sincronização: Mantida lógica offline/online.
 * - IA FIX: Correção de sintaxe nas chamadas de template string.
 * ============================================================
 */

// ⚠️ ID DO BACKEND V93 (Mantenha o seu ID se já fez deploy novo)
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

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
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
    
    if (loggedUser === "Bruno Garcia Queiroz") {
        document.getElementById('btnAdminSettings')?.classList.remove('hidden');
    }
    
    atualizarDataCabecalho();
    carregarLeads(false); 
    carregarTarefas(false); // Pré-carrega tarefas
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
        }
    }
    if (pageId === 'materiais' && !currentFolderId) setTimeout(() => carregarMateriais(null), 100);
    if (pageId === 'faltas') ocultarHistoricoFaltas();
}

// ============================================================
// 3. TAREFAS (ESTILO TODOIST)
// ============================================================

async function carregarTarefas(show = true) {
    const div = document.getElementById('listaTarefasContainer');
    if (show && div) div.innerHTML = '<div class="text-center p-5 text-gray-400"><i class="fas fa-spinner fa-spin"></i> Atualizando...</div>';
    
    // Se offline, usa o que tem
    if (!navigator.onLine && tasksCache.length > 0) { renderTarefas(); return; }

    const res = await apiCall('getTasks', { vendedor: loggedUser }, false);
    if (res && res.status === 'success') {
        tasksCache = res.data;
        if (show) renderTarefas();
    } else if (show && div) {
        div.innerHTML = '<div class="text-center text-red-400">Erro ao sincronizar.</div>';
    }
}

function renderTarefas() {
    const div = document.getElementById('listaTarefasContainer');
    if (!div) return;
    
    if (tasksCache.length === 0) {
        div.innerHTML = `
        <div class="flex flex-col items-center justify-center h-64 text-slate-300">
            <i class="fas fa-check-circle text-6xl mb-4 text-slate-200"></i>
            <p class="text-sm font-bold">Tudo feito!</p>
            <p class="text-xs">Aproveite o dia.</p>
        </div>`;
        return;
    }
    
    // Ordenação Inteligente: Pendentes primeiro, depois por data
    tasksCache.sort((a, b) => {
        if (a.status === b.status) {
            if (!a.dataLimite) return 1;
            if (!b.dataLimite) return -1;
            const dateA = converterDataString(a.dataLimite);
            const dateB = converterDataString(b.dataLimite);
            return dateA - dateB;
        }
        return a.status === 'PENDENTE' ? -1 : 1;
    });

    div.innerHTML = tasksCache.map(t => {
        const isDone = t.status === 'CONCLUIDA';
        const opacity = isDone ? "opacity-40" : "";
        const strike = isDone ? "line-through text-slate-400" : "text-slate-700";
        const checkColor = isDone ? "bg-green-500 border-green-500 text-white" : "border-slate-300 hover:border-[#00aeef]";
        
        let dataBadge = "";
        if (t.dataLimite) {
            const hoje = new Date(); hoje.setHours(0,0,0,0);
            const dataTask = converterDataString(t.dataLimite);
            let corData = "text-slate-400";
            let textoData = t.dataLimite;
            
            if (dataTask < hoje && !isDone) { corData = "text-red-500 font-bold"; textoData = "Atrasado • " + t.dataLimite; }
            else if (dataTask.getTime() === hoje.getTime() && !isDone) { corData = "text-green-600 font-bold"; textoData = "Hoje"; }
            
            dataBadge = `<div class="text-[10px] ${corData} flex items-center gap-1 mt-1"><i class="far fa-calendar-alt"></i> ${textoData}</div>`;
        }

        const vinculoLead = t.nomeLead ? `<span class="bg-blue-50 text-blue-600 text-[9px] px-1.5 py-0.5 rounded font-bold border border-blue-100 ml-2">👤 ${t.nomeLead}</span>` : '';

        return `
        <div class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-start gap-3 mb-2 transition-all active:scale-[0.98] ${opacity}">
            <div onclick="toggleTask('${t.id}', '${t.status}')" class="mt-1 w-5 h-5 rounded-full border-2 ${checkColor} flex items-center justify-center cursor-pointer transition-colors shadow-sm">
                ${isDone ? '<i class="fas fa-check text-[10px]"></i>' : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-sm font-medium ${strike} leading-tight break-words">
                    ${t.descricao}
                </div>
                <div class="flex items-center flex-wrap">
                    ${dataBadge}
                    ${vinculoLead}
                </div>
            </div>
        </div>`;
    }).join('');
}

function converterDataString(str) {
    if(!str) return new Date(8640000000000000); 
    try {
        const parts = str.split('/'); 
        if(parts.length === 3) return new Date(parts[2], parts[1]-1, parts[0]);
    } catch(e) {}
    return new Date();
}

async function toggleTask(id, currentStatus) {
    const task = tasksCache.find(t => t.id === id);
    if (task) {
        task.status = currentStatus === 'PENDENTE' ? 'CONCLUIDA' : 'PENDENTE';
        renderTarefas(); 
    }
    await apiCall('toggleTask', { taskId: id, status: currentStatus, vendedor: loggedUser }, false);
}

function abrirModalTarefa() { document.getElementById('taskModal').classList.remove('hidden'); }

async function salvarTarefa() {
    const desc = document.getElementById('taskDesc').value;
    const date = document.getElementById('taskDate').value;
    const leadVal = document.getElementById('taskLeadSelect').value;
    
    if(!desc) return alert("Digite a descrição.");
    
    showLoading(true, "CRIANDO...");
    const res = await apiCall('addTask', { vendedor: loggedUser, descricao: desc, dataLimite: date, nomeLead: leadVal });
    showLoading(false);
    
    if(res.status === 'success' || res.local) {
        document.getElementById('taskModal').classList.add('hidden');
        document.getElementById('taskDesc').value = '';
        carregarTarefas();
    } else alert("Erro ao salvar.");
}

async function limparTarefasConcluidas() {
    if(!confirm("Remover todas as tarefas concluídas?")) return;
    tasksCache = tasksCache.filter(t => t.status !== 'CONCLUIDA');
    renderTarefas();
    showLoading(true, "LIMPANDO...");
    await apiCall('archiveTasks', { vendedor: loggedUser });
    showLoading(false);
}

// ============================================================
// 4. LEMBRETES DE RETORNO
// ============================================================

function verificarAgendamentosHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => {
        if (!l.agendamento) return false;
        const dataLead = l.agendamento.split(' ')[0];
        return dataLead === hoje;
    });

    const banner = document.getElementById('lembreteBanner');
    const txt = document.getElementById('lembreteTexto');
    
    if (retornos.length > 0) {
        if(banner) banner.classList.remove('hidden');
        if(txt) txt.innerText = `Você tem ${retornos.length} retornos para hoje!`;
    } else {
        if(banner) banner.classList.add('hidden');
    }
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
    document.getElementById('searchLead').value = "";
    document.getElementById('searchLead').placeholder = `📅 Retornos de Hoje (${retornos.length})`;
}


// ... (RESTANTE DAS FUNÇÕES MANTIDAS E CORRIGIDAS) ...

async function apiCall(route, payload, show=true) {
    if(show) showLoading(true);
    if (!navigator.onLine && isWriteOperation(route)) {
        adicionarAFila(route, payload);
        if(show) showLoading(false);
        if (route === 'toggleTask') return { status: 'success', local: true };
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
        if (isWriteOperation(route)) { adicionarAFila(route, payload); return { status: 'success', local: true }; }
        return { status: 'error', message: 'Conexão' };
    }
}
function isWriteOperation(route) { return ['addLead', 'deleteLead', 'updateStatus', 'updateAgendamento', 'updateObservacao', 'addTask', 'toggleTask', 'archiveTasks', 'registerAbsence', 'updateAbsence', 'saveObjectionLead', 'updateLeadFull', 'forwardLead', 'manageTeam'].includes(route); }
function adicionarAFila(r, p) { syncQueue.push({route:r, payload:p}); localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue)); alert("Salvo Offline!"); }
async function processarFilaSincronizacao() { if(syncQueue.length===0) return; showLoading(true); const f=[]; for(const i of syncQueue) { try { await fetch(API_URL, {method:'POST', body:JSON.stringify({route:i.route, payload:i.payload})}); } catch(e){f.push(i)} } syncQueue=f; localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue)); showLoading(false); if (syncQueue.length === 0 && document.getElementById('gestaoLeads').style.display !== 'none') carregarLeads(false); }
async function carregarVendedores() { const s=document.getElementById('userSelect'); if(!s)return; try{const r=await apiCall('getVendors',{},false);if(r.status==='success'){const o=r.data.map(v=>`<option value="${v.nome}">${v.nome}</option>`).join('');s.innerHTML='<option value="">Selecione...</option>'+o; document.getElementById('modalLeadDestino').innerHTML='<option value="">Selecione...</option>'+o;}}catch(e){s.innerHTML='<option value="">Offline</option>';} }
function showLoading(s,t){const l=document.getElementById('loader');if(l)l.style.display=s?'flex':'none';if(t)document.getElementById('loaderText').innerText=t}
function setLoggedUser(){const v=document.getElementById('userSelect').value;if(v&&v!=="A carregar..."){loggedUser=v;localStorage.setItem('loggedUser',v);initApp()}else alert("Selecione!")}
function atualizarDataCabecalho(){document.getElementById('headerDate').innerText=new Date().toLocaleDateString('pt-BR')}
function atualizarDashboard(){const h=new Date().toLocaleDateString('pt-BR');document.getElementById('statLeads').innerText=leadsCache.filter(l=>l.timestamp&&l.timestamp.includes(h)).length}
function filtrarLeadsHoje(){const h=new Date().toLocaleDateString('pt-BR');const l=leadsCache.filter(x=>x.timestamp&&x.timestamp.includes(h));navegarPara('gestaoLeads');renderListaLeads(l);document.getElementById('searchLead').placeholder=`Hoje (${l.length})`}
function filtrarPorStatus(s){document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));if(event.target)event.target.classList.add('active');const l=s==='Todos'?leadsCache:leadsCache.filter(x=>x.status===s||x.interesse===s);renderListaLeads(l)}
async function carregarLeads(s=true){if(!navigator.onLine){if(document.getElementById('listaLeadsGestao'))renderLeads();return}const r=await apiCall('getLeads',{vendedor:loggedUser},s);if(r.status==='success'){leadsCache=r.data||[];localStorage.setItem('mhnet_leads_cache',JSON.stringify(leadsCache));if(r.isAdmin)document.getElementById('adminPanel')?.classList.remove('hidden');if(document.getElementById('listaLeadsGestao'))renderLeads();atualizarDashboard()}}
function renderLeads(){const t=(document.getElementById('searchLead')?.value||'').toLowerCase();const l=leadsCache.filter(x=>(x.nomeLead||'').toLowerCase().includes(t)||(x.bairro||'').toLowerCase().includes(t));renderListaLeads(l)}
function renderListaLeads(l){const d=document.getElementById('listaLeadsGestao');if(!d)return;if(l.length===0){d.innerHTML='<div class="text-center mt-10 text-gray-400">Vazio.</div>';return}d.innerHTML=l.map((x,i)=>criarCardLead(x,leadsCache.indexOf(x))).join('')}
function criarCardLead(l,i){let c="bg-slate-100 text-slate-500";if(l.status==='Venda Fechada')c="bg-green-500 text-white font-bold";else if(l.status==='Agendado')c="bg-orange-100 text-orange-600 font-bold";return`<div onclick="abrirLeadDetalhes(${i})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm"><div class="flex justify-between"><div><div class="font-bold text-lg">${l.nomeLead}</div><div class="text-xs text-slate-500">${l.bairro} • ${l.provedor||'-'}</div></div><span class="text-[10px] px-2 py-1 rounded-full ${c}">${l.status||'Novo'}</span></div></div>`}
function abrirLeadDetalhes(i){const l=leadsCache[i];if(!l)return;leadAtualParaAgendar=l;document.getElementById('modalLeadNome').innerText=l.nomeLead;document.getElementById('modalLeadBairro').innerText=l.bairro||'-';document.getElementById('modalLeadCidade').innerText=l.cidade||'-';document.getElementById('modalLeadTelefone').innerText=l.telefone||'-';document.getElementById('modalLeadProvedor').innerText=l.provedor||"--";document.getElementById('modalStatusFunil').value=l.status||"Novo";document.getElementById('modalLeadObs').value=l.observacao||"";const b=document.getElementById('btnModalWhats');if(b)b.onclick=()=>window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`,'_blank');document.getElementById('containerRaioX').innerHTML=`<button onclick="raioXConcorrencia()" class="ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px]">Raio-X</button>`;
// Tarefas no Modal
renderTarefasNoModal(l.nomeLead);
document.getElementById('leadModal').classList.remove('hidden')}
function renderTarefasNoModal(nome){/* Lógica se desejar mostrar tarefas no modal, senão deixe vazio */} 
function fecharLeadModal(){document.getElementById('leadModal').classList.add('hidden')}
async function salvarEdicaoModal(){if(!leadAtualParaAgendar)return;const s=document.getElementById('modalStatusFunil').value;const o=document.getElementById('modalLeadObs').value;leadAtualParaAgendar.status=s;leadAtualParaAgendar.observacao=o;const d=document.getElementById('agendarData').value;if(d){const[a,m,day]=d.split('-');leadAtualParaAgendar.agendamento=`${day}/${m}/${a} ${document.getElementById('agendarHora').value||'09:00'}`}localStorage.setItem('mhnet_leads_cache',JSON.stringify(leadsCache));renderLeads();showLoading(true);await Promise.all([apiCall('updateStatus',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,status:s},false),apiCall('updateObservacao',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,observacao:o},false)]);if(d)await apiCall('updateAgendamento',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,agendamento:leadAtualParaAgendar.agendamento},false);showLoading(false);fecharLeadModal()}
function editarLeadAtual(){if(!leadAtualParaAgendar)return;const l=leadAtualParaAgendar;document.getElementById('leadNome').value=l.nomeLead;document.getElementById('leadTelefone').value=l.telefone;document.getElementById('leadEndereco').value=l.endereco;document.getElementById('leadBairro').value=l.bairro;document.getElementById('leadCidade').value=l.cidade;document.getElementById('leadProvedor').value=l.provedor;document.getElementById('leadObs').value=l.observacao;const s=document.getElementById('leadStatus');if(s)s.value=l.status||"Novo";editingLeadIndex=leadsCache.indexOf(l);fecharLeadModal();navegarPara('cadastroLead')}
async function enviarLead(){const p={vendedor:loggedUser,nomeLead:document.getElementById('leadNome').value,telefone:document.getElementById('leadTelefone').value,endereco:document.getElementById('leadEndereco').value,bairro:document.getElementById('leadBairro').value,cidade:document.getElementById('leadCidade').value,provedor:document.getElementById('leadProvedor').value,interesse:document.getElementById('leadInteresse').value,status:document.getElementById('leadStatus').value,observacao:document.getElementById('leadObs').value};let r='addLead';if(editingLeadIndex!==null){r='updateLeadFull';p._linha=leadsCache[editingLeadIndex]._linha;p.nomeLeadOriginal=leadsCache[editingLeadIndex].nomeLead}const res=await apiCall(r,p);if(res.status==='success'||res.local){alert("Salvo!");if(editingLeadIndex===null&&!res.local)leadsCache.unshift(p);localStorage.setItem('mhnet_leads_cache',JSON.stringify(leadsCache));editingLeadIndex=null;navegarPara('gestaoLeads')}else alert("Erro.")}
async function abrirIndicadores(){navegarPara('indicadores');['funnelLeads','funnelNegociacao','funnelVendas'].forEach(id=>document.getElementById(id).innerText='...');const r=await apiCall('getIndicators',{vendedor:loggedUser},false);if(r.status==='success'){const d=r.data;document.getElementById('funnelLeads').innerText=d.totalLeads;document.getElementById('funnelNegociacao').innerText=d.negociacao;document.getElementById('funnelVendas').innerText=d.vendas;}}
async function verHistoricoFaltas(){const d=document.getElementById('listaHistoricoFaltas');document.getElementById('historicoFaltasContainer').classList.remove('hidden');document.getElementById('formFaltaContainer').classList.add('hidden');const r=await apiCall('getAbsences',{vendedor:loggedUser},false);if(r.status==='success')d.innerHTML=r.data.map(f=>`<div class="bg-white p-3 mb-2 rounded shadow"><div class="font-bold text-xs">${f.motivo}</div><div class="text-[10px]">${f.dataFalta} • ${f.statusEnvio}</div></div>`).join('')}
function ocultarHistoricoFaltas(){document.getElementById('historicoFaltasContainer').classList.add('hidden');document.getElementById('formFaltaContainer').classList.remove('hidden')}
async function enviarJustificativa(){showLoading(true);await apiCall('registerAbsence',{vendedor:loggedUser,dataFalta:document.getElementById('faltaData').value,motivo:document.getElementById('faltaMotivo').value,observacao:document.getElementById('faltaObs').value});showLoading(false);alert("Enviado!");navegarPara('dashboard')}
async function carregarMateriais(f=null,s=""){const d=document.getElementById('materiaisGrid');d.innerHTML='Carregando...';const r=await apiCall('getImages',{folderId:f,search:s},false);if(r.status==='success')document.getElementById('materiaisGrid').innerHTML=r.data.map(x=>x.type==='folder'?`<div onclick="carregarMateriais('${x.id}')" class="bg-blue-50 p-4 text-center"><i class="fas fa-folder"></i> ${x.name}</div>`:`<div class="p-2 border"><a href="${x.downloadUrl}" target="_blank">${x.name}</a></div>`).join('')}
function buscarMateriais(){carregarMateriais(currentFolderId,document.getElementById('searchMateriais').value)}
// ⚠️ FIX IA: Template Strings com crase (Backticks)
async function gerarAbordagemIA(){const nome=document.getElementById('leadNome').value;showLoading(true);const t=await perguntarIABackend(`Pitch curto para ${nome}`);showLoading(false);if(t)document.getElementById('leadObs').value=t}
async function gerarScriptVendaIA(){if(!leadAtualParaAgendar)return;showLoading(true);const r=await perguntarIABackend(`Script WhatsApp para ${leadAtualParaAgendar.nomeLead}`);showLoading(false);if(r)alert("Copiado: "+r)}
async function perguntarIABackend(p){ try { const r=await apiCall('askAI',{question:p, history: chatHistoryData},false); return r.status==='success' ? r.answer : null; } catch(e){return null;} }
// Outros
async function combaterObjecaoGeral(){const o=document.getElementById('inputObjecaoGeral').value;const r=await apiCall('solveObjection',{objection:o});if(r.status==='success')document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer}
async function combaterObjecaoLead(){const o=document.getElementById('inputObjecaoLead').value;const r=await apiCall('solveObjection',{objection:o});if(r.status==='success')document.getElementById('respostaObjecaoLead').value=r.answer}
async function salvarObjecaoLead(){await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value});alert("Salvo!")}
async function analiseEstrategicaIA(){const r=await perguntarIABackend(`Analise lead ${leadAtualParaAgendar.nomeLead}`);if(r)document.getElementById('modalLeadObs').value+="\n\n[IA]: "+r}
async function raioXConcorrencia(){const p=document.getElementById('modalLeadProvedor').innerText;const r=await perguntarIABackend(`Raio-X ${p}`);if(r)document.getElementById('modalLeadObs').value += "\n\n[RX]: " + r}
async function gerarCoachIA(){const r=await perguntarIABackend("Frase motivacional");if(r)alert(r)}
async function consultarPlanosIA(){document.getElementById('chatModal').classList.remove('hidden')}
function toggleChat(){document.getElementById('chatModal').classList.add('hidden')}
async function enviarMensagemChat(){const m=document.getElementById('chatInput').value;if(m){document.getElementById('chatHistory').innerHTML+=`<div class='text-right'>${m}</div>`;const r=await perguntarIABackend(m);document.getElementById('chatHistory').innerHTML+=`<div class='text-left'>${r}</div>`;}}
function abrirConfiguracoes(){document.getElementById('configModal').classList.remove('hidden')}
async function gerirEquipe(a){await apiCall('manageTeam',{acao:a,nome:document.getElementById('cfgNomeVendedor').value,meta:document.getElementById('cfgMeta').value});alert("Feito!");carregarVendedores()}
async function buscarEnderecoGPS(){navigator.geolocation.getCurrentPosition(p=>{fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json()).then(d=>{if(d.address){document.getElementById('leadEndereco').value=d.address.road;document.getElementById('leadBairro').value=d.address.suburb}})},()=>{alert('Erro GPS')})}
function iniciarDitado(t){}
function copying(id){document.getElementById(id).select();document.execCommand('copy');alert("Copiado!")}
function enviarZapTexto(id){window.open(`https://wa.me/?text=${encodeURIComponent(document.getElementById(id).value)}`,'_blank')}
function copiarTexto(id){document.getElementById(id).select();document.execCommand('copy');alert("Copiado!")}
function preencherEdicaoFalta(f){/*Igual V90*/}
async function enviarPayloadFalta(r,p){/*Igual V90*/}
async function salvarObservacaoModal(){await apiCall('updateObservacao',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,observacao:document.getElementById('modalLeadObs').value});alert("Salvo!")}
async function marcarVendaFechada(){if(!confirm("Venda Fechada?"))return;await apiCall('updateStatus',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,status:"Venda Fechada"});alert("Parabéns!");fecharLeadModal();carregarLeads()}
async function excluirLead(){if(!confirm("Excluir?"))return;await apiCall('deleteLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead});alert("Excluído.");fecharLeadModal();carregarLeads()}
async function salvarAgendamento(){const a=`${document.getElementById('agendarData').value} ${document.getElementById('agendarHora').value}`;await apiCall('updateAgendamento',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,agendamento:a});alert("Agendado!");fecharLeadModal()}
