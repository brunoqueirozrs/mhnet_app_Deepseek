/**
 * ============================================================
 * MHNET VENDAS EXTERNAS - FRONTEND LOGIC (v4.4 - Atualizado)
 * Conecta com Backend Google Apps Script + Gemini AI
 * ============================================================
 */

// --- CONFIGURAÇÃO DA API ---
// Atualizado com a sua nova URL fornecida
const DEPLOY_ID = 'AKfycbyWYgd3r5pA1dYB5LD_PY6m4V2FjWG-Oi6vYjlvNBre9r_eGiPlhia-HtJjD2Mnfc9F'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// Token de segurança (Deve ser igual ao do Code.gs)
const TOKEN = "MHNET2025#SEG";

// Chave da API Gemini (Opcional - Para funcionalidades de IA)
const GEMINI_KEY = ""; 

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
  // Verifica se a URL foi configurada corretamente
  if (API_URL.includes("COLE_SUA")) {
    alert("ERRO CRÍTICO: Configure a URL da API no arquivo app.js");
    return;
  }

  // Verifica se já existe um usuário logado
  if (loggedUser) {
    initApp();
  } else {
    showUserMenu();
    carregarVendedores(); // Carrega lista para o login
  }
});

function initApp() {
  const menu = document.getElementById('userMenu');
  const main = document.getElementById('mainContent');
  const userInfo = document.getElementById('userInfo');
  const footerUser = document.getElementById('footerUser');

  if(menu) menu.style.display = 'none';
  if(main) main.style.display = 'block';
  
  const userDisplay = `Vendedor: ${loggedUser}`;
  if (userInfo) userInfo.textContent = userDisplay;
  if (footerUser) footerUser.textContent = loggedUser;

  showPage('dashboard');
  carregarLeads(); // Carrega leads em background
}

// --- NAVEGAÇÃO ---
function showPage(pageId) {
  // Esconde todas as páginas
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  
  // Mostra a página desejada
  const target = document.getElementById(pageId);
  if (target) {
    target.style.display = 'block';
    window.scrollTo(0, 0); // Rola para o topo
  }
  
  if (pageId === 'dashboard') atualizarDashboard();
}

function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  if (menu) {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    if (menu.style.display === 'block') carregarVendedores();
  }
}

// --- GESTÃO DE USUÁRIO (COM FALLBACK DE SEGURANÇA) ---
async function carregarVendedores() {
  const select = document.getElementById('userSelect');
  if (!select) return;
  
  select.innerHTML = '<option>Carregando...</option>';
  
  // Lista de segurança caso a API falhe ou esteja offline
  const listaSeguranca = [
    {nome: "Ana Paula Rodrigues"}, {nome: "Vitoria Caroline Baldez Rosales"}, 
    {nome: "João Vithor Sader"}, {nome: "João Paulo da Silva Santos"}, 
    {nome: "Claudia Maria Semmler"}, {nome: "Diulia Vitoria Machado Borges"}, 
    {nome: "Elton da Silva Rodrigo Gonçalves"}
  ];

  try {
    // Tenta buscar do servidor sem bloquear a tela (showLoader = false)
    const res = await apiCall('getVendedores', {}, false, true); 
    
    let listaFinal = [];

    if (res && res.status === 'success' && res.data && res.data.length > 0) {
      console.log("Vendedores carregados da API");
      listaFinal = res.data;
    } else {
      console.warn("API vazia ou falhou. Usando lista local.");
      listaFinal = listaSeguranca;
    }

    renderizarOpcoesVendedores(select, listaFinal);

  } catch (e) {
    console.error("Erro ao carregar vendedores:", e);
    renderizarOpcoesVendedores(select, listaSeguranca);
  }
}

function renderizarOpcoesVendedores(selectElement, lista) {
  selectElement.innerHTML = '<option value="">Selecione...</option>';
  lista.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.nome;
    opt.innerText = v.nome;
    selectElement.appendChild(opt);
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
  if (!GEMINI_KEY) return "IA não configurada no app.js (Adicione a GEMINI_KEY).";
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sem resposta da IA.";
  } catch (error) {
    console.error("Erro IA:", error);
    return "Erro ao conectar com a IA.";
  }
}

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  const interesse = document.getElementById('leadInteresse').value;
  const bairro = document.getElementById('leadBairro').value || "Lajeado";
  
  if (!nome) return alert("Preencha o nome do cliente primeiro!");
  
  showLoading(true, "IA Criando Abordagem...");
  
  const prompt = `
    Aja como um vendedor experiente da provedora de internet MHNET.
    Crie uma mensagem curta e persuasiva para WhatsApp para o cliente ${nome}.
    Nível de interesse: ${interesse}.
    Bairro: ${bairro}.
    Destaque: Fibra óptica, estabilidade e instalação rápida.
    Tom: Profissional mas amigável. Use emojis. Sem hashtags.
  `;
  
  const txt = await chamarGemini(prompt);
  document.getElementById('leadObs').value = txt;
  showLoading(false);
}

async function gerarCoachIA() {
  showLoading(true, "Coach IA Analisando...");
  
  const hoje = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => new Date(l.timestamp).toLocaleDateString('pt-BR') === hoje).length;
  
  const prompt = `
    Aja como um gerente de vendas motivacional.
    Hoje é ${hoje}. O vendedor ${loggedUser} cadastrou ${leadsHoje} leads.
    Meta diária sugerida: 10 leads.
    Dê um feedback curto (máx 3 frases). Se estiver abaixo da meta, motive. Se estiver acima, parabenize.
    Use emojis.
  `;
  
  const txt = await chamarGemini(prompt);
  alert(`🤖 Coach IA diz:\n\n${txt}`);
  showLoading(false);
}

// --- ROTA & GPS ---
function startRoute() {
  if (!navigator.geolocation) return alert('GPS não suportado neste dispositivo.');
  
  routeCoords = [];
  seconds = 0;
  routeStartTime = new Date().toISOString();
  
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

  // Inicia Rastreamento GPS
  watchId = navigator.geolocation.watchPosition(
    pos => {
      routeCoords.push({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      
      const elPoints = document.getElementById('points');
      const elGps = document.getElementById('gpsStatus');
      
      if (elPoints) elPoints.innerText = routeCoords.length;
      if (elGps) {
        elGps.innerText = "✅ Rastreando";
        elGps.className = "status-badge success"; // Classe CSS verde
      }
    },
    err => {
      const elGps = document.getElementById('gpsStatus');
      if (elGps) {
        elGps.innerText = "❌ Erro GPS";
        elGps.className = "status-badge error";
      }
      console.error("Erro GPS:", err);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}

async function stopRoute() {
  if (!confirm("Deseja finalizar a rota e enviar os dados para a central?")) return;
  
  clearInterval(timerInterval);
  if (watchId) navigator.geolocation.clearWatch(watchId);
  
  showLoading(true, "Salvando Rota...");
  
  const payload = {
    vendedor: loggedUser,
    inicioISO: routeStartTime,
    fimISO: new Date().toISOString(),
    coordenadas: routeCoords
  };
  
  const res = await apiCall('saveRoute', payload);
  showLoading(false);
  
  if (res && res.status === 'success') {
    alert('Rota finalizada e salva com sucesso!');
    resetRouteUI();
    showPage('dashboard');
  } else {
    alert('Erro ao salvar rota: ' + (res?.message || 'Verifique sua conexão'));
    // Não limpa UI para permitir nova tentativa
  }
}

function updateRouteUI(isTracking) {
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const elGps = document.getElementById('gpsStatus');
  
  if (btnStart) btnStart.style.display = isTracking ? 'none' : 'flex';
  if (btnStop) btnStop.style.display = isTracking ? 'flex' : 'none';
  if (isTracking && elGps) elGps.innerText = "Iniciando GPS...";
}

function resetRouteUI() {
  updateRouteUI(false);
  const elGps = document.getElementById('gpsStatus');
  const elTimer = document.getElementById('timer');
  const elPoints = document.getElementById('points');

  if (elGps) {
    elGps.innerText = "Aguardando...";
    elGps.className = "status-badge";
  }
  if (elTimer) elTimer.innerText = "00:00:00";
  if (elPoints) elPoints.innerText = "0";
  
  routeCoords = [];
  seconds = 0;
}

// --- LEADS ---
async function enviarLead() {
  const nome = document.getElementById('leadNome').value;
  const tel = document.getElementById('leadTelefone').value;
  
  if (!nome || !tel) return alert("Preencha pelo menos Nome e Telefone");
  
  showLoading(true, "Salvando Lead...");
  
  const payload = {
    vendedor: loggedUser,
    lead: nome, 
    nomeLead: nome, // Compatibilidade
    telefone: tel,
    whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value,
    bairro: document.getElementById('leadBairro').value,
    cidade: document.getElementById('leadCidade').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value
  };
  
  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  if (res && res.status === 'success') {
    alert('Lead salvo com sucesso!');
    
    // Limpa formulário
    document.getElementById('leadNome').value = '';
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = '';
    document.getElementById('leadObs').value = '';
    
    carregarLeads(); 
    showPage('gestaoLeads');
  } else {
    alert('Erro ao salvar: ' + (res?.message || 'Tente novamente'));
  }
}

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  
  // Loading discreto se a lista estiver vazia
  if (lista && !lista.hasChildNodes()) {
    lista.innerHTML = '<div style="text-align:center; padding:20px; color:#666">Carregando...</div>';
  }

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    // Cache local dos leads deste vendedor
    leadsCache = res.data.filter(l => l.vendedor === loggedUser);
    renderLeads();
    atualizarDashboard();
  } else {
    if (lista && leadsCache.length === 0) {
      lista.innerHTML = '<div style="text-align:center; color:red; padding:20px">Erro ao carregar leads.</div>';
    }
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;

  const searchInput = document.getElementById('searchLead');
  const term = (searchInput ? searchInput.value : '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead && l.nomeLead.toLowerCase().includes(term)) || 
    (l.telefone && l.telefone.includes(term)) ||
    (l.bairro && l.bairro.toLowerCase().includes(term))
  );
  
  if (filtrados.length === 0) {
    div.innerHTML = '<div style="text-align:center; padding:20px; color:#888">Nenhum lead encontrado.</div>';
    return;
  }

  div.innerHTML = filtrados.map(l => `
    <div class="lead-card-gestao" style="background:white; padding:15px; margin-bottom:10px; border-radius:8px; border:1px solid #eee; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
      <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
        <span style="font-weight:bold; color:#004AAD">${l.nomeLead}</span>
        <span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:0.8em; font-weight:bold">${l.interesse || 'NOVO'}</span>
      </div>
      <div style="font-size:0.9em; color:#555">📞 ${l.telefone}</div>
      <div style="font-size:0.9em; color:#555">📍 ${l.bairro || ''} - ${l.cidade || ''}</div>
      <div style="font-size:0.8em; color:#999; text-align:right; margin-top:5px">
        ${l.vendedor ? `Vend: ${l.vendedor}` : ''}
      </div>
    </div>
  `).join('');
}

function atualizarDashboard() {
  // Último lead card
  if (leadsCache.length > 0) {
    const l = leadsCache[0]; 
    const elContent = document.getElementById('lastLeadContent');
    
    if (elContent) {
      elContent.innerHTML = `
        <div style="font-weight:bold; font-size:1.1em; color:#004AAD">${l.nomeLead}</div>
        <div style="color:#555">${l.bairro || 'Sem bairro'} - ${l.cidade || 'Lajeado'}</div>
        <div style="font-size:0.85em; color:#888; margin-top:5px">
          🕒 ${l.timestamp}
        </div>
      `;
    }
  }
  
  // Stats do dia
  const hojeStr = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hojeStr)).length;
  
  const elStat = document.getElementById('statLeads');
  if (elStat) elStat.innerText = leadsHoje;
}

// --- COMUNICAÇÃO API (SISTEMA ROBUSTO DE RETRY) ---
async function apiCall(action, payload = {}, showLoader = true, suppressAlert = false) {
  // Validação simples
  if (!API_URL || API_URL.includes("SUA_URL")) {
    alert("ERRO DE CONFIGURAÇÃO: Verifique a API_URL no arquivo app.js");
    return null;
  }
  
  if (showLoader) showLoading(true, "Processando...");

  const MAX_RETRIES = 3;
  let attempt = 0;
  
  while (attempt < MAX_RETRIES) {
    try {
      // Timeout controller para evitar travamentos longos (15s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ 
          route: action, 
          payload: payload, 
          token: TOKEN 
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const json = await response.json();
      if (showLoader) showLoading(false);
      
      if (json.status === 'error') throw new Error(json.message);
      return json; // Retorna o objeto completo {status, data}

    } catch (e) {
      attempt++;
      console.warn(`Tentativa ${attempt} falhou:`, e);
      
      if (showLoader) {
        const loaderText = document.getElementById('loaderText');
        if(loaderText) loaderText.innerText = `Reconectando (${attempt}/${MAX_RETRIES})...`;
      }

      if (attempt === MAX_RETRIES) {
        if (showLoader) showLoading(false);
        console.error("Falha final na API:", e);
        
        let msg = "Erro de conexão.";
        if (e.name === 'AbortError') msg = "Tempo limite excedido.";
        if (e.message && e.message.includes('Failed to fetch')) msg = "Sem internet ou bloqueio de rede.";
        
        if (!suppressAlert && !action.startsWith('get')) {
          alert(`Falha: ${msg} Tente novamente.`);
        }
        return null;
      }
      
      // Espera exponencial (1s, 2s, 4s) antes de tentar de novo
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
}

// --- UI HELPERS ---
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
