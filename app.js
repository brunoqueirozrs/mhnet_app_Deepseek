/**
 * ============================================================
 * MHNET VENDAS - LÓGICA V11.0 (FINAL + NOVO ID)
 * ============================================================
 */

// ✅ SEU NOVO ID DE IMPLANTAÇÃO
const DEPLOY_ID = 'AKfycbwn_oNMeaP56TZ-T5uw4vKXsUHm3nCQQOesMrRls1_TjElbQ1dLgvjBLTnXK_d2VMgR'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// LISTA FIXA DE SEGURANÇA (Para login offline)
const VENDEDORES_OFFLINE = [
    "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
    "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves"
];

// ESTADO GLOBAL
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
  console.log("🏁 [INIT] Aplicação iniciada.");

  // Garante Chat Oculto ao iniciar
  const chatModal = document.getElementById('chatModal');
  if (chatModal) {
      chatModal.style.display = 'none';
      chatModal.classList.add('hidden');
  }

  // Preenche Select imediatamente
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
  
  // Carrega leads em background
  setTimeout(() => carregarLeads(), 500);
}

// ============================================================
// 2. NAVEGAÇÃO
// ============================================================
function navegarPara(pageId) {
  console.log(`🔄 [NAV] Indo para: ${pageId}`);
  
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  
  const target = document.getElementById(pageId);
  if(target) {
      target.style.display = 'block';
      target.classList.remove('fade-in');
      void target.offsetWidth; 
      target.classList.add('fade-in');
  }
  
  // Scroll para o topo
  const main = document.querySelector('main');
  if(main) main.scrollTo(0, 0);
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
  if(confirm("Tem a certeza que deseja sair?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// ============================================================
// 3. IA (GEMINI)
// ============================================================
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
    if (!el) return;

    const history = document.getElementById('chatHistory');
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
        setTimeout(() => document.getElementById('chatInput').focus(), 300);
        
        if(history && (!history.hasChildNodes() || history.innerHTML.trim() === "")) {
             history.innerHTML = `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[85%]">Olá ${loggedUser ? loggedUser.split(' ')[0] : 'Vendedor'}! Sou o assistente MHNET.</div></div>`;
        }
    } else {
        el.style.display = 'none';
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
    history.scrollTop = history.scrollHeight;

    const loadingId = 'loading-' + Date.now();
    history.innerHTML += `<div id="${loadingId}" class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm flex gap-1"><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span></div></div>`;
    history.scrollTop = history.scrollHeight;

    const prompt = `Aja como um especialista comercial da MHNET Telecom. Responda: "${msg}"`;
    const response = await chamarGemini(prompt);
    
    document.getElementById(loadingId)?.remove();

    if(response) {
         const formatted = response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
         history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${formatted}</div></div>`;
    } else {
        history.innerHTML += `<div class="text-center text-xs text-red-400 mt-2 fade-in">Sem resposta da IA.</div>`;
    }
    history.scrollTop = history.scrollHeight;
}

// IA Tools
async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if(!nome) return alert("⚠️ Preencha o nome!");
  showLoading(true, "CRIANDO PITCH...");
  const txt = await chamarGemini(`Crie mensagem WhatsApp curta venda fibra MHNET para ${nome}.`);
  showLoading(false);
  if(txt) document.getElementById('leadObs').value = txt.replace(/["*]/g, '');
}

async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Sem leads.");
  showLoading(true, "ANALISANDO...");
  const bairros = [...new Set(leadsCache.slice(0, 30).map(l => l.bairro || 'Geral'))].join(', ');
  const txt = await chamarGemini(`Sugira rota para estes bairros: ${bairros}.`);
  showLoading(false);
  if (txt) alert(`💡 DICA:\n\n${txt}`);
}

async function gerarCoachIA() {
  showLoading(true, "COACH...");
  const hoje = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => (l.timestamp || '').startsWith(hoje)).length;
  const txt = await chamarGemini(`Vendedor fez ${leadsHoje} leads hoje. Motive-o.`);
  showLoading(false);
  if(txt) alert(`🚀 COACH:\n\n${txt.replace(/\*\*/g, '')}`);
}

// ============================================================
// 4. DADOS E API
// ============================================================

async function enviarLead() {
  const nome = document.getElementById('leadNome').value;
  const tel = document.getElementById('leadTelefone').value;
  
  if (!nome || !tel) return alert("⚠️ Preencha Nome e Telefone");
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
  
  if ((res && res.status === 'success') || res === 'CORS_ERROR_BUT_SENT') {
    alert('✅ Lead salvo com sucesso!');
    document.getElementById('leadNome').value = ''; 
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = ''; 
    document.getElementById('leadObs').value = '';
    document.getElementById('leadBairro').value = '';
    carregarLeads(); 
    navegarPara('gestaoLeads');
  } else {
    alert('❌ Erro ao salvar.');
  }
}

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) lista.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8">Atualizando...</div>';

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    leadsCache = (res.data || []).filter(l => {
      const v = (l.vendedor || l.Vendedor || '').toLowerCase();
      return v.includes(loggedUser.toLowerCase());
    });
    renderLeads();
    atualizarDashboard();
  } else {
    if(lista) lista.innerHTML = '<div style="text-align:center; color:#cbd5e1; padding:20px">Histórico indisponível offline.</div>';
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead || '').toLowerCase().includes(term) || (l.bairro || '').toLowerCase().includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = '<div style="text-align:center; padding:60px; color:#cbd5e1">Nenhum registro.</div>';
    return;
  }

  div.innerHTML = filtrados.map(l => {
    let badgeClass = "bg-gray-100 text-gray-500";
    const inter = (l.interesse || 'MÉDIO').toUpperCase();
    if(inter.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    if(inter.includes('MÉDIO')) badgeClass = "bg-yellow-100 text-yellow-700";
    if(inter.includes('BAIXO')) badgeClass = "bg-red-50 text-red-500";

    return `
    <div class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4">
      <div class="flex justify-between items-start mb-3">
        <div>
          <div class="font-bold text-[#003870] text-lg">${l.nomeLead || 'Sem Nome'}</div>
          <div class="text-xs text-gray-400">${l.timestamp || 'Hoje'}</div>
        </div>
        <span class="${badgeClass} px-3 py-1 rounded-lg text-[10px] font-bold">${inter}</span>
      </div>
      <div class="text-sm text-gray-600 mb-4">${l.bairro || 'Geral'}</div>
      <div class="flex justify-end pt-2 border-t border-gray-100">
         <a href="https://wa.me/55${(l.telefone||'').replace(/\D/g, '')}" target="_blank" class="bg-[#25D366] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
           WhatsApp
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

// ROTA
function startRoute() {
  if (!navigator.geolocation) return alert('Ative o GPS.');
  routeCoords = []; seconds = 0; routeStartTime = new Date().toISOString();
  
  document.getElementById('btnStart').style.display = 'none';
  document.getElementById('btnStop').style.display = 'flex';
  
  timerInterval = setInterval(() => {
    seconds++;
    const date = new Date(0); date.setSeconds(seconds);
    document.getElementById('timer').innerText = date.toISOString().substr(11, 8);
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
  const res = await apiCall('saveRoute', {vendedor: loggedUser, inicioISO: routeStartTime, fimISO: new Date().toISOString(), coordenadas: routeCoords});
  showLoading(false);
  alert("Rota salva!"); resetRouteUI(); navegarPara('dashboard');
}

function resetRouteUI() {
  document.getElementById('btnStart').style.display = 'flex';
  document.getElementById('btnStop').style.display = 'none';
  document.getElementById('timer').innerText = "00:00:00"; 
  document.getElementById('points').innerText = "0";
  document.getElementById('gpsStatus').innerText = "Parado";
}

// API
async function apiCall(route, payload, show=true, suppress=false) {
  if(show) showLoading(true);
  try {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({route, payload, token: TOKEN})
    });
    
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } 
    catch (e) { 
        if (route === 'addLead' || route === 'saveRoute') {
            if(show) showLoading(false);
            return 'CORS_ERROR_BUT_SENT';
        }
        throw new Error("Erro servidor."); 
    }

    if(show) showLoading(false);
    if (json.status === 'error') throw new Error(json.message);
    return json;

  } catch(e) {
    if(show) showLoading(false);
    if (e.name === 'TypeError' && (route === 'addLead' || route === 'saveRoute')) {
         return 'CORS_ERROR_BUT_SENT';
    }
    if(!suppress && route !== 'getLeads') alert("Erro conexão: " + e.message);
    return null;
  }
}

function showLoading(show, txt) {
  const loader = document.getElementById('loader');
  const loaderTxt = document.getElementById('loaderText');
  if(loader) loader.style.display = show ? 'flex' : 'none';
  if(loaderTxt && txt) loaderTxt.innerText = txt;
}
