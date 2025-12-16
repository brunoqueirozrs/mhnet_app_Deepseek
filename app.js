/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND (v10.4 - Fix Final)
 * Correção: CORS ID Atualizado + Proteção Chat IA
 * ============================================================
 */

// ✅ ID ATUALIZADO (Copiado da sua mensagem)
const DEPLOY_ID = 'AKfycbxMuP7gF6WM3syD4dpraqkMPRpInQ2xkc5_09o3fuNBIHTCn8UVQFRdPpH4wiVpccvz'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// LISTA FIXA DE SEGURANÇA
const VENDEDORES_OFFLINE = [
    "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
    "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves"
];

// --- ESTADO GLOBAL ---
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let routeCoords = [];
let watchId = null;
let timerInterval = null;
let seconds = 0;
let routeStartTime = null;

// ============================================================
// 1. INICIALIZAÇÃO BLINDADA
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log("🏁 [INIT] Aplicação iniciada.");

  // PROTEÇÃO 1: Garante que o Chat começa fechado
  const chatModal = document.getElementById('chatModal');
  if (chatModal) {
      chatModal.style.display = 'none';
      chatModal.classList.add('hidden');
  }

  // PROTEÇÃO 2: Preenche lista de vendedores
  const select = document.getElementById('userSelect');
  if(select) {
      select.innerHTML = '<option value="">Toque para selecionar...</option>';
      VENDEDORES_OFFLINE.forEach(nome => {
          const opt = document.createElement('option');
          opt.value = nome;
          opt.innerText = nome;
          select.appendChild(opt);
      });
      console.log("✅ [INIT] Lista de vendedores injetada.");
  }

  // PROTEÇÃO 3: Lógica de Login
  if (loggedUser) {
    console.log(`👤 [AUTH] Usuário recuperado: ${loggedUser}`);
    initApp();
  } else {
    console.log("👤 [AUTH] Novo acesso. Mostrando login.");
    mostrarLogin();
  }
});

function mostrarLogin() {
    const menu = document.getElementById('userMenu');
    const main = document.getElementById('mainContent');
    if(menu) menu.style.display = 'flex';
    if(main) main.style.display = 'none';
}

function initApp() {
  const menu = document.getElementById('userMenu');
  const main = document.getElementById('mainContent');
  const uiInfo = document.getElementById('userInfo');

  if(menu) menu.style.display = 'none';
  if(main) main.style.display = 'block';
  if(uiInfo) uiInfo.textContent = `Vendedor: ${loggedUser}`;
  
  navegarPara('dashboard');
  
  // Carrega leads em background sem bloquear a tela
  setTimeout(() => carregarLeads(), 500);
}

// ============================================================
// 2. NAVEGAÇÃO
// ============================================================
function navegarPara(pageId) {
  console.log(`🔄 [NAV] Navegando para: ${pageId}`);
  
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  
  const target = document.getElementById(pageId);
  if(target) {
      target.style.display = 'block';
      target.classList.remove('fade-in');
      void target.offsetWidth; 
      target.classList.add('fade-in');
  }
  
  window.scrollTo(0, 0);

  // Atualiza botões
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
    alert('Por favor, selecione seu nome na lista!');
  }
}

function logout() {
  if(confirm("Tem certeza que deseja sair?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// ============================================================
// 3. FUNCIONALIDADES IA (GEMINI)
// ============================================================

// --- CHAT (CORRIGIDO) ---
function toggleChat() {
    const el = document.getElementById('chatModal');
    
    // PROTEÇÃO: Se o HTML do chat não existir, aborta sem erro
    if (!el) {
        console.warn("⚠️ Elemento 'chatModal' não encontrado no HTML.");
        return;
    }

    const history = document.getElementById('chatHistory');
    
    // Verifica visibilidade de forma robusta
    const isHidden = el.style.display === 'none' || el.classList.contains('hidden');

    if(isHidden) {
        el.style.display = 'block';
        el.classList.remove('hidden');
        
        const content = el.querySelector('div.absolute');
        if(content) {
            content.classList.remove('slide-up');
            void content.offsetWidth;
            content.classList.add('slide-up');
        }
        
        const input = document.getElementById('chatInput');
        if(input) setTimeout(() => input.focus(), 300);
        
        if(history && (!history.hasChildNodes() || history.innerHTML.trim() === "")) {
             history.innerHTML = `
                <div class="flex gap-3 fade-in">
                    <div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div>
                    <div class="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[85%]">
                        Olá ${loggedUser ? loggedUser.split(' ')[0] : 'Vendedor'}! Sou o assistente MHNET. Como posso ajudar nas vendas?
                    </div>
                </div>`;
        }
    } else {
        el.style.display = 'none';
        el.classList.add('hidden');
    }
}

async function enviarMensagemChat() {
    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    if(!input || !history) return;

    const msg = input.value.trim();
    if(!msg) return;

    history.innerHTML += `
        <div class="flex gap-3 justify-end fade-in">
            <div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">
                ${msg}
            </div>
        </div>`;
    input.value = '';
    history.scrollTop = history.scrollHeight;

    const loadingId = 'loading-' + Date.now();
    history.innerHTML += `
        <div id="${loadingId}" class="flex gap-3 fade-in">
            <div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div>
            <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm flex gap-1">
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
            </div>
        </div>`;
    history.scrollTop = history.scrollHeight;

    const prompt = `Aja como um especialista comercial da MHNET Telecom. Responda: "${msg}"`;
    const response = await chamarGemini(prompt);
    
    const loadEl = document.getElementById(loadingId);
    if(loadEl) loadEl.remove();

    if(response) {
         const formatted = response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
         history.innerHTML += `
            <div class="flex gap-3 fade-in">
                <div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div>
                <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">
                    ${formatted}
                </div>
            </div>`;
    } else {
        history.innerHTML += `<div class="text-center text-xs text-red-400 mt-2 fade-in">Sem resposta da IA.</div>`;
    }
    history.scrollTop = history.scrollHeight;
}

// --- Outras Funções IA ---
async function chamarGemini(prompt) {
  if (!GEMINI_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (res.status === 403) {
        console.error("❌ [IA] Erro 403: Chave inválida.");
        return null;
    }
    
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { return null; }
}

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if (!nome) return alert("⚠️ Preencha o nome do cliente primeiro!");
  
  showLoading(true, "CRIANDO PITCH...");
  const txt = await chamarGemini(`Crie uma mensagem curta para WhatsApp para vender internet fibra MHNET para ${nome}. Use emojis.`);
  showLoading(false);
  
  if (txt) document.getElementById('leadObs').value = txt.replace(/["*]/g, '');
}

async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Sem leads para analisar.");
  
  showLoading(true, "ANALISANDO...");
  const bairros = [...new Set(leadsCache.slice(0, 30).map(l => l.bairro || 'Geral'))].join(', ');
  const txt = await chamarGemini(`Analise estes bairros e sugira uma rota lógica: ${bairros}.`);
  showLoading(false);
  
  if (txt) alert(`💡 DICA:\n\n${txt}`);
}

async function gerarCoachIA() {
  showLoading(true, "COACH...");
  const hoje = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  
  const txt = await chamarGemini(`O vendedor fez ${leadsHoje} leads hoje. Dê um feedback motivacional curto.`);
  showLoading(false);
  
  if(txt) alert(`🚀 COACH:\n\n${txt.replace(/\*\*/g, '')}`);
}

// ============================================================
// 4. DADOS E API
// ============================================================

async function enviarLead() {
  const nome = document.getElementById('leadNome').value.trim();
  const tel = document.getElementById('leadTelefone').value.trim();
  
  if (!nome || !tel) return alert("⚠️ Preencha Nome e Telefone!");
  
  showLoading(true, "SALVANDO...");
  
  const payload = {
    vendedor: loggedUser,
    nomeLead: nome,  
    lead: nome,
    telefone: tel,
    whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value,
    cidade: document.getElementById('leadCidade').value,
    bairro: document.getElementById('leadBairro').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value,
    provedor: "", 
    timestamp: new Date().toISOString()
  };
  
  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  if (res && res.status === 'success') {
    alert('✅ Lead salvo com sucesso!');
    document.getElementById('leadNome').value = ''; 
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = ''; 
    document.getElementById('leadObs').value = '';
    document.getElementById('leadBairro').value = '';
    carregarLeads(); 
    navegarPara('gestaoLeads');
  } else {
    // Erro de rede ou de script tratado no apiCall
  }
}

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) lista.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8">Atualizando...</div>';

  // Silent call (sem alerta de erro intrusivo para load inicial)
  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    leadsCache = (res.data || []).filter(l => {
      const v = (l.vendedor || l.Vendedor || '').toLowerCase();
      return v.includes(loggedUser.toLowerCase());
    });
    renderLeads();
    atualizarDashboard();
  } else {
    if(lista) lista.innerHTML = '<div style="text-align:center; color:red; padding:20px">Não foi possível carregar o histórico.</div>';
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead || l.lead || '').toLowerCase().includes(term) || 
    (l.bairro || '').toLowerCase().includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = '<div style="text-align:center; padding:60px; color:#cbd5e1">Nenhum registro.</div>';
    return;
  }

  div.innerHTML = filtrados.map(l => {
    const nome = l.nomeLead || l.lead || 'Cliente';
    const bairro = l.bairro || 'Geral';
    const interesse = (l.interesse || 'Novo').toUpperCase();
    const tel = l.telefone || l.whatsapp || '';
    const dataShow = l.timestamp ? l.timestamp.split(' ')[0] : 'Hoje';
    
    let badgeClass = "bg-gray-100 text-gray-500";
    if(interesse.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    if(interesse.includes('MÉDIO')) badgeClass = "bg-yellow-100 text-yellow-700";
    if(interesse.includes('BAIXO')) badgeClass = "bg-red-50 text-red-500";

    return `
    <div class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4">
      <div class="flex justify-between items-start mb-3">
        <div>
          <div class="font-bold text-[#003870] text-lg leading-tight">${nome}</div>
          <div class="text-xs text-gray-400 mt-1"><i class="fas fa-calendar-alt mr-1"></i> ${dataShow}</div>
        </div>
        <span class="${badgeClass} px-3 py-1 rounded-lg text-[10px] font-bold tracking-wide shadow-sm">${interesse}</span>
      </div>
      <div class="text-sm text-gray-600 mb-5 flex items-center gap-2 bg-blue-50/50 p-2 rounded-lg">
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

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const count = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

// --- ROTA ---
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
  if(!confirm("Finalizar rota?")) return;
  clearInterval(timerInterval); 
  navigator.geolocation.clearWatch(watchId);
  showLoading(true, "ENVIANDO ROTA...");
  
  await apiCall('saveRoute', {
      vendedor: loggedUser, 
      inicioISO: routeStartTime, 
      fimISO: new Date().toISOString(), 
      coordenadas: routeCoords
  });
  
  showLoading(false);
  alert("Rota salva!");
  
  document.getElementById('btnStart').style.display = 'flex';
  document.getElementById('btnStop').style.display = 'none';
  document.getElementById('timer').innerText = "00:00:00"; 
  document.getElementById('points').innerText = "0";
  document.getElementById('gpsStatus').innerText = "Parado";
  navegarPara('dashboard');
}

// --- API CENTRAL (CORS & ERRO) ---
async function apiCall(route, payload, show=true, suppress=false) {
  if(show) showLoading(true);
  console.log(`📡 [API] Chamando: ${route}`, payload);
  
  try {
    // FIX CORS: content-type text/plain
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({route, payload, token: TOKEN})
    });
    
    const text = await res.text();
    let json;
    
    try { 
        json = JSON.parse(text); 
        console.log(`✅ [API] Resposta:`, json);
    } catch (e) { 
        console.error(`❌ [API] Inválida:`, text);
        throw new Error("Erro de comunicação com o servidor."); 
    }

    if(show) showLoading(false);
    
    if (json.status === 'error') throw new Error(json.message);
    return json;

  } catch(e) {
    if(show) showLoading(false);
    console.error(`❌ [API] Erro:`, e);
    
    if (e.name === 'TypeError' && e.message.includes('fetch')) {
        if(!suppress) alert("⚠️ ERRO CRÍTICO: CORS/CONEXÃO\nO Google Apps Script bloqueou a conexão.\n\nSOLUÇÃO:\nNo script, faça Nova Implantação > 'Qualquer Pessoa'.");
    } else {
        if(!suppress) alert("Erro: " + e.message);
    }
    return null;
  }
}

function showLoading(show, txt) {
  const loader = document.getElementById('loader');
  const loaderTxt = document.getElementById('loaderText');
  if(loader) loader.style.display = show ? 'flex' : 'none';
  if(loaderTxt && txt) loaderTxt.innerText = txt;
}
