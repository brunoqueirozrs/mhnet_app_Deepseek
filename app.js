/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V107 (FALTAS & WHATSAPP & GPS FIX)
 * ============================================================
 * 📝 UPDATE:
 * - Lista de Faltas atualizada via JS (Layout novo).
 * - Envio de justificativa abre WhatsApp com Observação.
 * - Sincronizado com HTML V106 e Backend V93.
 * - GPS ajustado para capturar Rua, Bairro e Cidade.
 * ============================================================
 */

// ⚠️ ID DO BACKEND V93
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// --- ESTADO GLOBAL ---
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let vendorsCache = []; 
let tasksCache = [];
let materialsCache = []; // Cache para filtrar sem recarregar
let leadAtualParaAgendar = null; 
let currentFolderId = null;
let editingLeadIndex = null;
let editingAbsenceIndex = null;
let syncQueue = JSON.parse(localStorage.getItem('mhnet_sync_queue') || '[]');

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V107 - Faltas Updated");
    
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
    navegarPara('dashboard');
}

function setLoggedUser() {
    const v = document.getElementById('userSelect').value;
    if (v && v !== "" && v !== "Carregando...") { 
        loggedUser = v; 
        localStorage.setItem('loggedUser', v); 
        initApp(); 
    } else {
        if (document.getElementById('userSelect').options.length <= 1) {
            carregarVendedoresOffline();
            alert("Aguarde o carregamento...");
        } else {
            alert('Selecione seu nome.');
        }
    }
}

function logout() { 
    if(confirm("Sair?")) { 
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

    // Hooks
    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') abrirIndicadores();
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        if(busca && !busca.placeholder.includes("Filtrado")) {
            busca.value = "";
            busca.placeholder = "Buscar...";
            renderLeads();
        }
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
    
    // Injeta o formulário atualizado ao entrar na tela
    if (pageId === 'faltas') {
        renderizarFormularioFaltas();
        ocultarHistoricoFaltas();
    }
}

// ============================================================
// 3. FALTAS (ATUALIZADO)
// ============================================================

function renderizarFormularioFaltas() {
    const container = document.getElementById('formFaltaContainer');
    if (!container) return;

    // Lista de tipos solicitada
    const tipos = [
        "FOLGA PRGRAMADA (BANCO DE HORAS)",
        "CONSULTA MÉDICA",
        "SOLICITAÇÃO DE SAIDA EMERGENCIA",
        "ENCAMINHAMENTO DE ATESTADO",
        "ENCAMINHAMENTO DE COMPARECIMENTO",
        "FALTA SEM JUSTIFICATIVA",
        "AJUSTE DE PONTO",
        "BENEFÍCIO - DAY OFF",
        "PROBLEMAS NO APLICATIVO"
    ];

    const options = tipos.map(t => `<option value="${t}">${t}</option>`).join('');

    container.innerHTML = `
        <button onclick="verHistoricoFaltas()" class="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl mb-4 flex items-center justify-center gap-2"><i class="fas fa-history"></i> VER HISTÓRICO</button>
        
        <div>
            <label class="label-padrao">Data da Ocorrência</label>
            <input type="date" id="faltaData" class="input-padrao mb-3">
        </div>
        
        <div>
            <label class="label-padrao">Tipo de Solicitação</label>
            <select id="faltaMotivo" class="input-padrao bg-white mb-3 text-sm font-bold text-slate-700">
                <option value="">Selecione...</option>
                ${options}
            </select>
        </div>
        
        <div>
            <label class="label-padrao">Observação (Obrigatória)</label>
            <textarea id="faltaObs" class="input-padrao mb-3" rows="3" placeholder="Descreva o motivo ou detalhe..."></textarea>
        </div>
        
        <div class="bg-blue-50 p-4 rounded-xl border border-blue-100 border-dashed relative mb-4">
            <label class="label-padrao text-blue-700 mb-2 flex items-center gap-2"><i class="fas fa-paperclip"></i> Anexar Atestado/Foto</label>
            <input type="file" id="faltaArquivo" accept="image/*,application/pdf" class="w-full text-xs text-slate-500">
        </div>
        
        <button id="btnEnviarFalta" onclick="enviarJustificativa()" class="w-full bg-[#00aeef] text-white font-bold py-3 rounded-xl shadow-lg active:scale-95">ENVIAR SOLICITAÇÃO</button>
    `;
}

async function enviarJustificativa() {
    const dataFalta = document.getElementById('faltaData').value;
    const motivo = document.getElementById('faltaMotivo').value;
    const obs = document.getElementById('faltaObs').value;
    const fileInput = document.getElementById('faltaArquivo');
    
    if(!dataFalta || !motivo) return alert("Preencha data e motivo.");
    if(!obs) return alert("Por favor, preencha a observação.");
    
    showLoading(true, "PROCESSANDO...");
    
    const payload = {
        vendedor: loggedUser,
        dataFalta: dataFalta,
        motivo: motivo,
        observacao: obs,
        _linha: editingAbsenceIndex
    };
    
    // Preparar mensagem WhatsApp
    const [ano, mes, dia] = dataFalta.split('-');
    const dataFormatada = `${dia}/${mes}/${ano}`;
    const msgWhatsapp = `⚠️ *SOLICITAÇÃO/FALTA*\n👤 *Colaborador:* ${loggedUser}\n📅 *Data:* ${dataFormatada}\n📌 *Tipo:* ${motivo}\n📝 *Obs:* ${obs}`;
    
    const finalizarEnvio = async () => {
        // Envia para API (Planilha)
        const route = editingAbsenceIndex ? 'updateAbsence' : 'registerAbsence';
        const res = await apiCall(route, payload);
        
        showLoading(false);
        
        if (res && (res.status === 'success' || res.local)) {
            // Abre WhatsApp com a mensagem e observação
            if(confirm("Solicitação salva! Deseja enviar o aviso no WhatsApp agora?")) {
                window.open(`https://wa.me/555184487818?text=${encodeURIComponent(msgWhatsapp)}`, '_blank');
            }
            alert(editingAbsenceIndex ? "✅ Atualizado!" : "✅ Enviado com sucesso!");
            ocultarHistoricoFaltas();
            navegarPara('dashboard');
        } else {
            alert("Erro ao salvar no sistema.");
        }
    };

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async function(e) {
            payload.fileData = e.target.result; 
            payload.fileName = file.name;
            payload.mimeType = file.type;
            await finalizarEnvio();
        };
        reader.readAsDataURL(file);
    } else {
        if(editingAbsenceIndex) payload.existingFile = ""; 
        await finalizarEnvio();
    }
}

async function verHistoricoFaltas() {
    const div = document.getElementById('listaHistoricoFaltas');
    document.getElementById('historicoFaltasContainer').classList.remove('hidden');
    document.getElementById('formFaltaContainer').classList.add('hidden');
    div.innerHTML = '<div class="text-center p-5 text-gray-400"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    
    const res = await apiCall('getAbsences', { vendedor: loggedUser }, false);
    
    if (res && res.status === 'success' && res.data.length > 0) {
        div.innerHTML = res.data.map(f => `
            <div onclick='preencherEdicaoFalta(${JSON.stringify(f)})' class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 cursor-pointer active:bg-blue-50">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="font-bold text-xs text-slate-700">${f.motivo}</div>
                        <div class="text-[10px] text-slate-400">${f.dataFalta} • ${f.statusEnvio || 'Enviado'}</div>
                        <div class="text-[10px] text-slate-500 italic mt-1 line-clamp-1">"${f.obs}"</div>
                    </div>
                    <i class="fas fa-pen text-slate-300 text-xs"></i>
                </div>
            </div>`).join('');
    } else {
        div.innerHTML = '<div class="text-center p-5 text-gray-400 text-xs">Nenhum histórico encontrado.</div>';
    }
}

function ocultarHistoricoFaltas() {
    document.getElementById('historicoFaltasContainer').classList.add('hidden');
    document.getElementById('formFaltaContainer').classList.remove('hidden');
    editingAbsenceIndex = null;
    
    // Limpa campos visualmente (embora renderizarFormularioFaltas faça isso ao entrar na tela)
    if(document.getElementById('faltaData')) {
        document.getElementById('faltaData').value = '';
        document.getElementById('faltaMotivo').value = '';
        document.getElementById('faltaObs').value = '';
        document.getElementById('faltaArquivo').value = '';
        document.getElementById('btnEnviarFalta').innerHTML = 'ENVIAR SOLICITAÇÃO';
    }
}

function preencherEdicaoFalta(falta) {
    document.getElementById('historicoFaltasContainer').classList.add('hidden');
    document.getElementById('formFaltaContainer').classList.remove('hidden');
    
    const [d, m, a] = falta.dataFalta.split('/');
    document.getElementById('faltaData').value = `${a}-${m}-${d}`;
    document.getElementById('faltaMotivo').value = falta.motivo;
    document.getElementById('faltaObs').value = falta.obs;
    editingAbsenceIndex = falta._linha; 
    
    document.getElementById('btnEnviarFalta').innerHTML = 'ATUALIZAR';
    alert("📝 Editando solicitação. Anexe o atestado novamente se necessário.");
}

// ============================================================
// 4. MATERIAIS & FILTROS (ATUALIZADO)
// ============================================================

async function carregarMateriais(f=null, s="") {
    const div = document.getElementById('materiaisGrid');
    if (!div) return;
    
    // Se for navegação (mudança de pasta ou reset), limpa e busca na API
    // Se for apenas busca (s preenchido e f igual ao atual), filtramos o cache
    if (f !== currentFolderId || !materialsCache.length) {
        currentFolderId = f; 
        div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10 fade-in"><i class="fas fa-circle-notch fa-spin text-2xl mb-2 text-[#00aeef]"></i><br>Buscando materiais...</div>';
        
        try {
            const res = await apiCall('getImages', { folderId: f }, false); // Busca tudo da pasta
            if (res && res.status === 'success' && res.data) {
                materialsCache = res.data; // Salva em cache para filtro rápido
                atualizarNavegacaoMateriais(res.isRoot);
                filtrarERenderizarMateriais(s); // Filtra e Renderiza
            } else { throw new Error("Erro API"); }
        } catch (error) {
            div.innerHTML = `<div class="col-span-2 text-center text-red-400 py-10"><i class="fas fa-wifi mb-2"></i><br>Erro ao carregar.</div>`;
        }
    } else {
        // Apenas filtra o que já tem
        filtrarERenderizarMateriais(s);
    }
}

function filtrarERenderizarMateriais(termo) {
    const termoLimpo = termo.toLowerCase();
    let itensFiltrados = materialsCache;
    
    if (termoLimpo && termoLimpo !== "") {
        itensFiltrados = materialsCache.filter(item => item.name.toLowerCase().includes(termoLimpo));
    }
    
    renderMateriais(itensFiltrados);
}

function renderMateriais(items) {
    const div = document.getElementById('materiaisGrid');
    if(!div) return;
    
    if(items.length === 0) { 
        div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10">Nada encontrado.</div>'; 
        return; 
    }
    
    div.innerHTML = items.map(item => {
        if (item.type === 'folder') {
            // 📂 DESIGN DE PASTA (Ícone Grande)
            return `
            <div onclick="carregarMateriais('${item.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex flex-col items-center justify-center gap-2 cursor-pointer h-36 group hover:bg-blue-50 transition active:scale-95">
                <i class="fas fa-folder text-5xl text-[#00aeef] drop-shadow-sm group-hover:scale-110 transition"></i>
                <span class="text-xs font-bold text-slate-600 text-center leading-tight line-clamp-2">${item.name}</span>
            </div>`;
        } else {
            // 🖼️ DESIGN DE IMAGEM (Miniatura + Botões Restaurados)
            return `
            <div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-auto relative overflow-hidden group">
                <div class="h-32 w-full bg-gray-50 rounded-xl overflow-hidden relative mb-2 bg-gray-100">
                    <img src="${item.thumbnail}" class="w-full h-full object-cover transition transform group-hover:scale-105" alt="${item.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/150?text=SEM+IMAGEM'">
                </div>
                <div class="text-[10px] text-gray-500 font-bold truncate px-1 mb-2">${item.name}</div>
                <div class="flex gap-2 mt-auto">
                    <a href="${item.downloadUrl}" target="_blank" class="flex-1 bg-blue-50 text-blue-600 py-2 rounded-lg flex items-center justify-center active:scale-95 transition hover:bg-blue-100" title="Baixar">
                        <i class="fas fa-download"></i>
                    </a>
                    <button onclick="compartilharImagem('${item.viewUrl}')" class="flex-1 bg-green-50 text-green-600 py-2 rounded-lg flex items-center justify-center active:scale-95 transition hover:bg-green-100" title="Enviar no WhatsApp">
                        <i class="fab fa-whatsapp text-lg"></i>
                    </button>
                </div>
            </div>`;
        }
    }).join('');
}

function atualizarNavegacaoMateriais(isRoot) {
    const btnVoltar = document.querySelector('#materiais button'); 
    const titleEl = document.querySelector('#materiais h2');
    if(btnVoltar) {
        if(isRoot) {
            btnVoltar.onclick = () => navegarPara('dashboard');
            if(titleEl) titleEl.innerText = "Materiais";
        } else {
            btnVoltar.onclick = () => {
                const searchInput = document.getElementById('searchMateriais');
                if (searchInput) searchInput.value = ""; 
                carregarMateriais(null); // Volta pra raiz
            };
            if(titleEl) titleEl.innerText = "Voltar";
        }
    }
}

function buscarMateriais() { 
    // Chama o carregamento passando o ID atual e o termo de busca
    // Se o ID for null (raiz), filtra as pastas. Se for ID de pasta, filtra imagens.
    carregarMateriais(currentFolderId, document.getElementById('searchMateriais').value); 
}

function compartilharImagem(u) { 
    window.open(`https://wa.me/?text=${encodeURIComponent(u)}`, '_blank'); 
}

// ============================================================
// 5. API, SYNC & UTILS (MANTIDOS)
// ============================================================

async function apiCall(route, payload, show=true) {
    if(show) showLoading(true);
    if (!navigator.onLine && isWriteOperation(route)) {
        adicionarAFila(route, payload);
        if(show) showLoading(false);
        if (route === 'toggleTask') {
             const t = tasksCache.find(x => x.id === payload.taskId);
             if (t) t.status = payload.status === 'PENDENTE' ? 'CONCLUIDA' : 'PENDENTE';
             if (document.getElementById('listaTarefasContainer')) renderTarefas();
        }
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
async function carregarVendedores() { const s=document.getElementById('userSelect'); const s2=document.getElementById('modalLeadDestino'); const s3=document.getElementById('leadVendedorDestino'); if(!s)return; try{const r=await apiCall('getVendors',{},false);if(r.status==='success'){const o=r.data.map(v=>`<option value="${v.nome}">${v.nome}</option>`).join('');s.innerHTML='<option value="">Selecione...</option>'+o;if(s2)s2.innerHTML='<option value="">Selecionar...</option>'+o;if(s3)s3.innerHTML='<option value="">Selecione...</option>'+o;}}catch(e){carregarVendedoresOffline();} }
function carregarVendedoresOffline() { const o = ["Bruno Garcia Queiroz", "Ana Paula Rodrigues", "Vendedor Teste"].map(v=>`<option value="${v}">${v}</option>`).join(''); document.getElementById('userSelect').innerHTML = '<option value="">Modo Offline</option>'+o; }
function showLoading(s,t){const l=document.getElementById('loader');if(l)l.style.display=s?'flex':'none';if(t)document.getElementById('loaderText').innerText=t}
function fecharLeadModal(){document.getElementById('leadModal').classList.add('hidden')}
function atualizarDataCabecalho(){document.getElementById('headerDate').innerText=new Date().toLocaleDateString('pt-BR')}
function atualizarDashboard(){const h=new Date().toLocaleDateString('pt-BR');document.getElementById('statLeads').innerText=leadsCache.filter(l=>l.timestamp&&l.timestamp.includes(h)).length}
function verificarAgendamentosHoje(){const h=new Date().toLocaleDateString('pt-BR');const r=leadsCache.filter(l=>l.agendamento&&l.agendamento.includes(h));if(r.length>0)document.getElementById('lembreteBanner').classList.remove('hidden');else document.getElementById('lembreteBanner').classList.add('hidden')}
// Leads
function filtrarLeadsHoje(){const h=new Date().toLocaleDateString('pt-BR');const l=leadsCache.filter(x=>x.timestamp&&x.timestamp.includes(h));navegarPara('gestaoLeads');renderListaLeads(l);document.getElementById('searchLead').placeholder=`Hoje (${l.length})`}
function filtrarRetornos(){const h=new Date().toLocaleDateString('pt-BR');const l=leadsCache.filter(x=>x.agendamento&&x.agendamento.includes(h));navegarPara('gestaoLeads');renderListaLeads(l);document.getElementById('searchLead').placeholder=`Retornos (${l.length})`}
function filtrarPorStatus(s){document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));if(event.target)event.target.classList.add('active');const l=s==='Todos'?leadsCache:leadsCache.filter(x=>x.status===s||x.interesse===s);renderListaLeads(l)}
async function carregarLeads(s=true){if(!navigator.onLine){if(document.getElementById('listaLeadsGestao'))renderLeads();return}const r=await apiCall('getLeads',{vendedor:loggedUser},s);if(r.status==='success'){leadsCache=r.data||[];localStorage.setItem('mhnet_leads_cache',JSON.stringify(leadsCache));if(r.isAdmin)document.getElementById('adminPanel')?.classList.remove('hidden');if(document.getElementById('listaLeadsGestao'))renderLeads();atualizarDashboard()}}
function renderLeads(){const t=(document.getElementById('searchLead')?.value||'').toLowerCase();const l=leadsCache.filter(x=>(x.nomeLead||'').toLowerCase().includes(t)||(x.bairro||'').toLowerCase().includes(t));renderListaLeads(l)}
function renderListaLeads(l){const d=document.getElementById('listaLeadsGestao');if(!d)return;if(l.length===0){d.innerHTML='<div class="text-center mt-10 text-gray-400">Vazio.</div>';return}d.innerHTML=l.map((x,i)=>criarCardLead(x,leadsCache.indexOf(x))).join('')}
function criarCardLead(l,i){let c="bg-slate-100 text-slate-500";if(l.status==='Venda Fechada')c="bg-green-500 text-white font-bold";else if(l.status==='Agendado')c="bg-orange-100 text-orange-600 font-bold";return`<div onclick="abrirLeadDetalhes(${i})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm"><div class="flex justify-between"><div><div class="font-bold text-lg">${l.nomeLead}</div><div class="text-xs text-slate-500">${l.bairro} • ${l.provedor||'-'}</div></div><span class="text-[10px] px-2 py-1 rounded-full ${c}">${l.status||'Novo'}</span></div></div>`}
function abrirLeadDetalhes(i){const l=leadsCache[i];if(!l)return;leadAtualParaAgendar=l;document.getElementById('modalLeadNome').innerText=l.nomeLead;document.getElementById('modalLeadBairro').innerText=l.bairro||'-';document.getElementById('modalLeadCidade').innerText=l.cidade||'-';document.getElementById('modalLeadTelefone').innerText=l.telefone||'-';document.getElementById('modalLeadProvedor').innerText=l.provedor||"--";document.getElementById('modalStatusFunil').value=l.status||"Novo";document.getElementById('modalLeadObs').value=l.observacao||"";const b=document.getElementById('btnModalWhats');if(b)b.onclick=()=>window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`,'_blank');document.getElementById('containerRaioX').innerHTML=`<button onclick="raioXConcorrencia()" class="ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px]">Raio-X</button>`;document.getElementById('leadModal').classList.remove('hidden')}
async function salvarEdicaoModal(){if(!leadAtualParaAgendar)return;const s=document.getElementById('modalStatusFunil').value;const o=document.getElementById('modalLeadObs').value;leadAtualParaAgendar.status=s;leadAtualParaAgendar.observacao=o;const d=document.getElementById('agendarData').value;if(d){const[a,m,day]=d.split('-');leadAtualParaAgendar.agendamento=`${day}/${m}/${a} ${document.getElementById('agendarHora').value||'09:00'}`}localStorage.setItem('mhnet_leads_cache',JSON.stringify(leadsCache));renderLeads();showLoading(true);await Promise.all([apiCall('updateStatus',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,status:s},false),apiCall('updateObservacao',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,observacao:o},false)]);if(d)await apiCall('updateAgendamento',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,agendamento:leadAtualParaAgendar.agendamento},false);showLoading(false);fecharLeadModal()}
function editarLeadAtual(){if(!leadAtualParaAgendar)return;const l=leadAtualParaAgendar;document.getElementById('leadNome').value=l.nomeLead;document.getElementById('leadTelefone').value=l.telefone;document.getElementById('leadEndereco').value=l.endereco;document.getElementById('leadBairro').value=l.bairro;document.getElementById('leadCidade').value=l.cidade;document.getElementById('leadProvedor').value=l.provedor;document.getElementById('leadObs').value=l.observacao;const s=document.getElementById('leadStatus');if(s)s.value=l.status||"Novo";editingLeadIndex=leadsCache.indexOf(l);fecharLeadModal();navegarPara('cadastroLead')}
async function enviarLead(){const p={vendedor:loggedUser,nomeLead:document.getElementById('leadNome').value,telefone:document.getElementById('leadTelefone').value,endereco:document.getElementById('leadEndereco').value,bairro:document.getElementById('leadBairro').value,cidade:document.getElementById('leadCidade').value,provedor:document.getElementById('leadProvedor').value,interesse:document.getElementById('leadInteresse').value,status:document.getElementById('leadStatus').value,observacao:document.getElementById('leadObs').value};let r='addLead';if(editingLeadIndex!==null){r='updateLeadFull';p._linha=leadsCache[editingLeadIndex]._linha;p.nomeLeadOriginal=leadsCache[editingLeadIndex].nomeLead}else if(document.getElementById('leadVendedorDestino')?.value){r='forwardLead';p.novoVendedor=document.getElementById('leadVendedorDestino').value;p.origem=loggedUser}const res=await apiCall(r,p);if(res.status==='success'||res.local){alert("Salvo!");if(editingLeadIndex===null&&!res.local&&!p.novoVendedor)leadsCache.unshift(p);localStorage.setItem('mhnet_leads_cache',JSON.stringify(leadsCache));editingLeadIndex=null;navegarPara('gestaoLeads')}else alert("Erro.")}
async function abrirIndicadores(){navegarPara('indicadores');['funnelLeads','funnelNegociacao','funnelVendas'].forEach(id=>document.getElementById(id).innerText='...');const r=await apiCall('getIndicators',{vendedor:loggedUser},false);if(r.status==='success'){const d=r.data;document.getElementById('funnelLeads').innerText=d.totalLeads;document.getElementById('funnelNegociacao').innerText=d.negociacao;document.getElementById('funnelVendas').innerText=d.vendas;document.getElementById('indRealizado').innerText=d.vendas;}}
async function carregarTarefas(){const d=document.getElementById('listaTarefasContainer');d.innerHTML='Carregando...';const r=await apiCall('getTasks',{vendedor:loggedUser},false);if(r.status==='success')d.innerHTML=r.data.length?r.data.map(t=>`<div class="bg-white p-3 rounded shadow mb-2 flex gap-2"><input type="checkbox" ${t.status==='CONCLUIDA'?'checked':''} onchange="toggleTask('${t.id}','${t.status}')"><span>${t.descricao}</span></div>`).join(''):'Sem tarefas.';else d.innerHTML='Erro.'}
function abrirModalTarefa(){document.getElementById('taskModal').classList.remove('hidden')}
async function salvarTarefa(){await apiCall('addTask',{vendedor:loggedUser,descricao:document.getElementById('taskDesc').value,dataLimite:document.getElementById('taskDate').value});document.getElementById('taskModal').classList.add('hidden');carregarTarefas()}
async function toggleTask(i,s){await apiCall('toggleTask',{taskId:i,status:s,vendedor:loggedUser},false);carregarTarefas()}
async function limparTarefasConcluidas(){if(confirm("Limpar?"))await apiCall('archiveTasks',{vendedor:loggedUser});carregarTarefas()}
async function verHistoricoFaltas(){const d=document.getElementById('listaHistoricoFaltas');document.getElementById('historicoFaltasContainer').classList.remove('hidden');document.getElementById('formFaltaContainer').classList.add('hidden');const r=await apiCall('getAbsences',{vendedor:loggedUser},false);if(r.status==='success')d.innerHTML=r.data.map(f=>`<div class="bg-white p-3 mb-2 rounded shadow"><div class="font-bold text-xs">${f.motivo}</div><div class="text-[10px]">${f.dataFalta} • ${f.statusEnvio}</div></div>`).join('')}
function ocultarHistoricoFaltas(){document.getElementById('historicoFaltasContainer').classList.add('hidden');document.getElementById('formFaltaContainer').classList.remove('hidden')}
function abrirConfiguracoes(){document.getElementById('configModal').classList.remove('hidden')}
async function gerirEquipe(a){await apiCall('manageTeam',{acao:a,nome:document.getElementById('cfgNomeVendedor').value,meta:document.getElementById('cfgMeta').value});alert("Feito!");carregarVendedores()}
async function encaminharLeadModal(){const n=document.getElementById('modalLeadDestino').value;if(!n)return alert("Selecione");if(confirm("Encaminhar?")){await apiCall('forwardLead',{nomeLead:leadAtualParaAgendar.nomeLead,telefone:leadAtualParaAgendar.telefone,novoVendedor:n,origem:loggedUser});alert("Encaminhado!");fecharLeadModal();carregarLeads()}}
async function combaterObjecaoGeral(){const o=document.getElementById('inputObjecaoGeral').value;showLoading(true);const r=await apiCall('solveObjection',{objection:o});showLoading(false);if(r.status==='success'){document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer;document.getElementById('resultadoObjecaoGeral').classList.remove('hidden')}}
async function combaterObjecaoLead(){const o=document.getElementById('inputObjecaoLead').value;showLoading(true);const r=await apiCall('solveObjection',{objection:o});showLoading(false);if(r.status==='success')document.getElementById('respostaObjecaoLead').value=r.answer.replace(/[\*#]/g,'')}
async function salvarObjecaoLead(){await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value});alert("Salvo!")}
async function analiseEstrategicaIA(){showLoading(true);const r=await perguntarIABackend(`Analise lead ${leadAtualParaAgendar.nomeLead}`);showLoading(false);if(r) { document.getElementById('modalLeadObs').value += "\n\n[IA]: " + r.replace(/\*\*/g,''); alert("Adicionado!"); } }
async function raioXConcorrencia(){const p=document.getElementById('modalLeadProvedor').innerText;showLoading(true);const r=await perguntarIABackend(`Raio-X ${p}`);showLoading(false);if(r)document.getElementById('modalLeadObs').value += "\n\n[RX]: " + r}
async function refinarObsIA(){const o=document.getElementById('leadObs');showLoading(true);const r=await perguntarIABackend(`Reescreva: "${o.value}"`);showLoading(false);if(r)o.value=r.replace(/\*\*/g,'')}
async function gerarCoachIA(){showLoading(true);const r=await perguntarIABackend("Frase motivacional");showLoading(false);if(r)alert(`🚀 ${r.replace(/\*\*/g,'')}`);}
async function consultarPlanosIA(){document.getElementById('chatModal').classList.remove('hidden')}
function toggleChat(){document.getElementById('chatModal').classList.add('hidden')}
async function enviarMensagemChat(){const i=document.getElementById('chatInput');const m=i.value;if(!m)return;document.getElementById('chatHistory').innerHTML+=`<div class="text-right p-2 mb-1 bg-blue-50 rounded">${m}</div>`;i.value='';const r=await perguntarIABackend(m);document.getElementById('chatHistory').innerHTML+=`<div class="text-left p-2 bg-gray-100 mb-1 rounded">${r}</div>`;}
async function buscarEnderecoGPS(){navigator.geolocation.getCurrentPosition(p=>{fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json()).then(d=>{if(d.address){document.getElementById('leadEndereco').value=d.address.road;document.getElementById('leadBairro').value=d.address.suburb}})},()=>{alert('Erro GPS')})}
function iniciarDitado(t){const r=new(window.SpeechRecognition||window.webkitSpeechRecognition)();r.lang='pt-BR';r.start();r.onresult=e=>{document.getElementById(t).value+=e.results[0][0].transcript}}
function copiarTexto(id){document.getElementById(id).select();document.execCommand('copy');alert("Copiado!")}
function enviarZapTexto(id){window.open(`https://wa.me/?text=${encodeURIComponent(document.getElementById(id).value)}`,'_blank')}
async function gerarAbordagemIA(){const nome=document.getElementById('leadNome').value;showLoading(true);const t=await perguntarIABackend(`Pitch curto para ${nome}`);showLoading(false);if(t)document.getElementById('leadObs').value=t}
async function gerarScriptVendaIA(){if(!leadAtualParaAgendar)return;showLoading(true);const r=await perguntarIABackend(`Script WhatsApp para ${leadAtualParaAgendar.nomeLead}`);showLoading(false);if(r)alert("Copiado: "+r)}
async function perguntarIABackend(p){ try { const r=await apiCall('askAI',{question:p},false); return r.status==='success' ? r.answer : null; } catch(e){return null;} }
function preencherEdicaoFalta(f){document.getElementById('historicoFaltasContainer').classList.add('hidden');document.getElementById('formFaltaContainer').classList.remove('hidden');const [d, m, a] = f.dataFalta.split('/');document.getElementById('faltaData').value = `${a}-${m}-${d}`;document.getElementById('faltaMotivo').value = f.motivo;document.getElementById('faltaObs').value = f.obs;editingAbsenceIndex = f._linha;document.getElementById('btnEnviarFalta').innerHTML = 'ATUALIZAR';}
async function enviarPayloadFalta(r,p){const res = await apiCall(r, p);showLoading(false);if (res.status === 'success') {alert(editingAbsenceIndex ? "Atualizado!" : "Enviado!");ocultarHistoricoFaltas();navegarPara('dashboard');} else alert("Erro ao enviar.");}
function ajustarMicrofone(){const btn=document.getElementById('btnMicNome');if(btn){btn.removeAttribute('onclick');btn.onclick=()=>iniciarDitado('leadObs');}}
