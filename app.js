/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V87 (FIX LOADER & IA)
 * ============================================================
 * 📝 UPDATE:
 * - Ícone de loading restaurado para fa-sync fa-spin (setas circulares).
 * - Tratamento de erro da IA melhorado para evitar "IA Indisponível" falso positivo.
 * - Sincronizado com Backend V84.
 * ============================================================
 */

// ⚠️ ID FORNECIDO PELO USUÁRIO (V84)
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// ESTADO GLOBAL
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let leadAtualParaAgendar = null; 
let chatHistoryData = []; 
let currentFolderId = null;
let editingLeadIndex = null;
let editingAbsenceIndex = null;

// 1. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App Iniciado - V87");
    
    // Tenta carregar dados locais para rapidez
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { 
        try { leadsCache = JSON.parse(saved); } catch(e) {} 
    }
    
    // Carrega lista de vendedores (API ou Offline)
    carregarVendedores();
    
    // Verifica Login
    if (loggedUser) {
         initApp();
    } else {
         document.getElementById('userMenu').style.display = 'flex';
         document.getElementById('mainContent').style.display = 'none';
    }
});

// 2. FUNÇÕES UTILITÁRIAS (LOADER, ETC)

function showLoading(show, txt) { 
    const l = document.getElementById('loader'); 
    if (!l) return;
    
    l.style.display = show ? 'flex' : 'none'; 
    
    const t = document.getElementById('loaderText');
    if (t && txt) t.innerText = txt;
    else if (t) t.innerText = "CARREGANDO";
}

function copiarTexto(id) { 
    const el = document.getElementById(id); 
    if(!el) return; 
    
    // Suporte a input/textarea e div/span
    if (el.select) {
        el.select();
        el.setSelectionRange(0, 99999); // Mobile fix
    } else {
        const range = document.createRange();
        range.selectNode(el);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
    }
    
    document.execCommand('copy'); 
    alert("📋 Texto copiado!"); 
}

function enviarZapTexto(id) { 
    const el = document.getElementById(id); 
    if(!el) return; 
    const texto = el.value || el.innerText; 
    if(!texto) return alert("Nada para enviar."); 
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank'); 
}

function iniciarDitado(t, b) { 
    const R = window.SpeechRecognition || window.webkitSpeechRecognition; 
    if(!R) return alert("Seu navegador não suporta voz."); 
    const r = new R(); 
    r.lang='pt-BR'; 
    r.start(); 
    r.onresult = e => { 
        const el = document.getElementById(t);
        if(el) el.value += " " + e.results[0][0].transcript; 
    }; 
}

// 3. COMUNICAÇÃO API (CORE)

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
        
        // Retorno de "sucesso local" para não travar app em operações críticas offline
        if(['addLead', 'updateAgendamento', 'updateObservacao'].includes(route)) {
            return {status:'success', local: true};
        }
        return {status: 'error', message: 'Erro de conexão ou servidor.'};
    }
}

// 4. LOGIN E NAVEGAÇÃO

async function carregarVendedores() {
    const select = document.getElementById('userSelect');
    if(!select) return;
    
    const VENDEDORES_OFFLINE = ["Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader", "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges", "Elton da Silva Rodrigo Gonçalves", "Bruno Garcia Queiroz"];
    
    select.innerHTML = '<option value="">Conectando...</option>';
    
    const timeout = new Promise((_, reject) => setTimeout(() => reject("Timeout"), 5000));
    
    try {
        const res = await Promise.race([apiCall('getVendors', {}, false), timeout]);
        if (res && res.status === 'success' && res.data && res.data.length > 0) {
            select.innerHTML = '<option value="">Selecione seu nome...</option>';
            res.data.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.nome; opt.innerText = v.nome; select.appendChild(opt);
            });
        } else throw new Error("Lista vazia");
    } catch (e) {
        console.warn("Usando lista offline");
        select.innerHTML = '<option value="">Modo Offline (Selecione)</option>';
        VENDEDORES_OFFLINE.forEach(nome => {
            const opt = document.createElement('option');
            opt.value = nome; opt.innerText = nome; select.appendChild(opt);
        });
    }
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
    if(confirm("Sair do sistema?")) { 
        localStorage.removeItem('loggedUser'); 
        location.reload(); 
    } 
}

function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex'; 
    const elUser = document.getElementById('userInfo');
    if(elUser) { 
        elUser.innerText = loggedUser; 
        elUser.classList.remove('truncate', 'max-w-[150px]'); 
    }
    
    atualizarDataCabecalho();
    carregarLeads(false); 
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
        void target.offsetWidth; 
        target.classList.add('fade-in');
    }
    
    const scroller = document.getElementById('main-scroll');
    if(scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });

    // Lógica específica por tela
    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') abrirIndicadores();
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        if(busca && busca.placeholder.includes("Retornos")) {
            busca.value = "";
            busca.placeholder = "Buscar...";
        }
        renderLeads();
    }
    if (pageId === 'cadastroLead') {
        ajustarMicrofone();
        if (editingLeadIndex === null) {
            ['leadNome','leadTelefone','leadProvedor','leadObs','leadEndereco','leadBairro','leadCidade'].forEach(id => {
                const el = document.getElementById(id); if(el) el.value = '';
            });
        }
    }
    if (pageId === 'materiais' && !currentFolderId) setTimeout(() => carregarMateriais(null), 100);
    if (pageId === 'faltas') ocultarHistoricoFaltas();
}

function atualizarDataCabecalho() {
    const elData = document.getElementById('headerDate');
    if(!elData) return;
    const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const agora = new Date();
    elData.innerText = `${dias[agora.getDay()]}, ${agora.getDate()} ${meses[agora.getMonth()]}`;
}

function atualizarDashboard() {
    const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
    const count = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
    if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
    
    // Lista de Ataque (Retornos de hoje)
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    const container = document.getElementById('listaAtaqueDashboard');
    
    if (container) {
        if (retornos.length > 0) {
            container.innerHTML = `
            <div class="mb-2 flex items-center justify-between"><span class="text-xs font-bold text-orange-600 uppercase tracking-wider">🔥 Prioridade Hoje (${retornos.length})</span></div>
            <div class="space-y-2">${retornos.map(l => { 
                const idx = leadsCache.indexOf(l); 
                return `<div onclick="abrirLeadDetalhes(${idx})" class="bg-white p-3 rounded-xl border-l-4 border-l-orange-500 shadow-sm flex justify-between items-center active:bg-orange-50 cursor-pointer">
                    <div><div class="font-bold text-slate-800 text-sm">${l.nomeLead}</div><div class="text-[10px] text-slate-500"><i class="fas fa-clock"></i> ${l.agendamento.split(' ')[1] || 'Dia todo'}</div></div>
                    <i class="fas fa-chevron-right text-slate-300 text-xs"></i>
                </div>`; 
            }).join('')}</div>`;
            container.classList.remove('hidden');
        } else {
            container.innerHTML = ''; 
            container.classList.add('hidden');
        }
    }
}

function verificarAgendamentosHoje() {
    // Apenas garante que o banner de alerta apareça se houver leads no dashboard
    const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    const banner = document.getElementById('lembreteBanner');
    const txt = document.getElementById('lembreteTexto');
    
    if (retornos.length > 0) {
        if(banner) banner.classList.remove('hidden');
        if(txt) txt.innerText = `Você tem ${retornos.length} retornos hoje.`;
    } else {
        if(banner) banner.classList.add('hidden');
    }
}

// 5. GESTÃO DE LEADS

async function carregarLeads(showLoader = true) {
    const res = await apiCall('getLeads', { vendedor: loggedUser }, showLoader);
    if (res && res.status === 'success') {
        leadsCache = res.data || [];
        leadsCache.sort((a, b) => b._linha - a._linha); // Ordem decrescente
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        
        // Verifica Admin
        if (res.isAdmin) {
            const panel = document.getElementById('adminPanel');
            if(panel) panel.classList.remove('hidden');
        }
        
        if(document.getElementById('listaLeadsGestao')) renderLeads();
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
    
    if (!lista.length) { div.innerHTML = '<div class="text-center mt-10 text-gray-400">Nada encontrado.</div>'; return; }

    div.innerHTML = lista.map((l, i) => {
        const realIndex = leadsCache.indexOf(l);
        return criarCardLead(l, realIndex);
    }).join('');
}

function criarCardLead(l, index, destaque = false) {
    let badge = "bg-slate-100 text-slate-500";
    if (l.interesse === 'Alto') badge = "bg-green-100 text-green-700 ring-1 ring-green-200";
    if (l.interesse === 'Baixo') badge = "bg-blue-50 text-blue-400";
    if (l.status === 'Venda Fechada') badge = "bg-green-500 text-white font-bold ring-2 ring-green-300";

    const borda = destaque ? "border-l-4 border-l-orange-500 shadow-md bg-orange-50/50" : "border border-slate-100 shadow-sm bg-white";

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="${borda} p-5 rounded-2xl mb-3 cursor-pointer active:scale-[0.98] transition-all duration-200 relative overflow-hidden group">
      <div class="flex justify-between items-start relative z-10">
        <div class="flex-1 min-w-0 pr-3">
            <div class="font-bold text-slate-800 text-lg leading-tight mb-2 truncate">${l.nomeLead}</div>
            <div class="flex flex-wrap gap-2">
                ${l.bairro ? `<span class="text-[10px] bg-slate-50 text-slate-500 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider flex items-center border border-slate-200"><i class="fas fa-map-pin mr-1.5 text-slate-400"></i>${l.bairro}</span>` : ''}
                ${l.provedor ? `<span class="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider flex items-center border border-indigo-100"><i class="fas fa-wifi mr-1.5"></i>${l.provedor}</span>` : ''}
            </div>
        </div>
        <div class="flex flex-col items-end gap-2 shrink-0">
            <span class="text-[10px] font-bold px-3 py-1 rounded-full ${badge}">${l.status === 'Venda Fechada' ? 'VENDIDO' : (l.interesse || 'Médio')}</span>
            ${l.agendamento ? `<span class="text-[10px] text-orange-600 font-bold bg-white px-2 py-1 rounded-lg border border-orange-100 shadow-sm flex items-center"><i class="fas fa-clock mr-1"></i> ${l.agendamento.split(' ')[0]}</span>` : ''}
        </div>
      </div>
    </div>`;
}

// ... (MODAIS E AÇÕES DE LEAD)
function abrirLeadDetalhes(index) {
    const l = leadsCache[index];
    if(!l) return;
    leadAtualParaAgendar = l;
    
    document.getElementById('modalLeadNome').innerText = l.nomeLead;
    document.getElementById('modalLeadInfo').innerText = `${l.bairro || '-'} • ${l.telefone}`;
    document.getElementById('modalLeadProvedor').innerText = l.provedor || '--';
    document.getElementById('modalLeadObs').value = l.observacao || "";
    document.getElementById('inputObjecaoLead').value = l.objecao || "";
    document.getElementById('respostaObjecaoLead').value = l.respostaObjecao || "";

    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) {
        btnWhats.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');
    }
    
    const containerProv = document.getElementById('modalLeadProvedor')?.parentElement;
    if(containerProv && !document.getElementById('btnRaioXModal')) {
        const btn = document.createElement('button');
        btn.id = 'btnRaioXModal';
        btn.className = "ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold shadow hover:bg-slate-700 transition flex items-center gap-1";
        btn.innerHTML = '<i class="fas fa-bolt text-yellow-400"></i> Raio-X';
        btn.onclick = (e) => { e.stopPropagation(); raioXConcorrencia(); };
        containerProv.appendChild(btn);
    }

    const m = document.getElementById('leadModal');
    if (m) { 
        m.classList.remove('hidden'); 
        const c = m.querySelector('div.slide-up'); 
        if(c) { c.classList.remove('slide-up'); void c.offsetWidth; c.classList.add('slide-up'); } 
    }
}

function fecharLeadModal() { 
    document.getElementById('leadModal').classList.add('hidden'); 
    leadAtualParaAgendar = null; 
    editingLeadIndex = null;
}

window.editarLeadAtual = function() {
    if (!leadAtualParaAgendar) { alert("Selecione um lead."); return; }
    if(!confirm(`Editar cadastro de ${leadAtualParaAgendar.nomeLead}?`)) return;

    const lead = leadAtualParaAgendar;
    editingLeadIndex = leadsCache.indexOf(lead);

    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ""; };
    setVal('leadNome', lead.nomeLead);
    setVal('leadTelefone', lead.telefone);
    setVal('leadProvedor', lead.provedor);
    setVal('leadObs', lead.observacao);
    setVal('leadEndereco', lead.endereco);
    setVal('leadBairro', lead.bairro);
    setVal('leadCidade', lead.cidade);
    
    const selInt = document.getElementById('leadInteresse');
    if(selInt) selInt.value = lead.interesse || "Médio";

    fecharLeadModal();
    navegarPara('cadastroLead');
};

async function enviarLead() {
  const nome = document.getElementById('leadNome').value.trim();
  const tel = document.getElementById('leadTelefone').value.trim();
  if (!nome || !tel) return alert("Preencha Nome e WhatsApp");
  
  if (editingLeadIndex !== null) {
      alert("⚠️ Edição: Atualiza apenas Observações no servidor.");
      const obs = document.getElementById('leadObs').value;
      if (obs) {
          apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: nome, observacao: obs });
          leadsCache[editingLeadIndex].observacao = obs;
          localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      }
      editingLeadIndex = null;
      navegarPara('gestaoLeads');
      return;
  }

  const novoLead = {
    vendedor: loggedUser, nomeLead: nome, telefone: tel,
    endereco: document.getElementById('leadEndereco').value,
    cidade: document.getElementById('leadCidade').value,
    bairro: document.getElementById('leadBairro').value,
    interesse: document.getElementById('leadInteresse').value,
    provedor: document.getElementById('leadProvedor').value,
    observacao: document.getElementById('leadObs').value,
    agendamento: ""
  };
   
  const res = await apiCall('addLead', novoLead);
  
  if (res && (res.status === 'success' || res.local)) {
      alert('✅ Salvo!');
      leadsCache.unshift(novoLead); 
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      ['leadNome', 'leadTelefone', 'leadObs', 'leadEndereco', 'leadBairro', 'leadProvedor'].forEach(id => document.getElementById(id).value = '');
      navegarPara('gestaoLeads');
  } else alert('Erro ao salvar.');
}

async function excluirLead() {
    if (!leadAtualParaAgendar) return;
    if (!confirm("⚠️ EXCLUIR este lead permanentemente?")) return;
    
    showLoading(true, "EXCLUINDO...");
    const res = await apiCall('deleteLead', {
        vendedor: loggedUser,
        nomeLead: leadAtualParaAgendar.nomeLead
    });
    showLoading(false);
    
    if(res && res.status === 'success') {
        alert("✅ Lead excluído.");
        const index = leadsCache.indexOf(leadAtualParaAgendar);
        if (index > -1) leadsCache.splice(index, 1);
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        fecharLeadModal();
        renderLeads();
        atualizarDashboard();
    } else alert("Erro ao excluir.");
}

async function marcarVendaFechada() {
    if (!leadAtualParaAgendar) return;
    if (!confirm("🎉 Confirmar VENDA FECHADA?")) return;
    
    showLoading(true, "PARABÉNS! 🚀");
    const res = await apiCall('updateStatus', {
        vendedor: loggedUser,
        nomeLead: leadAtualParaAgendar.nomeLead,
        status: "Venda Fechada"
    });
    showLoading(false);
    
    if(res && res.status === 'success') {
        alert("🎉 Venda registrada!");
        leadAtualParaAgendar.status = "Venda Fechada";
        leadAtualParaAgendar.interesse = "VENDIDO";
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        fecharLeadModal();
        renderLeads();
    }
}

async function salvarAgendamento() {
  if (!leadAtualParaAgendar) return;
  const dt = document.getElementById('agendarData').value;
  const hr = document.getElementById('agendarHora').value;
  if (!dt) return alert("Informe a data!");
  const [a, m, d] = dt.split('-');
  const ag = `${d}/${m}/${a} ${hr || '09:00'}`;
  const res = await apiCall('updateAgendamento', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: ag });
  if(res && (res.status === 'success' || res.local)) {
      alert("✅ Agendado! O Gestor será notificado.");
      leadAtualParaAgendar.agendamento = ag;
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      fecharLeadModal();
      verificarAgendamentosHoje();
      renderLeads();
  }
}

async function salvarObservacaoModal() {
    if (!leadAtualParaAgendar) return;
    const obs = document.getElementById('modalLeadObs').value;
    const res = await apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: obs });
    if(res) {
        alert("Salvo!");
        leadAtualParaAgendar.observacao = obs;
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    }
}

// 7. FUNÇÕES DE TAREFAS

async function carregarTarefas() {
    const div = document.getElementById('listaTarefasContainer');
    div.innerHTML = '<div class="text-center p-5 text-gray-400"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    const res = await apiCall('getTasks', { vendedor: loggedUser }, false);
    if (res && res.status === 'success') {
        const tasks = res.data;
        if (res.isAdmin) document.getElementById('adminPanel').classList.remove('hidden');
        if (tasks.length === 0) { div.innerHTML = '<div class="text-center p-10 text-gray-300 flex flex-col items-center"><i class="fas fa-clipboard-check text-4xl mb-2"></i><p>Nenhuma tarefa pendente.</p></div>'; return; }
        div.innerHTML = tasks.map(t => {
            const checked = t.status === "CONCLUIDA" ? "checked" : "";
            const opacity = t.status === "CONCLUIDA" ? "opacity-50 line-through" : "";
            return `<div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 ${opacity}"><input type="checkbox" ${checked} onchange="toggleTask('${t.id}', '${t.status}')" class="w-5 h-5 accent-blue-600 rounded cursor-pointer"><div class="flex-1"><div class="text-sm font-bold text-slate-700">${t.descricao}</div><div class="text-[10px] text-slate-400 flex items-center gap-2 mt-1">${t.dataLimite ? `<span class="bg-red-50 text-red-400 px-1.5 py-0.5 rounded flex items-center gap-1"><i class="fas fa-calendar"></i> ${t.dataLimite}</span>` : ''}${t.nomeLead ? `<span class="bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded flex items-center gap-1"><i class="fas fa-user"></i> ${t.nomeLead}</span>` : ''}${res.isAdmin ? `<span class="text-orange-400 font-bold ml-auto">${t.vendedor}</span>` : ''}</div></div></div>`;
        }).join('');
    } else div.innerHTML = '<div class="text-center text-red-400">Erro ao carregar tarefas.</div>';
}

function abrirModalTarefa() {
    document.getElementById('taskModal').classList.remove('hidden');
    const sel = document.getElementById('taskLeadSelect');
    sel.innerHTML = '<option value="">Nenhum (Avulso)</option>';
    leadsCache.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.nomeLead; opt.innerText = l.nomeLead; sel.appendChild(opt);
    });
}

async function salvarTarefa() {
    const desc = document.getElementById('taskDesc').value;
    const date = document.getElementById('taskDate').value;
    const leadVal = document.getElementById('taskLeadSelect').value;
    if(!desc) return alert("Digite a descrição.");
    showLoading(true, "SALVANDO TAREFA...");
    const res = await apiCall('addTask', { vendedor: loggedUser, descricao: desc, dataLimite: date, nomeLead: leadVal });
    showLoading(false);
    if(res && res.status === 'success') {
        document.getElementById('taskModal').classList.add('hidden');
        document.getElementById('taskDesc').value = '';
        carregarTarefas();
    } else alert("Erro ao salvar tarefa.");
}

async function toggleTask(id, currentStatus) {
    await apiCall('toggleTask', { taskId: id, status: currentStatus, vendedor: loggedUser }, false);
    carregarTarefas(); 
}

// 8. FUNÇÕES DE IA E MATERIAIS

async function carregarMateriais(f=null, s="") {
    const div = document.getElementById('materiaisGrid');
    if (!div) return;
    currentFolderId = f; 
    div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10 fade-in"><i class="fas fa-circle-notch fa-spin text-2xl mb-2 text-[#00aeef]"></i><br>Buscando materiais...</div>';
    try {
        const res = await apiCall('getImages', { folderId: f, search: s }, false);
        if (res && res.status === 'success' && res.data) {
            atualizarNavegacaoMateriais(res.isRoot);
            renderMateriais(res.data);
        } else { throw new Error(res?.message || "Erro desconhecido"); }
    } catch (error) {
        div.innerHTML = `<div class="col-span-2 text-center text-red-400 py-10"><i class="fas fa-wifi mb-2"></i><br>Falha.<br><button onclick="carregarMateriais('${f || ''}')" class="mt-3 bg-blue-100 text-blue-600 px-4 py-2 rounded-lg text-sm">Tentar Novamente</button></div>`;
    }
}

function renderMateriais(items) {
    const div = document.getElementById('materiaisGrid');
    if(!div) return;
    if(items.length === 0) { div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10">Vazio.</div>'; return; }
    div.innerHTML = items.map(item => {
        if (item.type === 'folder') {
            return `<div onclick="carregarMateriais('${item.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-95 transition h-36 hover:bg-blue-50 group"><i class="fas fa-folder text-5xl text-[#00aeef] group-hover:scale-110 transition drop-shadow-sm"></i><span class="text-xs font-bold text-slate-600 text-center leading-tight line-clamp-2">${item.name}</span></div>`;
        } else {
            return `<div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-48 relative overflow-hidden group"><div class="h-32 w-full bg-gray-50 rounded-xl overflow-hidden relative"><img src="${item.thumbnail}" class="w-full h-full object-cover transition transform group-hover:scale-105" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/3342/3342137.png'; this.className='w-12 h-12 m-auto mt-8 opacity-50';"></div><div class="flex-1 flex items-center justify-between mt-2 px-1 gap-2"><span class="text-[10px] text-gray-500 font-bold truncate flex-1">${item.name}</span><a href="${item.downloadUrl || '#'}" download target="_blank" class="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition hover:bg-blue-200"><i class="fas fa-download text-xs"></i></a><button onclick="compartilharImagem('${item.viewUrl}')" class="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md active:scale-90 transition hover:bg-green-600"><i class="fab fa-whatsapp"></i></button></div><a href="${item.viewUrl}" target="_blank" class="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition"><i class="fas fa-expand"></i></a></div>`;
        }
    }).join('');
}

function atualizarNavegacaoMateriais(isRoot) {
    const btnVoltar = document.querySelector('#materiais button'); 
    const titleEl = document.querySelector('#materiais h2');
    if(btnVoltar) {
        if(isRoot) {
            btnVoltar.onclick = () => navegarPara('dashboard');
            if(titleEl) titleEl.innerText = "Marketing";
        } else {
            btnVoltar.onclick = () => {
                const searchInput = document.getElementById('searchMateriais');
                if (searchInput) searchInput.value = ""; 
                carregarMateriais(null);
            };
            if(titleEl) titleEl.innerText = "Voltar";
        }
    }
}
function buscarMateriais() { const input = document.getElementById('searchMateriais'); if (input) carregarMateriais(currentFolderId, input.value); }

async function abrirIndicadores() {
    navegarPara('indicadores');
    document.getElementById('indMes').innerText = '--/--';
    document.getElementById('indCiclo').innerText = 'Carregando...';
    document.getElementById('indVendas').innerText = '...';
    document.getElementById('indLeads').innerText = '...';
    document.getElementById('indAnaliseIA').innerText = 'Analisando...';
    document.getElementById('indProgresso').style.width = '0%';
    
    const res = await apiCall('getIndicators', { vendedor: loggedUser }, false);
    if (res && res.status === 'success') {
        const d = res.data;
        document.getElementById('indMes').innerText = d.mes;
        document.getElementById('indCiclo').innerText = `Ciclo: ${d.ciclo}`;
        document.getElementById('indVendas').innerText = d.vendas;
        document.getElementById('indLeads').innerText = d.totalLeads;
        document.getElementById('indMetaTexto').innerText = `${d.vendas} / ${d.meta}`;
        const larguraBarra = Math.min(d.porcentagem, 100);
        document.getElementById('indProgresso').style.width = `${larguraBarra}%`;
        
        const barra = document.getElementById('indProgresso');
        if (d.porcentagem >= 100) barra.className = "bg-green-500 h-4 rounded-full progress-bar";
        else if (d.porcentagem >= 70) barra.className = "bg-blue-500 h-4 rounded-full progress-bar";
        else barra.className = "bg-orange-500 h-4 rounded-full progress-bar";

        const resIA = await apiCall('analyzeIndicators', { vendas: d.vendas, meta: d.meta, diasUteisRestantes: d.diasUteisRestantes }, false);
        if (resIA && resIA.status === 'success') document.getElementById('indAnaliseIA').innerText = resIA.message;
        else document.getElementById('indAnaliseIA').innerText = "Foco na meta!";
    } else {
        document.getElementById('indAnaliseIA').innerText = 'Sem dados.';
    }
}

async function combaterObjecaoGeral() {
    const obj = document.getElementById('inputObjecaoGeral').value;
    if(!obj) return alert("Digite a objeção.");
    showLoading(true, "CONSULTANDO MATRIZ...");
    const res = await apiCall('solveObjection', { objection: obj });
    showLoading(false);
    if(res && res.status === 'success') {
        const div = document.getElementById('resultadoObjecaoGeral');
        div.innerHTML = `<div id="textoResObjGeral"><b>💡 Sugestão:</b><br>${res.answer.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</div><div class="flex gap-2 mt-3 justify-end border-t border-blue-200 pt-2"><button onclick="copiarTexto('textoResObjGeral')" class="text-blue-500 text-xs font-bold uppercase"><i class="far fa-copy"></i> Copiar</button><button onclick="enviarZapTexto('textoResObjGeral')" class="text-green-500 text-xs font-bold uppercase"><i class="fab fa-whatsapp"></i> Enviar</button></div>`;
        div.classList.remove('hidden');
    } else alert("Erro na IA.");
}

async function combaterObjecaoLead() {
    if (!leadAtualParaAgendar) return;
    const obj = document.getElementById('inputObjecaoLead').value;
    if(!obj) return alert("Digite a objeção.");
    showLoading(true, "GERANDO...");
    const res = await apiCall('solveObjection', { objection: obj });
    showLoading(false);
    if(res && res.status === 'success') {
        const cleanText = res.answer.replace(/[\*#]/g, ''); 
        document.getElementById('respostaObjecaoLead').value = cleanText;
    }
}

async function salvarObjecaoLead() {
    if (!leadAtualParaAgendar) return;
    const obj = document.getElementById('inputObjecaoLead').value;
    const ans = document.getElementById('respostaObjecaoLead').value;
    if(!obj || !ans) return alert("Gere uma resposta.");
    showLoading(true, "SALVANDO...");
    const res = await apiCall('saveObjectionLead', { 
        vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, objection: obj, answer: ans
    });
    showLoading(false);
    if(res && res.status === 'success') {
        alert("✅ Salvo no histórico!");
        leadAtualParaAgendar.objecao = obj;
        leadAtualParaAgendar.respostaObjecao = ans;
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    }
}

async function analiseEstrategicaIA() {
    if (!leadAtualParaAgendar) return;
    const l = leadAtualParaAgendar;
    showLoading(true, "ANALISANDO...");
    const prompt = `Analise este lead: Nome ${l.nomeLead}, Provedor ${l.provedor}, Interesse ${l.interesse}, Bairro ${l.bairro}. Sugira 3 táticas de negociação específicas.`;
    const resp = await perguntarIABackend(prompt);
    showLoading(false);
    if(resp) {
        const obsEl = document.getElementById('modalLeadObs');
        obsEl.value = (obsEl.value ? obsEl.value + "\n\n" : "") + `[IA]: ${resp.replace(/\*\*/g, '')}`;
        alert("✅ Análise adicionada às observações! Clique em 'Salvar Obs'.");
    }
}

async function raioXConcorrencia() {
    const provedor = document.getElementById('leadProvedor')?.value;
    if(!provedor) return alert("Preencha o provedor.");
    showLoading(true, "RAIO-X...");
    const prompt = `Cliente usa ${provedor}. Liste 3 pontos fracos deles e 3 argumentos da MHNET para vencer.`;
    const resp = await perguntarIABackend(prompt);
    showLoading(false);
    if(resp) {
        const obs = document.getElementById('leadObs');
        obs.value = (obs.value + "\n\n" + resp.replace(/\*\*/g, '')).trim();
    }
}

async function refinarObsIA() {
    const obs = document.getElementById('leadObs');
    if(!obs.value) return alert("Escreva algo primeiro.");
    showLoading(true, "REFINANDO...");
    const resp = await perguntarIABackend(`Reescreva profissionalmente: "${obs.value}"`);
    showLoading(false);
    if(resp) obs.value = resp.replace(/\*\*/g, '');
}

async function perguntarIABackend(p) {
    chatHistoryData.push(`User: ${p}`);
    const contexto = chatHistoryData.slice(-6);
    try {
        const res = await apiCall('askAI', { question: p, history: contexto }, false);
        if (res && res.status === 'success') {
            const resp = res.answer;
            chatHistoryData.push(`IA: ${resp}`);
            return resp;
        } else return "⚠️ IA indisponível.";
    } catch (e) { return "Erro de conexão."; }
}

async function gerarAbordagemIA() {
    const nome = document.getElementById('leadNome').value;
    if(!nome) return alert("Preencha o nome!");
    showLoading(true, "CRIANDO PITCH...");
    const txt = await perguntarIABackend(`Crie pitch curto WhatsApp para ${nome}.`);
    showLoading(false);
    if(txt) document.getElementById('leadObs').value = txt.replace(/["*#]/g, '').trim();
}

async function gerarCoachIA() {
    showLoading(true, "COACH...");
    const txt = await perguntarIABackend(`Frase motivacional vendas curta.`);
    showLoading(false);
    if(txt) alert(`🚀 ${txt.replace(/\*\*/g,'')}`);
}

async function consultarPlanosIA() {
    toggleChat();
    if(document.getElementById('chatHistory').innerHTML === "") {
        document.getElementById('chatHistory').innerHTML = `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm">Olá! Pergunte sobre planos.</div></div>`;
    }
}

function toggleChat() {
    const el = document.getElementById('chatModal');
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        setTimeout(() => document.getElementById('chatInput')?.focus(), 300);
    } else { el.classList.add('hidden'); }
}

async function enviarMensagemChat() {
    const input = document.getElementById('chatInput');
    const hist = document.getElementById('chatHistory');
    const msg = input.value.trim();
    if(!msg) return;
    hist.innerHTML += `<div class="flex gap-3 justify-end fade-in mb-3"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">${msg}</div></div>`;
    input.value = '';
    const loadId = 'load-' + Date.now();
    hist.innerHTML += `<div id="${loadId}" class="flex gap-3 fade-in mb-3"><div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs"><i class="fas fa-spinner fa-spin"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-400 italic">...</div></div>`;
    hist.scrollTop = hist.scrollHeight;
    const resp = await perguntarIABackend(msg);
    document.getElementById(loadId)?.remove();
    if(resp) {
          const cleanResp = resp.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
          hist.innerHTML += `<div class="flex gap-3 fade-in mb-3"><div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${cleanResp}</div></div>`;
          hist.scrollTop = hist.scrollHeight;
    }
}

// 9. FUNÇÕES FALTAS E HISTÓRICO

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
    
    alert("📝 Editando solicitação. Anexe o atestado novamente se necessário.");
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
        if(editingAbsenceIndex) payload.existingFile = ""; 
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
    } else alert("Erro ao enviar.");
}
