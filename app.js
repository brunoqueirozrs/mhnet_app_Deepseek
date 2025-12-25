/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V91 (GESTÃO & VISUAL)
 * ============================================================
 * 📝 UPDATE:
 * - Lógica de Funil de Vendas (Leads -> Negociação -> Vendas).
 * - Painel Admin para "Bruno Garcia Queiroz".
 * - Encaminhamento de Leads.
 * - Correção de ícones de Materiais.
 * ============================================================
 */

// ⚠️ ID DO BACKEND V90 (Confirmado)
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

// 1. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V91 - Gestão Ativa");
    
    carregarVendedores();
    
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { try { leadsCache = JSON.parse(saved); } catch(e) {} }
    
    if (loggedUser) {
         initApp();
    } else {
         document.getElementById('userMenu').style.display = 'flex';
         document.getElementById('mainContent').style.display = 'none';
    }
});

// 2. CORE
function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    document.getElementById('userInfo').innerText = loggedUser;
    
    atualizarDataCabecalho();

    // Lógica de Admin (Bruno Garcia Queiroz)
    if (loggedUser === "Bruno Garcia Queiroz") {
        const btnAdmin = document.getElementById('btnAdminSettings');
        const divEncaminhar = document.getElementById('divEncaminhar');
        if(btnAdmin) btnAdmin.classList.remove('hidden');
        if(divEncaminhar) divEncaminhar.classList.remove('hidden');
    }

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

    // Hooks Específicos
    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') abrirIndicadores(); // Chama API
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
            // Limpa form se for novo
            document.querySelectorAll('#cadastroLead input, #cadastroLead textarea').forEach(el => el.value = '');
            const sel = document.getElementById('leadInteresse'); if(sel) sel.value = 'Médio';
            const selVend = document.getElementById('leadVendedorDestino'); if(selVend) selVend.value = '';
        }
    }
    if (pageId === 'materiais' && !currentFolderId) setTimeout(() => carregarMateriais(null), 100);
    if (pageId === 'faltas') ocultarHistoricoFaltas();
}

// 4. FUNIL DE VENDAS & INDICADORES
async function abrirIndicadores() {
    // Apenas navega visualmente
    document.querySelectorAll('.page').forEach(e=>e.style.display='none'); 
    document.getElementById('indicadores').style.display='block';

    // Reseta valores visuais
    ['funnelLeads', 'funnelNegociacao', 'funnelVendas', 'indRealizado', 'indMeta'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerText = '...';
    });
    
    document.getElementById('indAnaliseIA').innerText = '🤖 Analisando performance...';
    
    const res = await apiCall('getIndicators', { vendedor: loggedUser }, false);
    
    if (res && res.status === 'success') {
        const d = res.data;
        
        // Dados do Funil
        document.getElementById('funnelLeads').innerText = d.totalLeads;
        document.getElementById('funnelNegociacao').innerText = d.negociacao || 0;
        document.getElementById('funnelVendas').innerText = d.vendas;
        
        // Dados Gerais
        document.getElementById('indMes').innerText = d.mes;
        document.getElementById('indCiclo').innerText = `Ciclo: ${d.ciclo}`; // Backend V90 não retorna ciclo formatado, ajustado lá? Se não, formatar aqui. Assumindo backend.
        document.getElementById('indRealizado').innerText = d.vendas;
        document.getElementById('indMeta').innerText = d.meta;
        
        // Atualiza barra de progresso se existir
        const progBar = document.getElementById('indProgresso');
        if(progBar) progBar.style.width = `${Math.min(d.porcentagem, 100)}%`;

        // IA Coach
        apiCall('analyzeIndicators', { 
            vendas: d.vendas, 
            meta: d.meta, 
            diasUteisRestantes: d.diasUteisRestantes 
        }).then(r => {
             if(r.status === 'success') document.getElementById('indAnaliseIA').innerText = r.message;
        });
    } else {
        document.getElementById('indAnaliseIA').innerText = 'Não foi possível carregar os dados.';
    }
}

// 5. GESTÃO DE LEADS

// Filtro de Leads Hoje
function filtrarLeadsHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    navegarPara('gestaoLeads');
    
    const leadsHoje = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje));
    
    const div = document.getElementById('listaLeadsGestao');
    div.innerHTML = "";
    
    if (leadsHoje.length === 0) {
        div.innerHTML = '<div class="text-center mt-10 text-gray-400">Nenhum lead hoje.</div>';
        return;
    }
    
    div.innerHTML = leadsHoje.map((l, i) => {
        // Precisamos encontrar o índice real no cache global para o clique funcionar
        const realIndex = leadsCache.indexOf(l);
        return criarCardLead(l, realIndex);
    }).join('');
    
    document.getElementById('searchLead').placeholder = `Filtrado: Hoje (${leadsHoje.length})`;
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
        
        if (res.isAdmin) {
            const panel = document.getElementById('adminPanel');
            if(panel) panel.classList.remove('hidden');
        }
        
        if(document.getElementById('listaLeadsGestao') && document.getElementById('gestaoLeads').style.display === 'block') renderLeads();
        atualizarDashboard();
    }
}

function renderLeads() {
    const div = document.getElementById('listaLeadsGestao');
    if (!div) return;
    const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
    
    const lista = leadsCache.filter(l => 
        (l.nomeLead||'').toLowerCase().includes(term) || 
        (l.bairro||'').toLowerCase().includes(term) ||
        (l.provedor||'').toLowerCase().includes(term)
    );
    
    if (!lista.length) { div.innerHTML = '<div class="text-center mt-10 text-gray-400">Nada encontrado.</div>'; return; }

    div.innerHTML = lista.map((l, i) => {
        const realIndex = leadsCache.indexOf(l);
        return criarCardLead(l, realIndex);
    }).join('');
}

function criarCardLead(l, index) {
    let badge = "bg-slate-100 text-slate-500";
    if (l.interesse === 'Alto') badge = "bg-green-100 text-green-700 ring-1 ring-green-200";
    else if (l.interesse === 'Baixo') badge = "bg-blue-50 text-blue-400";
    if (l.status === 'Venda Fechada') badge = "bg-green-600 text-white font-bold ring-2 ring-green-300";

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition">
        <div class="flex justify-between items-start">
            <div>
                <div class="font-bold text-slate-800 text-lg">${l.nomeLead}</div>
                <div class="text-xs text-slate-500">${l.bairro || '-'} • ${l.provedor || '-'}</div>
            </div>
            <span class="text-[10px] px-2 py-1 rounded-full font-bold ${badge}">${l.status === 'Venda Fechada' ? 'VENDIDO' : (l.interesse || 'Médio')}</span>
        </div>
    </div>`;
}

// 6. GESTÃO DE EQUIPE & ENCAMINHAMENTO (ADMIN)

function abrirConfiguracoes() {
    document.getElementById('configModal').classList.remove('hidden');
}

async function gerirEquipe(acao) {
    const nome = document.getElementById('cfgNomeVendedor').value;
    const meta = document.getElementById('cfgMeta').value;
    if(!nome) return alert("Nome obrigatório");
    
    showLoading(true, "ATUALIZANDO...");
    const res = await apiCall('manageTeam', { acao, nome, meta });
    showLoading(false);
    
    if(res.status === 'success') {
        alert("Equipe atualizada!");
        carregarVendedores(); // Recarrega lista
        document.getElementById('configModal').classList.add('hidden');
    } else alert("Erro ao atualizar equipe.");
}

async function encaminharLeadModal() {
    const novoVendedor = document.getElementById('modalLeadDestino').value;
    if(!novoVendedor) return alert("Selecione um vendedor para encaminhar.");
    
    if(!confirm(`Encaminhar lead para ${novoVendedor}?`)) return;
    
    showLoading(true, "ENCAMINHANDO...");
    const res = await apiCall('forwardLead', { 
        nomeLead: leadAtualParaAgendar.nomeLead, 
        telefone: leadAtualParaAgendar.telefone,
        novoVendedor: novoVendedor,
        origem: loggedUser
    });
    showLoading(false);
    
    if(res.status === 'success') {
        alert("✅ Lead encaminhado com sucesso!");
        fecharLeadModal();
        carregarLeads(); // Recarrega para refletir a mudança
    } else {
        alert("Erro ao encaminhar: " + (res.message || "Desconhecido"));
    }
}

// 7. CARREGAMENTO DE DADOS

async function carregarVendedores() {
    const s = document.getElementById('userSelect');
    const s2 = document.getElementById('modalLeadDestino'); // Modal Detalhes
    const s3 = document.getElementById('leadVendedorDestino'); // Cadastro
    
    if(!s) return;
    s.innerHTML = '<option value="">Conectando...</option>';

    try {
        const res = await apiCall('getVendors', {}, false);
        if(res.status === 'success') {
            vendorsCache = res.data;
            const options = res.data.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
            
            s.innerHTML = '<option value="">Selecione...</option>' + options;
            if(s2) s2.innerHTML = '<option value="">Selecionar...</option>' + options;
            if(s3) s3.innerHTML = '<option value="">Selecione Vendedor...</option>' + options;
        } else throw new Error("Vazio");
    } catch(e) {
        // Fallback offline se necessário
        const VENDEDORES_OFFLINE = ["Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader", "Bruno Garcia Queiroz"];
        s.innerHTML = '<option value="">Modo Offline</option>' + VENDEDORES_OFFLINE.map(n => `<option value="${n}">${n}</option>`).join('');
    }
}

async function carregarMateriais(f=null, s="") {
    const div = document.getElementById('materiaisGrid');
    if (!div) return;
    currentFolderId = f; 
    div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10">Carregando...</div>';
    
    try {
        const res = await apiCall('getImages', { folderId: f, search: s }, false);
        if (res && res.status === 'success' && res.data) {
            atualizarNavegacaoMateriais(res.isRoot);
            
            if(res.data.length === 0) {
                 div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10">Vazio.</div>';
                 return;
            }

            // CORREÇÃO ÍCONES
            div.innerHTML = res.data.map(item => {
                if (item.type === 'folder') {
                    // Ícone FontAwesome para pastas
                    return `
                    <div onclick="carregarMateriais('${item.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex flex-col items-center justify-center gap-2 cursor-pointer h-36 group hover:bg-blue-50">
                        <i class="fas fa-folder text-5xl text-[#00aeef] drop-shadow-sm group-hover:scale-110 transition"></i>
                        <span class="text-xs font-bold text-slate-600 text-center leading-tight line-clamp-2">${item.name}</span>
                    </div>`;
                } else {
                    // Imagem normal
                    return `
                    <div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-48 relative overflow-hidden group">
                        <div class="h-32 w-full bg-gray-50 rounded-xl overflow-hidden relative"><img src="${item.thumbnail}" class="w-full h-full object-cover" alt="${item.name}"></div>
                        <div class="flex-1 flex items-center justify-between mt-2 px-1"><span class="text-[10px] text-gray-500 font-bold truncate flex-1">${item.name}</span><a href="${item.downloadUrl}" target="_blank" class="text-blue-500 text-xs font-bold">Baixar</a></div>
                    </div>`;
                }
            }).join('');
        } else { throw new Error("Erro API"); }
    } catch (error) {
        div.innerHTML = `<div class="col-span-2 text-center text-red-400 py-10">Erro.</div>`;
    }
}

// 8. EDIÇÃO E CADASTRO

window.editarLeadAtual = function() {
    if (!leadAtualParaAgendar) return;
    const l = leadAtualParaAgendar;
    
    // Preenche campos do formulário de cadastro com dados do lead
    const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ""; }
    setVal('leadNome', l.nomeLead);
    setVal('leadTelefone', l.telefone);
    setVal('leadEndereco', l.endereco);
    setVal('leadBairro', l.bairro);
    setVal('leadCidade', l.cidade);
    setVal('leadProvedor', l.provedor);
    setVal('leadObs', l.observacao);
    
    const selInt = document.getElementById('leadInteresse');
    if(selInt) selInt.value = l.interesse || "Médio";
    
    editingLeadIndex = leadsCache.indexOf(l);
    fecharLeadModal();
    navegarPara('cadastroLead');
}

async function enviarLead() {
    const nome = document.getElementById('leadNome').value;
    const tel = document.getElementById('leadTelefone').value;
    
    if(!nome || !tel) return alert("Preencha Nome e WhatsApp.");
    
    // Se estiver editando
    if (editingLeadIndex !== null) {
        alert("⚠️ Edição: Atualizando dados.");
        const obs = document.getElementById('leadObs').value;
        // Na V90 só atualiza obs para segurança, se quiser tudo, precisaria de uma rota updateLead completa
        apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: nome, observacao: obs });
        
        leadsCache[editingLeadIndex].observacao = obs;
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        editingLeadIndex = null;
        navegarPara('gestaoLeads');
        return;
    }

    const payload = {
        vendedor: loggedUser,
        nomeLead: nome,
        telefone: tel,
        endereco: document.getElementById('leadEndereco').value,
        bairro: document.getElementById('leadBairro').value,
        cidade: document.getElementById('leadCidade').value,
        provedor: document.getElementById('leadProvedor').value,
        interesse: document.getElementById('leadInteresse').value,
        observacao: document.getElementById('leadObs').value,
        agendamento: "",
        
        // Se for admin e tiver escolhido destino
        encaminhadoPara: document.getElementById('leadVendedorDestino')?.value || ""
    };
    
    // Se encaminhado, muda o vendedor no payload
    if (payload.encaminhadoPara) {
        payload.vendedorOriginal = loggedUser;
        payload.vendedor = payload.encaminhadoPara;
    }
    
    const res = await apiCall('addLead', payload);
    if (res && (res.status === 'success' || res.local)) {
        alert("Salvo com sucesso!");
        if(!res.local && !payload.encaminhadoPara) leadsCache.unshift(payload);
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        navegarPara('gestaoLeads');
    } else alert('Erro ao salvar.');
}

// ... (RESTANTE DAS FUNÇÕES UTILITÁRIAS MANTIDAS: Modal, Faltas, Tarefas) ...

function setLoggedUser(){const v=document.getElementById('userSelect').value;if(v){loggedUser=v;localStorage.setItem('loggedUser',v);initApp()}else alert("Selecione!")}
function logout(){localStorage.removeItem('loggedUser');location.reload()}
function showLoading(s,t){document.getElementById('loader').style.display=s?'flex':'none';if(t)document.getElementById('loaderText').innerText=t}
async function apiCall(r,p,s=true){if(s)showLoading(true);try{const f=await fetch(API_URL,{method:'POST',body:JSON.stringify({route:r,payload:p})});const j=await f.json();if(s)showLoading(false);return j}catch(e){if(s)showLoading(false);return{status:'error'}}}
function atualizarDataCabecalho(){document.getElementById('headerDate').innerText=new Date().toLocaleDateString('pt-BR')}
function atualizarDashboard(){const h=new Date().toLocaleDateString('pt-BR');const c=leadsCache.filter(l=>l.timestamp&&l.timestamp.includes(h)).length;document.getElementById('statLeads').innerText=c}
function verificarAgendamentosHoje(){/*Simples*/}
function abrirLeadDetalhes(i){leadAtualParaAgendar=leadsCache[i];document.getElementById('modalLeadNome').innerText=leadAtualParaAgendar.nomeLead;document.getElementById('leadModal').classList.remove('hidden')}
function fecharLeadModal(){document.getElementById('leadModal').classList.add('hidden')}
async function excluirLead(){if(!confirm("Excluir?"))return;await apiCall('deleteLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead});alert("Excluído.");fecharLeadModal();carregarLeads()}
async function marcarVendaFechada(){if(!confirm("Venda?"))return;await apiCall('updateStatus',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,status:"Venda Fechada"});alert("Parabéns!");fecharLeadModal()}
async function salvarAgendamento(){const a=document.getElementById('agendarData').value;await apiCall('updateAgendamento',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,agendamento:a});alert("Agendado!");fecharLeadModal()}
async function salvarObservacaoModal(){await apiCall('updateObservacao',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,observacao:document.getElementById('modalLeadObs').value});alert("Salvo!")}
// Tarefas
async function carregarTarefas(){const d=document.getElementById('listaTarefasContainer');d.innerHTML='Carregando...';const r=await apiCall('getTasks',{vendedor:loggedUser},false);if(r.status==='success'){d.innerHTML=r.data.map(t=>`<div class="bg-white p-4 shadow mb-2">${t.descricao}</div>`).join('')}}
function abrirModalTarefa(){document.getElementById('taskModal').classList.remove('hidden')}
async function salvarTarefa(){await apiCall('addTask',{vendedor:loggedUser,descricao:document.getElementById('taskDesc').value,dataLimite:document.getElementById('taskDate').value});document.getElementById('taskModal').classList.add('hidden');carregarTarefas()}
async function limparTarefasConcluidas(){if(confirm("Limpar?"))await apiCall('archiveTasks',{vendedor:loggedUser});carregarTarefas()}
// Faltas
async function verHistoricoFaltas(){const d=document.getElementById('listaHistoricoFaltas');document.getElementById('historicoFaltasContainer').classList.remove('hidden');const r=await apiCall('getAbsences',{vendedor:loggedUser},false);if(r.status==='success')d.innerHTML=r.data.map(f=>`<div class="bg-white p-2 mb-1 shadow">${f.motivo}</div>`).join('')}
function ocultarHistoricoFaltas(){document.getElementById('historicoFaltasContainer').classList.add('hidden')}
async function enviarJustificativa(){showLoading(true);await apiCall('registerAbsence',{vendedor:loggedUser,motivo:document.getElementById('faltaMotivo').value,dataFalta:document.getElementById('faltaData').value,observacao:document.getElementById('faltaObs').value});showLoading(false);alert("Enviado!");navegarPara('dashboard')}
function atualizarNavegacaoMateriais(r){const b=document.querySelector('#materiais button');if(b)b.onclick=r?()=>navegarPara('dashboard'):()=>carregarMateriais(null)}
function buscarMateriais(){carregarMateriais(currentFolderId,document.getElementById('searchMateriais').value)}
async function buscarEnderecoGPS(){navigator.geolocation.getCurrentPosition(p=>{fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json()).then(d=>{if(d.address){document.getElementById('leadEndereco').value=d.address.road;document.getElementById('leadBairro').value=d.address.suburb}})},()=>{alert('Erro GPS')})}
function iniciarDitado(t){const r=new(window.SpeechRecognition||window.webkitSpeechRecognition)();r.lang='pt-BR';r.start();r.onresult=e=>{document.getElementById(t).value+=e.results[0][0].transcript}}
function copiarTexto(id){document.getElementById(id).select();document.execCommand('copy');alert("Copiado!")}
function enviarZapTexto(id){window.open(`https://wa.me/?text=${encodeURIComponent(document.getElementById(id).value)}`,'_blank')}
// IA
async function combaterObjecaoGeral(){const o=document.getElementById('inputObjecaoGeral').value;const r=await apiCall('solveObjection',{objection:o});if(r.status==='success'){document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer;document.getElementById('resultadoObjecaoGeral').classList.remove('hidden')}}
async function combaterObjecaoLead(){const o=document.getElementById('inputObjecaoLead').value;const r=await apiCall('solveObjection',{objection:o});if(r.status==='success')document.getElementById('respostaObjecaoLead').value=r.answer.replace(/[\*#]/g,'')}
async function salvarObjecaoLead(){await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value});alert("Salvo!")}
async function analiseEstrategicaIA(){const r=await apiCall('askAI',{question:`Analise lead ${leadAtualParaAgendar.nomeLead}`});if(r.status==='success')alert(r.answer)}
async function gerarCoachIA(){const r=await apiCall('askAI',{question:'Frase motivacional'});if(r.status==='success')alert(r.answer)}
async function consultarPlanosIA(){document.getElementById('chatModal').classList.remove('hidden')}
function toggleChat(){document.getElementById('chatModal').classList.add('hidden')}
async function enviarMensagemChat(){const i=document.getElementById('chatInput');const m=i.value;i.value='';const r=await apiCall('askAI',{question:m});document.getElementById('chatHistory').innerHTML+=`<div class="bg-gray-100 p-2 mb-1">${r.answer}</div>`}
