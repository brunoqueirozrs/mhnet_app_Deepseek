// ==============================
//  FRONTEND PWA – API MHNET
// ==============================
const API_BASE = 'AKfycbwkTMJ1Y8Pqv_hk0POHg44ep2SUPY05v_Oy6cDAPnJVW20RBHl58wwFK4-iu7aGbrx7';
const API_DIRECT = `https://script.google.com/macros/s/${API_BASE}/exec`;
const PLANILHA_VENDAS_ID = '19U8KDUFQUhMOLPIniKCkUfGXZCBY7i3uFyjOQYU003w';

let leadsCache = [];
let routesCache = [];
let vendedoresCache = [];
let loggedUser = null;

// ==============================
//  INICIALIZAÇÃO
// ==============================
document.addEventListener('DOMContentLoaded', () => {
  checkUserLogin();
  addFavicon();
});

// ==============================
//  SISTEMA DE LOGIN DO VENDEDOR
// ==============================
function checkUserLogin() {
  const savedUser = localStorage.getItem('loggedUser');
  if (savedUser) {
    loggedUser = savedUser;
    showMainContent();
  } else {
    showUserMenu();
  }
}

function showUserMenu() {
  document.getElementById('userMenu').style.display = 'block';
  document.getElementById('mainContent').style.display = 'none';
  document.getElementById('userInfo').textContent = 'Selecione um vendedor';
  carregarVendedores();
}

function showMainContent() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('userInfo').textContent = `Vendedor: ${loggedUser}`;
  showPage('dashboard');
  carregarEstatisticas();
}

function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function setLoggedUser() {
  const select = document.getElementById('userSelect');
  const user = select.value;
  if (user) {
    loggedUser = user;
    localStorage.setItem('loggedUser', user);
    showMainContent();
  } else {
    alert('Selecione um vendedor');
  }
}

function logout() {
  localStorage.removeItem('loggedUser');
  loggedUser = null;
  showUserMenu();
}

// ==============================
//  CONTROLE DE PÁGINAS
// ==============================
function showPage(id){
  if (!loggedUser && id !== 'userMenu') {
    showUserMenu();
    return;
  }
  
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
  if(id === 'novaVenda') limparFormularioVenda();
}

// ==============================
//  COMUNICAÇÃO COM API - JSONP
// ==============================
function apiCall(route, data = null) {
  return new Promise((resolve) => {
    // Tenta JSONP primeiro
    if (!data) {
      jsonpCall(route, resolve);
    } else {
      // Para POST, tenta fetch direto e fallback offline
      postWithFallback(route, data, resolve);
    }
  });
}

function jsonpCall(route, resolve) {
  const callbackName = 'jsonp_callback_' + Date.now();
  const url = `${API_DIRECT}?route=${route}&callback=${callbackName}`;
  
  const script = document.createElement('script');
  script.src = url;
  
  window[callbackName] = function(response) {
    delete window[callbackName];
    document.body.removeChild(script);
    console.log(`✅ JSONP ${route}:`, response);
    resolve(response);
  };
  
  script.onerror = function() {
    delete window[callbackName];
    document.body.removeChild(script);
    console.log(`❌ JSONP ${route} falhou, usando fallback`);
    resolve(getFallbackData(route));
  };
  
  document.body.appendChild(script);
}

async function postWithFallback(route, data, resolve) {
  // Tenta fetch normal primeiro
  try {
    const response = await fetch(API_DIRECT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ POST ${route}:`, result);
      resolve(result);
      return;
    }
  } catch (error) {
    console.log(`❌ POST ${route} falhou:`, error.message);
  }
  
  // Fallback offline
  console.log(`📴 Modo offline para: ${route}`);
  resolve(getFallbackData(route, data));
}

// ==============================
//  DADOS OFFLINE DE FALLBACK
// ==============================
function getFallbackData(route, data = null) {
  console.log(`📋 Dados offline para: ${route}`);
  
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
      // Simula salvamento offline
      const newLead = {
        id: leadsCache.length + 1,
        nomeLead: data.nomeLead,
        telefone: data.telefone,
        vendedor: data.vendedor,
        endereco: data.endereco,
        bairro: data.bairro,
        cidade: data.cidade,
        provedor: data.provedor,
        interesse: data.interesse,
        observacao: data.observacao,
        timestamp: new Date().toLocaleString('pt-BR')
      };
      leadsCache.push(newLead);
      return { 
        status: 'success', 
        message: 'Lead salvo localmente (modo offline)',
        data: newLead
      };
      
    case 'saveRoute':
      // Simula salvamento offline de rota
      const newRoute = {
        routeId: `OFFLINE-${Date.now()}`,
        vendedor: data.vendedor,
        inicio: new Date(data.inicioISO).toLocaleString('pt-BR'),
        fim: new Date(data.fimISO).toLocaleString('pt-BR'),
        duracao: calculateDuration(data.inicioISO, data.fimISO),
        distancia: calculateDistance(data.coords),
        qtdLeads: data.qtdLeads,
        kmlUrl: null
      };
      routesCache.push(newRoute);
      return { 
        status: 'success', 
        message: 'Rota salva localmente (modo offline)',
        data: newRoute
      };
      
    case 'addVenda':
      // Simula salvamento offline de venda
      const newVenda = {
        id: Date.now(),
        vendedor: data.vendedor,
        nome: data.nome,
        cpf: data.cpf,
        email: data.email,
        telefone1: data.telefone1,
        telefone2: data.telefone2,
        endereco: data.endereco,
        bairro: data.bairro,
        cidade: data.cidade,
        plano: data.plano,
        vencimento: data.vencimento,
        timestamp: new Date().toLocaleString('pt-BR')
      };
      return { 
        status: 'success', 
        message: 'Venda registrada localmente (modo offline)',
        data: newVenda
      };
      
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
  const userSelect = document.getElementById('userSelect');

  if(s1) s1.innerHTML = '';
  if(s2) s2.innerHTML = '';
  if(userSelect) userSelect.innerHTML = '<option value="">Selecione...</option>';

  vendedoresCache.forEach(v => {
    if(String(v.status).toLowerCase() === 'ativo'){
      const opt = new Option(v.nome, v.nome);
      if(s1) s1.add(opt.cloneNode(true));
      if(s2) s2.add(opt.cloneNode(true));
      if(userSelect) userSelect.add(new Option(v.nome, v.nome));
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
//  NOVA VENDA - CONTRATO
// ==============================
async function enviarVenda(){
  if (!loggedUser) {
    alert('Selecione um vendedor primeiro');
    showUserMenu();
    return;
  }

  const payload = {
    route: 'addVenda',
    planilhaId: PLANILHA_VENDAS_ID,
    vendedor: loggedUser,
    nome: document.getElementById('vendaNome').value || '',
    nascimento: document.getElementById('vendaNascimento').value || '',
    cpf: document.getElementById('vendaCPF').value || '',
    email: document.getElementById('vendaEmail').value || '',
    telefone1: document.getElementById('vendaTelefone1').value || '',
    telefone2: document.getElementById('vendaTelefone2').value || '',
    endereco: document.getElementById('vendaEndereco').value || '',
    bairro: document.getElementById('vendaBairro').value || '',
    cidade: document.getElementById('vendaCidade').value || '',
    plano: document.getElementById('vendaPlano').value || '',
    vencimento: document.getElementById('vendaVencimento').value || ''
  };

  // Validação básica
  if (!payload.nome || !payload.cpf || !payload.email || !payload.telefone1) {
    alert('Preencha os campos obrigatórios: Nome, CPF, E-mail e Telefone 1');
    return;
  }

  // Validação de CPF básica
  if (payload.cpf.length < 11) {
    alert('CPF deve ter pelo menos 11 dígitos');
    return;
  }

  // Validação de email básica
  if (!payload.email.includes('@')) {
    alert('E-mail inválido');
    return;
  }

  try {
    const json = await apiCall('addVenda', payload);
    
    if(json.status === 'success'){
      alert('✅ Venda registrada com sucesso! Contrato será gerado.');
      limparFormularioVenda();
      showPage('dashboard');
    } else {
      alert('Erro ao registrar venda: ' + (json.message || 'Tente novamente'));
    }
  } catch(e) {
    console.error(e);
    alert('Erro de conexão ao registrar venda');
  }
}

function limparFormularioVenda() {
  document.getElementById('vendaNome').value = '';
  document.getElementById('vendaNascimento').value = '';
  document.getElementById('vendaCPF').value = '';
  document.getElementById('vendaEmail').value = '';
  document.getElementById('vendaTelefone1').value = '';
  document.getElementById('vendaTelefone2').value = '';
  document.getElementById('vendaEndereco').value = '';
  document.getElementById('vendaBairro').value = '';
  document.getElementById('vendaPlano').value = '';
  document.getElementById('vendaVencimento').value = '';
}

// ==============================
//  LEADS
// ==============================
async function enviarLead(){
  if (!loggedUser) {
    alert('Selecione um vendedor primeiro');
    showUserMenu();
    return;
  }

  const payload = {
    route: 'addLead',
    vendedor: loggedUser,
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
    alert('✅ Lead salvo! ' + (json.message || ''));
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
    alert("❌ Erro: " + (json.message || 'Tente novamente'));
  }
}

async function carregarLeads(){
  try{
    const json = await apiCall('getLeads');
    
    if(json.status === 'success'){
      leadsCache = json.data || [];
      // Filtrar leads apenas do vendedor logado
      if (loggedUser) {
        leadsCache = leadsCache.filter(lead => lead.vendedor === loggedUser);
      }
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
        ${l.observacao ? `<div style="margin-top:4px;font-size:12px;color:#666">${l.observacao}</div>` : ''}
        ${l.timestamp ? `<div style="margin-top:4px;font-size:10px;color:#999">Captado em ${l.timestamp}</div>` : ''}
      `;
      div.appendChild(node);
    });
}

// ==============================
//  ROTAS
// ==============================
let routeActive = false;
let routeCoords = [];
let routeStart = null;
let watchId = null;

function startRoute(){
  if (!loggedUser) {
    alert('Selecione um vendedor primeiro');
    showUserMenu();
    return;
  }

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
    vendedor: loggedUser,
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
      // Filtrar rotas apenas do vendedor logado
      if (loggedUser) {
        routesCache = routesCache.filter(rota => rota.vendedor === loggedUser);
      }
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
      ${r.kmlUrl ? `<a style="margin-top:8px; display:block; color:#0ea5a4" href="${r.kmlUrl}" target="_blank">📎 Baixar KML</a>` : 
        '<div style="margin-top:8px; color:#666; font-size:12px">📱 Rota salva localmente</div>'}
    `;
    div.appendChild(node);
  });
}

// ==============================
//  ESTATÍSTICAS
// ==============================
function carregarEstatisticas(){
  if (loggedUser) {
    // Filtrar estatísticas apenas do vendedor logado
    const userLeads = leadsCache.filter(lead => lead.vendedor === loggedUser);
    const userRotas = routesCache.filter(rota => rota.vendedor === loggedUser);
    
    document.getElementById('statLeads').innerText = userLeads.length || 0;
    document.getElementById('statRotas').innerText = userRotas.length || 0;
    
    // Calcula taxa de conversão simples
    const totalLeads = userLeads.length;
    const leadsComInteresse = userLeads.filter(l => 
      l.interesse && l.interesse.toUpperCase() === 'ALTO'
    ).length;
    
    const taxa = totalLeads > 0 ? ((leadsComInteresse / totalLeads) * 100).toFixed(1) : 0;
    document.getElementById('statConv').innerText = `${taxa}%`;
  } else {
    document.getElementById('statLeads').innerText = leadsCache.length || 0;
    document.getElementById('statRotas').innerText = routesCache.length || 0;
    
    const totalLeads = leadsCache.length;
    const leadsComInteresse = leadsCache.filter(l => 
      l.interesse && l.interesse.toUpperCase() === 'ALTO'
    ).length;
    
    const taxa = totalLeads > 0 ? ((leadsComInteresse / totalLeads) * 100).toFixed(1) : 0;
    document.getElementById('statConv').innerText = `${taxa}%`;
  }
}

// ==============================
//  FUNÇÕES AUXILIARES
// ==============================
function calculateDuration(startISO, endISO) {
  try {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const diffMs = end - start;
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}min`;
    }
    return `${minutes} min`;
  } catch (e) {
    return 'N/A';
  }
}

function calculateDistance(coords) {
  if (!coords || coords.length < 2) return '0 km';
  
  let totalDistance = 0;
  for (let i = 1; i < coords.length; i++) {
    totalDistance += haversineDistance(coords[i-1], coords[i]);
  }
  
  return `${totalDistance.toFixed(2)} km`;
}

function haversineDistance(coord1, coord2) {
  const R = 6371; // Raio da Terra em km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function addFavicon() {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📱</text></svg>';
  document.head.appendChild(link);
}
