/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND (v10.0 - Full AI Integration)
 * Sincronizado com index.html v9.2
 * ============================================================
 */

// --- CONFIGURAÇÕES ---
const DEPLOY_ID = 'AKfycbwM64LebBEQ41LzEO3TB7RXHDreR4uvN2a1kzFbOgc'; // Seu ID atual
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; // Chave de API

// LISTA FIXA DE SEGURANÇA (Para login offline)
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
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // 1.1 Injeta lista de vendedores imediatamente (Sem esperar API)
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

  // 1.2 Verifica login
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
  carregarLeads(); // Carrega histórico em background
}

// ============================================================
// 2. NAVEGAÇÃO
// ============================================================
function navegarPara(pageId) {
  // Esconde todas as páginas
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  
  // Mostra a página alvo
  const target = document.getElementById(pageId);
  if(target) {
      target.style.display = 'block';
      target.classList.remove('fade-in');
      void target.offsetWidth; // Reinicia animação
      target.classList.add('fade-in');
  }
  
  window.scrollTo(0, 0);

  // Atualiza botões do rodapé
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active', 'text-blue-700');
    el.classList.add('text-slate-400');
  });

  // Mapeamento Página -> Botão
  let btnId = '';
  if(pageId === 'dashboard') btnId = 'nav-home';
  if(pageId === 'cadastroLead') btnId = 'nav-novo';
  if(pageId === 'gestaoLeads') btnId = 'nav-lista';
  if(pageId === 'rota') btnId = 'nav-rota';

  const btn = document.getElementById(btnId);
  if(btn && !btn.querySelector('div')) { // Ignora o botão central flutuante
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
// 3. INTEGRAÇÃO IA (GEMINI)
// ============================================================

// Função Central de Chamada à API
async function chamarGemini(prompt) {
  if (!GEMINI_KEY) {
      console.warn("Sem chave API Gemini");
      return null;
  }
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (res.status === 403) return null; // Chave inválida
    
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { 
    console.error("Erro IA:", e);
    return null; 
  }
}

// --- 3.1 Chat Assistente ---
function toggleChat() {
    const el = document.getElementById('chatModal');
    const history = document.getElementById('chatHistory');
    
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        // Animação de entrada
        const content = el.querySelector('div.absolute');
        content.classList.remove('slide-up');
        void content.offsetWidth;
        content.classList.add('slide-up');
        
        setTimeout(() => document.getElementById('chatInput').focus(), 300);
        
        // Mensagem de boas-vindas se vazio
        if(!history.hasChildNodes() || history.innerHTML.trim() === "") {
             history.innerHTML = `
                <div class="flex gap-3 fade-in">
                    <div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div>
                    <div class="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[85%]">
                        Olá ${loggedUser.split(' ')[0]}! Sou o assistente MHNET. Posso ajudar com argumentos de venda ou dúvidas sobre planos.
                    </div>
                </div>`;
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

    // Adiciona mensagem do usuário
    history.innerHTML += `
        <div class="flex gap-3 justify-end fade-in">
            <div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">
                ${msg}
            </div>
        </div>`;
    input.value = '';
    history.scrollTop = history.scrollHeight;

    // Indicador de "Digitando..."
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

    // Chama a API
    const prompt = `Aja como um especialista comercial da MHNET Telecom. Responda de forma curta, motivadora e útil à pergunta do vendedor: "${msg}"`;
    const response = await chamarGemini(prompt);
    
    document.getElementById(loadingId)?.remove();

    if(response) {
         // Formata a resposta (negrito, quebras de linha)
         const formatted = response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
         history.innerHTML += `
            <div class="flex gap-3 fade-in">
                <div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div>
                <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">
                    ${formatted}
                </div>
            </div>`;
    } else {
        history.innerHTML += `<div class="text-center text-xs text-red-400 mt-2 fade-in">Falha na conexão com a IA.</div>`;
    }
    history.scrollTop = history.scrollHeight;
}

// --- 3.2 Gerador de Pitch (WhatsApp) ---
async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if (!nome) return alert("⚠️ Preencha o nome do cliente primeiro!");
  
  showLoading(true, "CRIANDO PITCH...");
  
  const prompt = `Crie uma mensagem curta para WhatsApp (máximo 3 frases) para vender internet fibra ótica da MHNET para o cliente ${nome}. Use emojis e um tom amigável.`;
  const txt = await chamarGemini(prompt);
  
  showLoading(false);
  
  if (txt) {
      document.getElementById('leadObs').value = txt.replace(/["*]/g, ''); // Remove aspas e asteriscos
  } else {
      alert("Erro ao gerar texto.");
  }
}

// --- 3.3 Analista de Carteira ---
async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Sem leads para analisar.");
  
  showLoading(true, "ANALISANDO...");
  
  // Extrai lista única de bairros
  const bairros = [...new Set(leadsCache.slice(0, 30).map(l => l.bairro || 'Geral'))].join(', ');
  
  const prompt = `Analise estes bairros onde tenho clientes: ${bairros}. Sugira uma rota lógica ou estratégia de visitação em 2 frases curtas.`;
  const txt = await chamarGemini(prompt);
  
  showLoading(false);
  
  if (txt) alert(`💡 DICA DO ANALISTA:\n\n${txt}`);
}

// --- 3.4 Coach Motivacional ---
async function gerarCoachIA() {
  showLoading(true, "COACH...");
  
  const hoje = new Date().toLocaleDateString('pt-BR');
  // Filtra leads de hoje
  const leadsHoje = leadsCache.filter(l => {
      const d = l.timestamp || l.Data || '';
      // Tenta compatibilizar formatos de data
      return d.includes(hoje) || (new Date(d).toLocaleDateString('pt-BR') === hoje);
  }).length;
  
  const prompt = `O vendedor fez ${leadsHoje} leads hoje. Dê um feedback motivacional curto (1 frase enérgica). Se for 0, anime-o a começar.`;
  const txt = await chamarGemini(prompt);
  
  showLoading(false);
  
  if(txt) alert(`🚀 COACH DIZ:\n\n${txt.replace(/\*\*/g, '')}`);
}

// ============================================================
// 4. OPERAÇÕES DE DADOS (CRUD)
// ============================================================

// --- Salvar Lead ---
async function enviarLead() {
  const nome = document.getElementById('leadNome').value.trim();
  const tel = document.getElementById('leadTelefone').value.trim();
  
  if (!nome || !tel) return alert("⚠️ Preencha Nome e Telefone!");
  
  showLoading(true, "SALVANDO...");
  
  // Payload robusto (Envia chaves duplicadas para garantir compatibilidade com Backend)
  const payload = {
    vendedor: loggedUser,
    nomeLead: nome,  
    lead: nome, // Backup
    telefone: tel,
    whatsapp: tel, // Backup
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
    
    // Limpar campos
    document.getElementById('leadNome').value = ''; 
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = ''; 
    document.getElementById('leadObs').value = '';
    
    // Atualiza
    carregarLeads(); 
    navegarPara('gestaoLeads');
  } else {
    alert('❌ Erro ao salvar: ' + (res ? res.message : 'Verifique conexão'));
  }
}

// --- Carregar Leads ---
async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) lista.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8"><i class="fas fa-circle-notch fa-spin text-3xl mb-3 text-blue-500"></i><br>Atualizando...</div>';

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    // Filtra apenas leads do vendedor logado (case insensitive)
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

// --- Renderizar HTML da Lista ---
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

// ============================================================
// 5. ROTA E GPS
// ============================================================
function startRoute() {
  if (!navigator.geolocation) return alert('Ative o GPS.');
  
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
  resetRouteUI();
  navegarPara('dashboard');
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
  document.getElementById('gpsStatus').className = "bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-bold";
}

// ============================================================
// 6. CONEXÃO API (ROBUSTA - TEXT/PLAIN)
// ============================================================
async function apiCall(route, payload, show=true, suppress=false) {
  if(show) showLoading(true);
  try {
    // IMPORTANTE: text/plain evita Preflight CORS no Google Apps Script
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({route, payload, token: TOKEN})
    });
    
    const text = await res.text();
    let json;
    
    try { 
        json = JSON.parse(text); 
    } catch (e) { 
        console.error("Resposta inválida:", text);
        throw new Error("Resposta do servidor não é válida."); 
    }

    if(show) showLoading(false);
    
    if (json.status === 'error') throw new Error(json.message);
    
    return json;

  } catch(e) {
    if(show) showLoading(false);
    console.error("API Call Error:", e);
    if(!suppress) alert("Erro conexão: " + e.message);
    return null;
  }
}

function showLoading(show, txt) {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
  if(txt) document.getElementById('loaderText').innerText = txt;
}
