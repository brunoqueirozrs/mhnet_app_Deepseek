/**
 * ============================================================
 * MHNET VENDAS EXTERNAS - FRONTEND LOGIC (v4.0 Final)
 * Conecta com o Backend Google Apps Script
 * ============================================================
 */

// CONFIGURAÇÃO DA API
// NOTA: Usamos o link /exec (App da Web), não o link /library
const DEPLOY_ID = 'AKfycbwkTMJ1Y8Pqv_hk0POHg44ep2SUPY05v_Oy6cDAPnJVW20RBHl58wwFK4-iu7aGbrx7'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";

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
  // Verifica se já existe um usuário logado
  if (loggedUser) {
    initApp();
  } else {
    showUserMenu();
    carregarVendedores(); // Carrega lista para o login
  }
});

function initApp() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  
  // Atualiza nome no topo e rodapé
  const userDisplay = `Vendedor: ${loggedUser}`;
  const elUserInfo = document.getElementById('userInfo');
  const elFooterUser = document.getElementById('footerUser');
  
  if (elUserInfo) elUserInfo.textContent = userDisplay;
  if (elFooterUser) elFooterUser.textContent = loggedUser;

  showPage('dashboard');
  carregarLeads(); // Carrega leads em background para a lista
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

// --- GESTÃO DE USUÁRIO ---
async function carregarVendedores() {
  const select = document.getElementById('userSelect');
  if (!select) return;
  
  select.innerHTML = '<option>Carregando...</option>';
  
  try {
    const res = await apiCall('getVendedores');
    // Fallback se a API falhar ou vier vazia
    const lista = (res && res.data && res.data.length) ? res.data : [
      {nome: "Ana Paula Rodrigues"}, {nome: "Vitoria Caroline"}, 
      {nome: "João Vithor"}, {nome: "João Paulo"}, 
      {nome: "Claudia Maria"}, {nome: "Diulia Vitoria"}, {nome: "Elton da Silva"}
    ];
    
    select.innerHTML = '<option value="">Selecione...</option>';
    lista.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.nome;
      opt.innerText = v.nome;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
    select.innerHTML = '<option value="">Erro ao carregar (Offline)</option>';
    // Adiciona opções offline se necessário
  }
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

// --- ROTA & GPS ---
function startRoute() {
  if (!navigator.geolocation) return alert('GPS não suportado neste dispositivo.');
  
  routeCoords = [];
  seconds = 0;
  routeStartTime = new Date().toISOString();
  
  // Atualiza UI
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
      
      // Atualiza UI com dados reais
      const elPoints = document.getElementById('points');
      const elGps = document.getElementById('gpsStatus');
      
      if (elPoints) elPoints.innerText = routeCoords.length;
      if (elGps) {
        elGps.innerText = "✅ Rastreando";
        elGps.style.background = "#d4edda";
        elGps.style.color = "#155724";
      }
    },
    err => {
      const elGps = document.getElementById('gpsStatus');
      if (elGps) {
        elGps.innerText = "❌ Erro GPS";
        elGps.style.background = "#f8d7da";
        elGps.style.color = "#721c24";
      }
      console.error("Erro GPS:", err);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}

async function stopRoute() {
  if (!confirm("Deseja finalizar a rota e enviar os dados para a central?")) return;
  
  // Para tudo
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
    elGps.style.background = "#eee";
    elGps.style.color = "#666";
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
    nomeLead: nome,
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
    
    carregarLeads(); // Atualiza a lista local
    showPage('gestaoLeads');
  } else {
    alert('Erro ao salvar: ' + (res?.message || 'Tente novamente'));
  }
}

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if (lista && lista.innerHTML === '') lista.innerHTML = '<div style="text-align:center; padding:20px; color:#666">Carregando...</div>';

  const res = await apiCall('getLeads');
  
  if (res && res.status === 'success') {
    leadsCache = res.data;
    renderLeads();
    atualizarDashboard();
  } else {
    if (lista) lista.innerHTML = '<div style="text-align:center; color:red; padding:20px">Erro ao carregar leads. Verifique a conexão.</div>';
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
  
  // Opcional: Atualizar algum contador se existir na UI
}

function atualizarDashboard() {
  // Último lead card
  if (leadsCache.length > 0) {
    const l = leadsCache[0]; // Como o backend retorna reverso, o 0 é o mais recente
    const elContent = document.getElementById('lastLeadContent'); // ID usado no index.html
    const elContentBackup = document.getElementById('lastLeadCardContent');
    
    const html = `
      <div style="font-weight:bold; font-size:1.1em; color:#004AAD">${l.nomeLead}</div>
      <div style="color:#555">${l.bairro || 'Sem bairro'} - ${l.cidade || 'Lajeado'}</div>
      <div style="font-size:0.85em; color:#888; margin-top:5px">
        🕒 ${new Date(l.timestamp).toLocaleString('pt-BR')}
      </div>
    `;
    
    if (elContent) elContent.innerHTML = html;
    if (elContentBackup) elContentBackup.innerHTML = html;
  }
  
  // Stats do dia
  const hoje = new Date();
  const leadsHoje = leadsCache.filter(l => {
    const d = new Date(l.timestamp);
    return d.getDate() === hoje.getDate() && 
           d.getMonth() === hoje.getMonth() && 
           d.getFullYear() === hoje.getFullYear();
  }).length;
  
  const elStat = document.getElementById('statLeads');
  if (elStat) elStat.innerText = leadsHoje;
}

// --- COMUNICAÇÃO API (FETCH) ---
async function apiCall(route, payload = {}) {
  // Validação simples
  if (!API_URL || API_URL.includes("SUA_URL")) {
    alert("ERRO DE CONFIGURAÇÃO: Verifique a API_URL no arquivo app.js");
    return null;
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ 
        route: route, // Compatível com Backend v4.0 (handleRequest)
        payload: payload, 
        token: TOKEN 
      })
    });
    
    const json = await response.json();
    
    if (json.status === 'error') {
      throw new Error(json.message);
    }
    return json; // Retorna o objeto completo {status, data}
    
  } catch (e) {
    console.error("API Error:", e);
    // Tratamento amigável de erro
    if (e.message.includes("Failed to fetch")) {
      alert("Erro de conexão. Verifique se o Google Apps Script está publicado como 'Qualquer Pessoa'.");
    } else {
      alert("Erro no sistema: " + e.message);
    }
    return null;
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
