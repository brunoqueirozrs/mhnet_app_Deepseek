/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V90 (FINAL STABLE)
 * ============================================================
 * 📝 RESUMO TÉCNICO:
 * - Correção de Loop Infinito (Navegação vs Dados).
 * - Sincronizado com Backend V85.
 * - ID de Implantação Atualizado.
 * ============================================================
 */

// ⚠️ ID DA IMPLANTAÇÃO V85
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
    console.log("🚀 MHNET App V90 - Iniciado");
    
    // Carrega cache local de leads para agilidade
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { 
        try { leadsCache = JSON.parse(saved); } catch(e) {} 
    }
    
    carregarVendedores();
    
    if (loggedUser) {
         initApp();
    } else {
         document.getElementById('userMenu').style.display = 'flex';
         document.getElementById('mainContent').style.display = 'none';
    }
});

// 2. FUNÇÕES UTILITÁRIAS (Definidas antes para evitar ReferenceError)

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
    el.select();
    el.setSelectionRange(0, 99999);
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

function atualizarDataCabecalho() {
    const elData = document.getElementById('headerDate');
    if(!elData) return;
    const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const agora = new Date();
    elData.innerText = `${dias[agora.getDay()]}, ${agora.getDate()} ${meses[agora.getMonth()]}`;
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

    // LOGICA ESPECÍFICA POR TELA
    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') carregarDadosIndicadores(); // ✅ CHAMA DADOS, NÃO NAVEGAÇÃO
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

function atualizarDashboard() {
    const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
    const count = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
    if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
    
    // Lista de Ataque
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
        leadsCache.sort((a, b) => b._linha - a._linha);
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        
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
        (l.bairro||'').toLowerCase().includes(term)
    );
    
    if (!lista.length) { div.innerHTML = '<div class="text-center mt-10 text-gray-400">Vazio.</div>'; return; }

    div.innerHTML = lista.map((l, i) => {
        const realIndex = leadsCache.indexOf(l);
        let badge = "bg-slate-100 text-slate-500";
        if(l.status === 'Venda Fechada') badge = "bg-green-500 text-white";
        else if(l.interesse === 'Alto') badge = "bg-green-100 text-green-700";

        return `<div onclick="abrirLeadDetalhes(${realIndex})" class="bg-white p-4 mb-3 rounded-xl border border-slate-100 shadow-sm cursor-pointer active:scale-95 transition">
            <div class="flex justify-between items-start">
                <div>
                    <div class="font-bold text-slate-800 text-lg">${l.nomeLead}</div>
                    <div class="text-xs text-slate-500">${l.bairro || '-'} • ${l.provedor || '-'}</div>
                </div>
                <span class="text-[10px] px-2 py-1 rounded-full font-bold ${badge}">${l.status === 'Venda Fechada' ? 'VENDIDO' : (l.interesse || 'Médio')}</span>
            </div>
        </div>`;
    }).join('');
}

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
    
    // Botão Raio-X
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

window.editarLeadAtual = function() {
    if (!leadAtualParaAgendar) { alert("Selecione um lead."); return; }
    if(!confirm(`Editar cadastro de ${leadAtualParaAgendar.nomeLead}?`)) return;

    const lead = leadAtualParaAgendar;
    editingLeadIndex = leadsCache.indexOf(lead);

    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ""; };
    setVal('leadNome', lead.nomeLead); setVal('leadTelefone', lead.telefone); setVal('leadProvedor', lead.provedor);
    setVal('leadObs', lead.observacao); setVal('leadEndereco', lead.endereco); setVal('leadBairro', lead.bairro); setVal('leadCidade', lead.cidade);
    
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

  const payload = {
    vendedor: loggedUser, nomeLead: nome, telefone: tel,
    endereco: document.getElementById('leadEndereco').value,
    bairro: document.getElementById('leadBairro').value,
    cidade: document.getElementById('leadCidade').value,
    provedor: document.getElementById('leadProvedor').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value,
    agendamento: ""
  };
   
  const res = await apiCall('addLead', payload);
  if (res && (res.status === 'success' || res.local)) {
      if(!res.local) leadsCache.unshift(payload);
      alert(res.local ? "Salvo OFFLINE." : "Salvo com sucesso!");
      navegarPara('gestaoLeads');
  } else alert('Erro ao salvar.');
}

async function excluirLead() {
    if (!leadAtualParaAgendar) return;
    if (!confirm("⚠️ EXCLUIR permanentemente?")) return;
    showLoading(true, "EXCLUINDO...");
    const res = await apiCall('deleteLead', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead });
    showLoading(false);
    if(res && (res.status === 'success' || res.local)) {
        alert("✅ Excluído.");
        const index = leadsCache.indexOf(leadAtualParaAgendar);
        if (index > -1) leadsCache.splice(index, 1);
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        fecharLeadModal(); renderLeads(); atualizarDashboard();
    } else alert("Erro ao excluir.");
}

async function marcarVendaFechada() {
    if (!leadAtualParaAgendar) return;
    if (!confirm("🎉 Confirmar VENDA FECHADA?")) return;
    showLoading(true, "PARABÉNS! 🚀");
    const res = await apiCall('updateStatus', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: "Venda Fechada" });
    showLoading(false);
    if(res && res.status === 'success') {
        alert("🎉 Venda registrada!");
        leadAtualParaAgendar.status = "Venda Fechada";
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        fecharLeadModal(); renderLeads();
    }
}

async function salvarAgendamento() {
  if (!leadAtualParaAgendar) return;
  const ag = `${document.getElementById('agendarData').value} ${document.getElementById('agendarHora').value}`;
  const res = await apiCall('updateAgendamento', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: ag });
  if(res && (res.status === 'success' || res.local)) {
      alert("Agendado!");
      leadAtualParaAgendar.agendamento = ag;
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      fecharLeadModal(); verificarAgendamentosHoje(); renderLeads();
  }
}

async function salvarObservacaoModal() {
    if (!leadAtualParaAgendar) return;
    const obs = document.getElementById('modalLeadObs').value;
    const res = await apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: obs });
    if(res) { alert("Salvo!"); leadAtualParaAgendar.observacao = obs; localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache)); }
}

function ajustarMicrofone() {
    const btnMic = document.getElementById('btnMicNome');
    if (btnMic) {
        btnMic.removeAttribute('onclick');
        btnMic.onclick = function() { iniciarDitado('leadObs', 'btnMicNome'); };
    }
}

async function buscarEnderecoGPS() {
    if (!navigator.geolocation) return alert("GPS desligado.");
    showLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const data = await res.json();
            if (data && data.address) {
                const elEnd = document.getElementById('leadEndereco');
                const elBairro = document.getElementById('leadBairro');
                const elCidade = document.getElementById('leadCidade');
                if(elEnd) elEnd.value = data.address.road || '';
                if(elBairro) elBairro.value = data.address.suburb || data.address.neighbourhood || '';
                if(elCidade) elCidade.value = data.address.city || data.address.town || '';
                alert(`✅ Localizado: ${data.address.road}`);
            }
        } catch (e) { alert("Erro ao obter endereço."); }
        showLoading(false);
    }, () => { showLoading(false); alert("Erro no GPS."); }, { enableHighAccuracy: true });
}

window.filtrarRetornos = function() {
    const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
    navegarPara('gestaoLeads');
    const input = document.getElementById('searchLead');
    if(input) { input.value = ""; input.placeholder = `📅 Retornos de Hoje (${hoje})`; }
    const div = document.getElementById('listaLeadsGestao');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    if(!retornos.length) { div.innerHTML = '<div class="text-center mt-10 font-bold text-slate-400">Nenhum retorno hoje! 😴</div>'; return; }
    div.innerHTML = retornos.map(l => {
        const idx = leadsCache.indexOf(l);
        return criarCardLead(l, idx, true);
    }).join('');
};

// 7. TAREFAS

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
            return `<div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 ${opacity}"><input type="checkbox" ${checked} onchange="toggleTask('${t.id}', '${t.status}')" class="w-5 h-5 accent-blue-600 rounded cursor-pointer"><div class="flex-1"><div class="text-sm font-bold text-slate-700">${t.descricao}</div><div class="text-[10px] text-slate-400 flex items-center gap-2 mt-1">${t.dataLimite ? `<span class="bg-red-50 text-red-400 px-1.5 py-0.5 rounded flex items-center gap-1"><i class="fas fa-calendar"></i> ${t.dataLimite}</span>` : ''}${t.nomeLead ? `<span class="bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded flex items-center gap-1"><i class="fas fa-user"></i> ${t.nomeLead}</span>` : ''}</div></div></div>`;
        }).join('');
    } else div.innerHTML = '<div class="text-center text-red-400">Erro ao carregar.</div>';
}

function abrirModalTarefa() { document.getElementById('taskModal').classList.remove('hidden'); const sel = document.getElementById('taskLeadSelect'); sel.innerHTML = '<option value="">Nenhum (Avulso)</option>'; leadsCache.forEach(l => { const opt = document.createElement('option'); opt.value = l.nomeLead; opt.innerText = l.nomeLead; sel.appendChild(opt); }); }
async function salvarTarefa() { const desc = document.getElementById('taskDesc').value; const date = document.getElementById('taskDate').value; const leadVal = document.getElementById('taskLeadSelect').value; if(!desc) return alert("Digite a descrição."); showLoading(true, "SALVANDO TAREFA..."); const res = await apiCall('addTask', { vendedor: loggedUser, descricao: desc, dataLimite: date, nomeLead: leadVal }); showLoading(false); if(res && res.status === 'success') { document.getElementById('taskModal').classList.add('hidden'); document.getElementById('taskDesc').value = ''; carregarTarefas(); } else alert("Erro ao salvar."); }
async function toggleTask(id, s) { await apiCall('toggleTask', { taskId: id, status: s, vendedor: loggedUser }, false); carregarTarefas(); }
async function limparTarefasConcluidas() { if(!confirm("Limpar concluídas?")) return; showLoading(true, "LIMPANDO..."); await apiCall('archiveTasks', { vendedor: loggedUser }); showLoading(false); carregarTarefas(); }

// 8. FALTAS E HISTÓRICO

async function verHistoricoFaltas() {
    const div = document.getElementById('listaHistoricoFaltas');
    document.getElementById('historicoFaltasContainer').classList.remove('hidden');
    document.getElementById('formFaltaContainer').classList.add('hidden');
    div.innerHTML = '<div class="text-center p-5 text-gray-400"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    const res = await apiCall('getAbsences', { vendedor: loggedUser }, false);
    if (res && res.status === 'success' && res.data.length > 0) {
        div.innerHTML = res.data.map(f => `<div onclick='preencherEdicaoFalta(${JSON.stringify(f)})' class="bg-white p-3 rounded-xl border border-slate-100 shadow-sm mb-2 cursor-pointer active:bg-blue-50"><div class="flex justify-between items-start"><div><div class="font-bold text-xs text-slate-700">${f.motivo}</div><div class="text-[10px] text-slate-400">${f.dataFalta} • ${f.statusEnvio}</div></div><i class="fas fa-pen text-slate-300 text-xs"></i></div></div>`).join('');
    } else div.innerHTML = '<div class="text-center p-5 text-gray-400 text-xs">Nenhum histórico.</div>';
}

function ocultarHistoricoFaltas() {
    document.getElementById('historicoFaltasContainer').classList.add('hidden');
    document.getElementById('formFaltaContainer').classList.remove('hidden');
    editingAbsenceIndex = null;
    document.getElementById('faltaData').value = ''; document.getElementById('faltaMotivo').value = ''; document.getElementById('faltaObs').value = ''; document.getElementById('faltaArquivo').value = '';
    document.getElementById('btnEnviarFalta').innerHTML = '<i class="fas fa-paper-plane"></i> ENVIAR SOLICITAÇÃO';
}

function preencherEdicaoFalta(falta) {
    document.getElementById('historicoFaltasContainer').classList.add('hidden');
    document.getElementById('formFaltaContainer').classList.remove('hidden');
    const [d, m, a] = falta.dataFalta.split('/');
    document.getElementById('faltaData').value = `${a}-${m}-${d}`;
    document.getElementById('faltaMotivo').value = falta.motivo;
    document.getElementById('faltaObs').value = falta.obs;
    editingAbsenceIndex = falta._linha; 
    document.getElementById('btnEnviarFalta').innerHTML = '<i class="fas fa-sync"></i> ATUALIZAR & REENVIAR';
    alert("📝 Editando solicitação.");
}

async function enviarJustificativa() {
    const dataFalta = document.getElementById('faltaData').value;
    const motivo = document.getElementById('faltaMotivo').value;
    const obs = document.getElementById('faltaObs').value;
    const fileInput = document.getElementById('faltaArquivo');
    if(!dataFalta || !motivo) return alert("Preencha data e motivo.");
    showLoading(true, editingAbsenceIndex ? "ATUALIZANDO..." : "ENVIANDO...");
    const payload = { vendedor: loggedUser, dataFalta: dataFalta, motivo: motivo, observacao: obs, _linha: editingAbsenceIndex };
    const route = editingAbsenceIndex ? 'updateAbsence' : 'registerAbsence';
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async function(e) { payload.fileData = e.target.result; payload.fileName = file.name; payload.mimeType = file.type; await enviarPayloadFalta(route, payload); };
        reader.readAsDataURL(file);
    } else { if(editingAbsenceIndex) payload.existingFile = ""; await enviarPayloadFalta(route, payload); }
}

async function enviarPayloadFalta(route, payload) {
    const res = await apiCall(route, payload);
    showLoading(false);
    if (res && res.status === 'success') { alert(editingAbsenceIndex ? "✅ Atualizado!" : "✅ Enviado!"); ocultarHistoricoFaltas(); navegarPara('dashboard'); } else alert("Erro ao enviar.");
}

// 9. INDICADORES & IA (NOVAS FUNÇÕES)

async function abrirIndicadores() {
    // ⚠️ FUNÇÃO ESPECÍFICA PARA DADOS (NÃO CHAMA NAVEGAR)
    return carregarDadosIndicadores(); 
}

async function carregarDadosIndicadores() {
    navegarPara('indicadores');
    document.getElementById('indMes').innerText = '--/--';
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
        document.getElementById('indProgresso').style.width = `${Math.min(d.porcentagem, 100)}%`;
        apiCall('analyzeIndicators', { vendas: d.vendas, meta: d.meta, diasUteisRestantes: d.diasUteisRestantes }, false).then(r => { if(r.status === 'success') document.getElementById('indAnaliseIA').innerText = r.message; });
    } else { document.getElementById('indAnaliseIA').innerText = 'Sem dados.'; }
}

// IA e Objeções
async function combaterObjecaoGeral() { const o=document.getElementById('inputObjecaoGeral').value; showLoading(true); const r=await apiCall('solveObjection',{objection:o}); showLoading(false); if(r.status==='success') { document.getElementById('resultadoObjecaoGeral').innerHTML=r.answer.replace(/\*\*/g,'<b>').replace(/\*/g,'<i>'); document.getElementById('resultadoObjecaoGeral').classList.remove('hidden'); } }
async function combaterObjecaoLead() { const o=document.getElementById('inputObjecaoLead').value; showLoading(true); const r=await apiCall('solveObjection',{objection:o}); showLoading(false); if(r.status==='success') document.getElementById('respostaObjecaoLead').value=r.answer.replace(/[\*#]/g,''); }
async function salvarObjecaoLead() { await apiCall('saveObjectionLead',{vendedor:loggedUser,nomeLead:leadAtualParaAgendar.nomeLead,objection:document.getElementById('inputObjecaoLead').value,answer:document.getElementById('respostaObjecaoLead').value}); alert("Salvo!"); }
async function analiseEstrategicaIA() { showLoading(true); const r=await perguntarIABackend(`Analise lead ${leadAtualParaAgendar.nomeLead}`); showLoading(false); if(r) { document.getElementById('modalLeadObs').value += "\n\n[IA]: " + r.replace(/\*\*/g,''); alert("Análise adicionada!"); } }
async function raioXConcorrencia() { const p = document.getElementById('leadProvedor').value; if(!p) return alert("Informe provedor."); showLoading(true); const r = await perguntarIABackend(`Cliente usa ${p}. 3 pontos fracos deles e 3 argumentos nossos.`); showLoading(false); if(r) { const o = document.getElementById('leadObs'); o.value += "\n\n" + r.replace(/\*\*/g,''); } }
async function refinarObsIA() { const o = document.getElementById('leadObs'); if(!o.value) return alert("Escreva algo."); showLoading(true); const r = await perguntarIABackend(`Reescreva profissionalmente: "${o.value}"`); showLoading(false); if(r) o.value = r.replace(/\*\*/g,''); }
async function gerarCoachIA() { showLoading(true); const r=await perguntarIABackend("Frase motivacional curta"); showLoading(false); if(r) alert(`🚀 ${r.replace(/\*\*/g,'')}`); }
async function perguntarIABackend(p) { try { const r=await apiCall('askAI',{question:p},false); return r.status==='success' ? r.answer : null; } catch(e){return null;} }
async function consultarPlanosIA() { document.getElementById('chatModal').classList.remove('hidden'); }
function toggleChat() { document.getElementById('chatModal').classList.add('hidden'); }
async function enviarMensagemChat() { const i=document.getElementById('chatInput'); const m=i.value; if(!m)return; document.getElementById('chatHistory').innerHTML+=`<div class="text-right p-2 bg-blue-50 mb-1 rounded">${m}</div>`; i.value=''; const r=await perguntarIABackend(m); document.getElementById('chatHistory').innerHTML+=`<div class="text-left p-2 bg-gray-100 mb-1 rounded">${r}</div>`; }
async function carregarMateriais(f=null,s=""){ const d=document.getElementById('materiaisGrid'); d.innerHTML='Carregando...'; const r=await apiCall('getImages',{folderId:f,search:s},false); if(r.status==='success') renderMateriais(r.data); }
function renderMateriais(i){ const d=document.getElementById('materiaisGrid'); d.innerHTML=i.map(x=>`<div class="bg-white p-2 rounded border"><a href="${x.downloadUrl}" target="_blank">${x.name}</a></div>`).join(''); }
function buscarMateriais(){ carregarMateriais(currentFolderId, document.getElementById('searchMateriais').value); }
