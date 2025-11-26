// URL do Apps Script
const API = 'https://script.google.com/macros/s/AKfycbwkTMJ1Y8Pqv_hk0POHg44ep2SUPY05v_Oy6cDAPnJVW20RBHl58wwFK4-iu7aGbrx7/exec';

let leadsCache = [];
let routesCache = [];
let vendedoresCache = [];

/******************************
 * INICIALIZAÇÃO
 ******************************/
document.addEventListener('DOMContentLoaded', () => {
  showPage('dashboard');
  carregarVendedores();
  carregarEstatisticas();
});

/******************************
 * NAVEGAÇÃO ENTRE PÁGINAS
 ******************************/
function showPage(id) {
  document.querySelectorAll('.page, .dashboard, .actions').forEach(el => el.style.display = 'none');

  if (id === 'dashboard') {
    document.querySelector('.dashboard').style.display = 'block';
    document.querySelector('.actions').style.display = 'block';
  } else {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  }

  if (id === 'cadLead' || id === 'iniciarRota') carregarVendedores();
  if (id === 'verLeads') carregarLeads();
  if (id === 'minhasRotas') carregarRotas();
  if (id === 'configVendedores') carregarListaConfiguracao();
}

/******************************
 * VENDEDORES
 ******************************/
async function carregarVendedores() {
  try {
    const res = await fetch(API + '?route=getVendedores');
    const json = await res.json();

    vendedoresCache = json.data || [];

    const s1 = document.getElementById('leadVendedor');
    const s2 = document.getElementById('rotaVendedor');

    if (s1) s1.innerHTML = '';
    if (s2) s2.innerHTML = '';

    vendedoresCache.forEach(v => {
      if (v.status === 'Ativo') {
        const opt = new Option(v.nome, v.nome);
        if (s1) s1.add(opt.cloneNode(true));
        if (s2) s2.add(opt.cloneNode(true));
      }
    });

    carregarListaConfiguracao();
  } catch (e) {
    console.error(e);
  }
}

function carregarListaConfiguracao() {
  const div = document.getElementById('listaVend');
  if (!div) return;

  div.innerHTML = '';

  vendedoresCache.forEach(v => {
    const card = document.createElement('div');
    card.className = 'lead-card';

    card.innerHTML = `
      <strong>${v.nome}</strong>
      <div>Status: <b style="color:${v.status === 'Ativo' ? 'green' : 'red'}">${v.status}</b></div>

      <button onclick="alterarStatus(${v.id}, '${v.status}')"
        style="margin-top:8px; background:#0ea5a4; color:white; border:none; padding:6px 12px; border-radius:6px;">
        ${v.status === 'Ativo' ? 'Desativar' : 'Ativar'}
      </button>

      <button onclick="excluirVendedor(${v.id})"
        style="margin-top:8px; background:#d93535; color:white; border:none; padding:6px 12px; border-radius:6px;">
        Excluir
      </button>
    `;

    div.appendChild(card);
  });
}

async function addNovoVendedor() {
  const nome = document.getElementById('novoVend').value.trim();
  if (!nome) return alert('Digite um nome');

  const payload = { route: 'addVendedor', nome };

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  alert("Vendedor adicionado!");
  carregarVendedores();
}

async function alterarStatus(id, statusAtual) {
  const novoStatus = statusAtual === 'Ativo' ? 'Inativo' : 'Ativo';

  const payload = {
    route: "updateVendedorStatus",
    id,
    status: novoStatus
  };

  await fetch(API, {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  alert("Status alterado!");
  carregarVendedores();
}

async function excluirVendedor(id) {
  if (!confirm('Tem certeza que deseja remover?')) return;

  const payload = {
    route: "deleteVendedor",
    id
  };

  await fetch(API, {
    method: "POST",
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  alert("Vendedor excluído!");
  carregarVendedores();
}

/******************************
 * LEADS
 ******************************/
async function enviarLead() {
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

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const json = await res.json();

  if (json.status === 'duplicate') {
    alert('Telefone já cadastrado');
  } else if (json.status === 'success') {
    alert('Lead salvo!');
    document.getElementById('leadNome').value = '';
    document.getElementById('leadTelefone').value = '';
  } else {
    alert(json.message || 'Erro');
  }

  carregarLeads();
}

async function carregarLeads() {
  try {
    const res = await fetch(API + '?route=getLeads');
    const json = await res.json();

    leadsCache = json.data || [];
    renderLeads();
    carregarEstatisticas();
  } catch (e) {
    console.error(e);
  }
}

function renderLeads() {
  const q = document.getElementById('searchLead').value.toLowerCase();
  const div = document.getElementById('listaLeads');

  div.innerHTML = '';

  const list = leadsCache.filter(l =>
    !q ||
    l.nomeLead.toLowerCase().includes(q) ||
    (l.telefone || '').toLowerCase().includes(q) ||
    (l.provedor || '').toLowerCase().includes(q)
  );

  list.forEach(l => {
    const card = document.createElement('div');
    card.className = 'lead-card';

    card.innerHTML = `
      <strong>${l.nomeLead}</strong>
      <div class="muted">${l.vendedor} - ${l.telefone}</div>
      <div>${l.endereco} - ${l.bairro}</div>
      <div style="margin-top:8px;color:#0ea5a4">${l.provedor} • Interesse: ${l.interesse}</div>
    `;

    div.appendChild(card);
  });
}

/******************************
 * ROTAS
 ******************************/
let routeActive = false;
let routeCoords = [];
let routeVendor = '';
let routeStart = null;
let watchId = null;

function startRoute() {
  routeVendor = document.getElementById('rotaVendedor').value;
  if (!routeVendor) return alert('Escolha um vendedor');

  routeCoords = [];
  routeStart = new Date().toISOString();
  routeActive = true;

  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
  document.getElementById('routeInfo').innerText = 'Rota em andamento...';

  watchId = navigator.geolocation.watchPosition(
    pos => routeCoords.push({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() }),
    err => console.error(err),
    { enableHighAccuracy: true }
  );
}

async function stopRoute() {
  if (!routeActive) return;

  routeActive = false;

  if (watchId) navigator.geolocation.clearWatch(watchId);

  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
  document.getElementById('routeInfo').innerText = 'Enviando rota...';

  const payload = {
    route: 'saveRoute',
    vendedor: routeVendor,
    inicioISO: routeStart,
    fimISO: new Date().toISOString(),
    coords: routeCoords
  };

  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  alert('Rota salva!');
  document.getElementById('routeInfo').innerText = '';
  carregarRotas();
}

async function carregarRotas() {
  try {
    const res = await fetch(API + '?route=getRoutes');
    const json = await res.json();
    routesCache = json.data || [];

    const div = document.getElementById('listaRotas');
    div.innerHTML = '';

    routesCache.forEach(r => {
      const node = document.createElement('div');
      node.className = 'lead-card';

      node.innerHTML = `
        <strong>${r.routeId}</strong>
        <div class="muted">${r.vendedor} • ${r.inicio} → ${r.fim}</div>
        <a href="${r.kmlUrl}" target="_blank" style="color:#0ea5a4;margin-top:6px;display:block">Baixar KML</a>
      `;

      div.appendChild(node);
    });

    carregarEstatisticas();
  } catch (e) {
    console.error(e);
  }
}

/******************************
 * ESTATÍSTICAS
 ******************************/
function carregarEstatisticas() {
  if (document.getElementById('statLeads'))
    document.getElementById('statLeads').innerText = leadsCache.length;

  if (document.getElementById('statRotas'))
    document.getElementById('statRotas').innerText = routesCache.length;
}
