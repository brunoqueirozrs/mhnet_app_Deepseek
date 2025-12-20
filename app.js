/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V39 (HEADER DATE FIX)
 * ============================================================
 * 📝 AJUSTES:
 * - Função atualizarDataCabecalho() adicionada.
 * - Header agora exibe a data formatada (ex: SEG, 23 DEZ).
 * ============================================================
 */

// CONFIGURAÇÃO
const DEPLOY_ID = 'AKfycbzJvdEQcVEmCm7GAUJHc8gBujLPvX0bBgq3BIZha40osyPItW-ZFNjNUs3d5H9UvH0t'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let leadAtualParaAgendar = null; 
let chatHistoryData = []; 

// 1. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 MHNET App v39 - Header Update");
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

// 2. CORE SYSTEM

function initApp() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'flex'; 
  
  // Atualiza Nome
  const elUser = document.getElementById('userInfo');
  if(elUser) {
      elUser.innerText = loggedUser;
      elUser.classList.remove('truncate', 'max-w-[150px]'); 
  }

  // Atualiza Data no Cabeçalho (NOVO)
  atualizarDataCabecalho();
   
  navegarPara('dashboard');
   
  if(leadsCache.length > 0) {
    renderLeads();
    atualizarDashboard();
    verificarAgendamentosHoje();
  }
   
  carregarLeads(false); 
}

// Funçao para formatar data bonita (NOVO)
function atualizarDataCabecalho() {
    const elData = document.getElementById('headerDate');
    if(!elData) return;
    
    const agora = new Date();
    const opcoes = { weekday: 'short', day: 'numeric', month: 'short' };
    // Ex: "sáb., 20 de dez." -> "SÁB, 20 DEZ"
    const dataFormatada = agora.toLocaleDateString('pt-BR', opcoes)
        .replace(/\./g, '')
        .replace(' de ', ' ')
        .toUpperCase();
        
    elData.innerText = dataFormatada;
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

  if (pageId === 'gestaoLeads') {
      const busca = document.getElementById('searchLead');
      if(busca && busca.placeholder.includes("Retornos")) {
          busca.value = "";
          busca.placeholder = "Buscar por nome, bairro...";
      }
      renderLeads();
  }
  
  if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
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
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch(e) { throw new Error("Erro formato JSON."); }
    
    if(show) showLoading(false);
    return json;

  } catch(e) {
    console.error(`Erro API (${route}):`, e);
    if(show) showLoading(false);
    if(['addLead', 'updateAgendamento', 'updateObservacao'].includes(route)) {
        return {status:'success', local: true};
    }
    return {status: 'error', message: e.message};
  }
}

// 4. GESTÃO DE LEADS

async function carregarLeads(showLoader = true) {
  const res = await apiCall('getLeads', { vendedor: loggedUser }, showLoader);
  
  if (res && res.status === 'success') {
      leadsCache = res.data || [];
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      renderLeads();
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
  
  if (!lista.length) { 
      div.innerHTML = '<div class="flex flex-col items-center mt-10 text-slate-300"><i class="fas fa-search text-4xl mb-2"></i><p class="text-sm font-bold">Nenhum cliente encontrado.</p></div>'; 
      return; 
  }

  div.innerHTML = lista.map((l, i) => {
      const realIndex = leadsCache.indexOf(l);
      return criarCardLead(l, realIndex);
  }).join('');
}

function criarCardLead(l, index, destaque = false) {
    let badge = "bg-slate-100 text-slate-500";
    if (l.interesse === 'Alto') badge = "bg-green-100 text-green-700 ring-1 ring-green-200";
    if (l.interesse === 'Baixo') badge = "bg-blue-50 text-blue-400";

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
            <span class="text-[10px] font-bold px-3 py-1 rounded-full ${badge}">${l.interesse || 'Médio'}</span>
            ${l.agendamento ? `<span class="text-[10px] text-orange-600 font-bold bg-white px-2 py-1 rounded-lg border border-orange-100 shadow-sm flex items-center"><i class="fas fa-clock mr-1"></i> ${l.agendamento.split(' ')[0]}</span>` : ''}
        </div>
      </div>
    </div>`;
}

// 5. MODAIS

function abrirLeadDetalhes(index) {
    const l = leadsCache[index];
    if(!l) return;
    leadAtualParaAgendar = l;
    
    const setText = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };
    setText('modalLeadNome', l.nomeLead);
    setText('modalLeadInfo', `${l.bairro || 'Sem bairro'} • ${l.telefone}`);
    setText('modalLeadProvedor', l.provedor || 'Não informado');
    
    const obsEl = document.getElementById('modalLeadObs');
    if(obsEl) obsEl.value = l.observacao || "";
    
    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) {
        const num = l.telefone.replace(/\D/g,'');
        btnWhats.onclick = () => window.open(`https://wa.me/55${num}`, '_blank');
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
}

window.editarLeadAtual = function() {
    if (!leadAtualParaAgendar) { alert("Selecione um lead."); return; }
    if(!confirm(`Editar cadastro de ${leadAtualParaAgendar.nomeLead}?`)) return;

    const lead = leadAtualParaAgendar;
    
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
      alert('✅ Cadastro Salvo!');
      leadsCache.unshift(novoLead); 
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      ['leadNome', 'leadTelefone', 'leadObs', 'leadEndereco', 'leadBairro', 'leadProvedor'].forEach(id => document.getElementById(id).value = '');
      navegarPara('gestaoLeads');
  } else {
      alert('Erro ao salvar.');
  }
}

async function salvarAgendamento() {
  if (!leadAtualParaAgendar) return;
  const dt = document.getElementById('agendarData').value;
  const hr = document.getElementById('agendarHora').value;
  if (!dt) return alert("Data obrigatória");
  
  const [a, m, d] = dt.split('-');
  const ag = `${d}/${m}/${a} ${hr || '09:00'}`;
  
  const res = await apiCall('updateAgendamento', {
      vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: ag
  });
  
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

// 6. IA HÍBRIDA

async function perguntarIABackend(pergunta) {
  chatHistoryData.push(`User: ${pergunta}`);
  const contexto = chatHistoryData.slice(-6);
  try {
    const res = await apiCall('askAI', { question: pergunta, history: contexto }, false);
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

// 7. UTILITÁRIOS

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
  const count = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

function setLoggedUser() {
  const v = document.getElementById('userSelect').value;
  if (v) { loggedUser = v; localStorage.setItem('loggedUser', v); initApp(); } else alert('Selecione!');
}

function logout() { if(confirm("Sair?")) { localStorage.removeItem('loggedUser'); location.reload(); } }

function showLoading(show, txt) { 
    const l = document.getElementById('loader'); 
    const t = document.getElementById('loaderText');
    if(l) {
        if(show) {
            l.classList.remove('hidden');
            l.classList.add('flex');
        } else {
            l.classList.add('hidden');
            l.classList.remove('flex');
        }
    }
    if(t && txt) t.innerText = txt;
}

async function carregarVendedores() {
    const s = document.getElementById('userSelect');
    if(!s) return;
    try {
        const res = await apiCall('getVendors', {}, false);
        s.innerHTML = '<option value="">Selecione...</option>';
        if(res && res.data) {
            res.data.forEach(v => { const o = document.createElement('option'); o.value=v.nome; o.innerText=v.nome; s.appendChild(o); });
        } else throw new Error();
    } catch(e) {
        s.innerHTML = '<option value="">Offline</option>';
        ["Ana Paula", "Vitoria", "João"].forEach(n=>{ const o = document.createElement('option'); o.value=n; o.innerText=n; s.appendChild(o); });
    }
}

// GPS & Voz
async function buscarEnderecoGPS() {
    if (!navigator.geolocation) return alert("GPS Off");
    showLoading(true, "LOCALIZANDO...");
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
        } catch (e) {}
        showLoading(false);
    }, () => { showLoading(false); alert("Erro GPS"); }, { enableHighAccuracy: true });
}

function iniciarDitado(t, b) { 
    const R = window.SpeechRecognition || window.webkitSpeechRecognition; 
    if(!R) return alert("Navegador sem voz"); 
    const r = new R(); r.lang='pt-BR'; r.start(); 
    r.onresult = e => { document.getElementById(t).value += " " + e.results[0][0].transcript; }; 
}
