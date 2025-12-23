/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V60 (FINAL INTEGRADO)
 * ============================================================
 * 📝 RESUMO:
 * - Arquivo separado do HTML para melhor organização.
 * - Contém: Login, Leads, Tarefas, Faltas, Indicadores, IA e Materiais.
 * - Sincronizado com Backend V84.
 * ============================================================
 */

// ⚠️ ID DA IMPLANTAÇÃO V84 DO BACKEND (ATUALIZE SE NECESSÁRIO)
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let leadAtualParaAgendar = null; 
let chatHistoryData = []; 
let currentFolderId = null;
let editingLeadIndex = null;
let editingAbsenceIndex = null;

// 1. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 MHNET App v60 - Iniciando...");
    carregarVendedores();
    
    const saved = localStorage.getItem('mhnet_leads_cache');
    if(saved) { 
        try { leadsCache = JSON.parse(saved); } catch(e) {} 
    }
    
    if (loggedUser) {
         initApp();
    } else {
         document.getElementById('userMenu').style.display = 'flex';
         document.getElementById('mainContent').style.display = 'none';
    }
});

// 2. CORE & NAVEGAÇÃO

function initApp() {
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('mainContent').style.display = 'flex';
    
    const elUser = document.getElementById('userInfo');
    if(elUser) {
        elUser.innerText = loggedUser;
        elUser.classList.remove('truncate', 'max-w-[150px]');
    }
    
    atualizarDataCabecalho();
    
    // Carrega leads (e verifica se é admin)
    carregarLeads(false); 
    
    navegarPara('dashboard');
}

function setLoggedUser() {
    const v = document.getElementById('userSelect').value;
    if(v) {
        loggedUser = v;
        localStorage.setItem('loggedUser', v);
        initApp();
    } else {
        alert("Selecione um vendedor (ou aguarde carregar).");
    }
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
        void target.offsetWidth; // Trigger reflow para animação
        target.classList.add('fade-in');
    }
    
    const scroller = document.getElementById('main-scroll');
    if(scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });

    // Hooks específicos por página
    if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
    if (pageId === 'tarefas') carregarTarefas();
    if (pageId === 'indicadores') abrirIndicadores();
    if (pageId === 'gestaoLeads') {
        const busca = document.getElementById('searchLead');
        if(busca && busca.placeholder.includes("Retornos")) {
            busca.value = "";
            busca.placeholder = "Buscar por nome, bairro...";
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

// 3. COMUNICAÇÃO API

async function apiCall(route, payload, show=true) {
    if(show) showLoading(true);
    try {
        const res = await fetch(API_URL, { 
            method: 'POST', 
            headers: {'Content-Type': 'text/plain;charset=utf-8'}, 
            body: JSON.stringify({ route: route, payload: payload }) 
        });
        
        if (!res.ok) throw new Error("Falha HTTP");
        const json = await res.json();
        if(show) showLoading(false);
        return json;
    } catch(e) {
        console.warn("⚠️ API falhou ou offline:", e);
        if(show) showLoading(false);
        
        // Modo Offline Simulado para cadastros críticos
        if(['addLead', 'updateAgendamento', 'updateObservacao'].includes(route)) {
            return {status:'success', local: true};
        }
        return { status: 'error', message: 'Erro de conexão' };
    }
}

async function carregarVendedores() {
    const s = document.getElementById('userSelect');
    if(!s) return;
    
    // Lista offline de fallback
    const VENDEDORES_OFFLINE = [
        "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
        "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
        "Elton da Silva Rodrigo Gonçalves", "Bruno Garcia Queiroz"
    ];

    s.innerHTML = '<option value="">Conectando...</option>';
    
    // Timeout para não travar o login
    const timeout = new Promise((_, reject) => setTimeout(() => reject("Timeout"), 4000));

    try {
        const res = await Promise.race([apiCall('getVendors', {}, false), timeout]);
        if(res.status === 'success' && res.data.length > 0) {
            s.innerHTML = '<option value="">Selecione...</option>';
            res.data.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.nome; opt.innerText = v.nome; s.appendChild(opt);
            });
        } else throw new Error("Vazio");
    } catch(e) {
        console.warn("Usando lista offline");
        s.innerHTML = '<option value="">Modo Offline</option>';
        VENDEDORES_OFFLINE.forEach(nome => {
            const opt = document.createElement('option');
            opt.value = nome; opt.innerText = nome; s.appendChild(opt);
        });
    }
}

// 4. MÓDULO DE TAREFAS

async function carregarTarefas() {
    const div = document.getElementById('listaTarefasContainer');
    div.innerHTML = '<div class="text-center p-5 text-gray-400"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    
    const res = await apiCall('getTasks', { vendedor: loggedUser }, false);
    
    if (res && res.status === 'success') {
        const tasks = res.data;
        
        // Ativa painel Admin se necessário
        if (res.isAdmin) {
            const panel = document.getElementById('adminPanel');
            if(panel) panel.classList.remove('hidden');
        }

        if (tasks.length === 0) {
            div.innerHTML = '<div class="text-center p-10 text-gray-300 flex flex-col items-center"><i class="fas fa-clipboard-check text-4xl mb-2"></i><p>Nenhuma tarefa pendente.</p></div>';
            return;
        }
        
        div.innerHTML = tasks.map(t => {
            const checked = t.status === "CONCLUIDA" ? "checked" : "";
            const opacity = t.status === "CONCLUIDA" ? "opacity-50 line-through" : "";
            return `
            <div class="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3 ${opacity}">
                <input type="checkbox" ${checked} onchange="toggleTask('${t.id}', '${t.status}')" class="w-5 h-5 accent-blue-600 rounded cursor-pointer">
                <div class="flex-1">
                    <div class="text-sm font-bold text-slate-700">${t.descricao}</div>
                    <div class="text-[10px] text-slate-400 flex items-center gap-2 mt-1">
                        ${t.dataLimite ? `<span class="bg-red-50 text-red-400 px-1.5 py-0.5 rounded flex items-center gap-1"><i class="fas fa-calendar"></i> ${t.dataLimite}</span>` : ''}
                        ${t.nomeLead ? `<span class="bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded flex items-center gap-1"><i class="fas fa-user"></i> ${t.nomeLead}</span>` : ''}
                        ${res.isAdmin ? `<span class="text-orange-400 font-bold ml-auto">${t.vendedor}</span>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    } else {
        div.innerHTML = '<div class="text-center text-red-400">Erro ao carregar tarefas.</div>';
    }
}

function abrirModalTarefa() {
    document.getElementById('taskModal').classList.remove('hidden');
    const sel = document.getElementById('taskLeadSelect');
    sel.innerHTML = '<option value="">Nenhum (Avulso)</option>';
    leadsCache.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.nomeLead; 
        opt.innerText = l.nomeLead;
        sel.appendChild(opt);
    });
}

async function salvarTarefa() {
    const desc = document.getElementById('taskDesc').value;
    const date = document.getElementById('taskDate').value;
    const leadVal = document.getElementById('taskLeadSelect').value;
    
    if(!desc) return alert("Digite a descrição.");
    
    showLoading(true, "SALVANDO...");
    const res = await apiCall('addTask', {
        vendedor: loggedUser,
        descricao: desc,
        dataLimite: date,
        nomeLead: leadVal 
    });
    showLoading(false);
    
    if(res && res.status === 'success') {
        document.getElementById('taskModal').classList.add('hidden');
        document.getElementById('taskDesc').value = '';
        carregarTarefas();
    } else {
        alert("Erro ao salvar tarefa.");
    }
}

async function toggleTask(id, currentStatus) {
    await apiCall('toggleTask', { taskId: id, status: currentStatus, vendedor: loggedUser }, false);
    carregarTarefas(); 
}


// 5. MÓDULO DE FALTAS

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
    btn.classList.remove('bg-green-500');
    btn.classList.add('bg-[#00aeef]');
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
    btn.classList.remove('bg-[#00aeef]');
    btn.classList.add('bg-green-500');
    
    alert("📝 Editando solicitação.");
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
    } else {
        alert("Erro ao enviar.");
    }
}

// 6. GESTÃO DE LEADS

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
function abrirLeadDetalhes(i) {
    const l = leadsCache[i]; if(!l) return;
    leadAtualParaAgendar = l;
    
    document.getElementById('modalLeadNome').innerText = l.nomeLead;
    document.getElementById('modalLeadInfo').innerText = `${l.bairro || '-'} • ${l.telefone}`;
    document.getElementById('modalLeadProvedor').innerText = l.provedor || '--';
    document.getElementById('modalLeadObs').value = l.observacao || "";
    document.getElementById('inputObjecaoLead').value = l.objecao || "";
    document.getElementById('respostaObjecaoLead').value = l.respostaObjecao || "";

    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) btnWhats.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');

    const m = document.getElementById('leadModal');
    if (m) { m.classList.remove('hidden'); const c = m.querySelector('div.slide-up'); if(c) { c.classList.remove('slide-up'); void c.offsetWidth; c.classList.add('slide-up'); } }
}

function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); leadAtualParaAgendar = null; editingLeadIndex = null; }

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
  } else alert('Erro.');
}

async function excluirLead() {
    if (!leadAtualParaAgendar) return;
    if (!confirm("⚠️ EXCLUIR este lead permanentemente?")) return;
    showLoading(true, "EXCLUINDO...");
    const res = await apiCall('deleteLead', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead });
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
    const res = await apiCall('updateStatus', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: "Venda Fechada" });
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
      fecharLeadModal(); verificarAgendamentosHoje(); renderLeads();
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

// ... (IA e Materiais) ...
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
        } else { throw new Error(res?.message || "Erro API"); }
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
            return `<div onclick="carregarMateriais('${item.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-95 transition h-36 group"><i class="fas fa-folder text-5xl text-[#00aeef] group-hover:scale-110 transition drop-shadow-sm"></i><span class="text-xs font-bold text-slate-600 text-center leading-tight line-clamp-2">${item.name}</span></div>`;
        } else {
            return `<div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-48 relative overflow-hidden group"><div class="h-32 w-full bg-gray-50 rounded-xl overflow-hidden relative"><img src="${item.thumbnail}" class="w-full h-full object-cover" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/3342/3342137.png'; this.className='w-12 h-12 m-auto mt-8 opacity-50';"></div><div class="flex-1 flex items-center justify-between mt-2 px-1 gap-2"><span class="text-[10px] text-gray-500 font-bold truncate flex-1">${item.name}</span><a href="${item.downloadUrl || '#'}" download target="_blank" class="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition hover:bg-blue-200"><i class="fas fa-download text-xs"></i></a><button onclick="compartilharImagem('${item.viewUrl}')" class="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md active:scale-90 transition hover:bg-green-600"><i class="fab fa-whatsapp"></i></button></div><a href="${item.viewUrl}" target="_blank" class="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition"><i class="fas fa-expand"></i></a></div>`;
        }
    }).join('');
}
function atualizarNavegacaoMateriais(r) { const btn = document.querySelector('#materiais button'); const title = document.querySelector('#materiais h2'); if(btn) { if(r) { btn.onclick = () => navegarPara('dashboard'); if(title) title.innerText = "Marketing"; } else { btn.onclick = () => { const s = document.getElementById('searchMateriais'); if (s) s.value = ""; carregarMateriais(null); }; if(title) title.innerText = "Voltar"; } } }
function buscarMateriais() { const i = document.getElementById('searchMateriais'); if (i) carregarMateriais(currentFolderId, i.value); }
function compartilharImagem(u) { window.open(`https://wa.me/?text=${encodeURIComponent(u)}`, '_blank'); }

// --- IA ---
async function perguntarIABackend(p) { chatHistoryData.push(`User: ${p}`); const ctx = chatHistoryData.slice(-6); try { const res = await apiCall('askAI', { question: p, history: ctx }, false); if (res && res.status === 'success') { const ans = res.answer; chatHistoryData.push(`IA: ${ans}`); return ans; } return "Erro IA."; } catch (e) { return "Erro conexão."; } }
async function gerarAbordagemIA() { const nome = document.getElementById('leadNome').value; if(!nome) return alert("Preencha o nome!"); showLoading(true); const txt = await perguntarIABackend(`Crie pitch curto WhatsApp para ${nome}.`); showLoading(false); if(txt) document.getElementById('leadObs').value = txt.replace(/["*#]/g, '').trim(); }
async function gerarCoachIA() { showLoading(true); const txt = await perguntarIABackend(`Frase motivacional curta.`); showLoading(false); if(txt) alert(`🚀 ${txt.replace(/\*\*/g,'')}`); }
async function consultarPlanosIA() { toggleChat(); if(document.getElementById('chatHistory').innerHTML === "") document.getElementById('chatHistory').innerHTML = `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full text-center p-2 text-xs">🤖</div><div class="bg-white p-3 rounded-2xl text-sm text-gray-600 shadow-sm">Olá! Pergunte sobre planos.</div></div>`; }
function toggleChat() { const el = document.getElementById('chatModal'); if(el.classList.contains('hidden')) { el.classList.remove('hidden'); setTimeout(() => document.getElementById('chatInput')?.focus(), 300); } else { el.classList.add('hidden'); } }
async function enviarMensagemChat() { const input = document.getElementById('chatInput'); const hist = document.getElementById('chatHistory'); const msg = input.value.trim(); if(!msg) return; hist.innerHTML += `<div class="flex justify-end mb-3"><div class="bg-[#004c99] p-3 rounded-2xl text-sm text-white max-w-[85%]">${msg}</div></div>`; input.value = ''; const loadId = 'load-' + Date.now(); hist.innerHTML += `<div id="${loadId}" class="flex mb-3"><div class="bg-white p-3 rounded-2xl text-sm text-gray-400">...</div></div>`; hist.scrollTop = hist.scrollHeight; const resp = await perguntarIABackend(msg); document.getElementById(loadId)?.remove(); if(resp) { const clean = resp.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'); hist.innerHTML += `<div class="flex mb-3"><div class="bg-white p-3 rounded-2xl text-sm text-gray-600 shadow-sm max-w-[90%]">${clean}</div></div>`; hist.scrollTop = hist.scrollHeight; } }
async function combaterObjecaoGeral() { const obj = document.getElementById('inputObjecaoGeral').value; if(!obj) return alert("Digite algo."); showLoading(true); const res = await apiCall('solveObjection', { objection: obj }); showLoading(false); if(res.status==='success') { document.getElementById('resultadoObjecaoGeral').innerHTML = res.answer; document.getElementById('resultadoObjecaoGeral').classList.remove('hidden'); } }
async function combaterObjecaoLead() { const obj = document.getElementById('inputObjecaoLead').value; if(!obj) return alert("Digite algo."); showLoading(true); const res = await apiCall('solveObjection', { objection: obj }); showLoading(false); if(res.status==='success') document.getElementById('respostaObjecaoLead').value = res.answer.replace(/[\*#]/g, ''); }
async function salvarObjecaoLead() { if(!leadAtualParaAgendar) return; const obj = document.getElementById('inputObjecaoLead').value; const ans = document.getElementById('respostaObjecaoLead').value; showLoading(true); await apiCall('saveObjectionLead', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, objection: obj, answer: ans }); showLoading(false); alert("Salvo!"); }
async function analiseEstrategicaIA() { if(!leadAtualParaAgendar) return; showLoading(true); const p = `Analise lead: ${leadAtualParaAgendar.nomeLead}, ${leadAtualParaAgendar.provedor}, ${leadAtualParaAgendar.interesse}. 3 táticas.`; const r = await perguntarIABackend(p); showLoading(false); if(r) { const o = document.getElementById('modalLeadObs'); o.value += "\n\n[IA]: " + r.replace(/\*\*/g,''); alert("Análise adicionada!"); } }
async function raioXConcorrencia() { const p = document.getElementById('leadProvedor').value; if(!p) return alert("Informe provedor."); showLoading(true); const r = await perguntarIABackend(`Cliente usa ${p}. 3 pontos fracos deles e 3 argumentos nossos.`); showLoading(false); if(r) { const o = document.getElementById('leadObs'); o.value += "\n\n" + r.replace(/\*\*/g,''); } }
async function refinarObsIA() { const o = document.getElementById('leadObs'); if(!o.value) return alert("Escreva algo."); showLoading(true); const r = await perguntarIABackend(`Reescreva profissionalmente: "${o.value}"`); showLoading(false); if(r) o.value = r.replace(/\*\*/g,''); }

// --- INDICADORES ---
async function abrirIndicadores() { navegarPara('indicadores'); const res = await apiCall('getIndicators', { vendedor: loggedUser }, false); if(res.status==='success') { const d=res.data; document.getElementById('indMes').innerText=d.mes; document.getElementById('indVendas').innerText=d.vendas; document.getElementById('indLeads').innerText=d.totalLeads; document.getElementById('indProgresso').style.width=`${Math.min(d.porcentagem,100)}%`; apiCall('analyzeIndicators', {vendas:d.vendas,meta:d.meta,diasUteisRestantes:d.diasUteisRestantes},false).then(r=>{if(r.status==='success') document.getElementById('indAnaliseIA').innerText=r.message}); } }

// --- UTILS ---
function copiarTexto(id) { const el = document.getElementById(id); if(!el) return; el.select(); document.execCommand('copy'); alert("Copiado!"); }
function enviarZapTexto(id) { const el = document.getElementById(id); if(!el) return; window.open(`https://wa.me/?text=${encodeURIComponent(el.value||el.innerText)}`, '_blank'); }
function showLoading(s, t) { document.getElementById('loader').style.display = s ? 'flex' : 'none'; if(t) document.getElementById('loaderText').innerText = t; }
function iniciarDitado(t, b) { const R = window.SpeechRecognition || window.webkitSpeechRecognition; if(!R) return alert("Sem voz"); const r = new R(); r.lang='pt-BR'; r.start(); r.onresult = e => { document.getElementById(t).value += " " + e.results[0][0].transcript; }; }
async function buscarEnderecoGPS() { if(!navigator.geolocation) return alert("GPS Off"); showLoading(true); navigator.geolocation.getCurrentPosition(async (pos) => { try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`); const d = await r.json(); if(d.address) { document.getElementById('leadEndereco').value = d.address.road||''; document.getElementById('leadBairro').value = d.address.suburb||''; document.getElementById('leadCidade').value = d.address.city||''; alert("📍 Localizado!"); } } catch(e){} showLoading(false); }, ()=>{showLoading(false);alert("Erro GPS")}, {enableHighAccuracy:true}); }
