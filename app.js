// =====================================================
//     FRONTEND PWA - INTEGRAÇÃO COM APPS SCRIPT
// =====================================================

const API = 'https://script.google.com/macros/s/AKfycbwkTMJ1Y8Pqv_hk0POHg44ep2SUPY05v_Oy6cDAPnJVW20RBHl58wwFK4-iu7aGbrx7/exec';

let leadsCache = [];
let routesCache = [];
let vendedoresCache = [];

document.addEventListener('DOMContentLoaded', () => {
  showPage('dashboard');
  carregarVendedores();
  carregarEstatisticas();
});

// =====================================================
// PÁGINAS
// =====================================================
function showPage(id){
  document.querySelectorAll('.page, .dashboard, .actions')
    .forEach(el => el.style.display='none');

  if(id === 'dashboard'){
    document.querySelector('.dashboard').style.display='block';
    document.querySelector('.actions').style.display='block';
  } else {
    const el = document.getElementById(id);
    if(el) el.style.display='block';
  }

  if(id === 'cadLead' || id === 'iniciarRota') carregarVendedores();
  if(id === 'verLeads') carregarLeads();
  if(id === 'minhasRotas') carregarRotas();
}

// =====================================================
//   VENDEDORES
// =====================================================
async function carregarVendedores(){
  try {
    const res = await fetch(API + '?route=getVendedores');
    const json = await res.json();
    vendedoresCache = json.data || [];

    const s1 = document.getElementById('leadVendedor');
    const s2 = document.getElementById('rotaVendedor');

    // limpa selects
    s1.innerHTML = '';
    s2.innerHTML = '';

    vendedoresCache.forEach(v => {
      if(v.status.toLowerCase() === 'ativo'){
        let opt = new Option(v.nome, v.nome);
        s1.add(opt.cloneNode(true));
        s2.add(opt.cloneNode(true));
      }
    });

    renderVendedoresList();

  } catch (e){
    console.error(e);
  }
}

function renderVendedoresList(){
  const div = document.getElementById('listaVend');
  div.innerHTML = '';

  vendedoresCache.forEach(v => {
    const node = document.createElement('div');
    node.className = 'lead-card';

    node.innerHTML = `
      <strong>${v.nome}</strong>
      <div>Status: <b>${v.status}</b></div>
      <button onclick="alterarStatus(${v.id}, '${v.status}')">
        ${v.status === 'Ativo' ? 'Desativar' : 'Ativar'}
      </button>
      <button onclick="excluirVendedor(${v.id})" style="color:red">Excluir</button>
    `;

    div.appendChild(node);
  });
}

async function addNovoVendedor(){
  const nome = document.getElementById('novoVend').value.trim();
  if(!nome) return alert('Digite um nome');

  const res = await fetch(API, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ route:'addVendedor', nome })
  });

  const json = await res.json();

  alert(json.message || 'Vendedor adicionado');
  document.getElementById('novoVend').value = '';
  carregarVendedores();
}

async function alterarStatus(id, statusAtual){
  const novoStatus = statusAtual === 'Ativo' ? 'Inativo' : 'Ativo';

  await fetch(API, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({
      route: 'updateVendedorStatus',
      id,
      status: novoStatus
    })
  });

  alert('Status atualizado!');
  carregarVendedores();
}

async function excluirVendedor(id){
  if(!confirm("Deseja realmente excluir este vendedor?")) return;

  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({
      route: 'deleteVendedor',
      id
    })
  });

  alert('Vendedor removido!');
  carregarVendedores();
}

// =====================================================
//   LEADS
// =====================================================
async function enviarLead(){
  const payload = {
    route: 'addLead',
    vendedor: document.getElementById('leadVendedor').value,
    nomeLead: document.getElementById('leadNome').value,
    telefone: document.getElementById('leadTelefone').value,
    endereco: document.getElementById('leadEndereco').value,
    cidade: document.getElementById('leadCidade').value,
    bairro: document.getElementById('leadBairro').value,
    observacao: document.getElementById('leadObs').value,
    provedor: document.getElementById('leadProvedor').value,
    interesse: document.getElementById('leadInteresse').value
  };

  const res = await fetch(API, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });

  const json = await res.json();

  if(json.status === 'duplicate'){
    alert('Telefone já cadastrado');
  } else if(json.status === 'success'){
    alert('Lead salvo!');
    document.getElementById('leadNome').value='';
    document.getElementById('leadTelefone').value='';
  } else {
    alert(json.message);
  }

  carregarLeads();
}

async function carregarLeads(){
  try {
    const res = await fetch(API + '?route=getLeads');
    const json = await res.json();
    leadsCache = json.data || [];
    renderLeads();
    carregarEstatisticas();
  }catch(e){console.error(e)}
}

function renderLeads(){
  const q = document.getElementById('searchLead').value.toLowerCase();
  const div = document.getElementById('listaLeads');
  div.innerHTML = '';

  const list = leadsCache.filter(l =>
    !q || 
    l.nomeLead.toLowerCase().includes(q) ||
    l.telefone.toLowerCase().includes(q) ||
    l.provedor.toLowerCase().includes(q)
  );

  list.forEach(l => {
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

// =====================================================
//   ROTAS
// =====================================================
let routeActive = false;
let routeCoords = [];
let routeVendor = '';
let routeStart = null;
let watchId = null;

function startRoute(){
  routeVendor = document.getElementById('rotaVendedor').value;
  if(!routeVendor) return alert('Escolha um vendedor');

  routeCoords = [];
  routeStart = new Date().toISOString();
  routeActive = true;

  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;

  document.getElementById('routeInfo').innerText = 'Rota em andamento...';

  if(navigator.geolocation){
    watchId = navigator.geolocation.watchPosition(pos=>{
      routeCoords.push({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        timestamp: Date.now()
      });
    });
  }
}

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

  try{
    const res = await fetch(API, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    await res.json();
    alert('Rota salva!');
    carregarRotas();
  }catch(e){
    alert('Erro ao salvar rota');
    console.error(e);
  }

  document.getElementById('routeInfo').innerText = '';
}

async function carregarRotas(){
  const res = await fetch(API + '?route=getRoutes');
  const json = await res.json();
  routesCache = json.data || [];

  const div = document.getElementById('listaRotas');
  div.innerHTML = '';

  routesCache.forEach(r => {
    const node = document.createElement('div');
    node.className='lead-card';
    node.innerHTML = `
      <strong>Rota ${r.routeId}</strong>
      <div class="muted">${r.vendedor} • ${r.inicio} → ${r.fim}</div>
      <div style="margin-top:8px">
        <a href="${r.kmlUrl}" target="_blank">Baixar KML</a>
      </div>
    `;
    div.appendChild(node);
  });

  carregarEstatisticas();
}

// =====================================================
// ESTATÍSTICAS
// =====================================================
function carregarEstatisticas(){
  document.getElementById('statLeads').innerText = leadsCache.length;
  document.getElementById('statRotas').innerText = routesCache.length;
}
