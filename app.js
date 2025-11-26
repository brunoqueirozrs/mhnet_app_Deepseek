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
async function enviarLead(){
  const payload = {
    route: 'addLead',
    vendedor:  document.getElementById('leadVendedor').value || '',
    nomeLead:  document.getElementById('leadNome').value || '',
    telefone:  document.getElementById('leadTelefone').value || '',
    endereco:  document.getElementById('leadEndereco').value || '',
    cidade:    document.getElementById('leadCidade').value || '',
    bairro:    document.getElementById('leadBairro').value || '',
    observacao:document.getElementById('leadObs').value || '',
    provedor:  document.getElementById('leadProvedor').value || '',
    interesse: document.getElementById('leadInteresse').value || ''
  };

  const res  = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  const json = await res.json();

  if(json.status === 'duplicate'){
    alert('Telefone já cadastrado!');
  } else if(json.status === 'success'){
    alert('Lead salvo!');
    document.getElementById('leadNome').value='';
    document.getElementById('leadTelefone').value='';
  } else {
    alert("Erro: " + json.message);
  }

  carregarLeads();
}

async function carregarLeads(){
  try{
    const res  = await fetch(API + '?route=getLeads');
    const json = await res.json();
    leadsCache = json.data || [];
    renderLeads();
    carregarEstatisticas();
  } catch(e){
    console.error(e);
  }
}

function renderLeads(){
  const q = document.getElementById('searchLead').value.toLowerCase();
  const div = document.getElementById('listaLeads');

  div.innerHTML = '';

  leadsCache
    .filter(l =>
      !q ||
      (l.nomeLead||'').toLowerCase().includes(q) ||
      (l.telefone||'').toLowerCase().includes(q) ||
      (l.provedor||'').toLowerCase().includes(q)
    )
    .forEach(l => {
      const node = document.createElement('div');
      node.className = 'lead-card';
      node.innerHTML = `
        <strong>${l.nomeLead}</strong>
        <div class="muted">${l.vendedor} - ${l.telefone}</div>
        <div>${l.endereco} ${l.bairro}</div>
        <div style="margin-top:8px;color:#0ea5a4">${l.provedor} • Interesse: ${l.interesse}</div>
      `;
      div.appendChild(node);
    });
}

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
