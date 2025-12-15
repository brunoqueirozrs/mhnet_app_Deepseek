/**
 * ============================================================
 * MHNET VENDAS EXTERNAS - FRONTEND LOGIC (v5.3 - Fix Data Logic)
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
  console.log("🚀 App v5.3 Iniciado");
  if (API_URL.includes("COLE_SUA")) return alert("Configure a API_URL!");

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
  
  if (userInfo) userInfo.textContent = `Vendedor: ${loggedUser}`;

  showPage('dashboard');
  
  // Atualiza o estado da barra de navegação
  const navHome = document.getElementById('nav-home');
  if(navHome) setActiveNav(navHome); // Chama a função definida no HTML (via escopo global)

  carregarLeads(); 
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

// --- GESTÃO DE USUÁRIO ---
async function carregarVendedores() {
  const select = document.getElementById('userSelect');
  if (!select) return;
  
  const listaSeguranca = [
    {nome: "Elton da Silva Rodrigo Gonçalves"},
    {nome: "Ana Paula Rodrigues"}, 
    {nome: "Vitoria Caroline Baldez Rosales"}, 
    {nome: "João Vithor Sader"}, 
    {nome: "João Paulo da Silva Santos"}, 
    {nome: "Claudia Maria Semmler"}, 
    {nome: "Diulia Vitoria Machado Borges"}
  ];

  try {
    const res = await apiCall('getVendedores', {}, false, true); 
    if (res && res.status === 'success' && res.data) {
      renderizarOpcoesVendedores(select, res.data);
    } else {
      renderizarOpcoesVendedores(select, listaSeguranca);
    }
  } catch (e) {
    console.warn("Erro vendedores:", e);
    renderizarOpcoesVendedores(select, listaSeguranca);
  }
}

function renderizarOpcoesVendedores(selectElement, lista) {
  selectElement.innerHTML = '<option value="">Selecione seu nome...</option>';
  lista.forEach(v => {
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
    alert('Por favor, selecione um vendedor!');
  }
}

function logout() {
  if(confirm("Deseja sair?")) {
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
  if (!nome) return alert("Preencha o nome!");
  showLoading(true, "✨ IA Trabalhando...");
  const txt = await chamarGemini(`Mensagem WhatsApp curta para ${nome}, bairro ${bairro}, interesse ${interesse}. MHNET. Tom amigável.`);
  if (txt) document.getElementById('leadObs').value = txt;
  showLoading(false);
}

async function refinarObservacaoIA() {
  const obsField = document.getElementById('leadObs');
  if (!obsField.value) return alert("Escreva algo...");
  showLoading(true, "✨ Refinando...");
  const txt = await chamarGemini(`Reescreva profissionalmente para CRM: "${obsField.value}"`);
  if (txt) obsField.value = txt.trim();
  showLoading(false);
}

async function analisarCarteiraIA() {
  if (leadsCache.length === 0) return alert("Sem leads.");
  showLoading(true, "✨ Analisando...");
  const resumo = leadsCache.slice(0, 30).map(l => `${l.bairro} (${l.interesse})`).join(", ");
  const txt = await chamarGemini(`Estratégia curta para estes leads: ${resumo}`);
  showLoading(false);
  if (txt) alert(`🤖 Estratégia:\n\n${txt}`);
}

async function gerarCoachIA() {
  showLoading(true, "✨ Coach...");
  const hoje = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => new Date(l.timestamp).toLocaleDateString('pt-BR') === hoje).length;
  const txt = await chamarGemini(`Vendedor ${loggedUser} fez ${leadsHoje} leads hoje. Dê feedback curto.`);
  if(txt) alert(`🤖 Coach:\n\n${txt}`);
  showLoading(false);
}

// --- ROTA & GPS ---
function startRoute() {
  if (!navigator.geolocation) return alert('GPS indisponível.');
  routeCoords = [];
  seconds = 0;
  routeStartTime = new Date().toISOString();
  updateRouteUI(true);
  
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    seconds++;
    const h = Math.floor(seconds / 3600).toString().padStart(2,'0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2,'0');
    const s = (seconds % 60).toString().padStart(2,'0');
    const el = document.getElementById('timer');
    if (el) el.innerText = `${h}:${m}:${s}`;
  }, 1000);

  watchId = navigator.geolocation.watchPosition(
    pos => {
      routeCoords.push({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      document.getElementById('points').innerText = routeCoords.length;
      const el = document.getElementById('gpsStatus');
      if (el) { el.innerText = "✅ Rastreando"; el.className = "status-badge success"; }
    },
    err => {
      console.error("Erro GPS:", err);
      const el = document.getElementById('gpsStatus');
      if (el) { el.innerText = "❌ Erro GPS"; el.className = "status-badge error"; }
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
  );
}

async function stopRoute() {
  if (!confirm("Finalizar rota?")) return;
  clearInterval(timerInterval);
  if (watchId) navigator.geolocation.clearWatch(watchId);
  showLoading(true, "Enviando...");
  const res = await apiCall('saveRoute', { vendedor: loggedUser, inicioISO: routeStartTime, fimISO: new Date().toISOString(), coordenadas: routeCoords });
  showLoading(false);
  if (res && res.status === 'success') {
    alert('Rota salva!');
    resetRouteUI();
    showPage('dashboard');
  } else {
    alert('Erro ao salvar.');
  }
}

function updateRouteUI(isTracking) {
  document.getElementById('btnStart').style.display = isTracking ? 'none' : 'flex';
  document.getElementById('btnStop').style.display = isTracking ? 'flex' : 'none';
}

function resetRouteUI() {
  updateRouteUI(false);
  document.getElementById('gpsStatus').innerText = "Aguardando";
  document.getElementById('timer').innerText = "00:00:00";
  document.getElementById('points').innerText = "0";
  routeCoords = [];
  seconds = 0;
}

// --- LEADS & MATCHING LOGIC (CORRIGIDA) ---
function normalizeData(data) {
  if (!Array.isArray(data)) return [];
  return data.map(item => {
    const newItem = {};
    for (const key in item) {
      // Remove espaços, acentos e põe minúsculo
      const cleanKey = key.toLowerCase().trim().replace(/\s+/g, '');
      newItem[cleanKey] = item[key];
    }
    return newItem;
  });
}

async function enviarLead() {
  const nome = document.getElementById('leadNome').value;
  const tel = document.getElementById('leadTelefone').value;
  if (!nome || !tel) return alert("Preencha Nome e Telefone");
  
  showLoading(true, "Salvando...");
  const res = await apiCall('addLead', {
    vendedor: loggedUser, lead: nome, nomeLead: nome, telefone: tel, whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value,
    bairro: document.getElementById('leadBairro').value,
    cidade: document.getElementById('leadCidade').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value,
    data: new Date().toISOString()
  });
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
    alert('Erro: ' + (res?.message || 'Erro desconhecido'));
  }
}

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if (lista) lista.innerHTML = '<div style="text-align:center; padding:20px; color:#666">Buscando dados...</div>';

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    const dadosBrutos = res.data || [];
    console.log(`📥 Total Leads Recebidos: ${dadosBrutos.length}`);
    
    // Debug: Mostra as chaves do primeiro item para sabermos como filtrar
    if (dadosBrutos.length > 0) {
      console.log("🔑 Chaves disponíveis:", Object.keys(dadosBrutos[0]));
    }

    const dadosNormalizados = normalizeData(dadosBrutos);
    
    // Filtro mais permissivo
    leadsCache = dadosNormalizados.filter(l => {
      // Tenta achar a coluna de vendedor em várias possibilidades
      const vend = (l.vendedor || l.nomevendedor || l.emailaddress || l.carimbodedatahora || '').toString().toLowerCase();
      const user = loggedUser.toLowerCase();
      
      // Se o user for "Elton", dá match em "Elton da Silva" e vice-versa
      return vend.includes(user) || user.includes(vend);
    });

    console.log(`✅ Leads filtrados para ${loggedUser}: ${leadsCache.length}`);
    renderLeads();
    atualizarDashboard();
  } else {
    if (lista) lista.innerHTML = '<div style="text-align:center; color:red; padding:20px">Erro ao baixar leads.</div>';
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;

  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => {
    const nome = (l.nomelead || l.lead || l.nome || '').toString().toLowerCase();
    const bairro = (l.bairro || '').toString().toLowerCase();
    return (nome.includes(term) || bairro.includes(term));
  });
  
  if (filtrados.length === 0) {
    div.innerHTML = '<div style="text-align:center; padding:20px; color:#888">Nenhum lead encontrado.</div>';
    return;
  }

  // Ordena
  filtrados.sort((a, b) => {
    const da = new Date(a.timestamp || a.carimbodedatahora || a.data || 0);
    const db = new Date(b.timestamp || b.carimbodedatahora || b.data || 0);
    return db - da;
  });

  div.innerHTML = filtrados.map(l => {
    const nome = l.nomelead || l.lead || l.nome || 'Sem Nome';
    const tel = l.telefone || l.whatsapp || '';
    const bairro = l.bairro || 'Geral';
    const interesse = (l.interesse || 'Novo').toUpperCase();
    const rawDate = l.timestamp || l.carimbodedatahora || l.data || new Date().toISOString();
    
    let color = '#f0f0f0';
    if(interesse.includes('ALTO')) color = '#e6fffa'; 
    else if(interesse.includes('BAIXO')) color = '#fff5f5';

    return `
    <div class="lead-card-gestao" style="background:white; padding:16px; margin-bottom:12px; border-radius:12px; border:1px solid #edf2f7; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
        <div>
          <div style="font-weight:bold; color:#2d3748;">${nome}</div>
          <div style="font-size:0.85em; color:#718096">📅 ${new Date(rawDate).toLocaleDateString('pt-BR')}</div>
        </div>
        <span style="background:${color}; padding:4px 8px; border-radius:20px; font-size:0.75em; font-weight:800;">${interesse}</span>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:0.95em; color:#4a5568;">📍 ${bairro}</div>
        <a href="https://wa.me/55${tel.replace(/\D/g, '')}" target="_blank" style="background:#25D366; width:40px; height:40px; border-radius:50%; display:flex; items-center; justify-center; box-shadow:0 2px 5px rgba(0,0,0,0.2);">
          <i class="fab fa-whatsapp text-white text-lg" style="margin:auto"></i>
        </a>
      </div>
    </div>`;
  }).join('');
}

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const count = leadsCache.filter(l => {
    const d = l.timestamp || l.carimbodedatahora || l.data || new Date().toISOString();
    return new Date(d).toLocaleDateString('pt-BR') === hoje;
  }).length;
  
  const el = document.getElementById('statLeads');
  if(el) el.innerText = count;

  if (leadsCache.length > 0) {
    const l = leadsCache[0];
    const elContent = document.getElementById('lastLeadContent');
    if (elContent) {
      elContent.innerHTML = `
        <div style="font-weight:bold; color:#004AAD;">${l.nomelead || l.lead || 'Lead'}</div>
        <div style="color:#555; font-size:0.9em">📍 ${l.bairro || 'Geral'}</div>
        <div style="font-size:0.8em; color:#888; margin-top:5px;">🕒 ${new Date(l.timestamp || l.carimbodedatahora || new Date()).toLocaleString('pt-BR')}</div>
      `;
    }
  }
}

async function apiCall(action, payload = {}, showLoader = true, suppressAlert = false) {
  if (showLoader) showLoading(true);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ route: action, payload, token: TOKEN })
    });
    const json = await res.json();
    if (showLoader) showLoading(false);
    return json;
  } catch (e) {
    if (showLoader) showLoading(false);
    if (!suppressAlert) console.error("API Error:", e);
    return null;
  }
}

function showLoading(show, text) {
  const el = document.getElementById('loader');
  if (el) el.style.display = show ? 'flex' : 'none';
  const txt = document.getElementById('loaderText');
  if (txt && text) txt.innerText = text;
}