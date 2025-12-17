/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND (v13.1 - Fix Leitura POST)
 * ============================================================
 */

// ✅ ID DA IMPLANTAÇÃO
const DEPLOY_ID = 'AKfycbyprSsQFXsywlgFfZtLSR5Flra_UZAyHUrlUG8eT5adMKNwzX_XXUyxyFtFyag5Lrgr'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// LISTA FIXA DE SEGURANÇA
const VENDEDORES_OFFLINE = [
    "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
    "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves"
];

// Contexto IA
const PLANOS_CONTEXTO = `CONTEXTO MHNET: 500 Mega (R$ 89,90), 700 Mega (R$ 99,90), 1 Giga (R$ 119,90). Instalação grátis.`;

// Estado
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let routeCoords = [];
let watchId = null;
let timerInterval = null;
let seconds = 0;
let routeStartTime = null;

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log("🏁 [INIT] App v13.1 Iniciado.");

  // Preenche lista de vendedores
  const select = document.getElementById('userSelect');
  if(select) {
      select.innerHTML = '<option value="">Toque para selecionar...</option>';
      VENDEDORES_OFFLINE.forEach(nome => {
          const opt = document.createElement('option');
          opt.value = nome;
          opt.innerText = nome;
          select.appendChild(opt);
      });
  }

  // Tenta carregar cache
  const localData = localStorage.getItem('mhnet_leads_cache');
  if(localData) {
      try { leadsCache = JSON.parse(localData); } catch(e){}
  }

  // Verifica login
  if (loggedUser) {
    initApp();
  } else {
    document.getElementById('userMenu').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  }
});

function initApp() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('userInfo').textContent = `Vendedor: ${loggedUser}`;
  
  navegarPara('dashboard');
  
  // Renderiza cache primeiro (instantâneo)
  renderLeads();
  
  // Busca na nuvem usando POST (Fix CORS)
  carregarLeads();
}

// ============================================================
// 2. NAVEGAÇÃO
// ============================================================
function navegarPara(pageId) {
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  
  const target = document.getElementById(pageId);
  if(target) {
      target.style.display = 'block';
      target.classList.remove('fade-in');
      void target.offsetWidth; 
      target.classList.add('fade-in');
  }
  
  const mainScroll = document.getElementById('main-scroll');
  if(mainScroll) mainScroll.scrollTo(0,0);

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active', 'text-blue-700');
    el.classList.add('text-slate-400');
  });

  let btnId = '';
  if(pageId === 'dashboard') btnId = 'nav-home';
  if(pageId === 'cadastroLead') btnId = 'nav-novo';
  if(pageId === 'gestaoLeads') btnId = 'nav-lista';
  if(pageId === 'rota') btnId = 'nav-rota';

  const btn = document.getElementById(btnId);
  if(btn && !btn.querySelector('div')) {
      btn.classList.add('active', 'text-blue-700');
      btn.classList.remove('text-slate-400');
  }

  if (pageId === 'dashboard') atualizarDashboard();
  if (pageId === 'gestaoLeads') renderLeads();
}

function setLoggedUser() {
  const select = document.getElementById('userSelect');
  if (select && select.value) {
    loggedUser = select.value;
    localStorage.setItem('loggedUser', loggedUser);
    initApp();
  } else {
    alert('Selecione seu nome!');
  }
}

function logout() {
  if(confirm("Sair do sistema?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// ============================================================
// 3. GESTÃO DE LEADS
// ============================================================

function abrirLeadDetalhes(index) {
    const lead = leadsCache[index];
    if(!lead) return;

    document.getElementById('modalLeadNome').innerText = lead.nomeLead || lead.lead || 'Sem Nome';
    document.getElementById('modalLeadInfo').innerText = `${lead.bairro || 'Geral'} • ${lead.timestamp ? lead.timestamp.split(' ')[0] : 'Hoje'}`;
    document.getElementById('modalLeadObs').innerText = lead.observacao || "Nenhuma observação registada.";

    const tel = (lead.telefone || lead.whatsapp || "").replace(/\D/g, '');
    const btnWhats = document.getElementById('btnModalWhats');
    
    btnWhats.onclick = () => {
        if(tel) window.open(`https://wa.me/55${tel}`, '_blank');
        else alert("Telefone não disponível.");
    };

    const modal = document.getElementById('leadModal');
    modal.classList.remove('hidden');
    const content = modal.querySelector('div.absolute');
    content.classList.remove('slide-up');
    void content.offsetWidth;
    content.classList.add('slide-up');
}

function fecharLeadModal() {
    document.getElementById('leadModal').classList.add('hidden');
}

async function enviarLead() {
  const nome = document.getElementById('leadNome').value;
  const tel = document.getElementById('leadTelefone').value;
  
  if (!nome || !tel) return alert("Preencha Nome e Telefone");
  showLoading(true, "SALVANDO...");
  
  const novoLead = {
    vendedor: loggedUser, nomeLead: nome, lead: nome, 
    telefone: tel, whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value,
    cidade: document.getElementById('leadCidade').value,
    bairro: document.getElementById('leadBairro').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value,
    provedor: "", timestamp: new Date().toISOString()
  };
  
  const res = await apiCall('addLead', novoLead);
  showLoading(false);
  
  if ((res && res.status === 'success') || res === 'CORS_OK') {
      alert('✅ Lead Salvo!');
      leadsCache.unshift(novoLead);
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));

      document.getElementById('leadNome').value = ''; 
      document.getElementById('leadTelefone').value = '';
      document.getElementById('leadEndereco').value = ''; 
      document.getElementById('leadObs').value = '';
      document.getElementById('leadBairro').value = '';
      
      navegarPara('gestaoLeads');
  } else {
      alert('Erro ao conectar. Tente novamente.');
  }
}

// CORREÇÃO: Usa POST para ler dados (Evita bloqueio de GET)
async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista && leadsCache.length === 0) lista.innerHTML = '<div style="text-align:center; padding:30px; color:#94a3b8">Atualizando...</div>';

  // Usa apiCall (POST) em vez de fetch GET direto
  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    // Filtra leads do usuário
    leadsCache = (res.data || []).filter(l => {
      const v = (l.vendedor || l.Vendedor || '').toLowerCase();
      return v.includes(loggedUser.toLowerCase());
    });
    
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    renderLeads();
    atualizarDashboard();
  } else {
    if(lista && leadsCache.length === 0) lista.innerHTML = '<div style="text-align:center; color:#cbd5e1; padding:20px">Histórico vazio.</div>';
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead || l.lead || '').toLowerCase().includes(term) || (l.bairro || '').toLowerCase().includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = '<div style="text-align:center; padding:40px; color:#cbd5e1">Nenhum registro.</div>';
    return;
  }

  div.innerHTML = filtrados.map((l, index) => {
    let badgeClass = "bg-gray-100 text-gray-500";
    const inter = (l.interesse || 'MÉDIO').toUpperCase();
    if(inter.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    if(inter.includes('BAIXO')) badgeClass = "bg-red-50 text-red-500";
    
    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4 cursor-pointer active:bg-blue-50 transition">
      <div class="flex justify-between items-start mb-3 pointer-events-none">
        <div>
          <div class="font-bold text-[#003870] text-lg">${l.nomeLead || 'Sem Nome'}</div>
          <div class="text-xs text-gray-400">${l.timestamp ? l.timestamp.split(' ')[0] : 'Hoje'}</div>
        </div>
        <span class="${badgeClass} px-3 py-1 rounded-lg text-[10px] font-bold">${inter}</span>
      </div>
      <div class="text-sm text-gray-600 mb-2 pointer-events-none">
         <i class="fas fa-map-marker-alt text-red-400"></i> ${l.bairro || 'Geral'}
      </div>
      <div class="text-xs text-blue-400 font-bold text-right pointer-events-none">
         Ver detalhes <i class="fas fa-chevron-right"></i>
      </div>
    </div>`;
  }).join('');
}

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const count = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

// ============================================================
// 4. IA GEMINI
// ============================================================
async function chamarGemini(prompt) {
  if (!GEMINI_KEY) return null;
  const fullPrompt = `${PLANOS_CONTEXTO}\n\nPERGUNTA: ${prompt}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
    });
    if(!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { return null; }
}

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if(!nome) return alert("Preencha o nome!");
  showLoading(true, "CRIANDO...");
  const txt = await chamarGemini(`Mensagem WhatsApp curta para vender fibra MHNET para ${nome}.`);
  showLoading(false);
  if(txt) document.getElementById('leadObs').value = txt.replace(/\*\*/g, '');
}

async function consultarPlanosIA() {
    toggleChat();
    const history = document.getElementById('chatHistory');
    history.innerHTML += `<div class="flex gap-3 justify-end fade-in"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">Planos?</div></div>`;
    const response = await chamarGemini("Quais os planos e preços? Resuma.");
    if(response) history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${response}</div></div>`;
}

function toggleChat() {
    const el = document.getElementById('chatModal');
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        setTimeout(() => document.getElementById('chatInput').focus(), 300);
    } else {
        el.classList.add('hidden');
    }
}

async function enviarMensagemChat() {
    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    const msg = input.value.trim();
    if(!msg) return;
    history.innerHTML += `<div class="flex gap-3 justify-end fade-in"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">${msg}</div></div>`;
    input.value = '';
    
    const response = await chamarGemini(msg);
    if(response) {
         const formatted = response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
         history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${formatted}</div></div>`;
    }
}

// OUTROS
async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Sem leads.");
  showLoading(true, "ANALISANDO...");
  const bairros = [...new Set(leadsCache.slice(0, 30).map(l => l.bairro || 'Geral'))].join(', ');
  const txt = await chamarGemini(`Sugira rota para: ${bairros}.`);
  showLoading(false);
  if (txt) alert(`💡 DICA:\n\n${txt}`);
}

async function gerarCoachIA() {
  showLoading(true, "COACH...");
  const hoje = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  const txt = await chamarGemini(`Vendedor fez ${leadsHoje} leads hoje. Motive-o.`);
  showLoading(false);
  if(txt) alert(`🚀 COACH:\n\n${txt.replace(/\*\*/g, '')}`);
}

function startRoute() {
  if (!navigator.geolocation) return alert('Ative o GPS.');
  routeCoords = []; seconds = 0; routeStartTime = new Date().toISOString();
  document.getElementById('btnStart').style.display = 'none';
  document.getElementById('btnStop').style.display = 'flex';
  timerInterval = setInterval(() => {
    seconds++;
    const h = Math.floor(seconds / 3600).toString().padStart(2,'0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2,'0');
    const s = (seconds % 60).toString().padStart(2,'0');
    document.getElementById('timer').innerText = `${h}:${m}:${s}`;
  }, 1000);
  watchId = navigator.geolocation.watchPosition(p => {
    routeCoords.push({lat: p.coords.latitude, lon: p.coords.longitude});
    document.getElementById('points').innerText = routeCoords.length;
    document.getElementById('gpsStatus').innerText = "Rastreando";
  }, e => console.error(e), {enableHighAccuracy:true});
}

async function stopRoute() {
  if(!confirm("Finalizar?")) return;
  clearInterval(timerInterval); navigator.geolocation.clearWatch(watchId);
  showLoading(true, "ENVIANDO...");
  await apiCall('saveRoute', {vendedor: loggedUser, inicioISO: routeStartTime, fimISO: new Date().toISOString(), coordenadas: routeCoords});
  showLoading(false); alert("Rota salva!"); resetRouteUI(); navegarPara('dashboard');
}

function updateRouteUI(on) {
  document.getElementById('btnStart').style.display = on ? 'none' : 'flex';
  document.getElementById('btnStop').style.display = on ? 'flex' : 'none';
}
function resetRouteUI() {
  updateRouteUI(false);
  document.getElementById('timer').innerText = "00:00:00";
  document.getElementById('points').innerText = "0";
  document.getElementById('gpsStatus').innerText = "Parado";
}

// === API ===
async function apiCall(route, payload, show=true, suppress=false) {
  if(show) showLoading(true);
  try {
    const res = await fetch(API_URL, {
        method: 'POST',
        // text/plain É O TRUQUE PARA EVITAR CORS NO GOOGLE APPS SCRIPT
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({route, payload, token: TOKEN})
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { 
        if(route === 'addLead' || route === 'saveRoute') return 'CORS_OK';
        throw new Error("Erro resposta"); 
    }
    if(show) showLoading(false);
    if (json.status === 'error') throw new Error(json.message);
    return json;
  } catch(e) {
    if(show) showLoading(false);
    if(e.name === 'TypeError' && (route === 'addLead' || route === 'saveRoute')) return 'CORS_OK';
    if(!suppress) console.error("Erro conexão:", e.message);
    return null;
  }
}

function showLoading(show, txt) {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
  if(txt) document.getElementById('loaderText').innerText = txt;
}
