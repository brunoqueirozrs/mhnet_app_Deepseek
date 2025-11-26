// ==============================
//  FRONTEND PWA – API MHNET
// ==============================
const API = 'https://script.google.com/macros/s/AKfycbwkTMJ1Y8Pqv_hk0POHg44ep2SUPY05v_Oy6cDAPnJVW20RBHl58wwFK4-iu7aGbrx7/exec';

let leadsCache = [];
let routesCache = [];
let vendedoresCache = [];

// ==============================
//  INICIALIZAÇÃO
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  showPage('dashboard');
  carregarVendedores();
  carregarEstatisticas();
});

// ==============================
//  CONTROLE DE PÁGINAS
// ==============================
function showPage(id){
  document.querySelectorAll('.page, .dashboard, .actions').forEach(el => el.style.display = 'none');

  if(id === 'dashboard'){
    document.querySelector('.dashboard').style.display = 'block';
    document.querySelector('.actions').style.display   = 'block';
  } else {
    const el = document.getElementById(id);
    if(el) el.style.display = 'block';
  }

  if(id === 'cadLead' || id === 'iniciarRota') carregarVendedores();
  if(id === 'verLeads') carregarLeads();
  if(id === 'minhasRotas') carregarRotas();
}

// ==============================
//  VENDEDORES
// ==============================
async function carregarVendedores(){
  try {
    const res  = await fetch(API + '?route=getVendedores');
    const json = await res.json();

    vendedoresCache = json.data || [];

    // Preencher campos de seleção
    preencherSelectsVendedores();
    
    // Render lista no painel de configurações
    renderListaVendedores();

  } catch(e){
    console.error("Erro carregar vendedores:", e);
  }
}

function preencherSelectsVendedores(){
  const s1 = document.getElementById('leadVendedor');
  const s2 = document.getElementById('rotaVendedor');

  if(!s1 || !s2) return;

  s1.innerHTML = '';
  s2.innerHTML = '';

  vendedoresCache.forEach(v => {
    if(String(v.status).toLowerCase() === 'ativo'){
      const opt = new Option(v.nome, v.nome);
      s1.add(opt.cloneNode(true));
      s2.add(opt.cloneNode(true));
    }
  });
}

function renderListaVendedores(){
  const div = document.getElementById('listaVend');
  if(!div) return;

  div.innerHTML = '';

  vendedoresCache.forEach(v => {
    const node = document.createElement('div');
    node.className = 'lead-card';

    node.innerHTML = `
      <strong>${v.nome}</strong>
      <div>Status: <b>${v.status}</b></div>

      <button onclick="alterarStatusVendedor(${v.id}, '${v.status}')">
        ${v.status === 'Ativo' ? 'Desativar' : 'Ativar'}
      </button>

      <button style="color:red" onclick="excluirVendedor(${v.id})">
        Excluir
      </button>
    `;

    div.appendChild(node);
  });
}

// ---- CRUD ----
async function addNovoVendedor(){
  const nome = document.getElementById('novoVend').value;
  if(!nome) return alert('Digite um nome');

  const payload = { route:'addVendedor', nome };

  const res  = await fetch(API, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });

  alert("Vendedor adicionado!");
  document.getElementById('novoVend').value = '';
  carregarVendedores();
}

async function alterarStatusVendedor(id, statusAtual){
  const novoStatus = statusAtual === 'Ativo' ? 'Inativo' : 'Ativo';

  const payload = {
    route : 'updateVendedorStatus',
    id    : id,
    status: novoStatus
  };

  await fetch(API, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });

  alert("Status atualizado!");
  carregarVendedores();
}

async function excluirVendedor(id){
  if(!confirm("Deseja realmente excluir este vendedor?")) return;

  const payload = {
    route: 'deleteVendedor',
    id: id
  };

  await fetch(API, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });

  alert("Vendedor removido!");
  carregarVendedores();
}

// ==============================
//  LEADS
// ==============================
// app.js - COM CORS PROXY
const API_BASE = 'AKfycbwkTMJ1Y8Pqv_hk0POHg44ep2SUPY05v_Oy6cDAPnJVW20RBHl58wwFK4-iu7aGbrx7';
const API = `https://corsproxy.io/?https://script.google.com/macros/s/${API_BASE}/exec`;

// Ou use este proxy alternativo:
// const API = `https://api.allorigins.win/raw?url=https://script.google.com/macros/s/${API_BASE}/exec`;

let leadsCache = [];
let routesCache = [];
let vendedoresCache = [];

// ==============================
//  FUNÇÃO DE FETCH COM CORS PROXY
// ==============================
async function apiCall(route, data = null) {
  const url = data ? API : `${API}?route=${route}`;
  
  const options = data ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  } : { method: 'GET' };

  try {
    console.log(`🔄 Chamando API: ${route}`);
    const response = await fetch(url, options);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const result = await response.json();
    console.log(`✅ Resposta ${route}:`, result);
    return result;
    
  } catch (error) {
    console.error(`❌ Erro ${route}:`, error);
    return getFallbackData(route);
  }
}

// ==============================
//  DADOS OFFLINE DE FALLBACK
// ==============================
function getFallbackData(route) {
  switch(route) {
    case 'getVendedores':
      return {
        status: 'success', 
        data: [
          { id: 1, nome: "ANA PAULA RODRIGUES", status: "Ativo" },
          { id: 2, nome: "VITORIA CAROLINE BALDEZ ROSSALES", status: "Ativo" },
          { id: 3, nome: "JOÃO PAULO DA SILVA SANTOS", status: "Ativo" },
          { id: 4, nome: "CLAUDIA MARIA SEMMLER", status: "Ativo" },
          { id: 5, nome: "DIULIA VITÓRIA MACHADO BORGES", status: "Ativo" },
          { id: 6, nome: "ELTON DA SILVA RODRIGO GONÇALVES", status: "Ativo" }
        ]
      };
      
    case 'getLeads':
      return { status: 'success', data: [] };
      
    case 'getRoutes':
      return { status: 'success', data: [] };
      
    default:
      return { status: 'error', message: 'Rota offline' };
  }
}

// ==============================
//  VENDEDORES (ATUALIZADO)
// ==============================
async function carregarVendedores(){
  const json = await apiCall('getVendedores');
  
  if(json.status === 'success'){
    vendedoresCache = json.data || [];
    preencherSelectsVendedores();
    renderListaVendedores();
  }
}

// Mantenha as funções preencherSelectsVendedores e renderListaVendedores como estão

// ==============================
//  LEADS (ATUALIZADO)
// ==============================
async function enviarLead(){
  const payload = {
    route: 'addLead',
    vendedor: document.getElementById('leadVendedor').value || '',
    nomeLead: document.getElementById('leadNome').value || '',
    telefone: document.getElementById('leadTelefone').value || '',
    endereco: document.getElementById('leadEndereco').value || '',
    cidade: document.getElementById('leadCidade').value || '',
    bairro: document.getElementById('leadBairro').value || '',
    observacao: document.getElementById('leadObs').value || '',
    provedor: document.getElementById('leadProvedor').value || '',
    interesse: document.getElementById('leadInteresse').value || ''
  };

  const json = await apiCall('addLead', payload);

  if(json.status === 'duplicate'){
    alert('Telefone já cadastrado!');
  } else if(json.status === 'success'){
    alert('Lead salvo!');
    // Limpa os campos principais
    document.getElementById('leadNome').value = '';
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = '';
    document.getElementById('leadBairro').value = '';
  } else {
    alert("Erro: " + (json.message || 'Tente novamente'));
  }
}

async function carregarLeads(){
  const json = await apiCall('getLeads');
  
  if(json.status === 'success'){
    leadsCache = json.data || [];
    renderLeads();
    carregarEstatisticas();
  }
}

// ==============================
//  ROTAS (ATUALIZADO)
// ==============================
async function stopRoute(){
  if(!routeActive) return;

  routeActive = false;
  if(watchId) navigator.geolocation.clearWatch(watchId);

  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;

  const payload = {
    route: 'saveRoute',
    vendedor: routeVendor,
    inicioISO: routeStart,
    fimISO: new Date().toISOString(),
    coords: routeCoords,
    qtdLeads: 0
  };

  const json = await apiCall('saveRoute', payload);

  if(json.status === 'success'){
    alert("Rota salva!");
    carregarRotas();
  } else {
    alert("Erro ao salvar rota: " + (json.message || ''));
  }

  document.getElementById('routeInfo').innerText = '';
}

async function carregarRotas(){
  const json = await apiCall('getRoutes');
  
  if(json.status === 'success'){
    routesCache = json.data || [];
    renderRotas();
    carregarEstatisticas();
  }
}

function renderRotas(){
  const div = document.getElementById('listaRotas');
  if(!div) return;

  div.innerHTML = '';

  routesCache.forEach(r => {
    const node = document.createElement('div');
    node.className = 'lead-card';
    node.innerHTML = `
      <strong>Rota ${r.routeId || 'N/A'}</strong>
      <div class="muted">${r.vendedor} • ${r.inicio} → ${r.fim}</div>
      ${r.kmlUrl ? `<a style="margin-top:8px; display:block" href="${r.kmlUrl}" target="_blank">Baixar KML</a>` : ''}
    `;
    div.appendChild(node);
  });
}

// ==============================
//  VENDEDORES - CRUD (ATUALIZADO)
// ==============================
async function addNovoVendedor(){
  const nome = document.getElementById('novoVend').value;
  if(!nome) return alert('Digite um nome');

  const payload = { route: 'addVendedor', nome };
  const json = await apiCall('addVendedor', payload);

  if(json.status === 'success'){
    alert("Vendedor adicionado!");
    document.getElementById('novoVend').value = '';
    carregarVendedores();
  } else {
    alert("Erro: " + (json.message || ''));
  }
}

async function alterarStatusVendedor(id, statusAtual){
  const novoStatus = statusAtual === 'Ativo' ? 'Inativo' : 'Ativo';
  const payload = { route: 'updateVendedorStatus', id, status: novoStatus };

  const json = await apiCall('updateVendedorStatus', payload);

  if(json.status === 'success'){
    alert("Status atualizado!");
    carregarVendedores();
  }
}

async function excluirVendedor(id){
  if(!confirm("Deseja realmente excluir este vendedor?")) return;

  const payload = { route: 'deleteVendedor', id };
  const json = await apiCall('deleteVendedor', payload);

  if(json.status === 'success'){
    alert("Vendedor removido!");
    carregarVendedores();
  }
}

// Mantenha o resto do código igual...
// ==============================
//  ROTAS
// ==============================
let routeActive = false;
let routeCoords = [];
let routeVendor = '';
let routeStart = null;
let watchId = null;

function startRoute(){
  routeVendor = document.getElementById('rotaVendedor').value;
  if(!routeVendor) return alert('Escolha um vendedor');

  routeCoords = [];
  routeStart  = new Date().toISOString();
  routeActive = true;

  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled  = false;
  document.getElementById('routeInfo').innerText = 'Rota em andamento...';

  if(navigator.geolocation){
    watchId = navigator.geolocation.watchPosition(pos => {
      routeCoords.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() });
    }, err => console.error(err), { enableHighAccuracy:true, maximumAge:5000, timeout:10000 });
  } else {
    alert("Geolocalização indisponível");
  }
}

async function stopRoute(){
  if(!routeActive) return;

  routeActive = false;
  if(watchId) navigator.geolocation.clearWatch(watchId);

  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled  = true;

  const payload = {
    route: 'saveRoute',
    vendedor: routeVendor,
    inicioISO: routeStart,
    fimISO: new Date().toISOString(),
    coords: routeCoords,
    qtdLeads: 0
  };

  try {
    const res  = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const json = await res.json();

    alert("Rota salva!");
    carregarRotas();

  } catch(e){
    console.error(e);
    alert("Erro ao salvar rota");
  }

  document.getElementById('routeInfo').innerText = '';
}

async function carregarRotas(){
  try{
    const res  = await fetch(API + '?route=getRoutes');
    const json = await res.json();

    routesCache = json.data || [];

    const div = document.getElementById('listaRotas');
    div.innerHTML = '';

    routesCache.forEach(r => {
      const node = document.createElement('div');
      node.className = 'lead-card';

      node.innerHTML = `
        <strong>Rota ${r.routeId}</strong>
        <div class="muted">${r.vendedor} • ${r.inicio} → ${r.fim}</div>
        <a style="margin-top:8px; display:block" href="${r.kmlUrl}" target="_blank">Baixar KML</a>
      `;

      div.appendChild(node);
    });

    carregarEstatisticas();

  } catch(e){
    console.error(e);
  }
}

// ==============================
//  ESTATÍSTICAS
// ==============================
function carregarEstatisticas(){
  document.getElementById('statLeads').innerText = leadsCache.length || 0;
  document.getElementById('statRotas').innerText = routesCache.length || 0;
}


// app.js - VERSÃO COM JSONP
const API = 'https://script.google.com/macros/s/AKfycbwkTMJ1Y8Pqv_hk0POHg44ep2SUPY05v_Oy6cDAPnJVW20RBHl58wwFK4-iu7aGbrx7/exec';

// Função JSONP para contornar CORS
function jsonpFetch(route, data = null) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
    
    // Cria script element
    const script = document.createElement('script');
    
    if (data) {
      // POST request - usa form
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = API + '?callback=' + callbackName + '&route=' + route;
      
      const input = document.createElement('input');
      input.name = 'data';
      input.value = JSON.stringify(data);
      form.appendChild(input);
      
      window[callbackName] = function(response) {
        delete window[callbackName];
        document.body.removeChild(form);
        resolve(response);
      };
      
      document.body.appendChild(form);
      form.submit();
      
    } else {
      // GET request
      script.src = API + '?callback=' + callbackName + '&route=' + route;
      
      window[callbackName] = function(response) {
        delete window[callbackName];
        document.body.removeChild(script);
        resolve(response);
      };
      
      script.onerror = function() {
        delete window[callbackName];
        document.body.removeChild(script);
        reject(new Error('JSONP request failed'));
      };
      
      document.body.appendChild(script);
    }
  });
}

// ATUALIZE AS FUNÇÕES EXISTENTES:

async function carregarVendedores(){
  try {
    console.log('🔄 Carregando vendedores via JSONP...');
    const json = await jsonpFetch('getVendedores');
    
    if(json.status === 'success'){
      vendedoresCache = json.data || [];
      preencherSelectsVendedores();
      renderListaVendedores();
      console.log('✅ Vendedores carregados:', vendedoresCache.length);
    } else {
      console.error('❌ Erro no backend:', json.message);
      // Fallback para dados de exemplo
      vendedoresCache = [
        { id: 1, nome: "ANA PAULA RODRIGUES", status: "Ativo" },
        { id: 2, nome: "VITORIA CAROLINE", status: "Ativo" }
      ];
      preencherSelectsVendedores();
    }
  } catch(e){
    console.error("Erro carregar vendedores:", e);
    // Fallback offline
    vendedoresCache = [
      { id: 1, nome: "ANA PAULA RODRIGUES", status: "Ativo" },
      { id: 2, nome: "VITORIA CAROLINE", status: "Ativo" }
    ];
    preencherSelectsVendedores();
  }
}

// Atualize a função enviarLead
async function enviarLead(){
  const payload = {
    route: 'addLead',
    vendedor: document.getElementById('leadVendedor').value || '',
    nomeLead: document.getElementById('leadNome').value || '',
    telefone: document.getElementById('leadTelefone').value || '',
    endereco: document.getElementById('leadEndereco').value || '',
    cidade: document.getElementById('leadCidade').value || '',
    bairro: document.getElementById('leadBairro').value || '',
    observacao: document.getElementById('leadObs').value || '',
    provedor: document.getElementById('leadProvedor').value || '',
    interesse: document.getElementById('leadInteresse').value || ''
  };

  try {
    const json = await jsonpFetch('addLead', payload);
    
    if(json.status === 'duplicate'){
      alert('Telefone já cadastrado!');
    } else if(json.status === 'success'){
      alert('Lead salvo!');
      // Limpa formulário
      document.getElementById('leadNome').value = '';
      document.getElementById('leadTelefone').value = '';
      document.getElementById('leadEndereco').value = '';
      document.getElementById('leadBairro').value = '';
      document.getElementById('leadObs').value = '';
      document.getElementById('leadProvedor').value = '';
    } else {
      alert("Erro: " + json.message);
    }
  } catch(e) {
    console.error('Erro ao enviar lead:', e);
    alert('Erro de conexão. Tente novamente.');
  }
}

// Atualize as outras funções similarmente...
