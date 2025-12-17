/**
 * ============================================================
 * MHNET VENDAS - FRONTEND V16.0 (LEITURA COMPLETA)
 * ============================================================
 */

// ✅ COLOQUE SEU ID DE IMPLANTAÇÃO MAIS RECENTE AQUI
const DEPLOY_ID = 'AKfycbwcA8S8xJZWYWgA6UueGOLJcB75iKAMTaVjc5B0wPfUlcalyy7hZ3YNeinIVwTNvCd5'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

const VENDEDORES_OFFLINE = [
    "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
    "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves"
];

const PLANOS_CONTEXTO = `CONTEXTO MHNET: 500 Mega (R$ 89,90), 700 Mega (R$ 99,90), 1 Giga (R$ 119,90). Instalação grátis.`;

let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let routeCoords = [];
let watchId = null;
let timerInterval = null;
let seconds = 0;
let routeStartTime = null;

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 App MHNET v16.0 Iniciado");

  // Preenche lista de vendedores
  const select = document.getElementById('userSelect');
  if(select) {
      select.innerHTML = '<option value="">Toque para selecionar...</option>';
      VENDEDORES_OFFLINE.forEach(nome => {
          const opt = document.createElement('option');
          opt.value = nome;
          opt.innerText = nome;
          select.appendChild(opt);
      });
  }

  // Carrega cache local
  const localData = localStorage.getItem('mhnet_leads_cache');
  if(localData) {
      try { 
        leadsCache = JSON.parse(localData);
        console.log(`📦 Cache local: ${leadsCache.length} leads`);
      } catch(e) {
        console.error("Erro ao carregar cache:", e);
      }
  }

  // Verifica login
  if (loggedUser) {
    initApp();
  } else {
    document.getElementById('userMenu').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  }
});

function initApp() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('userInfo').textContent = `Vendedor: ${loggedUser}`;
  
  navegarPara('dashboard');
  
  // Renderiza cache primeiro (instantâneo)
  if(leadsCache.length > 0) {
    renderLeads();
    atualizarDashboard();
  }
  
  // Busca dados atualizados da nuvem
  carregarLeads();
}

// ============================================================
// 2. NAVEGAÇÃO
// ============================================================
function navegarPara(pageId) {
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  
  const target = document.getElementById(pageId);
  if(target) {
      target.style.display = 'block';
      target.classList.remove('fade-in');
      void target.offsetWidth; 
      target.classList.add('fade-in');
  }
  
  const mainScroll = document.getElementById('main-scroll');
  if(mainScroll) mainScroll.scrollTo(0,0);

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active', 'text-blue-700');
    el.classList.add('text-slate-400');
  });

  let btnId = '';
  if(pageId === 'dashboard') btnId = 'nav-home';
  if(pageId === 'cadastroLead') btnId = 'nav-novo';
  if(pageId === 'gestaoLeads') btnId = 'nav-lista';
  if(pageId === 'rota') btnId = 'nav-rota';

  const btn = document.getElementById(btnId);
  if(btn && !btn.querySelector('div')) {
      btn.classList.add('active', 'text-blue-700');
      btn.classList.remove('text-slate-400');
  }

  if (pageId === 'dashboard') atualizarDashboard();
  if (pageId === 'gestaoLeads') renderLeads();
}

function setLoggedUser() {
  const select = document.getElementById('userSelect');
  if (select && select.value) {
    loggedUser = select.value;
    localStorage.setItem('loggedUser', loggedUser);
    initApp();
  } else {
    alert('Selecione seu nome!');
  }
}

function logout() {
  if(confirm("Sair do sistema?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// ============================================================
// 3. GESTÃO DE LEADS - LEITURA COMPLETA
// ============================================================

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  
  if(lista && leadsCache.length === 0) {
    lista.innerHTML = `
      <div style="text-align:center; padding:40px; color:#94a3b8">
        <i class="fas fa-sync fa-spin text-3xl mb-3"></i>
        <div>Buscando seus leads...</div>
      </div>
    `;
  }

  try {
    console.log("📡 Buscando leads do servidor...");
    
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        route: 'getLeads',
        payload: { vendedor: loggedUser }
      })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    console.log("📥 Resposta recebida:", text.substring(0, 200));
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('❌ Erro ao parsear JSON:', text);
      throw new Error('Resposta inválida do servidor');
    }

    if (data.status === 'success') {
      // Filtra e processa leads
      leadsCache = (data.data || []).filter(l => {
        // Remove leads sem nome
        if (!l.nomeLead || l.nomeLead.trim() === '') return false;
        
        // Filtra por vendedor
        const v = (l.vendedor || '').toLowerCase();
        return v.includes(loggedUser.toLowerCase());
      });
      
      // Ordena por data (mais recentes primeiro)
      leadsCache.sort((a, b) => {
        const parseDate = (d) => {
          if (!d) return 0;
          // Formato: dd/MM/yyyy HH:mm:ss
          if (d.includes('/')) {
            const parts = d.split(' ');
            const dateParts = parts[0].split('/');
            const timeParts = parts[1] ? parts[1].split(':') : [0, 0, 0];
            return new Date(
              dateParts[2], 
              dateParts[1] - 1, 
              dateParts[0],
              timeParts[0],
              timeParts[1],
              timeParts[2]
            ).getTime();
          }
          return new Date(d).getTime();
        };
        return parseDate(b.timestamp) - parseDate(a.timestamp);
      });
      
      // Salva no cache
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      
      console.log(`✅ ${leadsCache.length} leads carregados para ${loggedUser}`);
      
      renderLeads();
      atualizarDashboard();
      
    } else {
      throw new Error(data.message || 'Erro ao carregar leads');
    }
      
  } catch (e) {
    console.error('❌ Erro ao carregar leads:', e);
    
    if(lista && leadsCache.length === 0) {
      lista.innerHTML = `
        <div style="text-align:center; color:#cbd5e1; padding:30px">
          <i class="fas fa-exclamation-triangle text-4xl mb-3 text-yellow-400"></i>
          <div class="text-lg font-bold mb-2">Sem conexão</div>
          <div class="text-sm">Não foi possível carregar leads do servidor</div>
          <button onclick="carregarLeads()" class="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg">
            <i class="fas fa-redo"></i> Tentar Novamente
          </button>
        </div>
      `;
    } else {
      // Mostra leads do cache
      renderLeads();
    }
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead || '').toLowerCase().includes(term) || 
    (l.bairro || '').toLowerCase().includes(term) ||
    (l.telefone || '').toLowerCase().includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = `
      <div style="text-align:center; padding:40px; color:#cbd5e1">
        <i class="fas fa-inbox text-5xl mb-3"></i>
        <div class="text-lg">Nenhum lead encontrado</div>
        ${term ? '<div class="text-sm mt-2">Tente outra busca</div>' : ''}
      </div>
    `;
    return;
  }

  div.innerHTML = filtrados.map((l, index) => {
    let badgeClass = "bg-gray-100 text-gray-500";
    const inter = (l.interesse || 'MÉDIO').toUpperCase();
    if(inter.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    if(inter.includes('BAIXO')) badgeClass = "bg-red-50 text-red-500";
    
    const dataShow = l.timestamp ? l.timestamp.split(' ')[0] : 'Hoje';
    const horaShow = l.timestamp && l.timestamp.includes(' ') ? l.timestamp.split(' ')[1].substring(0, 5) : '';

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4 cursor-pointer active:bg-blue-50 transition hover:shadow-md">
      <div class="flex justify-between items-start mb-3 pointer-events-none">
        <div>
          <div class="font-bold text-[#003870] text-lg">${l.nomeLead}</div>
          <div class="text-xs text-gray-400">${dataShow} ${horaShow}</div>
        </div>
        <span class="${badgeClass} px-3 py-1 rounded-lg text-[10px] font-bold">${inter}</span>
      </div>
      <div class="text-sm text-gray-600 mb-2 pointer-events-none">
         <i class="fas fa-map-marker-alt text-red-400"></i> ${l.bairro || 'Não informado'}
      </div>
      <div class="text-sm text-gray-500 mb-2 pointer-events-none">
         <i class="fas fa-phone text-green-500"></i> ${l.telefone || 'Sem telefone'}
      </div>
      <div class="text-xs text-blue-400 font-bold text-right pointer-events-none">
         Ver detalhes <i class="fas fa-chevron-right"></i>
      </div>
    </div>`;
  }).join('');
}

function abrirLeadDetalhes(index) {
    const lead = leadsCache[index];
    if(!lead) return;

    document.getElementById('modalLeadNome').innerText = lead.nomeLead || 'Sem Nome';
    document.getElementById('modalLeadInfo').innerText = `${lead.bairro || 'Geral'} • ${lead.timestamp ? lead.timestamp.split(' ')[0] : 'Hoje'}`;
    
    // Monta informações completas
    let info = [];
    if(lead.telefone) info.push(`📞 ${lead.telefone}`);
    if(lead.endereco) info.push(`📍 ${lead.endereco}`);
    if(lead.cidade) info.push(`🏙️ ${lead.cidade}`);
    if(lead.provedor) info.push(`📡 Provedor atual: ${lead.provedor}`);
    if(lead.observacao) info.push(`\n💬 ${lead.observacao}`);
    
    document.getElementById('modalLeadObs').innerText = info.length ? info.join('\n') : "Nenhuma informação adicional.";

    const tel = (lead.telefone || "").replace(/\D/g, '');
    const btnWhats = document.getElementById('btnModalWhats');
    
    btnWhats.onclick = () => {
        if(tel) window.open(`https://wa.me/55${tel}`, '_blank');
        else alert("Telefone não disponível.");
    };

    const modal = document.getElementById('leadModal');
    modal.classList.remove('hidden');
    const content = modal.querySelector('div.absolute');
    content.classList.remove('slide-up');
    void content.offsetWidth;
    content.classList.add('slide-up');
}

function fecharLeadModal() {
    document.getElementById('leadModal').classList.add('hidden');
}

async function enviarLead() {
  const nome = document.getElementById('leadNome').value.trim();
  const tel = document.getElementById('leadTelefone').value.trim();
  
  if (!nome || !tel) return alert("❌ Preencha Nome e Telefone");
  
  showLoading(true, "SALVANDO...");
  
  const novoLead = {
    vendedor: loggedUser,
    nomeLead: nome,
    telefone: tel,
    endereco: document.getElementById('leadEndereco').value.trim(),
    cidade: document.getElementById('leadCidade').value.trim(),
    bairro: document.getElementById('leadBairro').value.trim(),
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value.trim(),
    provedor: "",
    timestamp: new Date().toLocaleString('pt-BR')
  };
  
  const res = await apiCall('addLead', novoLead);
  showLoading(false);
  
  if (res && (res.status === 'success' || res === 'CORS_OK')) {
      alert('✅ Lead Salvo com Sucesso!');
      
      // Adiciona ao cache local
      leadsCache.unshift(novoLead);
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));

      // Limpa formulário
      document.getElementById('leadNome').value = ''; 
      document.getElementById('leadTelefone').value = '';
      document.getElementById('leadEndereco').value = ''; 
      document.getElementById('leadCidade').value = '';
      document.getElementById('leadObs').value = '';
      document.getElementById('leadBairro').value = '';
      document.getElementById('leadInteresse').value = 'MÉDIO';
      
      navegarPara('gestaoLeads');
  } else {
      alert('❌ Erro ao salvar. Tente novamente.');
  }
}

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
  const count = leadsCache.filter(l => {
    const leadDate = l.timestamp ? l.timestamp.split(' ')[0] : '';
    return leadDate === hoje;
  }).length;
  
  if(document.getElementById('statLeads')) {
    document.getElementById('statLeads').innerText = count;
  }
  
  console.log(`📊 Dashboard: ${count} leads hoje de ${leadsCache.length} totais`);
}

// ============================================================
// 4. IA GEMINI
// ============================================================
async function chamarGemini(prompt) {
  if (!GEMINI_KEY) return null;
  const fullPrompt = `${PLANOS_CONTEXTO}\n\nPERGUNTA: ${prompt}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
    });
    if(!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { 
    console.error("Erro Gemini:", e);
    return null; 
  }
}

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if(!nome) return alert("Preencha o nome primeiro!");
  showLoading(true, "CRIANDO...");
  const txt = await chamarGemini(`Crie uma mensagem WhatsApp curta e persuasiva para vender fibra óptica MHNET para ${nome}.`);
  showLoading(false);
  if(txt) document.getElementById('leadObs').value = txt.replace(/\*\*/g, '');
}

async function consultarPlanosIA() {
    toggleChat();
    const history = document.getElementById('chatHistory');
    history.innerHTML += `<div class="flex gap-3 justify-end fade-in"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">Quais são os planos?</div></div>`;
    const response = await chamarGemini("Liste os planos MHNET com preços e benefícios.");
    if(response) {
      const formatted = response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${formatted}</div></div>`;
    }
}

function toggleChat() {
    const el = document.getElementById('chatModal');
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        setTimeout(() => document.getElementById('chatInput')?.focus(), 300);
    } else {
        el.classList.add('hidden');
    }
}

async function enviarMensagemChat() {
    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    const msg = input.value.trim();
    if(!msg) return;
    
    history.innerHTML += `<div class="flex gap-3 justify-end fade-in"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">${msg}</div></div>`;
    input.value = '';
    
    const response = await chamarGemini(msg);
    if(response) {
         const formatted = response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
         history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${formatted}</div></div>`;
         history.scrollTop = history.scrollHeight;
    }
}

async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Você ainda não tem leads cadastrados.");
  showLoading(true, "ANALISANDO...");
  const bairros = [...new Set(leadsCache.slice(0, 30).map(l => l.bairro || 'Geral'))].join(', ');
  const txt = await chamarGemini(`Com base nestes bairros: ${bairros}, sugira uma rota eficiente de visitas.`);
  showLoading(false);
  if (txt) alert(`💡 SUGESTÃO DE ROTA:\n\n${txt.replace(/\*\*/g, '')}`);
}

async function gerarCoachIA() {
  showLoading(true, "MOTIVANDO...");
  const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
  const leadsHoje = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  const txt = await chamarGemini(`O vendedor cadastrou ${leadsHoje} leads hoje. Dê uma mensagem motivacional curta e energética.`);
  showLoading(false);
  if(txt) alert(`🚀 MENSAGEM DO COACH:\n\n${txt.replace(/\*\*/g, '')}`);
}

// ============================================================
// 5. ROTAS GPS
// ============================================================
function startRoute() {
  if (!navigator.geolocation) return alert('GPS não disponível no dispositivo.');
  
  routeCoords = [];
  seconds = 0;
  routeStartTime = new Date().toISOString();
  
  document.getElementById('btnStart').style.display = 'none';
  document.getElementById('btnStop').style.display = 'flex';
  
  timerInterval = setInterval(() => {
    seconds++;
    const h = Math.floor(seconds / 3600).toString().padStart(2,'0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2,'0');
    const s = (seconds % 60).toString().padStart(2,'0');
    document.getElementById('timer').innerText = `${h}:${m}:${s}`;
  }, 1000);
  
  watchId = navigator.geolocation.watchPosition(
    p => {
      routeCoords.push({lat: p.coords.latitude, lon: p.coords.longitude});
      document.getElementById('points').innerText = routeCoords.length;
      document.getElementById('gpsStatus').innerText = "📍 Rastreando";
    },
    e => {
      console.error("Erro GPS:", e);
      document.getElementById('gpsStatus').innerText = "⚠️ Erro GPS";
    },
    {enableHighAccuracy: true, timeout: 10000, maximumAge: 0}
  );
}

async function stopRoute() {
  if(!confirm("Finalizar rastreamento da rota?")) return;
  
  clearInterval(timerInterval);
  navigator.geolocation.clearWatch(watchId);
  
  showLoading(true, "SALVANDO ROTA...");
  
  await apiCall('saveRoute', {
    vendedor: loggedUser,
    inicioISO: routeStartTime,
    fimISO: new Date().toISOString(),
    coordenadas: routeCoords
  });
  
  showLoading(false);
  alert(`✅ Rota salva!\n${routeCoords.length} pontos coletados`);
  resetRouteUI();
  navegarPara('dashboard');
}

function resetRouteUI() {
  document.getElementById('btnStart').style.display = 'flex';
  document.getElementById('btnStop').style.display = 'none';
  document.getElementById('timer').innerText = "00:00:00";
  document.getElementById('points').innerText = "0";
  document.getElementById('gpsStatus').innerText = "Parado";
}

// ============================================================
// 6. API CALL
// ============================================================
async function apiCall(route, payload, show=true) {
  if(show) showLoading(true);
  
  try {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ route, payload })
    });
    
    const text = await res.text();
    let json;
    
    try {
      json = JSON.parse(text);
    } catch (e) {
      // Para addLead e saveRoute, aceita resposta vazia (CORS OK)
      if(route === 'addLead' || route === 'saveRoute') {
        return 'CORS_OK';
      }
      throw new Error("Resposta inválida");
    }
    
    if(show) showLoading(false);
    
    if (json.status === 'error') {
      throw new Error(json.message);
    }
    
    return json;
    
  } catch(e) {
    if(show) showLoading(false);
    
    // Fallback para operações de escrita
    if(e.name === 'TypeError' && (route === 'addLead' || route === 'saveRoute')) {
      return 'CORS_OK';
    }
    
    console.error(`Erro ao chamar ${route}:`, e.message);
    return null;
  }
}

function showLoading(show, txt = "AGUARDE...") {
  const loader = document.getElementById('loader');
  if(loader) {
    loader.style.display = show ? 'flex' : 'none';
  }
  
  const loaderText = document.getElementById('loaderText');
  if(loaderText && txt) {
    loaderText.innerText = txt;
  }
}
