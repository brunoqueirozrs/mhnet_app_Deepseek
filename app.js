/**
 * ============================================================
 * MHNET VENDAS - v7.8 (CORS Corrigido + ID Atualizado)
 * ============================================================
 */

// ✅ NOVO ID DE IMPLANTAÇÃO ATUALIZADO
const DEPLOY_ID = 'AKfycbwM64LebBEQ41LzEO3TB7RXHDreR4uvN2a1kzFbOgc'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// LISTA FIXA DE SEGURANÇA
const VENDEDORES_OFFLINE = [
    "Ana Paula Rodrigues",
    "Vitoria Caroline Baldez Rosales",
    "João Vithor Sader",
    "João Paulo da Silva Santos",
    "Claudia Maria Semmler",
    "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves"
];

let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let routeCoords = [];
let watchId = null;
let timerInterval = null;
let seconds = 0;
let routeStartTime = null;

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Injeta lista de vendedores
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
  carregarLeads();
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
function navegarPara(pageId) {
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  const target = document.getElementById(pageId);
  if(target) target.style.display = 'block';
  window.scrollTo(0, 0);

  // Atualiza botões de navegação
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

// ============================================================
// AUTENTICAÇÃO
// ============================================================
function setLoggedUser() {
  const select = document.getElementById('userSelect');
  if (select && select.value) {
    loggedUser = select.value;
    localStorage.setItem('loggedUser', loggedUser);
    initApp();
  } else {
    alert('Por favor, selecione seu nome na lista!');
  }
}

function logout() {
  if(confirm("Sair do sistema?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// ============================================================
// IA GEMINI - CHAT
// ============================================================
async function chamarGemini(prompt) {
  if (!GEMINI_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (res.status === 403) {
        console.warn("⚠️ Chave Gemini inválida ou expirada.");
        return null;
    }
    
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { 
    console.error("Erro Gemini:", e);
    return null; 
  }
}

function toggleChat() {
    const el = document.getElementById('chatModal');
    const history = document.getElementById('chatHistory');
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        el.querySelector('div.absolute.bottom-0').classList.add('slide-up');
        setTimeout(() => document.getElementById('chatInput').focus(), 300);
        if(!history.hasChildNodes() || history.innerHTML.trim() === "") {
             history.innerHTML = `<div class="flex gap-3"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[80%]">Olá! Sou o assistente MHNET. Como posso ajudar nas vendas hoje?</div></div>`;
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

    history.innerHTML += `<div class="flex gap-3 justify-end"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[80%]">${msg}</div></div>`;
    input.value = '';
    history.scrollTop = history.scrollHeight;

    const loadingId = 'loading-' + Date.now();
    history.innerHTML += `<div id="${loadingId}" class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm flex gap-1"><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span></div></div>`;
    history.scrollTop = history.scrollHeight;

    const prompt = `Aja como um assistente de vendas da MHNET Telecom. Responda de forma breve e prática: "${msg}"`;
    const response = await chamarGemini(prompt);
    
    document.getElementById(loadingId)?.remove();
    if(response) {
         history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[85%] leading-relaxed">${response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</div></div>`;
    } else {
        history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-red-100 rounded-full flex-shrink-0 flex items-center justify-center text-red-600 text-xs"><i class="fas fa-exclamation"></i></div><div class="bg-red-50 p-3 rounded-2xl rounded-tl-none border border-red-100 text-sm text-red-600 shadow-sm max-w-[85%]">Desculpe, não consegui processar sua mensagem no momento.</div></div>`;
    }
    history.scrollTop = history.scrollHeight;
}

// ============================================================
// FUNÇÕES IA - ABORDAGEM/ANÁLISE/COACH
// ============================================================
async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value.trim();
  if (!nome) return alert("⚠️ Preencha o nome do lead primeiro!");
  
  showLoading(true, "🤖 CRIANDO PITCH...");
  const txt = await chamarGemini(`Crie uma mensagem curta de WhatsApp (máx 3 linhas) para ${nome}, oferecendo internet fibra óptica da MHNET. Tom amigável, persuasivo, com emojis.`);
  showLoading(false);
  
  if (txt) {
    document.getElementById('leadObs').value = txt.replace(/\*\*/g, '');
  } else {
    alert("❌ Não foi possível gerar a abordagem. Tente novamente.");
  }
}

async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("📂 Nenhum lead cadastrado para analisar.");
  
  showLoading(true, "🔍 ANALISANDO CARTEIRA...");
  const bairros = [...new Set(leadsCache.slice(0,30).map(l=>l.bairro || 'Indefinido'))].join(', ');
  const txt = await chamarGemini(`Analise esta lista de bairros e sugira uma rota otimizada para visitação: ${bairros}. Seja breve e objetivo.`);
  showLoading(false);
  
  if (txt) {
    alert(`💡 ANÁLISE DA CARTEIRA:\n\n${txt}`);
  } else {
    alert("❌ Erro ao analisar. Tente novamente.");
  }
}

async function gerarCoachIA() {
  showLoading(true, "🚀 GERANDO COACH...");
  const hoje = leadsCache.filter(l => {
    const data = new Date(l.timestamp || l.Data);
    return data.toLocaleDateString() === new Date().toLocaleDateString();
  }).length;
  
  const txt = await chamarGemini(`O vendedor cadastrou ${hoje} leads hoje. Dê uma frase motivacional curta (máx 2 linhas) para incentivá-lo.`);
  showLoading(false);
  
  if(txt) {
    alert(`🎯 COACH DO DIA:\n\n${txt}`);
  } else {
    alert("❌ Erro ao gerar coaching.");
  }
}

// ============================================================
// CADASTRO DE LEADS
// ============================================================
async function enviarLead() {
  const nome = document.getElementById('leadNome').value.trim();
  const tel = document.getElementById('leadTelefone').value.trim();
  
  if (!nome || !tel) {
    return alert("⚠️ Preencha pelo menos Nome e Telefone!");
  }
  
  showLoading(true, "💾 SALVANDO LEAD...");
  
  const payload = {
    vendedor: loggedUser,
    nomeLead: nome,
    lead: nome,
    telefone: tel,
    whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value.trim(),
    cidade: document.getElementById('leadCidade').value.trim(),
    bairro: document.getElementById('leadBairro').value.trim(),
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value.trim(),
    provedor: "",
    timestamp: new Date().toISOString()
  };
  
  console.log("📤 Enviando Lead:", payload);

  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  if (res && res.status === 'success') {
    alert('✅ Lead salvo com sucesso!');
    
    // Limpa formulário
    document.getElementById('leadNome').value = ''; 
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = ''; 
    document.getElementById('leadCidade').value = ''; 
    document.getElementById('leadBairro').value = '';
    document.getElementById('leadObs').value = '';
    document.getElementById('leadInteresse').value = 'Médio';
    
    carregarLeads();
    navegarPara('gestaoLeads');
  }
}

// ============================================================
// LISTAGEM DE LEADS
// ============================================================
async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) {
    lista.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8"><i class="fas fa-circle-notch fa-spin text-3xl mb-3 text-blue-500"></i><br>Buscando histórico...</div>';
  }

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    leadsCache = (res.data || []).filter(l => {
      const v = (l.vendedor || l.Vendedor || '').toLowerCase();
      return v.includes(loggedUser.toLowerCase());
    });
    renderLeads();
    atualizarDashboard();
  } else {
    if(lista) {
      lista.innerHTML = '<div style="text-align:center; color:#ef4444; padding:40px"><i class="fas fa-exclamation-triangle text-4xl mb-3"></i><br>Não foi possível carregar o histórico.<br><small>Verifique sua conexão.</small></div>';
    }
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead || l.lead || '').toLowerCase().includes(term) || 
    (l.bairro || '').toLowerCase().includes(term) ||
    (l.telefone || '').includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = '<div style="text-align:center; padding:60px; color:#cbd5e1"><i class="far fa-folder-open text-5xl mb-4"></i><br>Nenhum registro encontrado.</div>';
    return;
  }

  // Ordena por data (mais recente primeiro)
  filtrados.sort((a,b) => {
    const getDate = (d) => {
      if(!d) return 0;
      if(d.includes('/')) {
        const parts = d.split(' '); 
        const dateParts = parts[0].split('/');
        return new Date(dateParts[2], dateParts[1]-1, dateParts[0]);
      }
      return new Date(d);
    };
    return getDate(b.timestamp) - getDate(a.timestamp);
  });

  div.innerHTML = filtrados.map(l => {
    const nome = l.nomeLead || l.lead || 'Cliente';
    const bairro = l.bairro || 'Não informado';
    const interesse = (l.interesse || 'Médio').toUpperCase();
    const tel = l.telefone || l.whatsapp || '';
    
    let badgeClass = "bg-gray-100 text-gray-500";
    if(interesse.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    if(interesse.includes('MÉDIO')) badgeClass = "bg-yellow-100 text-yellow-700";
    if(interesse.includes('BAIXO')) badgeClass = "bg-red-50 text-red-500";

    const dataFormatada = l.timestamp ? l.timestamp.split('T')[0].split('-').reverse().join('/') : 'Hoje';

    return `
    <div class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4 hover:shadow-md transition">
      <div class="flex justify-between items-start mb-3">
        <div>
          <div class="font-bold text-[#003870] text-lg leading-tight">${nome}</div>
          <div class="text-xs text-gray-400 mt-1"><i class="fas fa-calendar-alt mr-1"></i> ${dataFormatada}</div>
        </div>
        <span class="${badgeClass} px-3 py-1 rounded-lg text-[10px] font-bold tracking-wide shadow-sm">${interesse}</span>
      </div>
      <div class="text-sm text-gray-600 mb-4 flex items-center gap-2 bg-blue-50/50 p-2 rounded-lg">
        <i class="fas fa-map-marker-alt text-red-400 ml-1"></i> ${bairro}
      </div>
      <div class="flex justify-between items-center border-t border-gray-100 pt-4">
         <span class="text-xs text-gray-400 font-medium">Ação rápida</span>
         <a href="https://wa.me/55${tel.replace(/\D/g, '')}" target="_blank" class="bg-[#25D366] text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:brightness-105 transition shadow-green-200 shadow-lg">
           <i class="fab fa-whatsapp text-lg"></i> WhatsApp
         </a>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// DASHBOARD
// ============================================================
function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const count = leadsCache.filter(l => {
    const dataLead = l.timestamp ? new Date(l.timestamp).toLocaleDateString('pt-BR') : '';
    return dataLead === hoje;
  }).length;
  
  const statEl = document.getElementById('statLeads');
  if(statEl) statEl.innerText = count;
}

// ============================================================
// ROTA (GPS)
// ============================================================
function startRoute() {
  if (!navigator.geolocation) {
    return alert('⚠️ GPS não disponível neste dispositivo.');
  }
  
  routeCoords = [];
  seconds = 0;
  routeStartTime = new Date().toISOString();
  updateRouteUI(true);
  
  timerInterval = setInterval(() => {
    seconds++;
    const h = Math.floor(seconds / 3600).toString().padStart(2,'0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2,'0');
    const s = (seconds % 60).toString().padStart(2,'0');
    document.getElementById('timer').innerText = `${h}:${m}:${s}`;
  }, 1000);
  
  watchId = navigator.geolocation.watchPosition(
    p => {
      routeCoords.push({
        lat: p.coords.latitude, 
        lon: p.coords.longitude
      });
      document.getElementById('points').innerText = routeCoords.length;
      const st = document.getElementById('gpsStatus');
      st.innerText = "Rastreando";
      st.className = "bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-bold";
    },
    e => console.error("Erro GPS:", e),
    {enableHighAccuracy: true, timeout: 10000, maximumAge: 0}
  );
}

async function stopRoute() {
  if(!confirm("❓ Finalizar e salvar rota?")) return;
  
  clearInterval(timerInterval);
  navigator.geolocation.clearWatch(watchId);
  
  showLoading(true, "📍 ENVIANDO ROTA...");
  
  await apiCall('saveRoute', {
    vendedor: loggedUser,
    inicioISO: routeStartTime,
    fimISO: new Date().toISOString(),
    coordenadas: routeCoords
  });
  
  showLoading(false);
  alert("✅ Rota salva com sucesso!");
  resetRouteUI();
  navegarPara('dashboard');
}

function updateRouteUI(isRunning) {
  document.getElementById('btnStart').style.display = isRunning ? 'none' : 'flex';
  document.getElementById('btnStop').style.display = isRunning ? 'flex' : 'none';
}

function resetRouteUI() {
  updateRouteUI(false);
  document.getElementById('timer').innerText = "00:00:00";
  document.getElementById('points').innerText = "0";
  const st = document.getElementById('gpsStatus');
  st.innerText = "Parado";
  st.className = "bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-bold";
}

// ============================================================
// API CHAMADAS (CORS OTIMIZADO)
// ============================================================
async function apiCall(route, payload = {}, showLoader = true, suppressAlert = false) {
  if(showLoader) showLoading(true);
  
  try {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          route: route,
          payload: payload,
          token: TOKEN
        })
    });
    
    const text = await response.text();
    let json;
    
    try { 
      json = JSON.parse(text); 
    } catch (parseError) { 
      throw new Error("Resposta inválida do servidor (não é JSON)");
    }

    if(showLoader) showLoading(false);
    
    if (json.status === 'error') {
      throw new Error(json.message || "Erro desconhecido no servidor");
    }
    
    return json;

  } catch(error) {
    if(showLoader) showLoading(false);
    console.error("❌ API Call Error:", error);
    
    // Tratamento específico de erros
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        if(!suppressAlert) {
          alert("⚠️ ERRO DE CONEXÃO\n\nNão foi possível conectar ao servidor.\n\nVerifique:\n1. Sua conexão com a internet\n2. Se o Google Apps Script está ativo\n3. Se o DEPLOY_ID está correto");
        }
    } else {
        if(!suppressAlert) {
          alert(`❌ Erro: ${error.message}`);
        }
    }
    
    return null;
  }
}

// ============================================================
// LOADING SCREEN
// ============================================================
function showLoading(show, text = "CARREGANDO...") {
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loaderText');
  
  if(loader) loader.style.display = show ? 'flex' : 'none';
  if(loaderText) loaderText.innerText = text;
}
