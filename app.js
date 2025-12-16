/**
 * ============================================================
 * MHNET VENDAS - v7.7 (Diagnóstico CORS e Fix)
 * ============================================================
 */

// ⚠️ ATENÇÃO: Se der erro de CORS, gere uma NOVA IMPLANTAÇÃO como "QUALQUER PESSOA"
// e cole o novo ID aqui:
const DEPLOY_ID = 'AKfycbymgWQBpEW967OtnmdcDcZFsB3gCmCFFosDOg2hNlR9dFwqTXbuOvaE_FXyP3GjyMoN'; 
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

// INIT
document.addEventListener('DOMContentLoaded', () => {
  // 1. Injeta lista IMEDIATAMENTE (Sem depender de API)
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
  carregarLeads(); // Puxa histórico em background
}

function navegarPara(pageId) {
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  const target = document.getElementById(pageId);
  if(target) target.style.display = 'block';
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
  if(confirm("Sair do sistema?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// *** IA GEMINI (Chat + Funções) ***
async function chamarGemini(prompt) {
  if (!GEMINI_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (res.status === 403) {
        console.warn("Chave Gemini inválida ou expirada.");
        return null;
    }
    
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { return null; }
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
    const msg = input.value;
    if(!msg) return;

    history.innerHTML += `<div class="flex gap-3 justify-end"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[80%]">${msg}</div></div>`;
    input.value = '';
    history.scrollTop = history.scrollHeight;

    const loadingId = 'loading-' + Date.now();
    history.innerHTML += `<div id="${loadingId}" class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm flex gap-1"><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span><span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span></div></div>`;
    history.scrollTop = history.scrollHeight;

    const prompt = `Aja como um assistente de vendas da MHNET Telecom. Responda: "${msg}"`;
    const response = await chamarGemini(prompt);
    
    document.getElementById(loadingId)?.remove();
    if(response) {
         history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[85%] leading-relaxed">${response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</div></div>`;
    }
    history.scrollTop = history.scrollHeight;
}

// OUTRAS FUNÇÕES IA
async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if (!nome) return alert("Preencha o nome!");
  showLoading(true, "CRIANDO PITCH...");
  const txt = await chamarGemini(`Mensagem WhatsApp para ${nome}. Venda de internet fibra MHNET. Curta, persuasiva e com emojis.`);
  if (txt) document.getElementById('leadObs').value = txt;
  showLoading(false);
}

async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Sem leads.");
  showLoading(true, "ANALISANDO...");
  const txt = await chamarGemini(`Analise estes bairros e sugira rota: ${leadsCache.slice(0,20).map(l=>l.bairro).join(', ')}`);
  showLoading(false);
  if (txt) alert(`💡 Dica:\n${txt}`);
}

async function gerarCoachIA() {
  showLoading(true, "COACH...");
  const hoje = leadsCache.filter(l => new Date(l.timestamp || l.Data).toLocaleDateString() === new Date().toLocaleDateString()).length;
  const txt = await chamarGemini(`Vendedor fez ${hoje} vendas hoje. Motive-o em 1 frase curta.`);
  showLoading(false);
  if(txt) alert(`🚀 Coach:\n${txt}`);
}

// *** ENVIO DE LEADS ***
async function enviarLead() {
  const nome = document.getElementById('leadNome').value;
  const tel = document.getElementById('leadTelefone').value;
  
  if (!nome || !tel) return alert("Preencha Nome e Telefone");
  showLoading(true, "SALVANDO...");
  
  const payload = {
    vendedor: loggedUser, nomeLead: nome, lead: nome, 
    telefone: tel, whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value,
    cidade: document.getElementById('leadCidade').value,
    bairro: document.getElementById('leadBairro').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value,
    provedor: "", timestamp: new Date().toISOString()
  };
  
  console.log("Enviando Lead:", payload); // Debug

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
    // Se chegou aqui, já foi mostrado alerta no apiCall, mas reforça se necessário
  }
}

// *** LISTAGEM DE LEADS ***
async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) lista.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8"><i class="fas fa-circle-notch fa-spin text-3xl mb-3 text-blue-500"></i><br>Buscando histórico...</div>';

  const res = await apiCall('getLeads', {}, false, true); // Suppress alert for background load
  
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
    div.innerHTML = '<div style="text-align:center; padding:60px; color:#cbd5e1"><i class="far fa-folder-open text-5xl mb-4"></i><br>Nenhum registro encontrado.</div>';
    return;
  }

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
    const bairro = l.bairro || 'Geral';
    const interesse = (l.interesse || 'Novo').toUpperCase();
    const tel = l.telefone || l.whatsapp || '';
    
    let badgeClass = "bg-gray-100 text-gray-500";
    if(interesse.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    if(interesse.includes('MÉDIO')) badgeClass = "bg-yellow-100 text-yellow-700";
    if(interesse.includes('BAIXO')) badgeClass = "bg-red-50 text-red-500";

    return `
    <div class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4">
      <div class="flex justify-between items-start mb-3">
        <div>
          <div class="font-bold text-[#003870] text-lg leading-tight">${nome}</div>
          <div class="text-xs text-gray-400 mt-1"><i class="fas fa-calendar-alt mr-1"></i> ${l.timestamp ? l.timestamp.split(' ')[0] : 'Hoje'}</div>
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
    const st = document.getElementById('gpsStatus');
    st.innerText = "Rastreando";
    st.className = "bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-bold";
  }, e => console.error(e), {enableHighAccuracy:true});
}

async function stopRoute() {
  if(!confirm("Finalizar rota?")) return;
  clearInterval(timerInterval); navigator.geolocation.clearWatch(watchId);
  showLoading(true, "ENVIANDO ROTA...");
  await apiCall('saveRoute', {vendedor: loggedUser, inicioISO: routeStartTime, fimISO: new Date().toISOString(), coordenadas: routeCoords});
  showLoading(false); alert("Rota salva!"); resetRouteUI(); navegarPara('dashboard');
}

function updateRouteUI(on) {
  document.getElementById('btnStart').style.display = on ? 'none' : 'flex';
  document.getElementById('btnStop').style.display = on ? 'flex' : 'none';
}
function resetRouteUI() {
  updateRouteUI(false);
  document.getElementById('timer').innerText = "00:00:00"; document.getElementById('points').innerText = "0";
  document.getElementById('gpsStatus').innerText = "Parado";
}

// *** API ROBUSTA (FIX CORREÇÃO) ***
async function apiCall(route, payload, show=true, suppress=false) {
  if(show) showLoading(true);
  try {
    // FIX: Content-Type text/plain evita Preflight CORS complexo no Google Apps Script
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({route, payload, token: TOKEN})
    });
    
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } 
    catch (e) { throw new Error("Resposta do servidor não é JSON."); }

    if(show) showLoading(false);
    
    if (json.status === 'error') throw new Error(json.message);
    return json;

  } catch(e) {
    if(show) showLoading(false);
    console.error("API Call Error:", e);
    
    // Alerta específico para o problema de CORS
    if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
        alert("⚠️ ERRO CRÍTICO DE PERMISSÃO (CORS)\n\nO Google Apps Script bloqueou a conexão.\n\nSOLUÇÃO OBRIGATÓRIA:\n1. Vá ao seu script no Google.\n2. Clique em Implantar > NOVA IMPLANTAÇÃO.\n3. Em 'Quem tem acesso', mude para 'QUALQUER PESSOA' (Anyone).\n4. Copie o NOVO ID da URL gerada e atualize no app.js.");
    } else {
        if(!suppress) alert("Erro conexão API: " + e.message);
    }
    return null;
  }
}

function showLoading(show, txt) {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
  if(txt) document.getElementById('loaderText').innerText = txt;
}
