/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND (v13.0 - Planos IA)
 * ============================================================
 */

// CONFIGURAÇÃO
const DEPLOY_ID = 'AKfycbxMuP7gF6WM3syD4dpraqkMPRpInQ2xkc5_09o3fuNBIHTCn8UVQFRdPpH4wiVpccvz'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// === BASE DE CONHECIMENTO DE PLANOS (IA) ===
// Edite aqui os preços e combos para a IA saber o que responder.
const PLANOS_DB = `
TABELA DE PREÇOS MHNET (Vigência 2025):
- INTERNET FIBRA:
  * 400 Mega: R$ 89,90/mês
  * 600 Mega: R$ 99,90/mês (Instalação Grátis)
  * 1 Giga (1000 Mega): R$ 149,90/mês

- COMBOS (INTERNET + MÓVEL):
  * Combo Light: 400 Mega + Chip 10GB = R$ 109,90
  * Combo Plus: 600 Mega + Chip 20GB = R$ 129,90
  * Combo Ultra: 1 Giga + Chip 50GB = R$ 189,90

- EMPRESARIAL:
  * Link Dedicado: Sob consulta
  * 600 Mega PJ: R$ 119,90
`;

// LISTA FIXA (GARANTIA DE LOGIN)
const VENDEDORES_OFFLINE = [
    "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
    "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves"
];

let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let routeCoords = [];
let watchId = null;
let timerInterval = null;
let seconds = 0;
let routeStartTime = null;

// INIT
document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('userSelect');
  if(select) {
      select.innerHTML = '<option value="">Selecione...</option>';
      VENDEDORES_OFFLINE.forEach(nome => {
          const opt = document.createElement('option');
          opt.value = nome;
          opt.innerText = nome;
          select.appendChild(opt);
      });
  }

  // Configuração inicial do Chat
  const chatModal = document.getElementById('chatModal');
  if (chatModal) {
      chatModal.style.display = 'none';
      chatModal.classList.add('hidden');
  }

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
  carregarLeads(); // Busca base de leads em background
}

function navegarPara(pageId) {
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  const target = document.getElementById(pageId);
  if(target) target.style.display = 'block';
  
  // Scroll para o topo (corrigido para o container main)
  const mainScroll = document.getElementById('main-scroll');
  if(mainScroll) mainScroll.scrollTo(0,0);
  else window.scrollTo(0, 0);

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
  if(confirm("Sair?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// === NOVA FUNÇÃO: CONSULTOR DE PLANOS IA ===
async function perguntarPlanoIA() {
    const input = document.getElementById('inputPlanos');
    const display = document.getElementById('respostaPlanos');
    const query = input.value.trim();
    
    if(!query) return alert("Digite uma dúvida sobre os planos.");
    
    display.classList.remove('hidden');
    display.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Consultando base...';
    
    // Prompt com Contexto dos Planos
    const prompt = `
    Aja como um especialista em planos da MHNET.
    Use APENAS estas informações:
    ${PLANOS_DB}
    
    Pergunta do vendedor: "${query}"
    Responda de forma curta e direta. Se não souber, diga que não consta na tabela.
    `;
    
    const resposta = await chamarGemini(prompt);
    
    if(resposta) {
        display.innerHTML = resposta.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    } else {
        display.innerHTML = 'Erro ao consultar IA.';
    }
}

// === GESTÃO DE LEADS ===

async function enviarLead() {
  const nome = document.getElementById('leadNome').value;
  const tel = document.getElementById('leadTelefone').value;
  
  if (!nome || !tel) return alert("Preencha Nome e Telefone");
  showLoading(true, "SALVANDO...");
  
  const payload = {
    vendedor: loggedUser,
    nome: nome, nomeLead: nome, lead: nome,
    telefone: tel, whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value,
    bairro: document.getElementById('leadBairro').value,
    cidade: document.getElementById('leadCidade').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value,
    timestamp: new Date().toISOString()
  };
  
  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  if ((res && res.status === 'success') || res === 'CORS_ERROR_BUT_SENT') {
    alert('✅ Lead salvo!');
    document.getElementById('leadNome').value = ''; 
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = ''; 
    document.getElementById('leadObs').value = '';
    document.getElementById('leadBairro').value = '';
    
    carregarLeads(); // Atualiza a base imediatamente
    navegarPara('gestaoLeads');
  } else {
    alert('❌ Erro no salvamento.');
  }
}

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) lista.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8">Atualizando base...</div>';

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    leadsCache = (res.data || []).filter(l => {
      const v = (l.vendedor || l.Vendedor || '').toLowerCase();
      return v.includes(loggedUser.toLowerCase());
    });
    renderLeads(); 
    atualizarDashboard();
  } else {
    if(lista) lista.innerHTML = '<div style="text-align:center; color:red; padding:20px">Erro ao buscar base.</div>';
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  const badgeTotal = document.getElementById('totalLeadsBadge');
  
  if (!div) return;
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead || '').toLowerCase().includes(term) || 
    (l.bairro || '').toLowerCase().includes(term) ||
    (l.telefone || '').includes(term)
  );
  
  if(badgeTotal) badgeTotal.innerText = `Total: ${filtrados.length}`;
  
  if (!filtrados.length) {
    div.innerHTML = '<div style="text-align:center; padding:60px; color:#cbd5e1">Nenhum registro encontrado.</div>';
    return;
  }

  filtrados.sort((a,b) => {
      const ta = a.timestamp || '';
      const tb = b.timestamp || '';
      return tb.localeCompare(ta); 
  });

  div.innerHTML = filtrados.map(l => {
    let badgeClass = "bg-gray-100 text-gray-500";
    const inter = (l.interesse || 'MÉDIO').toUpperCase();
    if(inter.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    if(inter.includes('BAIXO')) badgeClass = "bg-red-50 text-red-500";

    const telLimpo = (l.telefone||'').replace(/\D/g, '');

    return `
    <div class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4">
      <div class="flex justify-between items-start mb-3">
        <div>
          <div class="font-bold text-[#003870] text-lg leading-tight">${l.nomeLead || 'Sem Nome'}</div>
          <div class="text-xs text-gray-400 mt-1">${l.timestamp || 'Data n/d'}</div>
        </div>
        <span class="${badgeClass} px-3 py-1 rounded-lg text-[10px] font-bold">${inter}</span>
      </div>
      <div class="flex items-center gap-3 mb-3 bg-slate-50 p-2 rounded-lg">
          <div class="flex-1 text-sm font-bold text-gray-700">
             <i class="fas fa-phone-alt text-gray-400 mr-2"></i> ${l.telefone || 'Sem Tel'}
          </div>
          <a href="https://wa.me/55${telLimpo}" target="_blank" class="btn-zap-square">
             <i class="fab fa-whatsapp"></i>
          </a>
      </div>
      <div class="text-sm text-gray-500 ml-1">
         <i class="fas fa-map-marker-alt text-red-400 mr-1"></i> ${l.bairro || 'Geral'}
      </div>
    </div>`;
  }).join('');
}

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const count = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

// *** IA GEMINI ***
async function chamarGemini(prompt) {
  if (!GEMINI_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { return null; }
}

function toggleChat() {
    const el = document.getElementById('chatModal');
    if(!el) return;
    const history = document.getElementById('chatHistory');
    
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        el.querySelector('div.absolute.bottom-0').classList.add('slide-up');
        setTimeout(() => document.getElementById('chatInput').focus(), 300);
        if(!history.hasChildNodes() || history.innerHTML.trim() === "") {
             history.innerHTML = `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[80%]">Olá! Sou o assistente MHNET. Como posso ajudar?</div></div>`;
        }
    } else {
        el.classList.add('hidden');
    }
}

async function enviarMensagemChat() {
    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    const msg = input.value.trim();
    if(!msg) return;

    history.innerHTML += `<div class="flex gap-3 justify-end fade-in"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[80%]">${msg}</div></div>`;
    input.value = '';
    history.scrollTop = history.scrollHeight;

    const loadingId = 'loading-' + Date.now();
    history.innerHTML += `<div id="${loadingId}" class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm flex gap-1"><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span></div></div>`;
    history.scrollTop = history.scrollHeight;

    const response = await chamarGemini(`Aja como especialista MHNET. Responda: "${msg}"`);
    
    document.getElementById(loadingId)?.remove();
    if(response) {
         history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</div></div>`;
    }
    history.scrollTop = history.scrollHeight;
}

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if(!nome) return alert("Preencha o nome!");
  showLoading(true, "CRIANDO...");
  const txt = await chamarGemini(`Mensagem WhatsApp curta para vender fibra MHNET para ${nome}.`);
  showLoading(false);
  if(txt) document.getElementById('leadObs').value = txt.replace(/["*]/g, '');
}

async function gerarCoachIA() {
    showLoading(true, "COACH...");
    const hoje = new Date().toLocaleDateString('pt-BR');
    const leadsHoje = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
    const txt = await chamarGemini(`Vendedor fez ${leadsHoje} leads hoje. Motive-o.`);
    showLoading(false);
    if(txt) alert(`🚀 COACH:\n\n${txt.replace(/\*\*/g, '')}`);
}

async function analisarCarteiraIA() {
    if (!leadsCache.length) return alert("Sem leads.");
    showLoading(true, "ANALISANDO...");
    const bairros = [...new Set(leadsCache.slice(0, 30).map(l => l.bairro || 'Geral'))].join(', ');
    const txt = await chamarGemini(`Analise bairros para rota: ${bairros}.`);
    showLoading(false);
    if (txt) alert(`💡 DICA:\n\n${txt}`);
}

// ROTA
function startRoute() {
  if (!navigator.geolocation) return alert('Ative o GPS.');
  routeCoords = []; seconds = 0; routeStartTime = new Date().toISOString();
  updateRouteUI(true);
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
  });
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

// API GENÉRICA
async function apiCall(route, payload, show=true, suppress=false) {
  if(show) showLoading(true);
  try {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // FIX CORS
        body: JSON.stringify({route, payload, token: TOKEN})
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { 
        if (route === 'addLead' || route === 'saveRoute') return 'CORS_ERROR_BUT_SENT';
        throw new Error("Erro resposta servidor"); 
    }
    if(show) showLoading(false);
    if (json.status === 'error') throw new Error(json.message);
    return json;
  } catch(e) {
    if(show) showLoading(false);
    if (route === 'addLead' || route === 'saveRoute') return 'CORS_ERROR_BUT_SENT';
    if(!suppress) alert("Erro conexão: " + e.message);
    return null;
  }
}

function showLoading(show, txt) {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
  if(txt) document.getElementById('loaderText').innerText = txt;
}
