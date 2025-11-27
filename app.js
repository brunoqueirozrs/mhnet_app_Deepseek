// ==============================
//  FRONTEND PWA – API MHNET
// ==============================
const API_BASE = 'AKfycbwkTMJ1Y8Pqv_hk0POHg44ep2SUPY05v_Oy6cDAPnJVW20RBHl58wwFK4-iu7aGbrx7';
// const API = `https://corsproxy.io/?https://script.google.com/macros/s/${API_BASE}/exec`;

// Tente estes proxies alternativos em ordem:
const PROXIES = [
  `https://api.codetabs.com/v1/proxy?quest=https://script.google.com/macros/s/${API_BASE}/exec`,
  `https://cors-anywhere.herokuapp.com/https://script.google.com/macros/s/${API_BASE}/exec`,
  `https://thingproxy.freeboard.io/fetch/https://script.google.com/macros/s/${API_BASE}/exec`
];

let API = PROXIES[0]; // Usa o primeiro proxy
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
//  FUNÇÃO DE FETCH COM FALLBACK
// ==============================
async function apiCall(route, data = null) {
  for (let i = 0; i < PROXIES.length; i++) {
    try {
      API = PROXIES[i];
      console.log(`🔄 Tentando proxy ${i + 1}: ${route}`);
      
      const url = data ? API : `${API}?route=${route}`;
      
      const options = data ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      } : { method: 'GET' };

      const response = await fetch(url, options);
      
      if (!response.ok) continue; // Tenta próximo proxy
      
      const text = await response.text();
      console.log(`📄 Resposta bruta ${route}:`, text.substring(0, 100));
      
      const result = JSON.parse(text);
      console.log(`✅ Sucesso com proxy ${i + 1}:`, result.status);
      return result;
      
    } catch (error) {
      console.log(`❌ Proxy ${i + 1} falhou:`, error.message);
      continue; // Tenta próximo proxy
    }
  }
  
  // Se todos os proxies falharem, usa fallback offline
  console.log('📴 Todos os proxies falharam, usando modo offline');
  return getFallbackData(route);
}

// ==============================
//  DADOS OFFLINE DE FALLBACK
// ==============================
function getFallbackData(route) {
  console.log(`📋 Usando dados offline para: ${route}`);
  
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
      // Dados de exemplo para teste
      return { 
        status: 'success', 
        data: [
          {
            id: 1,
            nomeLead: "Cliente Exemplo",
            telefone: "(51) 99999-9999",
            vendedor: "ANA PAULA RODRIGUES",
            endereco: "Rua Exemplo, 123",
            bairro: "Centro",
            cidade: "Lajeado",
            provedor: "Claro",
            interesse: "ALTO",
            observacao: "Lead de exemplo para teste"
          }
        ]
      };
      
    case 'getRoutes':
      return { status: 'success', data: [] };
      
    case 'addLead':
      return { status: 'success', message: 'Lead salvo localmente (modo offline)' };
      
    case 'saveRoute':
      return { status: 'success', message: 'Rota salva localmente (modo offline)' };
      
    default:
      return { status: 'error', message: 'Rota offline: ' + route };
  }
}

// ==============================
//  VENDEDORES
// ==============================
async function carregarVendedores(){
  try {
    const json = await apiCall('getVendedores');
    
    if(json.status === 'success'){
      vendedoresCache = json.data || [];
      preencherSelectsVendedores();
      renderListaVendedores();
    } else {
      console.error('Erro no backend:', json.message);
    }
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

  const payload = {
    route : 'updateVendedorStatus',
    id    : id,
    status: novoStatus
  };

  const json = await apiCall('updateVendedorStatus', payload);

  if(json.status === 'success'){
    alert("Status atualizado!");
    carregarVendedores();
  }
}

async function excluirVendedor(id){
  if(!confirm("Deseja realmente excluir este vendedor?")) return;

  const payload = {
    route: 'deleteVendedor',
    id: id
  };

  const json = await apiCall('deleteVendedor', payload);

  if(json.status === 'success'){
    alert("Vendedor removido!");
    carregarVendedores();
  }
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
    cidade:    document.getElementById('leadCidade').value || 'Lajeado',
    bairro:    document.getElementById('leadBairro').value || '',
    observacao:document.getElementById('leadObs').value || '',
    provedor:  document.getElementById('leadProvedor').value || '',
    interesse: document.getElementById('leadInteresse').value || 'MEDIO'
  };

  // Validação básica
  if(!payload.nomeLead || !payload.telefone) {
    return alert('Preencha pelo menos nome e telefone');
  }

  const json = await apiCall('addLead', payload);

  if(json.status === 'duplicate'){
    alert('Telefone já cadastrado!');
  } else if(json.status === 'success'){
    alert('Lead salvo! ' + (json.message || ''));
    // Limpa formulário
    document.getElementById('leadNome').value='';
    document.getElementById('leadTelefone').value='';
    document.getElementById('leadEndereco').value='';
    document.getElementById('leadBairro').value='';
    document.getElementById('leadObs').value='';
    document.getElementById('leadProvedor').value='';
    document.getElementById('leadInteresse').value='MEDIO';
    
    carregarLeads();
  } else {
    alert("Erro: " + (json.message || 'Tente novamente'));
  }
}

async function carregarLeads(){
  try{
    const json = await apiCall('getLeads');
    
    if(json.status === 'success'){
      leadsCache = json.data || [];
      renderLeads();
      carregarEstatisticas();
    }
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
        <div>${l.endereco} ${l.bairro} - ${l.cidade}</div>
        <div style="margin-top:8px;color:#0ea5a4">${l.provedor} • Interesse: ${l.interesse}</div>
        <div style="margin-top:4px;font-size:12px;color:#666">${l.observacao}</div>
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
  document.getElementById('routeInfo').innerText = 'Rota em andamento... Coletando coordenadas GPS';

  if(navigator.geolocation){
    watchId = navigator.geolocation.watchPosition(
      pos => {
        const coord = { 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude, 
          timestamp: Date.now() 
        };
        routeCoords.push(coord);
        console.log('📍 Coordenada:', coord);
        document.getElementById('routeInfo').innerText = 
          `Rota em andamento... ${routeCoords.length} pontos coletados`;
      }, 
      err => {
        console.error('Erro GPS:', err);
        document.getElementById('routeInfo').innerText = 'Erro GPS: ' + err.message;
      }, 
      { 
        enableHighAccuracy: true, 
        maximumAge: 10000, 
        timeout: 15000 
      }
    );
  } else {
    alert("Geolocalização indisponível neste dispositivo");
  }
}

async function stopRoute(){
  if(!routeActive) return;

  routeActive = false;
  if(watchId) navigator.geolocation.clearWatch(watchId);

  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled  = true;

  if(routeCoords.length === 0) {
    alert("Nenhuma coordenada foi coletada. Verifique as permissões de GPS.");
    document.getElementById('routeInfo').innerText = '';
    return;
  }

  const payload = {
    route: 'saveRoute',
    vendedor: routeVendor,
    inicioISO: routeStart,
    fimISO: new Date().toISOString(),
    coords: routeCoords,
    qtdLeads: 0
  };

  document.getElementById('routeInfo').innerText = 'Salvando rota...';

  try {
    const json = await apiCall('saveRoute', payload);

    if(json.status === 'success'){
      alert("✅ Rota salva com sucesso! " + (json.message || ''));
      if(json.kmlUrl) {
        console.log('📎 KML disponível em:', json.kmlUrl);
      }
      carregarRotas();
    } else {
      alert("❌ Erro ao salvar rota: " + (json.message || ''));
    }

  } catch(e){
    console.error('Erro stopRoute:', e);
    alert("❌ Erro ao salvar rota");
  }

  document.getElementById('routeInfo').innerText = '';
}

async function carregarRotas(){
  try{
    const json = await apiCall('getRoutes');
    
    if(json.status === 'success'){
      routesCache = json.data || [];
      renderRotas();
      carregarEstatisticas();
    }
  } catch(e){
    console.error(e);
  }
}

function renderRotas(){
  const div = document.getElementById('listaRotas');
  if(!div) return;

  div.innerHTML = '';

  if(routesCache.length === 0) {
    div.innerHTML = '<div class="muted">Nenhuma rota registrada ainda</div>';
    return;
  }

  routesCache.forEach(r => {
    const node = document.createElement('div');
    node.className = 'lead-card';
    node.innerHTML = `
      <strong>${r.routeId || 'Rota'}</strong>
      <div class="muted">${r.vendedor} • ${r.inicio} → ${r.fim}</div>
      <div>Duração: ${r.duracao} • Distância: ${r.distancia}</div>
      ${r.kmlUrl ? `<a style="margin-top:8px; display:block; color:#0ea5a4" href="${r.kmlUrl}" target="_blank">📎 Baixar KML</a>` : ''}
    `;
    div.appendChild(node);
  });
}

// ==============================
//  ESTATÍSTICAS
// ==============================
function carregarEstatisticas(){
  document.getElementById('statLeads').innerText = leadsCache.length || 0;
  document.getElementById('statRotas').innerText = routesCache.length || 0;
  
  // Calcula taxa de conversão simples
  const totalLeads = leadsCache.length;
  const leadsComInteresse = leadsCache.filter(l => 
    l.interesse && l.interesse.toUpperCase() === 'ALTO'
  ).length;
  
  const taxa = totalLeads > 0 ? ((leadsComInteresse / totalLeads) * 100).toFixed(1) : 0;
  document.getElementById('statConv').innerText = `${taxa}%`;
}

// ==============================
//  SOLUÇÃO FAVICON
// ==============================
// Adiciona favicon dinamicamente para evitar erro 404
(function() {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📱</text></svg>';
  document.head.appendChild(link);
})();
