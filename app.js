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
    carregarEstatisticas();
  } else {
    const el = document.getElementById(id);
    if(el) el.style.display = 'block';
  }

  if(id === 'cadLead' || id === 'iniciarRota') carregarVendedores();
  if(id === 'gestaoLeads' || id === 'verLeads') carregarLeads();
  if(id === 'minhasRotas') carregarRotas();
  if(id === 'novaVenda') limparFormularioVenda();
}

// ==============================
//  GESTÃO DE LEADS - NOVA FUNCIONALIDADE
// ==============================
function renderLeads() {
  const q = document.getElementById('searchLead').value.toLowerCase();
  const div = document.getElementById('listaLeadsGestao');

  div.innerHTML = '';

  const leadsFiltrados = leadsCache
    .filter(l => 
      !q ||
      (l.nomeLead||'').toLowerCase().includes(q) ||
      (l.telefone||'').toLowerCase().includes(q) ||
      (l.bairro||'').toLowerCase().includes(q) ||
      (l.provedor||'').toLowerCase().includes(q)
    );

  if (leadsFiltrados.length === 0) {
    div.innerHTML = '<div class="muted" style="text-align:center; padding:40px;">Nenhum lead encontrado</div>';
    return;
  }

  leadsFiltrados.forEach(l => {
    const node = document.createElement('div');
    node.className = 'lead-card-gestao';
    
    // Determinar classe do status
    const statusClass = getStatusClass(l.status || 'NOVO');
    const statusText = getStatusText(l.status || 'NOVO');
    
    // Formatar telefone para WhatsApp
    const phone = (l.telefone || '').replace(/\D/g, '');
    const whatsappUrl = phone ? `https://wa.me/55${phone}?text=Olá ${encodeURIComponent(l.nomeLead || '')}, tudo bem? Sou da MHnet e gostaria de conversar sobre nossos planos de internet!` : '#';
    
    node.innerHTML = `
      <div class="lead-header">
        <div class="lead-name">${l.nomeLead || 'Sem nome'}</div>
        <div class="lead-status ${statusClass}">${statusText}</div>
      </div>
      
      <div class="lead-contact">
        <span class="lead-info">📞 ${l.telefone || 'Sem telefone'}</span>
        ${phone ? `<a href="${whatsappUrl}" target="_blank" class="whatsapp-btn">💬 WhatsApp</a>` : ''}
      </div>
      
      <div class="lead-info">🏠 ${l.endereco || ''} ${l.bairro || ''} - ${l.cidade || 'Lajeado'}</div>
      <div class="lead-info">📡 ${l.provedor || 'Sem provedor'} • 🎯 ${l.interesse || 'MEDIO'}</div>
      
      ${l.observacao ? `<div class="lead-obs">📝 ${l.observacao}</div>` : ''}
      
      <div class="lead-timestamp">
        ${l.vendedor ? `Vendedor: ${l.vendedor} • ` : ''}
        ${l.timestamp ? `Captado em ${l.timestamp}` : 'Lead recente'}
      </div>
    `;
    
    div.appendChild(node);
  });
}

function getStatusClass(status) {
  const statusMap = {
    'NOVO': 'status-novo',
    'EM_ATENDIMENTO': 'status-atendimento',
    'AGENDADO': 'status-agendado',
    'CONVERTIDO': 'status-convertido',
    'PERDIDO': 'status-perdido'
  };
  return statusMap[status] || 'status-novo';
}

function getStatusText(status) {
  const statusMap = {
    'NOVO': 'NOVO',
    'EM_ATENDIMENTO': 'EM ATENDIMENTO',
    'AGENDADO': 'AGENDADO',
    'CONVERTIDO': 'CONVERTIDO',
    'PERDIDO': 'PERDIDO'
  };
  return statusMap[status] || 'NOVO';
}

function exportarLeads() {
  if (leadsCache.length === 0) {
    alert('Nenhum lead para exportar');
    return;
  }
  
  const csvContent = "data:text/csv;charset=utf-8," 
    + "Nome,Telefone,Endereço,Bairro,Cidade,Provedor,Interesse,Status,Observações,Vendedor,Data\n"
    + leadsCache.map(lead => 
        `"${lead.nomeLead || ''}","${lead.telefone || ''}","${lead.endereco || ''}","${lead.bairro || ''}","${lead.cidade || ''}","${lead.provedor || ''}","${lead.interesse || ''}","${lead.status || ''}","${(lead.observacao || '').replace(/"/g, '""')}","${lead.vendedor || ''}","${lead.timestamp || ''}"`
      ).join("\n");
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `leads_${loggedUser}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ==============================
//  COMUNICAÇÃO COM API - JSONP (mantida igual)
// ==============================
function apiCall(route, data = null) {
  return new Promise((resolve) => {
    if (!data) {
      jsonpCall(route, resolve);
    } else {
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
 
