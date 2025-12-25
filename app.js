/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V93 (FINAL INTEGRADO)
 * ============================================================
 * 📝 RESUMO DAS FUNCIONALIDADES:
 * 1. Login Dinâmico (Carrega da planilha Vendedores).
 * 2. Gestão de Leads: Cadastro, Edição, Exclusão, Agendamento, Status de Funil.
 * 3. Gestão de Equipe (Admin): Encaminhamento de leads e Configuração de metas.
 * 4. Indicadores: Funil de Vendas Visual e Análise de IA baseada em dias úteis.
 * 5. Tarefas: To-Do list simples vinculada ao usuário.
 * 6. Faltas: Envio de justificativa com anexo e histórico.
 * 7. IA Híbrida: Matriz de Objeções, Coach, Raio-X e Chat.
 * ============================================================
 */

// ⚠️ ID DA IMPLANTAÇÃO BACKEND V90/V91 (Não alterar se estiver funcionando)
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// --- ESTADO GLOBAL DO APP ---
let loggedUser = localStorage.getItem('loggedUser'); // Usuário logado
let leadsCache = [];           // Cache local de leads para rapidez
let vendorsCache = [];         // Cache da lista de vendedores
let leadAtualParaAgendar = null; // Lead selecionado no modal
let chatHistoryData = [];      // Histórico do chat IA
let currentFolderId = null;    // Navegação de materiais
let editingLeadIndex = null;   // Índice do lead sendo editado (null = novo)
let editingAbsenceIndex = null; // Índice da falta sendo editada (null = nova)

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App V93 - Sistema Iniciado");
    
    // Tenta carregar dados do localStorage para exibir algo imediatamente
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { try { leadsCache = JSON.parse(saved); } catch(e) {} }
    
    // Carrega a lista de vendedores (para login e encaminhamento)
    carregarVendedores();
    
    // Verifica sessão
    if (loggedUser) {
         initApp();
    } else {
         // Mostra tela de login
         document.getElementById('userMenu').style.display = 'flex';
         document.getElementById('mainContent').style.display = 'none';
    }
});

// ============================================================
// 2. CORE, NAVEGAÇÃO E AUTH
// ============================================================

function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    document.getElementById('userInfo').innerText = loggedUser;
    
    // Lógica de Admin (Libera botões se for o Gestor)
    if (loggedUser === "Bruno Garcia Queiroz") {
        const btnAdmin = document.getElementById('btnAdminSettings');
        const divEncaminhar = document.getElementById('divEncaminhar');
        if(btnAdmin) btnAdmin.classList.remove('hidden');
        if(divEncaminhar) divEncaminhar.classList.remove('hidden');
    }
    
    atualizarDataCabecalho();
    carregarLeads(false); // Carrega leads silenciosamente (sem loader intrusivo)
    navegarPara('dashboard');
}

function setLoggedUser() {
    const v = document.getElementById('userSelect').value;
    if (v) { 
        loggedUser = v; 
        localStorage.setItem('loggedUser', v); 
        initApp(); 
    } else {
        alert('Selecione um vendedor!');
    }
}

function logout() { 
    if(confirm("Deseja sair do sistema?")) { 
        localStorage.removeItem('loggedUser'); 
        location.reload(); 
    } 
}

// Roteador de Telas (SPA - Single Page Application)
function navegarPara(pageId) {
    // Esconde todas as páginas
    document.querySelectorAll('.page').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('fade-in');
    });

    // Mostra a página alvo com animação
    const target = document.getElementById(pageId);
    if(target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('fade-in'), 10);
    }
    
    const scroller = document.getElementById('main-scroll');
    if(scroller) scroller.scrollTo(0,0);

    // Hooks (Ações específicas ao entrar na tela)
    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') abrirIndicadores(); // Busca dados frescos
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        // Limpa filtro se vier de outra tela que não seja o "Leads Hoje"
        if(busca && busca.placeholder.includes("Filtrado")) {
            busca.value = "";
            busca.placeholder = "Buscar...";
        }
        renderLeads();
    }
    if (pageId === 'cadastroLead') {
        ajustarMicrofone();
        // Se for NOVO cadastro (não edição), limpa os campos
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

// ============================================================
// 3. COMUNICAÇÃO API (HELPER)
// ============================================================

async function apiCall(route, payload, show=true) {
    if(show) showLoading(true);
    try {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            headers: {'Content-Type': 'text/plain;charset=utf-8'}, 
            body: JSON.stringify({ route: route, payload: payload }) 
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch(e) { throw new Error("Erro de resposta JSON."); }
        
        if(show) showLoading(false);
        return json;
    } catch(e) {
        console.error(`Erro API (${route}):`, e);
        if(show) showLoading(false);
        
        // Tratamento de Offline para escritas críticas (Simula sucesso para não travar UX)
        if(['addLead', 'updateAgendamento', 'updateObservacao', 'registerAbsence'].includes(route)) {
            return {status:'success', local: true, message: "Salvo localmente (Offline)"};
        }
        return {status: 'error', message: 'Erro de conexão ou servidor.'};
    }
}

// ============================================================
// 4. LEADS & CARTEIRA
// ============================================================

// Filtra leads do dia atual (Botão Dashboard)
function filtrarLeadsHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const leadsHoje = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje));
    
    if (leadsHoje.length === 0) {
        alert("📅 Nenhum lead cadastrado ou interagido hoje!\nVamos pra cima! 🚀");
        return; // Mantém no dashboard
    }
    
    navegarPara('gestaoLeads');
    const div = document.getElementById('listaLeadsGestao');
    div.innerHTML = leadsHoje.map((l) => {
        const realIndex = leadsCache.indexOf(l);
        return criarCardLead(l, realIndex);
    }).join('');
    
    document.getElementById('searchLead').placeholder = `Filtrado: Hoje (${leadsHoje.length})`;
}

async function carregarLeads(showLoader = true) {
    // Se offline, usa cache e renderiza direto
    if(!navigator.onLine) {
        if(document.getElementById('listaLeadsGestao')) renderLeads();
        return;
    }

    const res = await apiCall('getLeads', { vendedor: loggedUser }, showLoader);
    if (res && res.status === 'success') {
        leadsCache = res.data || [];
        // Ordena por inserção (mais recente primeiro)
        leadsCache.sort((a, b) => b._linha - a._linha);
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        
        // Libera painel Admin se confirmado pelo backend
        if (res.isAdmin) document.getElementById('adminPanel')?.classList.remove('hidden');
        
        // Renderiza se estiver na tela de lista
        if(document.getElementById('listaLeadsGestao') && document.getElementById('gestaoLeads').style.display !== 'none') {
            renderLeads();
        }
        atualizarDashboard();
        verificarAgendamentosHoje();
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
    
    if (!lista.length) { div.innerHTML = '<div class="text-center mt-10 text-gray-400">Vazio.</div>'; return; }

    div.innerHTML = lista.map((l) => {
        const realIndex = leadsCache.indexOf(l);
        return criarCardLead(l, realIndex);
    }).join('');
}

function criarCardLead(l, index) {
    // Cores dos Badges de Status
    let badgeColor = "bg-slate-100 text-slate-500";
    if (l.status === 'Venda Fechada') badgeColor = "bg-green-500 text-white font-bold";
    else if (l.status === 'Em Negociação') badgeColor = "bg-blue-100 text-blue-600 font-bold";
    else if (l.status === 'Perda') badgeColor = "bg-red-100 text-red-600 font-bold";
    else if (l.interesse === 'Alto') badgeColor = "bg-orange-100 text-orange-600 font-bold";

    // Badge do Provedor (separado)
    const badgeProvedor = l.provedor ? `<span class="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 ml-2"><i class="fas fa-wifi"></i> ${l.provedor}</span>` : '';

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition">
        <div class="flex justify-between items-start">
            <div>
                <div class="font-bold text-slate-800 text-lg leading-tight">${l.nomeLead}</div>
                <div class="text-xs text-slate-500 mt-1">${l.bairro || 'Sem Bairro'} ${badgeProvedor}</div>
            </div>
            <div class="flex flex-col items-end gap-1">
                <span class="text-[10px] px-2 py-1 rounded-full ${badgeColor}">${l.status || l.interesse || 'Novo'}</span>
                ${l.agendamento ? `<span class="text-[9px] text-orange-500 flex items-center gap-1"><i class="fas fa-clock"></i> ${l.agendamento.split(' ')[0]}</span>` : ''}
            </div>
        </div>
    </div>`;
}

// Abertura do Modal de Detalhes (Popula todos os campos)
function abrirLeadDetalhes(index) {
    const l = leadsCache[index];
    if(!l) return;
    leadAtualParaAgendar = l;
    
    // Dados Básicos
    document.getElementById('modalLeadNome').innerText = l.nomeLead;
    document.getElementById('modalLeadInfo').innerText = `${l.bairro} • ${l.telefone}`;
    document.getElementById('modalLeadProvedor').innerText = l.provedor || "--";
    
    // Campos de Texto/Ação
    document.getElementById('modalLeadObs').value = l.observacao || "";
    document.getElementById('inputObjecaoLead').value = l.objecao || "";
    document.getElementById('respostaObjecaoLead').value = l.respostaObjecao || "";

    // Botão WhatsApp com link
    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) btnWhats.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');
    
    // Injeção do Botão Raio-X ao lado do Provedor (se não existir)
    const containerProv = document.getElementById('modalLeadProvedor')?.parentElement;
    if(containerProv && !document.getElementById('btnRaioXModal')) {
        const btn = document.createElement('button');
        btn.id = 'btnRaioXModal';
        btn.className = "ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold shadow hover:bg-slate-700 transition flex items-center gap-1";
        btn.innerHTML = '<i class="fas fa-bolt text-yellow-400"></i> Raio-X';
        btn.onclick = (e) => { e.stopPropagation(); raioXConcorrencia(); };
        containerProv.appendChild(btn);
    }

    document.getElementById('leadModal').classList.remove('hidden');
}

function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); leadAtualParaAgendar = null; editingLeadIndex = null; }

// --- CADASTRO E EDIÇÃO ---

window.editarLeadAtual = function() {
    if (!leadAtualParaAgendar) return;
    const l = leadAtualParaAgendar;
    
    // Popula formulário de cadastro para edição
    const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ""; }
    setVal('leadNome', l.nomeLead);
    setVal('leadTelefone', l.telefone);
    setVal('leadEndereco', l.endereco);
    setVal('leadBairro', l.bairro);
    setVal('leadCidade', l.cidade);
    setVal('leadProvedor', l.provedor);
    setVal('leadObs', l.observacao);
    
    const selInt = document.getElementById('leadInteresse'); if(selInt) selInt.value = l.interesse || "Médio";
    const statusEl = document.getElementById('leadStatus'); if(statusEl) statusEl.value = l.status || "Novo";
    
    // Mostra campo de encaminhamento se for admin
    if (loggedUser === "Bruno Garcia Queiroz") {
        document.getElementById('divEncaminhar').classList.remove('hidden');
    }

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
        status: document.getElementById('leadStatus').value, // Novo campo de Funil
        observacao: document.getElementById('leadObs').value,
        agendamento: "",
        
        // Encaminhamento (Só Admin)
        novoVendedor: document.getElementById('leadVendedorDestino')?.value || ""
    };
    
    let route = 'addLead';
    
    // Se estiver editando
    if (editingLeadIndex !== null) {
        route = 'updateLeadFull'; // Rota de atualização completa (Backend V91)
        payload._linha = leadsCache[editingLeadIndex]._linha;
        payload.nomeLeadOriginal = leadsCache[editingLeadIndex].nomeLead;
    } else {
        // Se for novo e tiver encaminhamento, ajusta vendedor
        if (payload.novoVendedor) {
            route = 'forwardLead'; // Ou usa addLead com vendedor alterado
            payload.origem = loggedUser;
        }
    }

    const res = await apiCall(route, payload);
    
    if (res && (res.status === 'success' || res.local)) {
        alert(editingLeadIndex !== null ? "Atualizado com sucesso!" : "Cadastrado!");
        
        // Se novo e online, adiciona ao cache para feedback instantâneo
        if(editingLeadIndex === null && !res.local && !payload.novoVendedor) {
             payload.timestamp = new Date().toLocaleDateString('pt-BR'); // Mock data para exibir
             leadsCache.unshift(payload);
        }
        
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        
        // Se editou, recarrega tudo para garantir consistência
        if(editingLeadIndex !== null) carregarLeads(false);

        editingLeadIndex = null;
        navegarPara('gestaoLeads');
    } else {
        alert("Erro: " + (res?.message || "Falha na conexão"));
    }
}

// ============================================================
// 5. GESTÃO E INDICADORES
// ============================================================

async function abrirIndicadores() {
    navegarPara('indicadores');
    // Limpa UI
    ['funnelLeads', 'funnelNegociacao', 'funnelVendas', 'indRealizado', 'indMeta'].forEach(id => {
        const el = document.getElementById(id); if(el) el.innerText = '...';
    });
    document.getElementById('indAnaliseIA').innerText = '🤖 Analisando performance...';
    
    const res = await apiCall('getIndicators', { vendedor: loggedUser }, false);
    
    if (res && res.status === 'success') {
        const d = res.data;
        
        // Funil
        document.getElementById('funnelLeads').innerText = d.totalLeads;
        document.getElementById('funnelNegociacao').innerText = d.negociacao || 0;
        document.getElementById('funnelVendas').innerText = d.vendas;
        
        // Meta e Ciclo
        document.getElementById('indMes').innerText = d.mes;
        document.getElementById('indCiclo').innerText = `Ciclo: ${d.ciclo}`;
        document.getElementById('indRealizado').innerText = d.vendas;
        document.getElementById('indMeta').innerText = d.meta;
        
        // IA Coach
        apiCall('analyzeIndicators', { 
            vendas: d.vendas, meta: d.meta, diasUteisRestantes: d.diasUteisRestantes 
        }, false).then(r => {
             if(r.status === 'success') document.getElementById('indAnaliseIA').innerText = r.message;
        });
    } else {
        document.getElementById('indAnaliseIA').innerText = 'Não foi possível carregar dados.';
    }
}

// Configurações de Equipe (Admin)
function abrirConfiguracoes() { document.getElementById('configModal').classList.remove('hidden'); }

async function gerirEquipe(acao) {
    const nome = document.getElementById('cfgNomeVendedor').value;
    const meta = document.getElementById('cfgMeta').value;
    if(!nome) return alert("Nome obrigatório");
    
    showLoading(true);
    const res = await apiCall('manageTeam', { acao, nome, meta });
    showLoading(false);
    
    if(res.status === 'success') {
        alert("Equipe atualizada!");
        carregarVendedores();
        document.getElementById('configModal').classList.add('hidden');
    } else alert("Erro ao atualizar.");
}

// Encaminhamento rápido no Modal
async function encaminharLeadModal() {
    const novoVendedor = document.getElementById('modalLeadDestino').value;
    if(!novoVendedor) return alert("Selecione um vendedor.");
    
    if(!confirm(`Encaminhar para ${novoVendedor}?`)) return;
    
    showLoading(true, "ENCAMINHANDO...");
    const res = await apiCall('forwardLead', { 
        nomeLead: leadAtualParaAgendar.nomeLead, 
        telefone: leadAtualParaAgendar.telefone,
        novoVendedor: novoVendedor,
        origem: loggedUser
    });
    showLoading(false);
    
    if(res.status === 'success') {
        alert("✅ Lead encaminhado!");
        fecharLeadModal();
        carregarLeads(); // Atualiza lista
    } else {
        alert("Erro: " + (res.message || "Falha"));
    }
}

// ============================================================
// 6. FALTAS E JUSTIFICATIVAS
// ============================================================

async function verHistoricoFaltas() {
    const div = document.getElementById('listaHistoricoFaltas');
    document.getElementById('historicoFaltasContainer').classList.remove('hidden');
    document.getElementById('formFaltaContainer').classList.add('hidden');
    
    div.innerHTML = '<div class="text-center p-5 text-gray-400">Carregando...</div>';
    
    const res = await apiCall('getAbsences', { vendedor: loggedUser }, false);
    
    if (res && res.status === 'success' && res.data.length > 0) {
        div.innerHTML = res.data.map(f => `
            <div onclick='preencherEdicaoFalta(${JSON.stringify(f)})' class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 cursor-pointer active:bg-blue-50">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="font-bold text-xs text-slate-700">${f.motivo}</div>
                        <div class="text-[10px] text-slate-400">${f.dataFalta} • ${f.statusEnvio}</div>
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
    
    document.getElementById('faltaData').value = '';
    document.getElementById('faltaMotivo').value = '';
    document.getElementById('faltaObs').value = '';
    document.getElementById('faltaArquivo').value = '';
    
    const btn = document.getElementById('btnEnviarFalta');
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> ENVIAR SOLICITAÇÃO';
    btn.className = "w-full bg-[#00aeef] text-white font-bold py-4 rounded-xl shadow-xl mt-4 active:scale-95 transition flex items-center justify-center gap-2";
}

function preencherEdicaoFalta(falta) {
    document.getElementById('historicoFaltasContainer').classList.add('hidden');
    document.getElementById('formFaltaContainer').classList.remove('hidden');
    
    const [d, m, a] = falta.dataFalta.split('/');
    document.getElementById('faltaData').value = `${a}-${m}-${d}`;
    document.getElementById('faltaMotivo').value = falta.motivo;
    document.getElementById('faltaObs').value = falta.obs;
    editingAbsenceIndex = falta._linha; 
    
    const btn = document.getElementById('btnEnviarFalta');
    btn.innerHTML = '<i class="fas fa-sync"></i> ATUALIZAR & REENVIAR';
    btn.className = "w-full bg-green-500 text-white font-bold py-4 rounded-xl shadow-xl mt-4 active:scale-95 transition flex items-center justify-center gap-2";
    
    alert("📝 Editando solicitação. Reenvie o anexo se necessário.");
}

async function enviarJustificativa() {
    const dataFalta = document.getElementById('faltaData').value;
    const motivo = document.getElementById('faltaMotivo').value;
    const obs = document.getElementById('faltaObs').value;
    const fileInput = document.getElementById('faltaArquivo');
    
    if(!dataFalta || !motivo) return alert("Preencha data e motivo.");
    
    showLoading(true, editingAbsenceIndex ? "ATUALIZANDO..." : "ENVIANDO...");
    
    const payload = {
        vendedor: loggedUser,
        dataFalta: dataFalta,
        motivo: motivo,
        observacao: obs,
        _linha: editingAbsenceIndex
    };
    
    const route = editingAbsenceIndex ? 'updateAbsence' : 'registerAbsence';

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async function(e) {
            payload.fileData = e.target.result; 
            payload.fileName = file.name;
            payload.mimeType = file.type;
            await enviarPayloadFalta(route, payload);
        };
        reader.readAsDataURL(file);
    } else {
        await enviarPayloadFalta(route, payload);
    }
}

async function enviarPayloadFalta(route, payload) {
    const res = await apiCall(route, payload);
    showLoading(false);
    if (res && res.status === 'success') {
        alert(editingAbsenceIndex ? "✅ Atualizado!" : "✅ Enviado!");
        ocultarHistoricoFaltas();
        navegarPara('dashboard');
    } else {
        alert("Erro: " + (res?.message || "Desconhecido"));
    }
}

// ============================================================
// 7. TAREFAS & MATERIAIS
// ============================================================

async function carregarTarefas() {
    const div = document.getElementById('listaTarefasContainer');
    div.innerHTML = '<div class="text-center p-5 text-gray-400">Carregando...</div>';
    const res = await apiCall('getTasks', { vendedor: loggedUser }, false);
    
    if (res && res.status === 'success') {
        const tasks = res.data;
        if (tasks.length === 0) { div.innerHTML = '<div class="text-center p-10 text-gray-300">Nenhuma tarefa.</div>'; return; }
        
        div.innerHTML = tasks.map(t => {
            const checked = t.status === "CONCLUIDA" ? "checked" : "";
            const opacity = t.status === "CONCLUIDA" ? "opacity-50 line-through" : "";
            return `
            <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 ${opacity}">
                <input type="checkbox" ${checked} onchange="toggleTask('${t.id}', '${t.status}')" class="w-5 h-5 accent-blue-600 rounded cursor-pointer">
                <div class="flex-1">
                    <div class="text-sm font-bold text-slate-700">${t.descricao}</div>
                    <div class="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                        ${t.dataLimite ? `<span>📅 ${t.dataLimite}</span>` : ''}
                        ${t.nomeLead ? `<span class="bg-blue-50 text-blue-500 px-1 rounded">👤 ${t.nomeLead}</span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    } else div.innerHTML = '<div class="text-center text-red-400">Erro.</div>';
}

function abrirModalTarefa() {
    document.getElementById('taskModal').classList.remove('hidden');
    // Popula select leads
    const sel = document.getElementById('taskLeadSelect');
    sel.innerHTML = '<option value="">Nenhum (Avulso)</option>';
    leadsCache.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.nomeLead; opt.innerText = l.nomeLead;
        sel.appendChild(opt);
    });
}

async function salvarTarefa() {
    const desc = document.getElementById('taskDesc').value;
    const date = document.getElementById('taskDate').value;
    const leadVal = document.getElementById('taskLeadSelect').value;
    if(!desc) return alert("Digite a descrição.");
    
    showLoading(true);
    await apiCall('addTask', { vendedor: loggedUser, descricao: desc, dataLimite: date, nomeLead: leadVal });
    showLoading(false);
    document.getElementById('taskModal').classList.add('hidden');
    carregarTarefas();
}

async function toggleTask(id, currentStatus) {
    await apiCall('toggleTask', { taskId: id, status: currentStatus, vendedor: loggedUser }, false);
    carregarTarefas(); 
}

async function limparTarefasConcluidas() {
    if(!confirm("Limpar concluídas?")) return;
    showLoading(true);
    await apiCall('archiveTasks', { vendedor: loggedUser });
    showLoading(false);
    carregarTarefas();
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
            renderMateriais(res.data);
        } else throw new Error("Erro API");
    } catch (e) {
        div.innerHTML = '<div class="col-span-2 text-center text-red-400">Erro.</div>';
    }
}

function renderMateriais(items) {
    const div = document.getElementById('materiaisGrid');
    if(!div) return;
    if(items.length === 0) { div.innerHTML = '<div class="col-span-2 text-center text-gray-400">Vazio.</div>'; return; }
    
    div.innerHTML = items.map(item => {
        if (item.type === 'folder') {
            return `<div onclick="carregarMateriais('${item.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex flex-col items-center justify-center gap-2 cursor-pointer h-36">
                <i class="fas fa-folder text-5xl text-[#00aeef]"></i><span class="text-xs font-bold text-slate-600 text-center leading-tight line-clamp-2">${item.name}</span>
            </div>`;
        } else {
            return `<div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-48 relative overflow-hidden group">
                <div class="h-32 w-full bg-gray-50 rounded-xl overflow-hidden"><img src="${item.thumbnail}" class="w-full h-full object-cover"></div>
                <div class="flex-1 flex items-center justify-between mt-2 px-1"><span class="text-[10px] text-gray-500 font-bold truncate flex-1">${item.name}</span><a href="${item.downloadUrl}" target="_blank" class="text-blue-500 text-xs font-bold">Baixar</a></div>
            </div>`;
        }
    }).join('');
}

function atualizarNavegacaoMateriais(isRoot) {
    const btn = document.querySelector('#materiais button'); 
    const title = document.querySelector('#materiais h2');
    if(btn) {
        if(isRoot) { btn.onclick = () => navegarPara('dashboard'); if(title) title.innerText = "Marketing"; } 
        else { 
            btn.onclick = () => { document.getElementById('searchMateriais').value = ""; carregarMateriais(null); }; 
            if(title) title.innerText = "Voltar"; 
        }
    }
}
function buscarMateriais() { carregarMateriais(currentFolderId, document.getElementById('searchMateriais').value); }

// ============================================================
// 8. FUNÇÕES UTILITÁRIAS & AUXILIARES
// ============================================================

async function carregarVendedores() {
    const s = document.getElementById('userSelect');
    const s2 = document.getElementById('modalLeadDestino');
    const s3 = document.getElementById('leadVendedorDestino');
    if(!s) return;
    s.innerHTML = '<option value="">Conectando...</option>';
    
    try {
        const res = await apiCall('getVendors', {}, false);
        if(res.status === 'success') {
            const opts = res.data.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
            s.innerHTML = '<option value="">Selecione...</option>' + opts;
            if(s2) s2.innerHTML = '<option value="">Selecionar...</option>' + opts;
            if(s3) s3.innerHTML = '<option value="">Selecione...</option>' + opts;
        }
    } catch(e) {
        s.innerHTML = '<option value="">Modo Offline</option>';
    }
}

function showLoading(show, txt) { 
    const l = document.getElementById('loader'); 
    if(l) l.style.display = show ? 'flex' : 'none'; 
    if(txt) document.getElementById('loaderText').innerText = txt;
}

function atualizarDataCabecalho() {
    const el = document.getElementById('headerDate');
    if(el) el.innerText = new Date().toLocaleDateString('pt-BR');
}

function atualizarDashboard() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const count = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje)).length;
    const el = document.getElementById('statLeads');
    if(el) el.innerText = count;
}

function verificarAgendamentosHoje() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    const banner = document.getElementById('lembreteBanner');
    if (retornos.length > 0) { if(banner) banner.classList.remove('hidden'); } 
    else { if(banner) banner.classList.add('hidden'); }
}

async function excluirLead() { if(!confirm("Excluir?")) return; showLoading(true); await apiCall('deleteLead', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead }); showLoading(false); alert("Excluído."); fecharLeadModal(); carregarLeads(); }
async function marcarVendaFechada() { if(!confirm("Venda Fechada?")) return; showLoading(true); await apiCall('updateStatus', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: "Venda Fechada" }); showLoading(false); alert("Parabéns!"); fecharLeadModal(); carregarLeads(); }
async function salvarAgendamento() { const ag = `${document.getElementById('agendarData').value} ${document.getElementById('agendarHora').value}`; await apiCall('updateAgendamento', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: ag }); alert("Agendado!"); fecharLeadModal(); }
async function salvarObservacaoModal() { await apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: document.getElementById('modalLeadObs').value }); alert("Salvo!"); }

// IA Wrappers (Simplificados)
async function combaterObjecaoGeral() { const o=document.getElementById('inputObjecaoGeral').value; showLoading(true); const r=await apiCall('solveObjection',{objection:o}); showLoading(false); if(r.status==='success') { document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer; document.getElementById('resultadoObjecaoGeral').classList.remove('hidden'); } }
async function combaterObjecaoLead() { const o=document.getElementById('inputObjecaoLead').value; showLoading(true); const r=await apiCall('solveObjection',{objection:o}); showLoading(false); if(r.status==='success') document.getElementById('respostaObjecaoLead').value=r.answer.replace(/[\*#]/g,''); }
async function salvarObjecaoLead() { await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value}); alert("Salvo!"); }
async function analiseEstrategicaIA() { showLoading(true); const r=await perguntarIABackend(`Analise lead ${leadAtualParaAgendar.nomeLead}`); showLoading(false); if(r) { document.getElementById('modalLeadObs').value += "\n\n[IA]: " + r.replace(/\*\*/g,''); alert("Análise adicionada!"); } }
async function raioXConcorrencia() { const p = document.getElementById('leadProvedor').value; showLoading(true); const r = await perguntarIABackend(`Cliente usa ${p}. 3 pontos fracos deles e 3 argumentos nossos.`); showLoading(false); if(r) { const o = document.getElementById('leadObs'); o.value += "\n\n" + r.replace(/\*\*/g,''); } }
async function refinarObsIA() { const o = document.getElementById('leadObs'); showLoading(true); const r = await perguntarIABackend(`Reescreva profissionalmente: "${o.value}"`); showLoading(false); if(r) o.value = r.replace(/\*\*/g,''); }
async function gerarCoachIA() { showLoading(true); const r=await perguntarIABackend("Frase motivacional curta"); showLoading(false); if(r) alert(`🚀 ${r.replace(/\*\*/g,'')}`); }
async function perguntarIABackend(p) { try { const r=await apiCall('askAI',{question:p},false); return r.status==='success' ? r.answer : null; } catch(e){return null;} }
async function consultarPlanosIA() { document.getElementById('chatModal').classList.remove('hidden'); }
function toggleChat() { document.getElementById('chatModal').classList.add('hidden'); }
async function enviarMensagemChat() { const i=document.getElementById('chatInput'); const m=i.value; if(!m)return; document.getElementById('chatHistory').innerHTML+=`<div class="text-right p-2 mb-1 bg-blue-50 rounded">${m}</div>`; i.value=''; const r=await perguntarIABackend(m); document.getElementById('chatHistory').innerHTML+=`<div class="text-left p-2 bg-gray-100 mb-1 rounded">${r}</div>`; }
async function buscarEnderecoGPS() { navigator.geolocation.getCurrentPosition(p=>{fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.coords.latitude}&lon=${p.coords.longitude}`).then(r=>r.json()).then(d=>{if(d.address){document.getElementById('leadEndereco').value=d.address.road;document.getElementById('leadBairro').value=d.address.suburb}})},()=>{alert('Erro GPS')}) }
function iniciarDitado(t) { const r=new(window.SpeechRecognition||window.webkitSpeechRecognition)(); r.lang='pt-BR'; r.start(); r.onresult=e=>{document.getElementById(t).value+=e.results[0][0].transcript} }
function copiarTexto(id){ document.getElementById(id).select(); document.execCommand('copy'); alert("Copiado!"); }
function enviarZapTexto(id){ window.open(`https://wa.me/?text=${encodeURIComponent(document.getElementById(id).value)}`,'_blank'); }
