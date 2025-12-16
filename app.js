/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND (v10.3 - Modo Debug Blindado)
 * ============================================================
 */

// ⚠️ IMPORTANTE: Se der erro de CORS, gere uma NOVA IMPLANTAÇÃO como "QUALQUER PESSOA"
// e cole o novo ID aqui:
const DEPLOY_ID = 'AKfycbxMuP7gF6WM3syD4dpraqkMPRpInQ2xkc5_09o3fuNBIHTCn8UVQFRdPpH4wiVpccvz'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// LISTA FIXA DE SEGURANÇA
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
  console.log("🏁 [INIT] Aplicação iniciada.");

  // Força o Chat a ficar oculto no início (Correção visual)
  const chatModal = document.getElementById('chatModal');
  if (chatModal) chatModal.style.display = 'none';

  // 1.1 Injeta lista de vendedores imediatamente
  const select = document.getElementById('userSelect');
  if(select) {
      select.innerHTML = '<option value="">Toque para selecionar...</option>';
      VENDEDORES_OFFLINE.forEach(nome => {
          const opt = document.createElement('option');
          opt.value = nome;
          opt.innerText = nome;
          select.appendChild(opt);
      });
      console.log("✅ [INIT] Lista de vendedores injetada.");
  }

  // 1.2 MODO DE TESTE: Sempre mostra o login primeiro (Ignora auto-login)
  // Para voltar ao normal depois, descomente o bloco if abaixo e remova as linhas seguintes
  
  /*
  if (loggedUser) {
    console.log(`👤 [AUTH] Usuário recuperado: ${loggedUser}`);
    initApp();
  } else {
    mostrarLogin();
  }
  */
  
  // Força tela de login para validação
  console.log("🛠️ [DEBUG] Forçando tela de login para testes.");
  mostrarLogin();
});

function mostrarLogin() {
    console.log("👤 [AUTH] Mostrando tela de login.");
    const menu = document.getElementById('userMenu');
    const main = document.getElementById('mainContent');
    if(menu) menu.style.display = 'flex';
    if(main) main.style.display = 'none';
}

function initApp() {
  const menu = document.getElementById('userMenu');
  const main = document.getElementById('mainContent');
  
  if(menu) menu.style.display = 'none';
  if(main) main.style.display = 'block';
  
  const uiInfo = document.getElementById('userInfo');
  if(uiInfo) uiInfo.textContent = `Vendedor: ${loggedUser}`;
  
  navegarPara('dashboard');
  
  // Tenta carregar leads, mas não trava se der erro
  setTimeout(() => carregarLeads(), 500);
}

// ============================================================
// 2. NAVEGAÇÃO
// ============================================================
function navegarPara(pageId) {
  console.log(`🔄 [NAV] Navegando para: ${pageId}`);
  
  // Esconde todas as páginas
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  
  // Mostra a página alvo
  const target = document.getElementById(pageId);
  if(target) {
      target.style.display = 'block';
      target.classList.remove('fade-in');
      void target.offsetWidth; // Reinicia animação
      target.classList.add('fade-in');
  } else {
      console.error(`❌ [NAV] Página ID '${pageId}' não encontrada!`);
      return;
  }
  
  window.scrollTo(0, 0);

  // Atualiza botões do rodapé
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active', 'text-blue-700');
    el.classList.add('text-slate-400');
  });

  // Mapeamento Página -> Botão
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

function setLoggedUser() {
  const select = document.getElementById('userSelect');
  if (select && select.value) {
    loggedUser = select.value;
    localStorage.setItem('loggedUser', loggedUser);
    console.log(`✅ [AUTH] Login efetuado com sucesso: ${loggedUser}`);
    initApp();
  } else {
    alert('Por favor, selecione seu nome na lista!');
  }
}

function logout() {
  if(confirm("Tem certeza que deseja sair?")) {
    console.log("👋 [AUTH] Logout realizado.");
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// ============================================================
// 3. INTEGRAÇÃO IA (GEMINI)
// ============================================================

async function chamarGemini(prompt) {
  if (!GEMINI_KEY) {
      console.warn("⚠️ [IA] Sem chave API Gemini configurada.");
      return null;
  }
  
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (res.status === 403) {
        console.error("❌ [IA] Erro 403: Chave inválida.");
        return null;
    }
    
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { 
    console.error("❌ [IA] Erro na requisição:", e);
    return null; 
  }
}

// --- 3.1 Chat Assistente (FIXED) ---
function toggleChat() {
    const el = document.getElementById('chatModal');
    const history = document.getElementById('chatHistory');
    
    if (!el) return console.error("❌ Elemento chatModal não encontrado!");

    // Usa style.display para garantir funcionamento sem CSS externo
    if (el.style.display === 'none' || el.classList.contains('hidden')) {
        el.style.display = 'block'; // Força mostrar
        el.classList.remove('hidden');
        
        // Foca no input
        const input = document.getElementById('chatInput');
        if(input) setTimeout(() => input.focus(), 300);
        
        // Mensagem inicial
        if(history && (!history.hasChildNodes() || history.innerHTML.trim() === "")) {
             history.innerHTML = `
                <div class="flex gap-3 fade-in">
                    <div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div>
                    <div class="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[85%]">
                        Olá ${loggedUser ? loggedUser.split(' ')[0] : 'Vendedor'}! Sou o assistente MHNET. Como posso ajudar nas vendas?
                    </div>
                </div>`;
        }
    } else {
        el.style.display = 'none'; // Força esconder
        el.classList.add('hidden');
    }
}

async function enviarMensagemChat() {
    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    if(!input || !history) return;

    const msg = input.value.trim();
    if(!msg) return;

    // Mensagem Usuario
    history.innerHTML += `
        <div class="flex gap-3 justify-end fade-in">
            <div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">
                ${msg}
            </div>
        </div>`;
    input.value = '';
    history.scrollTop = history.scrollHeight;

    // Loading
    const loadingId = 'loading-' + Date.now();
    history.innerHTML += `
        <div id="${loadingId}" class="flex gap-3 fade-in">
            <div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div>
            <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm flex gap-1">
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
            </div>
        </div>`;
    history.scrollTop = history.scrollHeight;

    const prompt = `Aja como um especialista comercial da MHNET Telecom. Responda de forma curta e útil: "${msg}"`;
    const response = await chamarGemini(prompt);
    
    const loadEl = document.getElementById(loadingId);
    if(loadEl) loadEl.remove();

    if(response) {
         const formatted = response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
         history.innerHTML += `
            <div class="flex gap-3 fade-in">
                <div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div>
                <div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">
                    ${formatted}
                </div>
            </div>`;
    } else {
        history.innerHTML += `<div class="text-center text-xs text-red-400 mt-2 fade-in">Sem resposta da IA.</div>`;
    }
    history.scrollTop = history.scrollHeight;
}

// --- 3.2 Pitch ---
async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if (!nome) return alert("⚠️ Preencha o nome do cliente primeiro!");
  
  showLoading(true, "CRIANDO PITCH...");
  const prompt = `Crie uma mensagem curta para WhatsApp para vender internet fibra MHNET para ${nome}. Use emojis.`;
  const txt = await chamarGemini(prompt);
  showLoading(false);
  
  if (txt) document.getElementById('leadObs').value = txt.replace(/["*]/g, '');
}

// --- 3.3 Análise ---
async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Sem leads para analisar.");
  
  showLoading(true, "ANALISANDO...");
  const bairros = [...new Set(leadsCache.slice(0, 30).map(l => l.bairro || 'Geral'))].join(', ');
  const prompt = `Analise estes bairros e sugira uma rota lógica: ${bairros}.`;
  const txt = await chamarGemini(prompt);
  showLoading(false);
  
  if (txt) alert(`💡 DICA:\n\n${txt}`);
}

// --- 3.4 Coach ---
async function gerarCoachIA() {
  showLoading(true, "COACH...");
  const hoje = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  
  const prompt = `O vendedor fez ${leadsHoje} leads hoje. Dê um feedback motivacional curto (1 frase).`;
  const txt = await chamarGemini(prompt);
  showLoading(false);
  
  if(txt) alert(`🚀 COACH:\n\n${txt.replace(/\*\*/g, '')}`);
}

// ============================================================
// 4. OPERAÇÕES DE DADOS (CRUD)
// ============================================================

// --- Salvar Lead ---
async function enviarLead() {
  console.group("💾 [DATA] Iniciando Envio de Lead");
  const nome = document.getElementById('leadNome').value.trim();
  const tel = document.getElementById('leadTelefone').value.trim();
  
  if (!nome || !tel) {
      console.warn("Campos obrigatórios vazios.");
      console.groupEnd();
      return alert("⚠️ Preencha Nome e Telefone!");
  }
  
  showLoading(true, "SALVANDO...");
  
  const payload = {
    vendedor: loggedUser,
    nomeLead: nome,  
    lead: nome, // Backup
    telefone: tel,
    whatsapp: tel, // Backup
    endereco: document.getElementById('leadEndereco').value,
    cidade: document.getElementById('leadCidade').value,
    bairro: document.getElementById('leadBairro').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value,
    provedor: "", 
    timestamp: new Date().toISOString()
  };
  
  console.log("📦 Payload gerado:", payload);

  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  if (res && res.status === 'success') {
    console.log("✅ Sucesso ao salvar lead.");
    alert('✅ Lead salvo com sucesso!');
    
    // Limpar campos
    document.getElementById('leadNome').value = ''; 
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = ''; 
    document.getElementById('leadObs').value = '';
    
    carregarLeads(); 
    navegarPara('gestaoLeads');
  } else {
    // Alerta detalhado no console, alerta simples pro usuário se apiCall não deu
    if(res) alert('❌ Erro ao salvar: ' + res.message);
  }
  console.groupEnd();
}

// --- Carregar Leads ---
async function carregarLeads() {
  console.group("📥 [DATA] Carregando Leads");
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) lista.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8">Atualizando...</div>';

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    console.log(`Recebidos ${res.data.length} leads brutos.`);
    
    // Filtra leads do usuário
    leadsCache = (res.data || []).filter(l => {
      const v = (l.vendedor || l.Vendedor || '').toLowerCase();
      return v.includes(loggedUser.toLowerCase());
    });
    
    console.log(`Filtrados ${leadsCache.length} leads para ${loggedUser}.`);
    renderLeads();
    atualizarDashboard();
  } else {
    console.error("Erro ao carregar leads:", res);
    if(lista) lista.innerHTML = '<div style="text-align:center; color:red; padding:20px">Não foi possível carregar o histórico.</div>';
  }
  console.groupEnd();
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead || l.lead || '').toLowerCase().includes(term) || 
    (l.bairro || '').toLowerCase().includes(term) ||
    (l.telefone || '').includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = '<div style="text-align:center; padding:60px; color:#cbd5e1">Nenhum registro.</div>';
    return;
  }

  div.innerHTML = filtrados.map(l => {
    const nome = l.nomeLead || l.lead || 'Cliente';
    const bairro = l.bairro || 'Geral';
    const interesse = (l.interesse || 'Novo').toUpperCase();
    const tel = l.telefone || l.whatsapp || '';
    
    // Tenta formatar data de string DD/MM/YYYY HH:mm:ss
    let dataShow = 'Hoje';
    if(l.timestamp) {
        dataShow = l.timestamp.split(' ')[0];
    }
    
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
  const count = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

// ============================================================
// 5. ROTA E GPS
// ============================================================

function startRoute() {
  console.log("📍 [GPS] Solicitando localização...");
  if (!navigator.geolocation) return alert('Ative o GPS.');
  
  routeCoords = []; 
  seconds = 0; 
  routeStartTime = new Date().toISOString();
  
  updateRouteUI(true);
  
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
  }, e => console.error("Erro GPS:", e), {enableHighAccuracy:true});
}

async function stopRoute() {
  if(!confirm("Finalizar rota?")) return;
  console.log("🛑 [GPS] Parando rota. Pontos:", routeCoords.length);
  
  clearInterval(timerInterval);
  navigator.geolocation.clearWatch(watchId);
  
  showLoading(true, "ENVIANDO ROTA...");
  const res = await apiCall('saveRoute', {
      vendedor: loggedUser, 
      inicioISO: routeStartTime, 
      fimISO: new Date().toISOString(), 
      coordenadas: routeCoords
  });
  showLoading(false);
  
  if (res && res.status === 'success') {
      alert("✅ Rota salva!");
      resetRouteUI();
      navegarPara('dashboard');
  } else {
      console.error("Erro ao salvar rota:", res);
      alert("Erro ao salvar rota.");
  }
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
// 6. CONEXÃO API (ROBUSTA)
// ============================================================
async function apiCall(route, payload, show=true, suppress=false) {
  if(show) showLoading(true);
  console.log(`📡 [API] Chamando: ${route}`, payload);
  
  try {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
        body: JSON.stringify({route, payload, token: TOKEN})
    });
    
    // Verifica se a resposta HTTP é OK
    if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
    }

    const text = await res.text();
    let json;
    
    try { 
        json = JSON.parse(text); 
        console.log(`✅ [API] Resposta JSON (${route}):`, json);
    } catch (e) { 
        console.error(`❌ [API] Resposta inválida (${route}):`, text);
        // Não lançamos erro se for só HTML de redirecionamento, tratamos como erro de rede
        throw new Error("Servidor não retornou JSON. Verifique CORS/Deploy."); 
    }

    if(show) showLoading(false);
    
    if (json.status === 'error') throw new Error(json.message);
    return json;

  } catch(e) {
    if(show) showLoading(false);
    console.error(`❌ [API] Erro na requisição (${route}):`, e);
    
    // Detecção específica de erro de permissão (CORS)
    if (e.name === 'TypeError' && e.message.includes('fetch')) {
        if(!suppress) {
            alert("⚠️ ERRO DE CONEXÃO (CORS)\n\nO servidor Google recusou a conexão.\n\nSOLUÇÃO:\nNo Google Apps Script: Implantar > Nova Implantação > 'Qualquer Pessoa'.\n\nCole o novo ID no topo do app.js.");
        }
    } else {
        if(!suppress) alert("Erro conexão: " + e.message);
    }
    return null;
  }
}

function showLoading(show, txt) {
  const loader = document.getElementById('loader');
  const loaderTxt = document.getElementById('loaderText');
  if(loader) loader.style.display = show ? 'flex' : 'none';
  if(loaderTxt && txt) loaderTxt.innerText = txt;
}
