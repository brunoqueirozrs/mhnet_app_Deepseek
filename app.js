/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND (v5.5 - Fix Save)
 * ============================================================
 */

// CONFIGURAÇÃO
const DEPLOY_ID = 'AKfycbyWYgd3r5pA1dYB5LD_PY6m4V2FjWG-Oi6vYjlvNBre9r_eGiPlhia-HtJjD2Mnfc9F'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// ESTADO
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let routeCoords = [];
let watchId = null;
let timerInterval = null;
let seconds = 0;
let routeStartTime = null;

// INIT
document.addEventListener('DOMContentLoaded', () => {
  if (loggedUser) initApp();
  else { showUserMenu(); carregarVendedores(); }
});

function initApp() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('userInfo').textContent = `Vendedor: ${loggedUser}`;
  showPage('dashboard');
  const navHome = document.getElementById('nav-home');
  if(navHome) setActiveNav(navHome);
  carregarLeads(); 
}

// UI LOGIC
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
  document.getElementById('userMenu').style.display = 'flex'; 
  document.getElementById('mainContent').style.display = 'none';
}

function setLoggedUser() {
  const select = document.getElementById('userSelect');
  if (select && select.value) {
    loggedUser = select.value;
    localStorage.setItem('loggedUser', loggedUser);
    initApp();
  } else {
    alert('Selecione um vendedor!');
  }
}

function logout() {
  if(confirm("Sair do sistema?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// VENDEDORES
async function carregarVendedores() {
  const select = document.getElementById('userSelect');
  const listaSeguranca = [{nome: "Elton da Silva Rodrigo Gonçalves"}, {nome: "Ana Paula Rodrigues"}];
  try {
    const res = await apiCall('getVendedores', {}, false, true); 
    renderizarOpcoesVendedores(select, (res && res.status === 'success' && res.data) ? res.data : listaSeguranca);
  } catch (e) {
    renderizarOpcoesVendedores(select, listaSeguranca);
  }
}

function renderizarOpcoesVendedores(selectElement, lista) {
  selectElement.innerHTML = '<option value="">Selecione seu nome...</option>';
  lista.forEach(v => {
    const nome = v.nome || v.Nome || v[0]; 
    if (nome) {
      const opt = document.createElement('option');
      opt.value = nome;
      opt.innerText = nome;
      selectElement.appendChild(opt);
    }
  });
}

// IA GEMINI
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

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if (!nome) return alert("Preencha o nome!");
  showLoading(true, "IA Escrevendo...");
  const txt = await chamarGemini(`Mensagem WhatsApp para ${nome}. Fibra óptica. Tom amigável.`);
  if (txt) document.getElementById('leadObs').value = txt;
  showLoading(false);
}

async function refinarObservacaoIA() {
  const obs = document.getElementById('leadObs').value;
  if (!obs) return;
  showLoading(true, "IA Refinando...");
  const txt = await chamarGemini(`Resuma formalmente para CRM: "${obs}"`);
  if (txt) document.getElementById('leadObs').value = txt.trim();
  showLoading(false);
}

async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Sem leads.");
  showLoading(true, "Analisando...");
  const txt = await chamarGemini(`Dê uma dica estratégica curta baseada nestes bairros: ${leadsCache.slice(0,20).map(l=>l.bairro).join(', ')}`);
  showLoading(false);
  if (txt) alert(`💡 Dica:\n${txt}`);
}

async function gerarCoachIA() {
  showLoading(true, "Coach...");
  const hoje = leadsCache.filter(l => new Date(l.timestamp || l.Data).toLocaleDateString() === new Date().toLocaleDateString()).length;
  const txt = await chamarGemini(`Vendedor fez ${hoje} vendas hoje. Frase motivacional curta.`);
  showLoading(false);
  if(txt) alert(`🚀 Coach:\n${txt}`);
}

// *** FUNÇÃO CRÍTICA: SALVAR LEAD (CORRIGIDA) ***
async function enviarLead() {
  const nome = document.getElementById('leadNome').value;
  const tel = document.getElementById('leadTelefone').value;
  
  if (!nome || !tel) return alert("Preencha Nome e Telefone");
  
  showLoading(true, "Salvando na Planilha...");
  
  // Payload Robusto: Envia variações de chaves para garantir compatibilidade com Google Sheets
  const payload = {
    // Padrão PascalCase (comum em headers)
    "Data": new Date().toLocaleString('pt-BR'),
    "Vendedor": loggedUser,
    "Nome": nome,
    "Telefone": tel,
    "Bairro": document.getElementById('leadBairro').value,
    "Cidade": document.getElementById('leadCidade').value,
    "Interesse": document.getElementById('leadInteresse').value,
    "Observacao": document.getElementById('leadObs').value,
    
    // Padrão camelCase (fallback)
    "vendedor": loggedUser,
    "lead": nome,
    "whatsapp": tel,
    "endereco": document.getElementById('leadEndereco').value,
    "timestamp": new Date().toISOString()
  };
  
  // Log para debug
  console.log("Enviando Payload:", payload);

  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  if (res && res.status === 'success') {
    alert('✅ Lead Salvo com Sucesso!');
    // Limpar campos
    document.getElementById('leadNome').value = '';
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = '';
    document.getElementById('leadObs').value = '';
    document.getElementById('leadBairro').value = '';
    
    carregarLeads(); 
    showPage('gestaoLeads');
  } else {
    console.error("Erro API:", res);
    alert('❌ Erro ao salvar: ' + (res?.message || 'Verifique a conexão.'));
  }
}

// LEADS LISTA
async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) lista.innerHTML = '<div style="text-align:center; padding:20px; color:#666">Atualizando...</div>';

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    leadsCache = (res.data || []).filter(l => {
      const v = (l.Vendedor || l.vendedor || '').toLowerCase();
      return v.includes(loggedUser.toLowerCase());
    });
    renderLeads();
    atualizarDashboard();
  } else {
    if(lista) lista.innerHTML = '<div style="text-align:center; color:red; padding:20px">Erro na lista.</div>';
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => 
    (l.Nome || l.lead || '').toLowerCase().includes(term) || 
    (l.Bairro || l.bairro || '').toLowerCase().includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = '<div style="text-align:center; padding:20px; color:#888">Nenhum lead.</div>';
    return;
  }

  // Ordena pelo mais recente
  filtrados.sort((a,b) => new Date(b.Data || b.timestamp) - new Date(a.Data || a.timestamp));

  div.innerHTML = filtrados.map(l => {
    const nome = l.Nome || l.lead || 'Sem Nome';
    const bairro = l.Bairro || l.bairro || 'Geral';
    const interesse = (l.Interesse || l.interesse || 'Novo').toUpperCase();
    const tel = l.Telefone || l.telefone || '';
    
    let color = '#f0f0f0';
    if(interesse.includes('ALTO')) color = '#d1fae5';
    if(interesse.includes('BAIXO')) color = '#fee2e2';

    return `
    <div class="lead-card-gestao" style="background:white; padding:16px; margin-bottom:12px; border-radius:12px; border:1px solid #edf2f7;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <div style="font-weight:bold; color:#1e3a8a;">${nome}</div>
        <span style="background:${color}; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:bold;">${interesse}</span>
      </div>
      <div style="font-size:0.9rem; color:#64748b;">📍 ${bairro}</div>
      <div style="margin-top:8px; display:flex; justify-content:flex-end;">
         <a href="https://wa.me/55${tel.replace(/\D/g, '')}" target="_blank" class="text-green-500 font-bold text-sm flex items-center gap-1">
           <i class="fab fa-whatsapp"></i> Conversar
         </a>
      </div>
    </div>`;
  }).join('');
}

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString();
  const count = leadsCache.filter(l => new Date(l.Data || l.timestamp).toLocaleDateString() === hoje).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

// ROTA
function startRoute() {
  if (!navigator.geolocation) return alert('Sem GPS.');
  routeCoords = []; seconds = 0; routeStartTime = new Date().toISOString();
  updateRouteUI(true);
  timerInterval = setInterval(() => {
    seconds++;
    const date = new Date(0); date.setSeconds(seconds);
    document.getElementById('timer').innerText = date.toISOString().substr(11, 8);
  }, 1000);
  watchId = navigator.geolocation.watchPosition(p => {
    routeCoords.push({lat: p.coords.latitude, lon: p.coords.longitude});
    document.getElementById('points').innerText = routeCoords.length;
    document.getElementById('gpsStatus').innerText = "✅ Rastreando";
    document.getElementById('gpsStatus').className = "status-badge success";
  }, e => console.error(e), {enableHighAccuracy:true});
}

async function stopRoute() {
  if(!confirm("Finalizar?")) return;
  clearInterval(timerInterval);
  navigator.geolocation.clearWatch(watchId);
  showLoading(true, "Salvando Rota...");
  await apiCall('saveRoute', {vendedor: loggedUser, inicioISO: routeStartTime, fimISO: new Date().toISOString(), coordenadas: routeCoords});
  showLoading(false);
  alert("Rota salva!");
  resetRouteUI();
  showPage('dashboard');
}

function updateRouteUI(on) {
  document.getElementById('btnStart').style.display = on ? 'none' : 'flex';
  document.getElementById('btnStop').style.display = on ? 'flex' : 'none';
}
function resetRouteUI() {
  updateRouteUI(false);
  document.getElementById('timer').innerText = "00:00:00";
  document.getElementById('points').innerText = "0";
  document.getElementById('gpsStatus').innerText = "Aguardando";
}

// API
async function apiCall(route, payload, show=true, suppress=false) {
  if(show) showLoading(true);
  try {
    const res = await fetch(API_URL, {method:'POST', body: JSON.stringify({route, payload, token: TOKEN})});
    const json = await res.json();
    if(show) showLoading(false);
    return json;
  } catch(e) {
    if(show) showLoading(false);
    if(!suppress) alert("Erro conexão.");
    return null;
  }
}

function showLoading(show, txt) {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
  if(txt) document.getElementById('loaderText').innerText = txt;
}