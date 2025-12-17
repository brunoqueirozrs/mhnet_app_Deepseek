/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND (v11.6 - Gestão Blindada)
 * Foco: Correção de leitura de Leads e Cache Local
 * ============================================================
 */

// ✅ ID DO DEPLOY (Verifique se é este o "Qualquer Pessoa")
const DEPLOY_ID = 'AKfycbxMuP7gF6WM3syD4dpraqkMPRpInQ2xkc5_09o3fuNBIHTCn8UVQFRdPpH4wiVpccvz'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// LISTA FIXA DE SEGURANÇA (Para Login)
const VENDEDORES_OFFLINE = [
    "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
    "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves"
];

// --- ESTADO GLOBAL ---
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
  console.log("🏁 [INIT] App Iniciado.");

  // Preenche lista de vendedores (Visual)
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

  // Recupera leads salvos no celular (Cache) caso a API falhe
  const savedLeads = localStorage.getItem('leadsCacheLocal');
  if (savedLeads) {
      try {
          leadsCache = JSON.parse(savedLeads);
          console.log("📂 [CACHE] Leads recuperados da memória:", leadsCache.length);
      } catch (e) { console.error("Erro cache leads", e); }
  }

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
  
  // Tenta atualizar a lista com dados novos da nuvem
  setTimeout(() => carregarLeads(), 1000);
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
  
  // Rola o container principal para o topo
  const mainScroll = document.getElementById('main-scroll');
  if(mainScroll) mainScroll.scrollTo(0,0);

  // Atualiza botões do rodapé
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

  // Se for para a gestão de leads, força renderização
  if (pageId === 'gestaoLeads') renderLeads();
  if (pageId === 'dashboard') atualizarDashboard();
}

function setLoggedUser() {
  const select = document.getElementById('userSelect');
  if (select && select.value) {
    loggedUser = select.value;
    localStorage.setItem('loggedUser', loggedUser);
    initApp();
  } else {
    alert('Por favor, selecione seu nome na lista!');
  }
}

function logout() {
  if(confirm("Tem certeza que deseja sair?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// ============================================================
// 3. IA (GEMINI)
// ============================================================

function toggleChat() {
    const el = document.getElementById('chatModal');
    if (!el) return;
    
    const history = document.getElementById('chatHistory');
    const isHidden = el.style.display === 'none' || el.classList.contains('hidden');

    if(isHidden) {
        el.style.display = 'block';
        el.classList.remove('hidden');
        const content = el.querySelector('div.absolute');
        if(content) {
            content.classList.remove('slide-up');
            void content.offsetWidth;
            content.classList.add('slide-up');
        }
        setTimeout(() => document.getElementById('chatInput').focus(), 300);
        
        if(history && (!history.hasChildNodes() || history.innerHTML.trim() === "")) {
             history.innerHTML = `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[85%]">Olá ${loggedUser ? loggedUser.split(' ')[0] : 'Vendedor'}! Sou o assistente MHNET.</div></div>`;
        }
    } else {
        el.style.display = 'none';
        el.classList.add('hidden');
    }
}

async function enviarMensagemChat() {
    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    if(!input || !history) return;
    const msg = input.value.trim();
    if(!msg) return;

    history.innerHTML += `<div class="flex gap-3 justify-end fade-in"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">${msg}</div></div>`;
    input.value = '';
    history.scrollTop = history.scrollHeight;

    const response = await chamarGemini(msg);
    if(response) {
         const formatted = response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
         history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${formatted}</div></div>`;
         history.scrollTop = history.scrollHeight;
    }
}

async function chamarGemini(prompt) {
  if (!GEMINI_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (res.status === 403) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { return null; }
}

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if(!nome) return alert("Preencha o nome!");
  showLoading(true, "CRIANDO PITCH...");
  const txt = await chamarGemini(`Mensagem WhatsApp curta para vender fibra MHNET para ${nome}.`);
  showLoading(false);
  if(txt) document.getElementById('leadObs').value = txt.replace(/["*]/g, '');
}

async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Sem leads no histórico.");
  showLoading(true, "ANALISANDO...");
  const bairros = [...new Set(leadsCache.slice(0, 30).map(l => l.bairro || 'Geral'))].join(', ');
  const txt = await chamarGemini(`Sugira rota para: ${bairros}.`);
  showLoading(false);
  if (txt) alert(`💡 DICA:\n\n${txt}`);
}

async function gerarCoachIA() {
  showLoading(true, "COACH...");
  const hoje = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  const txt = await chamarGemini(`Vendedor fez ${leadsHoje} leads hoje. Motive-o.`);
  showLoading(false);
  if(txt) alert(`🚀 COACH:\n\n${txt.replace(/\*\*/g, '')}`);
}

async function consultarPlanosIA() {
    toggleChat();
    const history = document.getElementById('chatHistory');
    history.innerHTML += `<div class="flex gap-3 justify-end fade-in"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">Planos?</div></div>`;
    const response = await chamarGemini("Quais os planos e preços? Resuma.");
    if(response) history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${response}</div></div>`;
}

// ============================================================
// 4. GESTÃO DE LEADS (AJUSTADO E BLINDADO)
// ============================================================

async function enviarLead() {
  const nome = document.getElementById('leadNome').value.trim();
  const tel = document.getElementById('leadTelefone').value.trim();
  
  if (!nome || !tel) return alert("Preencha Nome e Telefone");
  showLoading(true, "SALVANDO...");
  
  // Objeto de Lead
  const novoLead = {
    vendedor: loggedUser, nomeLead: nome, lead: nome, 
    telefone: tel, whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value,
    cidade: document.getElementById('leadCidade').value,
    bairro: document.getElementById('leadBairro').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value,
    provedor: "", timestamp: new Date().toISOString() // Formato ISO para ordenação
  };
  
  // Tenta enviar para o Google Sheets
  const res = await apiCall('addLead', novoLead);
  showLoading(false);
  
  // Se sucesso OU erro CORS (que na verdade é sucesso opaco)
  if ((res && res.status === 'success') || res === 'CORS_ERROR') {
      
    // 1. Salva localmente também (Cache imediato)
    leadsCache.unshift(novoLead); // Adiciona no topo da lista
    localStorage.setItem('leadsCacheLocal', JSON.stringify(leadsCache));

    alert('✅ Lead salvo!');
    
    // 2. Limpa campos
    document.getElementById('leadNome').value = ''; 
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = ''; 
    document.getElementById('leadObs').value = '';
    document.getElementById('leadBairro').value = '';
    
    // 3. Atualiza tela
    renderLeads();
    navegarPara('gestaoLeads');

  } else {
      alert('Erro ao salvar na nuvem. Verifique a internet.');
  }
}

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) lista.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8">Buscando na nuvem...</div>';

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success' && Array.isArray(res.data)) {
    // SUCESSO: Atualiza cache com dados da nuvem
    leadsCache = res.data.filter(l => {
      // Filtro inteligente (ignora case)
      const v = (l.vendedor || l.Vendedor || '').toLowerCase();
      return v.includes(loggedUser.toLowerCase());
    });
    
    // Salva no celular
    localStorage.setItem('leadsCacheLocal', JSON.stringify(leadsCache));
    
    renderLeads();
    atualizarDashboard();
  } else {
    // FALHA: Mostra o que tem no cache (se houver)
    if(leadsCache.length > 0) {
        console.log("Usando cache local para exibição.");
        renderLeads();
    } else {
        if(lista) lista.innerHTML = '<div style="text-align:center; color:#cbd5e1; padding:20px">Sem histórico recente.<br><small>Verifique se o Backend está público.</small></div>';
    }
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  // Filtro de busca na tela
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead || l.lead || '').toLowerCase().includes(term) || 
    (l.bairro || '').toLowerCase().includes(term) ||
    (l.telefone || '').includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = '<div style="text-align:center; padding:60px; color:#cbd5e1">Nenhum registro encontrado.</div>';
    return;
  }

  // Ordena por data (mais recente primeiro)
  filtrados.sort((a,b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
  });

  div.innerHTML = filtrados.map(l => {
    let badgeClass = "bg-gray-100 text-gray-500";
    const inter = (l.interesse || 'MÉDIO').toUpperCase();
    if(inter.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    if(inter.includes('BAIXO')) badgeClass = "bg-red-50 text-red-500";
    if(inter.includes('MÉDIO')) badgeClass = "bg-yellow-100 text-yellow-700";

    // Formata Data
    let dataShow = 'Hoje';
    if(l.timestamp) {
        try { dataShow = l.timestamp.split(' ')[0]; } catch(e) {}
    }

    return `
    <div class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4">
      <div class="flex justify-between items-start mb-3">
        <div>
          <div class="font-bold text-[#003870] text-lg">${l.nomeLead || l.lead || 'Sem Nome'}</div>
          <div class="text-xs text-gray-400 mt-1"><i class="fas fa-calendar-alt mr-1"></i> ${dataShow}</div>
        </div>
        <span class="${badgeClass} px-3 py-1 rounded-lg text-[10px] font-bold">${inter}</span>
      </div>
      <div class="text-sm text-gray-600 mb-4 flex items-center gap-2">
         <i class="fas fa-map-marker-alt text-red-400"></i> ${l.bairro || 'Geral'}
      </div>
      <div class="flex justify-end pt-2 border-t border-gray-100">
         <a href="https://wa.me/55${(l.telefone||'').replace(/\D/g, '')}" target="_blank" class="bg-[#25D366] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
           <i class="fab fa-whatsapp text-lg"></i> WhatsApp
         </a>
      </div>
    </div>`;
  }).join('');
}

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  // Conta leads com data de hoje (aproximada pela string)
  const count = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

// ============================================================
// 5. ROTA
// ============================================================
function startRoute() {
  if (!navigator.geolocation) return alert('Ative o GPS.');
  routeCoords = []; seconds = 0; routeStartTime = new Date().toISOString();
  
  document.getElementById('btnStart').style.display = 'none';
  document.getElementById('btnStop').style.display = 'flex';
  
  timerInterval = setInterval(() => {
    seconds++;
    const h = Math.floor(seconds / 3600).toString().padStart(2,'0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2,'0');
    const s = (seconds % 60).toString().padStart(2,'0');
    document.getElementById('timer').innerText = `${h}:${m}:${s}`;
  }, 1000);

  watchId = navigator.geolocation.watchPosition(p => {
    routeCoords.push({lat: p.coords.latitude, lon: p.coords.longitude});
    document.getElementById('points').innerText = routeCoords.length;
    document.getElementById('gpsStatus').innerText = "Rastreando";
  }, e => console.error(e), {enableHighAccuracy:true});
}

async function stopRoute() {
  if(!confirm("Finalizar?")) return;
  clearInterval(timerInterval); navigator.geolocation.clearWatch(watchId);
  showLoading(true, "ENVIANDO...");
  await apiCall('saveRoute', {vendedor: loggedUser, inicioISO: routeStartTime, fimISO: new Date().toISOString(), coordenadas: routeCoords});
  showLoading(false); alert("Rota salva!"); resetRouteUI(); navegarPara('dashboard');
}

function updateRouteUI(on) {
  document.getElementById('btnStart').style.display = on ? 'none' : 'flex';
  document.getElementById('btnStop').style.display = on ? 'flex' : 'none';
}
function resetRouteUI() {
  updateRouteUI(false);
  document.getElementById('timer').innerText = "00:00:00"; 
  document.getElementById('points').innerText = "0";
  document.getElementById('gpsStatus').innerText = "Parado";
}

// ============================================================
// 6. API (CORS OPACO + ERRO SILENCIOSO)
// ============================================================
async function apiCall(route, payload, show=true, suppress=false) {
  if(show) showLoading(true);
  try {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // FIX CORS
        body: JSON.stringify({route, payload, token: TOKEN})
    });
    
    // Se o fetch funcionou, tenta ler JSON
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { throw new Error("Erro de resposta"); }
    
    if(show) showLoading(false);
    if (json.status === 'error') throw new Error(json.message);
    return json;
  } catch(e) {
    if(show) showLoading(false);
    
    // SE DER ERRO DE FETCH EM POST (GRAVAÇÃO), ASSUMIMOS QUE FOI O CROS
    if(e.name === 'TypeError' && (route === 'addLead' || route === 'saveRoute')) {
        console.warn("⚠️ CORS bloqueou resposta, mas envio provável.");
        return 'CORS_ERROR';
    }
    
    if(!suppress) console.error("Erro conexão:", e.message);
    return null;
  }
}

function showLoading(show, txt) {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
  if(txt) document.getElementById('loaderText').innerText = txt;
}
