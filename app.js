/**
 * ============================================================
 * MHNET VENDAS - LÓGICA ORGANIZADA (v12.0 - Correções Finais)
 * Foco: Fix Histórico, IA Gemini 1.5 e Rota
 * ============================================================
 */

// ------------------------------------------------------------
// 1. CONFIGURAÇÕES & SEGURANÇA
// ------------------------------------------------------------
const DEPLOY_ID = 'AKfycbxMuP7gF6WM3syD4dpraqkMPRpInQ2xkc5_09o3fuNBIHTCn8UVQFRdPpH4wiVpccvz'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";

// MUDANÇA IA: Usando modelo estável 1.5 Flash
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 
const GEMINI_MODEL = "gemini-1.5-flash";

// Lista Fixa para garantir Login Offline
const VENDEDORES_OFFLINE = [
    "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
    "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves"
];

// Estado Global
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let routeCoords = [];
let watchId = null;
let timerInterval = null;
let seconds = 0;
let routeStartTime = null;

// ------------------------------------------------------------
// 2. INICIALIZAÇÃO & LOGIN
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  console.log("🏁 [APP] Iniciando v12.0...");

  // Esconde Chat inicialmente
  const chatModal = document.getElementById('chatModal');
  if (chatModal) { chatModal.style.display = 'none'; chatModal.classList.add('hidden'); }

  // Preenche Select de Vendedores
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

  // Verifica Sessão
  if (loggedUser) {
    console.log(`👤 [AUTH] Usuário: ${loggedUser}`);
    initApp();
  } else {
    mostrarLogin();
  }
});

function mostrarLogin() {
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
    alert('Por favor, selecione seu nome na lista!');
  }
}

function initApp() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('userInfo').textContent = `Vendedor: ${loggedUser}`;
  
  navegarPara('dashboard');
  setTimeout(() => carregarLeads(), 500);
}

function logout() {
  if(confirm("Tem certeza que deseja sair?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// ------------------------------------------------------------
// 3. NAVEGAÇÃO CENTRAL
// ------------------------------------------------------------
function navegarPara(pageId) {
  console.log(`🔄 [NAV] Indo para: ${pageId}`);
  
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  
  const target = document.getElementById(pageId);
  if(target) {
      target.style.display = 'block';
      target.classList.remove('fade-in');
      void target.offsetWidth; 
      target.classList.add('fade-in');
  }

  const main = document.querySelector('main');
  if(main) main.scrollTo(0,0);
  window.scrollTo(0, 0);

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
}

// ------------------------------------------------------------
// 4. CADASTRO LEAD (Salvar)
// ------------------------------------------------------------
async function enviarLead() {
  const nome = document.getElementById('leadNome').value.trim();
  const tel = document.getElementById('leadTelefone').value.trim();
  
  if (!nome || !tel) return alert("⚠️ Preencha Nome e Telefone!");
  
  showLoading(true, "SALVANDO...");
  
  const payload = {
    vendedor: loggedUser,
    nomeLead: nome,  
    lead: nome,
    telefone: tel,
    whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value,
    cidade: document.getElementById('leadCidade').value,
    bairro: document.getElementById('leadBairro').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value,
    provedor: "", 
    timestamp: new Date().toISOString()
  };
  
  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  if ((res && res.status === 'success') || res === 'CORS_ERROR_BUT_SENT') {
    alert('✅ Lead salvo com sucesso!');
    
    // Limpeza
    document.getElementById('leadNome').value = ''; 
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = ''; 
    document.getElementById('leadObs').value = '';
    document.getElementById('leadBairro').value = '';
    
    carregarLeads(); 
    navegarPara('gestaoLeads');
  } else {
    alert('❌ Erro ao salvar. Tente novamente.');
  }
}

// ------------------------------------------------------------
// 5. GESTÃO LEADS (Lista e Histórico) - CORRIGIDO
// ------------------------------------------------------------
async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) lista.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8">Buscando histórico...</div>';

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    const todosLeads = res.data || [];
    console.log(`📥 Total baixado: ${todosLeads.length}`);

    // FILTRO MAIS FLEXÍVEL (Corrige problema de não aparecer)
    leadsCache = todosLeads.filter(l => {
      const vPlanilha = (l.vendedor || l.Vendedor || '').toLowerCase().trim();
      const vApp = loggedUser.toLowerCase().trim();
      
      // Verifica se um nome contém o outro (ex: "João" bate com "João Silva")
      return vPlanilha.includes(vApp) || vApp.includes(vPlanilha);
    });

    console.log(`✅ Leads filtrados: ${leadsCache.length}`);
    renderLeads();
    atualizarDashboard();
  } else {
    if(lista) lista.innerHTML = '<div style="text-align:center; color:#cbd5e1; padding:20px">Sem histórico offline.</div>';
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead || l.lead || '').toLowerCase().includes(term) || 
    (l.bairro || '').toLowerCase().includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = '<div style="text-align:center; padding:60px; color:#cbd5e1">Nenhum registro encontrado.</div>';
    return;
  }

  // Ordena por data (tenta converter formato DD/MM/YYYY)
  filtrados.sort((a,b) => {
      const parse = (d) => {
          if(!d) return 0;
          if(d.includes('/')) {
              const [dia, mes, ano] = d.split(' ')[0].split('/');
              return new Date(`${ano}-${mes}-${dia}`);
          }
          return new Date(d);
      };
      return parse(b.timestamp) - parse(a.timestamp);
  });

  div.innerHTML = filtrados.map(l => {
    const nome = l.nomeLead || l.lead || 'Cliente';
    const bairro = l.bairro || 'Geral';
    const interesse = (l.interesse || 'Novo').toUpperCase();
    const tel = l.telefone || l.whatsapp || '';
    const dataShow = l.timestamp ? l.timestamp.split(' ')[0] : 'Hoje';
    
    let badgeClass = "bg-gray-100 text-gray-500";
    if(interesse.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    if(interesse.includes('MÉDIO')) badgeClass = "bg-yellow-100 text-yellow-700";
    if(interesse.includes('BAIXO')) badgeClass = "bg-red-50 text-red-500";

    return `
    <div class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4">
      <div class="flex justify-between items-start mb-3">
        <div>
          <div class="font-bold text-[#003870] text-lg leading-tight">${nome}</div>
          <div class="text-xs text-gray-400 mt-1"><i class="fas fa-calendar-alt mr-1"></i> ${dataShow}</div>
        </div>
        <span class="${badgeClass} px-3 py-1 rounded-lg text-[10px] font-bold tracking-wide shadow-sm">${interesse}</span>
      </div>
      <div class="text-sm text-gray-600 mb-5 flex items-center gap-2 bg-blue-50/50 p-2 rounded-lg">
        <i class="fas fa-map-marker-alt text-red-400 ml-1"></i> ${bairro}
      </div>
      <div class="flex justify-between items-center border-t border-gray-100 pt-4">
         <span class="text-xs text-gray-400 font-medium">Ação rápida</span>
         <a href="https://wa.me/55${tel.replace(/\D/g, '')}" target="_blank" class="bg-[#25D366] text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:brightness-105 transition shadow-green-200 shadow-lg">
           <i class="fab fa-whatsapp text-lg"></i> WhatsApp
         </a>
      </div>
    </div>`;
  }).join('');
}

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  // Ajuste para datas DD/MM/YYYY
  const count = leadsCache.filter(l => (l.timestamp || '').startsWith(hoje)).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

// ------------------------------------------------------------
// 6. INTEGRAÇÃO IA (GEMINI 1.5 - CORRIGIDA)
// ------------------------------------------------------------
async function chamarGemini(prompt) {
  if (!GEMINI_KEY) return null;
  console.log("🤖 [IA] Chamando modelo:", GEMINI_MODEL);
  
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
    const res = await fetch(url, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (res.status !== 200) {
        console.error("Erro IA Status:", res.status);
        return null;
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { 
      console.error("Erro IA Fetch:", e);
      return null; 
  }
}

// Chat Flutuante
function toggleChat() {
    const el = document.getElementById('chatModal');
    const history = document.getElementById('chatHistory');
    
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        el.querySelector('div.absolute').classList.add('slide-up');
        setTimeout(() => document.getElementById('chatInput').focus(), 300);
        
        if(!history.hasChildNodes()) {
             history.innerHTML = `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[80%]">Olá ${loggedUser.split(' ')[0]}! Sou o assistente de vendas. Como posso ajudar?</div></div>`;
        }
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
    history.scrollTop = history.scrollHeight;

    // Loading
    const loadingId = 'load' + Date.now();
    history.innerHTML += `<div id="${loadingId}" class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm"><span class="animate-pulse">...</span></div></div>`;
    history.scrollTop = history.scrollHeight;

    const prompt = `Aja como um gerente de vendas da MHNET Telecom. Responda curto e prático: "${msg}"`;
    const response = await chamarGemini(prompt);
    
    document.getElementById(loadingId)?.remove();
    
    if(response) {
         history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')}</div></div>`;
    } else {
         history.innerHTML += `<div class="text-center text-xs text-red-400 mt-2">IA indisponível no momento.</div>`;
    }
    history.scrollTop = history.scrollHeight;
}

// Funções IA Auxiliares
async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if (!nome) return alert("⚠️ Preencha o nome!");
  showLoading(true, "CRIANDO PITCH...");
  const txt = await chamarGemini(`Crie mensagem WhatsApp curta (3 linhas) para vender fibra MHNET para ${nome}. Use emojis.`);
  showLoading(false);
  if(txt) document.getElementById('leadObs').value = txt.replace(/["*]/g, '');
  else alert("Erro na IA. Verifique conexão.");
}

async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Sem leads.");
  showLoading(true, "ANALISANDO...");
  const bairros = [...new Set(leadsCache.slice(0, 30).map(l => l.bairro || 'Geral'))].join(', ');
  const txt = await chamarGemini(`Sugira uma rota lógica para estes bairros: ${bairros}. Resposta curta.`);
  showLoading(false);
  if (txt) alert(`💡 DICA:\n\n${txt}`);
}

async function gerarCoachIA() {
  showLoading(true, "COACH...");
  const hoje = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => (l.timestamp || '').startsWith(hoje)).length;
  const txt = await chamarGemini(`Vendedor fez ${leadsHoje} leads hoje. Dê um feedback motivacional curto.`);
  showLoading(false);
  if(txt) alert(`🚀 COACH:\n\n${txt.replace(/\*\*/g, '')}`);
}

// ------------------------------------------------------------
// 7. ROTA GPS
// ------------------------------------------------------------
function startRoute() {
  if (!navigator.geolocation) return alert('Ative o GPS.');
  routeCoords = []; seconds = 0; routeStartTime = new Date().toISOString();
  
  document.getElementById('btnStart').style.display = 'none';
  document.getElementById('btnStop').style.display = 'flex';
  
  timerInterval = setInterval(() => {
    seconds++;
    const date = new Date(0); date.setSeconds(seconds);
    document.getElementById('timer').innerText = date.toISOString().substr(11, 8);
  }, 1000);

  watchId = navigator.geolocation.watchPosition(p => {
    routeCoords.push({lat: p.coords.latitude, lon: p.coords.longitude});
    document.getElementById('points').innerText = routeCoords.length;
    document.getElementById('gpsStatus').innerText = "Rastreando";
  }, e => console.error(e), {enableHighAccuracy:true});
}

async function stopRoute() {
  if(!confirm("Finalizar rota?")) return;
  clearInterval(timerInterval); 
  navigator.geolocation.clearWatch(watchId);
  showLoading(true, "ENVIANDO ROTA...");
  
  // Envia rota (se KML não gera, é config do Backend Drive API)
  const res = await apiCall('saveRoute', {
      vendedor: loggedUser, 
      inicioISO: routeStartTime, 
      fimISO: new Date().toISOString(), 
      coordenadas: routeCoords
  });
  
  showLoading(false);
  if ((res && res.status === 'success') || res === 'CORS_ERROR_BUT_SENT') {
      alert("✅ Rota salva!");
      // Reset UI
      document.getElementById('btnStart').style.display = 'flex';
      document.getElementById('btnStop').style.display = 'none';
      document.getElementById('timer').innerText = "00:00:00"; 
      document.getElementById('points').innerText = "0";
      document.getElementById('gpsStatus').innerText = "Parado";
      navegarPara('dashboard');
  } else {
      alert("Erro ao salvar rota.");
  }
}

// ------------------------------------------------------------
// 8. API CALL
// ------------------------------------------------------------
async function apiCall(route, payload, show=true, suppress=false) {
  if(show) showLoading(true);
  try {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({route, payload, token: TOKEN})
    });
    
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } 
    catch (e) { 
        if (route === 'addLead' || route === 'saveRoute') {
            if(show) showLoading(false);
            return 'CORS_ERROR_BUT_SENT';
        }
        throw new Error("Servidor não retornou JSON."); 
    }

    if(show) showLoading(false);
    if (json.status === 'error') throw new Error(json.message);
    return json;

  } catch(e) {
    if(show) showLoading(false);
    
    // Tratamento de falha silenciosa para POST
    if (e.name === 'TypeError' && (route === 'addLead' || route === 'saveRoute')) {
         return 'CORS_ERROR_BUT_SENT';
    }
    
    if(!suppress && route !== 'getLeads') alert("Erro conexão: " + e.message);
    return null;
  }
}

function showLoading(show, txt) {
  const loader = document.getElementById('loader');
  const loaderTxt = document.getElementById('loaderText');
  if(loader) loader.style.display = show ? 'flex' : 'none';
  if(loaderTxt && txt) loaderTxt.innerText = txt;
}
