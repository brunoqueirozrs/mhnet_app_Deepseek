/**
 * ============================================================
 * MHNET VENDAS EXTERNAS - FRONTEND LOGIC (v5.1 - Fix Básico)
 * Foco: Correção de Rota e Listagem de Leads
 * ============================================================
 */

// --- CONFIGURAÇÃO DA API ---
const DEPLOY_ID = 'AKfycbyWYgd3r5pA1dYB5LD_PY6m4V2FjWG-Oi6vYjlvNBre9r_eGiPlhia-HtJjD2Mnfc9F'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// --- ESTADO GLOBAL ---
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let routeCoords = [];
let watchId = null;
let timerInterval = null;
let seconds = 0;
let routeStartTime = null;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  if (API_URL.includes("COLE_SUA")) {
    alert("ERRO CRÍTICO: Configure a URL da API no arquivo app.js");
    return;
  }

  if (loggedUser) {
    initApp();
  } else {
    showUserMenu();
    carregarVendedores();
  }
});

function initApp() {
  const menu = document.getElementById('userMenu');
  const main = document.getElementById('mainContent');
  const userInfo = document.getElementById('userInfo');

  if(menu) menu.style.display = 'none';
  if(main) main.style.display = 'block';
  
  const userDisplay = `Vendedor: ${loggedUser}`;
  if (userInfo) userInfo.textContent = userDisplay;

  showPage('dashboard');
  carregarLeads(); // Carrega leads ao iniciar
}

// --- NAVEGAÇÃO ---
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  
  const target = document.getElementById(pageId);
  if (target) {
    target.style.display = 'block';
    window.scrollTo(0, 0);
  }
  
  if (pageId === 'dashboard') atualizarDashboard();
}

function showUserMenu() {
  const menu = document.getElementById('userMenu');
  const main = document.getElementById('mainContent');
  if (menu) menu.style.display = 'flex'; 
  if (main) main.style.display = 'none';
}

function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  if (menu) {
    const isVisible = menu.style.display === 'flex';
    if (isVisible) {
      menu.style.display = 'none';
    } else {
      menu.style.display = 'flex';
      carregarVendedores();
    }
  }
}

// --- GESTÃO DE USUÁRIO ---
async function carregarVendedores() {
  const select = document.getElementById('userSelect');
  if (!select) return;
  
  if (select.options.length <= 1) {
    select.innerHTML = '<option>Carregando...</option>';
  }
  
  const listaSeguranca = [
    {nome: "Ana Paula Rodrigues"}, {nome: "Vitoria Caroline Baldez Rosales"}, 
    {nome: "João Vithor Sader"}, {nome: "João Paulo da Silva Santos"}, 
    {nome: "Claudia Maria Semmler"}, {nome: "Diulia Vitoria Machado Borges"}, 
    {nome: "Elton da Silva Rodrigo Gonçalves"}
  ];

  try {
    const res = await apiCall('getVendedores', {}, false, true); 
    renderizarOpcoesVendedores(select, (res && res.status === 'success' && res.data) ? res.data : listaSeguranca);
  } catch (e) {
    console.error("Erro ao carregar vendedores:", e);
    renderizarOpcoesVendedores(select, listaSeguranca);
  }
}

function renderizarOpcoesVendedores(selectElement, lista) {
  selectElement.innerHTML = '<option value="">Selecione seu nome...</option>';
  lista.forEach(v => {
    // Tenta pegar o nome de várias formas possíveis
    const nome = v.nome || v.Nome || v.NOME || v[0]; 
    if (nome) {
      const opt = document.createElement('option');
      opt.value = nome;
      opt.innerText = nome;
      selectElement.appendChild(opt);
    }
  });
}

function setLoggedUser() {
  const select = document.getElementById('userSelect');
  if (select && select.value) {
    loggedUser = select.value;
    localStorage.setItem('loggedUser', loggedUser);
    initApp();
  } else {
    alert('Por favor, selecione um vendedor da lista!');
  }
}

function logout() {
  if(confirm("Tem a certeza que deseja sair?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// --- INTEGRAÇÃO IA (GEMINI) ---
async function chamarGemini(prompt) {
  if (!GEMINI_KEY) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (error) {
    console.error("Erro IA:", error);
    return null;
  }
}

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  const interesse = document.getElementById('leadInteresse').value;
  const bairro = document.getElementById('leadBairro').value || "Lajeado";
  
  if (!nome) return alert("Preencha o nome do cliente primeiro!");
  showLoading(true, "✨ IA Criando Pitch...");
  
  const prompt = `Crie mensagem WhatsApp curta para cliente ${nome}. Bairro ${bairro}, Interesse ${interesse}. MHNET Fibra. Tom amigável, emojis.`;
  const txt = await chamarGemini(prompt);
  if (txt) document.getElementById('leadObs').value = txt;
  showLoading(false);
}

async function refinarObservacaoIA() {
  const obsField = document.getElementById('leadObs');
  if (!obsField.value || obsField.value.length < 5) return alert("Escreva algo primeiro.");
  showLoading(true, "✨ Refinando...");
  const txt = await chamarGemini(`Reescreva profissionalmente para CRM: "${obsField.value}"`);
  if (txt) obsField.value = txt.trim();
  showLoading(false);
}

async function analisarCarteiraIA() {
  if (leadsCache.length === 0) return alert("Nenhum lead para analisar.");
  showLoading(true, "✨ Analisando...");
  const resumo = leadsCache.slice(0, 30).map(l => `${l.bairro || 'Geral'} (${l.interesse})`).join(", ");
  const txt = await chamarGemini(`Estratégia curta de vendas para estes leads: ${resumo}`);
  showLoading(false);
  if (txt) alert(`🤖 Estratégia:\n\n${txt}`);
}

async function gerarCoachIA() {
  showLoading(true, "✨ Coach IA...");
  const hoje = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => new Date(l.timestamp).toLocaleDateString('pt-BR') === hoje).length;
  const txt = await chamarGemini(`Vendedor ${loggedUser} fez ${leadsHoje} leads hoje (Meta: 10). Dê feedback curto e motivacional.`);
  if(txt) alert(`🤖 Coach:\n\n${txt}`);
  showLoading(false);
}

// --- ROTA & GPS (CORRIGIDO) ---
function startRoute() {
  if (!navigator.geolocation) return alert('Seu dispositivo não suporta GPS ou permissão foi negada.');
  
  // Limpa estados anteriores
  routeCoords = [];
  seconds = 0;
  routeStartTime = new Date().toISOString();
  
  // Atualiza UI imediatamente para dar feedback visual
  updateRouteUI(true);
  
  // Inicia Timer
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    seconds++;
    const h = Math.floor(seconds / 3600).toString().padStart(2,'0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2,'0');
    const s = (seconds % 60).toString().padStart(2,'0');
    const elTimer = document.getElementById('timer');
    if (elTimer) elTimer.innerText = `${h}:${m}:${s}`;
  }, 1000);

  // Inicia GPS com tratamento de erro robusto
  const gpsOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 };
  
  watchId = navigator.geolocation.watchPosition(
    pos => {
      routeCoords.push({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      
      const elPoints = document.getElementById('points');
      const elGps = document.getElementById('gpsStatus');
      
      if (elPoints) elPoints.innerText = routeCoords.length;
      if (elGps) {
        elGps.innerText = "✅ Rastreando";
        elGps.className = "status-badge success";
      }
    },
    err => {
      console.error("Erro GPS:", err);
      const elGps = document.getElementById('gpsStatus');
      let msg = "Erro GPS";
      if (err.code === 1) msg = "Permissão Negada"; // Usuário bloqueou
      if (err.code === 2) msg = "Sinal Indisponível";
      if (err.code === 3) msg = "Tempo Esgotado";
      
      if (elGps) {
        elGps.innerText = `❌ ${msg}`;
        elGps.className = "status-badge error";
      }
      // Tenta reiniciar com precisão menor se falhar por timeout
      if (err.code === 3) {
         console.warn("Tentando reiniciar GPS com baixa precisão...");
         // Lógica de fallback poderia vir aqui se necessário
      }
    },
    gpsOptions
  );
}

async function stopRoute() {
  if (!confirm("Finalizar rota e enviar dados?")) return;
  
  clearInterval(timerInterval);
  if (watchId) navigator.geolocation.clearWatch(watchId);
  
  showLoading(true, "Enviando Rota...");
  
  const payload = {
    vendedor: loggedUser,
    inicioISO: routeStartTime,
    fimISO: new Date().toISOString(),
    coordenadas: routeCoords
  };
  
  const res = await apiCall('saveRoute', payload);
  showLoading(false);
  
  if (res && res.status === 'success') {
    alert('Rota salva com sucesso!');
    resetRouteUI();
    showPage('dashboard');
  } else {
    alert('Erro ao salvar. Verifique conexão.');
  }
}

function updateRouteUI(isTracking) {
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const elGps = document.getElementById('gpsStatus');
  
  if (btnStart) btnStart.style.display = isTracking ? 'none' : 'flex';
  if (btnStop) btnStop.style.display = isTracking ? 'flex' : 'none';
  if (isTracking && elGps) elGps.innerText = "Iniciando...";
}

function resetRouteUI() {
  updateRouteUI(false);
  const elGps = document.getElementById('gpsStatus');
  const elTimer = document.getElementById('timer');
  const elPoints = document.getElementById('points');

  if (elGps) { elGps.innerText = "Aguardando"; elGps.className = "status-badge"; }
  if (elTimer) elTimer.innerText = "00:00:00";
  if (elPoints) elPoints.innerText = "0";
  
  routeCoords = [];
  seconds = 0;
}

// --- LEADS & NORMALIZAÇÃO DE DADOS ---

// Função auxiliar para evitar problemas de Maiúsculas/Minúsculas
function normalizeData(data) {
  if (!Array.isArray(data)) return [];
  return data.map(item => {
    const newItem = {};
    for (const key in item) {
      newItem[key.toLowerCase().trim()] = item[key];
    }
    return newItem; // Agora temos chaves como 'vendedor', 'nome', 'bairro' (tudo minúsculo)
  });
}

async function enviarLead() {
  const nome = document.getElementById('leadNome').value;
  const tel = document.getElementById('leadTelefone').value;
  
  if (!nome || !tel) return alert("Preencha Nome e Telefone");
  showLoading(true, "Salvando...");
  
  const payload = {
    vendedor: loggedUser,
    lead: nome, 
    nomeLead: nome,
    telefone: tel,
    whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value,
    bairro: document.getElementById('leadBairro').value,
    cidade: document.getElementById('leadCidade').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value,
    data: new Date().toISOString() // Garante data
  };
  
  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  if (res && res.status === 'success') {
    alert('Salvo!');
    document.getElementById('leadNome').value = '';
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = '';
    document.getElementById('leadObs').value = '';
    carregarLeads(); 
    showPage('gestaoLeads');
  } else {
    alert('Erro: ' + (res?.message || 'Tente novamente'));
  }
}

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if (lista && !lista.hasChildNodes()) lista.innerHTML = '<div style="text-align:center; padding:20px; color:#666">Atualizando lista...</div>';

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    // Normaliza para evitar erros de coluna
    const dadosBrutos = res.data || [];
    const dadosNormalizados = normalizeData(dadosBrutos);
    
    // Filtra pelo vendedor logado (comparando nomes em minúsculo por segurança)
    leadsCache = dadosNormalizados.filter(l => {
      const vend = (l.vendedor || l.nomevendedor || '').toString().toLowerCase();
      const user = loggedUser.toLowerCase();
      return vend.includes(user) || user.includes(vend);
    });

    renderLeads();
    atualizarDashboard();
  } else {
    if (lista && leadsCache.length === 0) {
      lista.innerHTML = '<div style="text-align:center; color:red; padding:20px">Não foi possível carregar os leads.</div>';
    }
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;

  const searchInput = document.getElementById('searchLead');
  const term = (searchInput ? searchInput.value : '').toLowerCase();
  
  // Filtro de busca na tela
  const filtrados = leadsCache.filter(l => {
    // Busca em chaves normalizadas
    const nome = (l.nomelead || l.lead || l.nome || '').toString().toLowerCase();
    const tel = (l.telefone || '').toString();
    const bairro = (l.bairro || '').toString().toLowerCase();
    return (nome.includes(term) || tel.includes(term) || bairro.includes(term));
  });
  
  if (filtrados.length === 0) {
    div.innerHTML = '<div style="text-align:center; padding:20px; color:#888">Nenhum registro encontrado.</div>';
    return;
  }

  // Ordena por data (mais recente primeiro) se houver timestamp ou carimbodedatahora
  filtrados.sort((a, b) => {
    const da = new Date(a.timestamp || a.carimbodedatahora || a.data || 0);
    const db = new Date(b.timestamp || b.carimbodedatahora || b.data || 0);
    return db - da;
  });

  div.innerHTML = filtrados.map(l => {
    const nome = l.nomelead || l.lead || l.nome || 'Sem Nome';
    const tel = l.telefone || '';
    const bairro = l.bairro || 'Não informado';
    const interesse = (l.interesse || 'NOVO').toUpperCase();
    
    // Tenta achar qualquer campo de data
    const rawDate = l.timestamp || l.carimbodedatahora || l.data || new Date().toISOString();
    const dataDisplay = new Date(rawDate).toLocaleDateString('pt-BR');

    let statusColor = '#f0f0f0';
    let statusTextColor = '#555';
    if(interesse.includes('ALTO')) { statusColor = '#e6fffa'; statusTextColor = '#008f75'; } 
    else if(interesse.includes('MÉDIO')) { statusColor = '#fffaf0'; statusTextColor = '#c05621'; }
    else if(interesse.includes('BAIXO')) { statusColor = '#fff5f5'; statusTextColor = '#c53030'; }

    const wppLink = `https://wa.me/55${tel.replace(/\D/g, '')}`;

    return `
    <div class="lead-card-gestao" style="background:white; padding:16px; margin-bottom:12px; border-radius:12px; border:1px solid #edf2f7; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
        <div>
          <div style="font-weight:bold; color:#2d3748; font-size:1.1em; margin-bottom:2px">${nome}</div>
          <div style="font-size:0.85em; color:#718096">📅 ${dataDisplay}</div>
        </div>
        <span style="background:${statusColor}; color:${statusTextColor}; padding:4px 8px; border-radius:20px; font-size:0.75em; font-weight:800; letter-spacing:0.5px">${interesse}</span>
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="flex:1">
          <div style="font-size:0.95em; color:#4a5568; margin-bottom:4px; display:flex; align-items:center">
             <span style="margin-right:6px">📞</span> ${tel}
          </div>
          <div style="font-size:0.95em; color:#4a5568; display:flex; align-items:center">
             <span style="margin-right:6px">📍</span> ${bairro}
          </div>
        </div>
        <a href="${wppLink}" target="_blank" style="margin-left:10px; background:#25D366; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 6px rgba(37, 211, 102, 0.3);">
          <i class="fab fa-whatsapp text-white text-xl"></i>
        </a>
      </div>
    </div>
    `;
  }).join('');
}

function atualizarDashboard() {
  const hojeStr = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => {
    const rawDate = l.timestamp || l.carimbodedatahora || l.data || new Date().toISOString();
    return new Date(rawDate).toLocaleDateString('pt-BR') === hojeStr;
  }).length;
  
  const elStat = document.getElementById('statLeads');
  if (elStat) elStat.innerText = leadsHoje;

  if (leadsCache.length > 0) {
    const l = leadsCache[0]; // Assumindo que já foi ordenado em renderLeads ou é o primeiro da lista
    const elContent = document.getElementById('lastLeadContent');
    
    if (elContent) {
      const nome = l.nomelead || l.lead || l.nome || 'Recente';
      const bairro = l.bairro || 'Geral';
      const rawDate = l.timestamp || l.carimbodedatahora || l.data || new Date().toISOString();
      
      elContent.innerHTML = `
        <div style="font-weight:bold; font-size:1.1em; color:#004AAD; margin-bottom:5px">${nome}</div>
        <div style="color:#555; font-size:0.95em">📍 ${bairro}</div>
        <div style="font-size:0.85em; color:#888; margin-top:8px; border-top:1px solid #f0f0f0; padding-top:6px">
          🕒 ${new Date(rawDate).toLocaleString('pt-BR')}
        </div>
      `;
    }
  }
}

// --- COMUNICAÇÃO API (RETRY) ---
async function apiCall(action, payload = {}, showLoader = true, suppressAlert = false) {
  if (!API_URL || API_URL.includes("SUA_URL")) {
    alert("ERRO DE CONFIGURAÇÃO: Verifique a API_URL no arquivo app.js");
    return null;
  }
  
  if (showLoader) showLoading(true, "Processando...");
  const MAX_RETRIES = 3;
  let attempt = 0;
  
  while (attempt < MAX_RETRIES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ route: action, payload: payload, token: TOKEN }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const text = await response.text();
      let json;
      try { json = JSON.parse(text); } catch (e) { throw new Error("Erro JSON servidor"); }
      if (showLoader) showLoading(false);
      if (json.status === 'error') throw new Error(json.message);
      return json;
    } catch (e) {
      attempt++;
      if (attempt === MAX_RETRIES) {
        if (showLoader) showLoading(false);
        if (!suppressAlert && !action.startsWith('get')) alert(`Erro de conexão. Tente novamente.`);
        return null;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

function showLoading(show, text) {
  const el = document.getElementById('loader');
  const txt = document.getElementById('loaderText');
  if (show) {
    if(txt) txt.innerText = text || "Carregando...";
    if(el) el.style.display = 'flex';
  } else {
    if(el) el.style.display = 'none';
  }
}
