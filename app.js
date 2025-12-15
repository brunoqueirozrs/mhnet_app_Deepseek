/**
 * ============================================================
 * MHNET VENDAS EXTERNAS - FRONTEND LOGIC (v5.0 - AI Powered)
 * Conecta com Backend Google Apps Script + Gemini AI
 * ============================================================
 */

// --- CONFIGURAÇÃO DA API ---
// Substitua pela URL da sua nova implantação no Google Apps Script se mudou
const DEPLOY_ID = 'AKfycbyWYgd3r5pA1dYB5LD_PY6m4V2FjWG-Oi6vYjlvNBre9r_eGiPlhia-HtJjD2Mnfc9F'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// Token de segurança (Deve ser igual ao do Code.gs)
const TOKEN = "MHNET2025#SEG";

// Chave da API Gemini (NECESSÁRIA PARA AS FUNÇÕES DE IA)
// Adicione sua chave aqui para ativar:
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// --- ESTADO GLOBAL ---
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let routeCoords = [];
let watchId = null;
let timerInterval = null;
let seconds = 0;
let routeStartTime = null;

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  // Verifica se a URL foi configurada corretamente
  if (API_URL.includes("COLE_SUA")) {
    alert("ERRO CRÍTICO: Configure a URL da API no arquivo app.js");
    return;
  }

  // Verifica se já existe um utilizador autenticado
  if (loggedUser) {
    initApp();
  } else {
    showUserMenu(); // Agora a função existe!
    carregarVendedores(); // Carrega lista para o login
  }
});

function initApp() {
  const menu = document.getElementById('userMenu');
  const main = document.getElementById('mainContent');
  const userInfo = document.getElementById('userInfo');

  if(menu) menu.style.display = 'none';
  if(main) main.style.display = 'block';
  
  const userDisplay = `Vendedor: ${loggedUser}`;
  if (userInfo) userInfo.textContent = userDisplay;

  showPage('dashboard');
  carregarLeads(); // Carrega leads em background
}

// --- NAVEGAÇÃO & LAYOUT ---
function showPage(pageId) {
  // Esconde todas as páginas
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  
  // Mostra a página desejada
  const target = document.getElementById(pageId);
  if (target) {
    target.style.display = 'block';
    window.scrollTo(0, 0); // Rola para o topo
  }
  
  if (pageId === 'dashboard') atualizarDashboard();
}

function showUserMenu() {
  const menu = document.getElementById('userMenu');
  const main = document.getElementById('mainContent');
  
  // Garante que o menu de usuário (login) apareça e o resto suma
  if (menu) menu.style.display = 'flex'; 
  if (main) main.style.display = 'none';
}

function toggleUserMenu() {
  const menu = document.getElementById('userMenu');
  if (menu) {
    const isVisible = menu.style.display === 'flex' || menu.style.display === 'block';
    if (isVisible) {
      menu.style.display = 'none';
    } else {
      menu.style.display = 'flex';
      carregarVendedores();
    }
  }
}

// --- GESTÃO DE USUÁRIO (COM FALLBACK DE SEGURANÇA) ---
async function carregarVendedores() {
  const select = document.getElementById('userSelect');
  if (!select) return;
  
  if (select.options.length <= 1) {
    select.innerHTML = '<option>Carregando...</option>';
  }
  
  const listaSeguranca = [
    {nome: "Ana Paula Rodrigues"}, {nome: "Vitoria Caroline Baldez Rosales"}, 
    {nome: "João Vithor Sader"}, {nome: "João Paulo da Silva Santos"}, 
    {nome: "Claudia Maria Semmler"}, {nome: "Diulia Vitoria Machado Borges"}, 
    {nome: "Elton da Silva Rodrigo Gonçalves"}
  ];

  try {
    const res = await apiCall('getVendedores', {}, false, true); 
    
    let listaFinal = [];

    if (res && res.status === 'success' && res.data && Array.isArray(res.data)) {
      listaFinal = res.data;
    } else {
      listaFinal = listaSeguranca;
    }

    renderizarOpcoesVendedores(select, listaFinal);

  } catch (e) {
    console.error("Erro fatal ao carregar vendedores:", e);
    renderizarOpcoesVendedores(select, listaSeguranca);
  }
}

function renderizarOpcoesVendedores(selectElement, lista) {
  selectElement.innerHTML = '<option value="">Selecione seu nome...</option>';
  lista.forEach(v => {
    const nome = v.nome || v.Nome || v[0]; 
    if (nome) {
      const opt = document.createElement('option');
      opt.value = nome;
      opt.innerText = nome;
      selectElement.appendChild(opt);
    }
  });
}

function setLoggedUser() {
  const select = document.getElementById('userSelect');
  if (select && select.value) {
    loggedUser = select.value;
    localStorage.setItem('loggedUser', loggedUser);
    initApp();
  } else {
    alert('Por favor, selecione um vendedor da lista!');
  }
}

function logout() {
  if(confirm("Tem a certeza que deseja sair?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// --- INTEGRAÇÃO IA (GEMINI API) ---
// Função auxiliar central para chamar o Gemini
async function chamarGemini(prompt, modalidade = "texto") {
  if (!GEMINI_KEY) {
    alert("⚠️ Chave API Gemini não configurada no arquivo app.js");
    return null;
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const data = await response.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!texto) throw new Error("Sem resposta da API");
    return texto;
    
  } catch (error) {
    console.error("Erro IA:", error);
    alert("Erro ao conectar com a Inteligência Artificial. Verifique a conexão.");
    return null;
  }
}

// 1. Gerador de Abordagem/Pitch (Para WhatsApp)
async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  const interesse = document.getElementById('leadInteresse').value;
  const bairro = document.getElementById('leadBairro').value || "Lajeado";
  
  if (!nome) return alert("Preencha o nome do cliente primeiro!");
  
  showLoading(true, "✨ IA Criando Pitch...");
  
  const prompt = `
    Aja como um vendedor experiente da provedora de internet MHNET.
    Crie uma mensagem curta e persuasiva para WhatsApp para o cliente ${nome}.
    Contexto: O cliente mora no bairro ${bairro} e tem interesse nível ${interesse}.
    Objetivo: Agendar instalação ou visita.
    Destaque: Fibra óptica, estabilidade.
    Tom: Profissional mas amigável. Use emojis. Sem hashtags.
  `;
  
  const txt = await chamarGemini(prompt);
  if (txt) document.getElementById('leadObs').value = txt;
  showLoading(false);
}

// 2. Refinador de Notas (Novo!)
// Pega texto "sujo" (anotação rápida) e transforma em log profissional
async function refinarObservacaoIA() {
  const obsField = document.getElementById('leadObs');
  const rawText = obsField.value;

  if (!rawText || rawText.length < 5) return alert("Escreva algo no campo de observação primeiro.");

  showLoading(true, "✨ IA Refinando Texto...");

  const prompt = `
    Você é um assistente de CRM. Reescreva a seguinte anotação de um vendedor de campo de forma clara, profissional e gramaticalmente correta.
    Mantenha a essência da informação, mas remova gírias desnecessárias e melhore a pontuação.
    Texto original: "${rawText}"
    Saída (apenas o texto corrigido):
  `;

  const refinedText = await chamarGemini(prompt);
  if (refinedText) obsField.value = refinedText.trim();
  
  showLoading(false);
}

// 3. Consultor de Carteira/Estratégia (Novo!)
// Analisa a lista de leads atual e sugere prioridades
async function analisarCarteiraIA() {
  if (leadsCache.length === 0) return alert("Nenhum lead para analisar.");

  showLoading(true, "✨ IA Analisando Carteira...");

  // Prepara resumo dos dados para enviar ao Gemini (Anonimizado para economizar tokens e privacidade)
  const resumoLeads = leadsCache.map(l => {
    const bairro = l.bairro || l.Bairro || "Geral";
    const interesse = l.interesse || l.Interesse || "Médio";
    return `- Bairro: ${bairro}, Interesse: ${interesse}`;
  }).slice(0, 30).join("\n"); // Limita a 30 para não estourar tokens simples

  const prompt = `
    Aja como um estrategista de vendas externas.
    Analise esta lista de leads pendentes de um vendedor:
    ${resumoLeads}

    Com base nestes dados, sugira uma estratégia curta (máximo 3 pontos) para o dia de hoje.
    Exemplo: "Foque no bairro X pois tem alta concentração de interesse Alto".
    Responda em Tópicos com emojis.
  `;

  const conselho = await chamarGemini(prompt);
  
  showLoading(false);
  
  if (conselho) {
    // Cria um modal simples ou usa alert formatado
    alert(`🤖 Estratégia do Dia:\n\n${conselho}`);
  }
}

// 4. Coach Motivacional (Existente melhorado)
async function gerarCoachIA() {
  showLoading(true, "✨ Coach IA Analisando...");
  
  const hoje = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => {
    const dataLead = l.timestamp || l.Data || new Date().toISOString();
    return new Date(dataLead).toLocaleDateString('pt-BR') === hoje;
  }).length;
  
  const prompt = `
    Aja como um gerente de vendas motivacional enérgico.
    Hoje é ${hoje}. O vendedor ${loggedUser} cadastrou ${leadsHoje} leads hoje.
    Meta diária ideal: 10 leads.
    
    Se leads < 5: Dê uma bronca motivacional engraçada e encoraje.
    Se leads >= 5 e < 10: Diga que está quase lá.
    Se leads >= 10: Parabenize com entusiasmo.
    
    Use emojis. Máximo 2 parágrafos curtos.
  `;
  
  const txt = await chamarGemini(prompt);
  if(txt) alert(`🤖 Coach IA diz:\n\n${txt}`);
  showLoading(false);
}

// --- ROTA & GPS ---
function startRoute() {
  if (!navigator.geolocation) return alert('GPS não suportado neste dispositivo.');
  
  routeCoords = [];
  seconds = 0;
  routeStartTime = new Date().toISOString();
  
  updateRouteUI(true);
  
  // Inicia Timer
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    seconds++;
    const h = Math.floor(seconds / 3600).toString().padStart(2,'0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2,'0');
    const s = (seconds % 60).toString().padStart(2,'0');
    
    const elTimer = document.getElementById('timer');
    if (elTimer) elTimer.innerText = `${h}:${m}:${s}`;
  }, 1000);

  // Inicia Rastreamento GPS
  watchId = navigator.geolocation.watchPosition(
    pos => {
      routeCoords.push({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      
      const elPoints = document.getElementById('points');
      const elGps = document.getElementById('gpsStatus');
      
      if (elPoints) elPoints.innerText = routeCoords.length;
      if (elGps) {
        elGps.innerText = "✅ Rastreando";
        elGps.className = "status-badge success"; // Classe CSS verde
      }
    },
    err => {
      const elGps = document.getElementById('gpsStatus');
      if (elGps) {
        elGps.innerText = "❌ Erro GPS";
        elGps.className = "status-badge error";
      }
      console.error("Erro GPS:", err);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
  );
}

async function stopRoute() {
  if (!confirm("Deseja finalizar a rota e enviar os dados para a central?")) return;
  
  clearInterval(timerInterval);
  if (watchId) navigator.geolocation.clearWatch(watchId);
  
  showLoading(true, "Salvando Rota...");
  
  const payload = {
    vendedor: loggedUser,
    inicioISO: routeStartTime,
    fimISO: new Date().toISOString(),
    coordenadas: routeCoords
  };
  
  const res = await apiCall('saveRoute', payload);
  showLoading(false);
  
  if (res && res.status === 'success') {
    alert('Rota finalizada e salva com sucesso!');
    resetRouteUI();
    showPage('dashboard');
  } else {
    alert('Erro ao salvar rota. Verifique sua conexão e tente novamente.');
  }
}

function updateRouteUI(isTracking) {
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const elGps = document.getElementById('gpsStatus');
  
  if (btnStart) btnStart.style.display = isTracking ? 'none' : 'flex';
  if (btnStop) btnStop.style.display = isTracking ? 'flex' : 'none';
  if (isTracking && elGps) elGps.innerText = "Iniciando GPS...";
}

function resetRouteUI() {
  updateRouteUI(false);
  const elGps = document.getElementById('gpsStatus');
  const elTimer = document.getElementById('timer');
  const elPoints = document.getElementById('points');

  if (elGps) {
    elGps.innerText = "Aguardando...";
    elGps.className = "status-badge";
  }
  if (elTimer) elTimer.innerText = "00:00:00";
  if (elPoints) elPoints.innerText = "0";
  
  routeCoords = [];
  seconds = 0;
}

// --- LEADS ---
async function enviarLead() {
  const nome = document.getElementById('leadNome').value;
  const tel = document.getElementById('leadTelefone').value;
  
  if (!nome || !tel) return alert("Preencha pelo menos Nome e Telefone");
  
  showLoading(true, "Salvando Lead...");
  
  const payload = {
    vendedor: loggedUser,
    lead: nome, 
    nomeLead: nome, // Compatibilidade com colunas variadas
    telefone: tel,
    whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value,
    bairro: document.getElementById('leadBairro').value,
    cidade: document.getElementById('leadCidade').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value
  };
  
  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  if (res && res.status === 'success') {
    alert('Lead salvo com sucesso!');
    
    // Limpa formulário
    document.getElementById('leadNome').value = '';
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = '';
    document.getElementById('leadObs').value = '';
    
    carregarLeads(); 
    showPage('gestaoLeads');
  } else {
    alert('Erro ao salvar: ' + (res?.message || 'Tente novamente'));
  }
}

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  
  // Loading discreto se a lista estiver vazia
  if (lista && !lista.hasChildNodes()) {
    lista.innerHTML = '<div style="text-align:center; padding:20px; color:#666">Carregando...</div>';
  }

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    // Cache local dos leads deste vendedor (Robustez para dados null)
    const dados = res.data || [];
    leadsCache = dados.filter(l => l && (l.vendedor === loggedUser || l.Vendedor === loggedUser));
    renderLeads();
    atualizarDashboard();
  } else {
    if (lista && leadsCache.length === 0) {
      lista.innerHTML = '<div style="text-align:center; color:red; padding:20px">Erro ao carregar leads. Verifique a conexão.</div>';
    }
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;

  const searchInput = document.getElementById('searchLead');
  const term = (searchInput ? searchInput.value : '').toLowerCase();
  
  // Helper para pegar propriedades de forma segura (ignora Case Sensitivity)
  const getProp = (obj, key) => (obj[key] || obj[key.charAt(0).toUpperCase() + key.slice(1)] || '').toString();

  const filtrados = leadsCache.filter(l => {
    if (!l) return false;
    const nome = getProp(l, 'nomeLead') || getProp(l, 'lead') || getProp(l, 'nome');
    const tel = getProp(l, 'telefone');
    const bairro = getProp(l, 'bairro');
    
    return (nome.toLowerCase().includes(term) || tel.includes(term) || bairro.toLowerCase().includes(term));
  });
  
  if (filtrados.length === 0) {
    div.innerHTML = '<div style="text-align:center; padding:20px; color:#888">Nenhum lead encontrado.</div>';
    return;
  }

  div.innerHTML = filtrados.map(l => {
    // Extração segura de dados
    const nome = getProp(l, 'nomeLead') || getProp(l, 'lead') || 'Cliente Sem Nome';
    const tel = getProp(l, 'telefone');
    const bairro = getProp(l, 'bairro') || 'Bairro ñ informado';
    const interesse = (getProp(l, 'interesse') || 'NOVO').toUpperCase();
    const timestamp = l.timestamp || l.Data || new Date().toISOString();

    // Cores baseadas no interesse
    let statusColor = '#f0f0f0';
    let statusTextColor = '#555';
    
    if(interesse.includes('ALTO')) { statusColor = '#e6fffa'; statusTextColor = '#008f75'; } // Verde
    else if(interesse.includes('MÉDIO') || interesse.includes('MEDIO')) { statusColor = '#fffaf0'; statusTextColor = '#c05621'; } // Laranja
    else if(interesse.includes('BAIXO')) { statusColor = '#fff5f5'; statusTextColor = '#c53030'; } // Vermelho

    // Link do WhatsApp
    const wppLink = `https://wa.me/55${tel.replace(/\D/g, '')}`;

    return `
    <div class="lead-card-gestao" style="background:white; padding:16px; margin-bottom:12px; border-radius:12px; border:1px solid #edf2f7; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
        <div>
          <div style="font-weight:bold; color:#2d3748; font-size:1.1em; margin-bottom:2px">${nome}</div>
          <div style="font-size:0.85em; color:#718096">📅 ${new Date(timestamp).toLocaleDateString('pt-BR')}</div>
        </div>
        <span style="background:${statusColor}; color:${statusTextColor}; padding:4px 8px; border-radius:20px; font-size:0.75em; font-weight:800; letter-spacing:0.5px">${interesse}</span>
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="flex:1">
          <div style="font-size:0.95em; color:#4a5568; margin-bottom:4px; display:flex; align-items:center">
             <span style="margin-right:6px">📞</span> ${tel}
          </div>
          <div style="font-size:0.95em; color:#4a5568; display:flex; align-items:center">
             <span style="margin-right:6px">📍</span> ${bairro}
          </div>
        </div>

        <a href="${wppLink}" target="_blank" style="margin-left:10px; background:#25D366; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 6px rgba(37, 211, 102, 0.3); transition: transform 0.2s">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-8.68-2.031-.967-.272-.099-.47-.149-.669.198-.198.347-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.495.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.248-.57-.397z"/></svg>
        </a>
      </div>
    </div>
    `;
  }).join('');
}

function atualizarDashboard() {
  // Stats do dia
  const hojeStr = new Date().toLocaleDateString('pt-BR');
  const leadsHoje = leadsCache.filter(l => {
    const data = l.timestamp || l.Data || new Date().toISOString();
    return new Date(data).toLocaleDateString('pt-BR') === hojeStr;
  }).length;
  
  const elStat = document.getElementById('statLeads');
  if (elStat) elStat.innerText = leadsHoje;

  // Último lead card
  if (leadsCache.length > 0) {
    const l = leadsCache[0]; 
    const elContent = document.getElementById('lastLeadContent');
    const getProp = (obj, key) => (obj[key] || obj[key.charAt(0).toUpperCase() + key.slice(1)] || '').toString();
    
    if (elContent) {
      const nome = getProp(l, 'nomeLead') || getProp(l, 'lead') || 'Recente';
      const bairro = getProp(l, 'bairro') || 'Geral';
      const cidade = getProp(l, 'cidade') || '';
      const data = l.timestamp || l.Data || new Date().toISOString();

      elContent.innerHTML = `
        <div style="font-weight:bold; font-size:1.1em; color:#004AAD; margin-bottom:5px">${nome}</div>
        <div style="color:#555; font-size:0.95em">📍 ${bairro} ${cidade ? '- ' + cidade : ''}</div>
        <div style="font-size:0.85em; color:#888; margin-top:8px; border-top:1px solid #f0f0f0; padding-top:6px">
          🕒 ${new Date(data).toLocaleString('pt-BR')}
        </div>
      `;
    }
  }
}

// --- COMUNICAÇÃO API (SISTEMA ROBUSTO DE RETRY) ---
async function apiCall(action, payload = {}, showLoader = true, suppressAlert = false) {
  if (!API_URL || API_URL.includes("SUA_URL")) {
    alert("ERRO DE CONFIGURAÇÃO: Verifique a API_URL no arquivo app.js");
    return null;
  }
  
  if (showLoader) showLoading(true, "Processando...");

  const MAX_RETRIES = 3;
  let attempt = 0;
  
  while (attempt < MAX_RETRIES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ 
          route: action, 
          payload: payload, 
          token: TOKEN 
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      // Tratamento de resposta HTML (erro comum no Google Apps Script)
      const text = await response.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error("Resposta do servidor não é JSON válido: " + text.substring(0, 50) + "...");
      }

      if (showLoader) showLoading(false);
      
      if (json.status === 'error') throw new Error(json.message);
      return json;

    } catch (e) {
      attempt++;
      console.warn(`Tentativa ${attempt} falhou:`, e);
      
      if (showLoader) {
        const loaderText = document.getElementById('loaderText');
        if(loaderText) loaderText.innerText = `Reconectando (${attempt}/${MAX_RETRIES})...`;
      }

      if (attempt === MAX_RETRIES) {
        if (showLoader) showLoading(false);
        console.error("Falha final na API:", e);
        
        let msg = "Erro de conexão.";
        if (e.name === 'AbortError') msg = "Tempo limite excedido.";
        if (e.message && e.message.includes('JSON')) msg = "Erro no script do servidor.";
        
        if (!suppressAlert && !action.startsWith('get')) {
          alert(`Falha: ${msg} Tente novamente.`);
        }
        return null;
      }
      
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
}

// --- UI HELPERS ---
function showLoading(show, text) {
  const el = document.getElementById('loader');
  const txt = document.getElementById('loaderText');
  
  if (show) {
    if(txt) txt.innerText = text || "Carregando...";
    if(el) el.style.display = 'flex';
  } else {
    if(el) el.style.display = 'none';
  }
}
