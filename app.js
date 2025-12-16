/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND (v10.2 - Documentado)
 * * GUIA RÁPIDO PARA MANUTENÇÃO:
 * 1. Configurações: Mude IDs e Chaves no topo do arquivo.
 * 2. Login: Funções 'initApp' e 'setLoggedUser'.
 * 3. Telas: Função 'navegarPara' controla qual tela aparece.
 * 4. IA: Funções 'chamarGemini' e derivadas controlam o cérebro do app.
 * 5. Dados: 'enviarLead' e 'carregarLeads' falam com a Planilha.
 * 6. GPS: 'startRoute' controla a geolocalização.
 * ============================================================
 */

// --- CONFIGURAÇÕES GERAIS ---
// Aqui ficam as chaves de acesso. Se mudar a planilha ou o script, atualize o DEPLOY_ID.
const DEPLOY_ID = 'AKfycbwM64LebBEQ41LzEO3TB7RXHDreR4uvN2a1kzFbOgc'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG"; // Senha simples para proteger o backend
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; // Chave da Inteligência Artificial

// LISTA FIXA DE SEGURANÇA
// Usada para carregar os nomes no login instantaneamente, mesmo sem internet.
const VENDEDORES_OFFLINE = [
    "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
    "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves"
];

// --- ESTADO GLOBAL (Memória do App) ---
// Variáveis que guardam informações enquanto o app está aberto.
let loggedUser = localStorage.getItem('loggedUser'); // Nome do vendedor logado
let leadsCache = []; // Lista dos últimos leads carregados
let routeCoords = []; // Lista de pontos do GPS
let watchId = null;   // ID do rastreador GPS
let timerInterval = null; // Relógio da rota
let seconds = 0;
let routeStartTime = null;

// ============================================================
// 1. INICIALIZAÇÃO (O que acontece ao abrir o App)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log("🏁 [INIT] Aplicação iniciada.");

  // Preenche a lista de nomes na tela de login assim que o app abre.
  const select = document.getElementById('userSelect');
  if(select) {
      select.innerHTML = '<option value="">Toque para selecionar...</option>';
      VENDEDORES_OFFLINE.forEach(nome => {
          const opt = document.createElement('option');
          opt.value = nome;
          opt.innerText = nome;
          select.appendChild(opt);
      });
      console.log("✅ [INIT] Lista de vendedores carregada.");
  }

  // Se já tiver um usuário salvo no celular, entra direto. Senão, mostra login.
  if (loggedUser) {
    console.log(`👤 [AUTH] Usuário recuperado: ${loggedUser}`);
    initApp();
  } else {
    console.log("👤 [AUTH] Nenhum usuário logado. Mostrando tela de login.");
    document.getElementById('userMenu').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  }
});

/**
 * Função: initApp
 * Objetivo: Preparar a tela principal após o login.
 * O que faz: Esconde o login, mostra o app, coloca o nome do vendedor no topo
 * e carrega o histórico de leads.
 */
function initApp() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('userInfo').textContent = `Vendedor: ${loggedUser}`;
  navegarPara('dashboard');
  carregarLeads(); 
}

// ============================================================
// 2. NAVEGAÇÃO (Troca de Telas)
// ============================================================

/**
 * Função: navegarPara
 * Objetivo: Trocar de página sem recarregar o site.
 * Como usar: Chame navegarPara('id-da-tela') ex: 'cadastroLead'
 */
function navegarPara(pageId) {
  console.log(`🔄 [NAV] Navegando para: ${pageId}`);
  
  // 1. Esconde todas as páginas (divs com classe .page)
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  
  // 2. Mostra apenas a página escolhida e aplica animação de entrada
  const target = document.getElementById(pageId);
  if(target) {
      target.style.display = 'block';
      target.classList.remove('fade-in');
      void target.offsetWidth; // Truque para reiniciar a animação
      target.classList.add('fade-in');
  } else {
      console.error(`❌ [NAV] Página ID '${pageId}' não encontrada!`);
  }
  
  window.scrollTo(0, 0); // Rola para o topo

  // 3. Atualiza os ícones da barra inferior (deixa azul o ativo)
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active', 'text-blue-700');
    el.classList.add('text-slate-400');
  });

  // Lógica para saber qual botão pintar de azul baseado na tela atual
  let btnId = '';
  if(pageId === 'dashboard') btnId = 'nav-home';
  if(pageId === 'cadastroLead') btnId = 'nav-novo';
  if(pageId === 'gestaoLeads') btnId = 'nav-lista';
  if(pageId === 'rota') btnId = 'nav-rota';

  const btn = document.getElementById(btnId);
  // O botão central (+) não muda de cor, por isso checamos se não é ele
  if(btn && !btn.querySelector('div')) { 
      btn.classList.add('active', 'text-blue-700');
      btn.classList.remove('text-slate-400');
  }

  // Se for o painel principal, atualiza os números
  if (pageId === 'dashboard') atualizarDashboard();
}

/**
 * Função: setLoggedUser
 * Objetivo: Salvar quem é o vendedor quando clica em "Entrar".
 */
function setLoggedUser() {
  const select = document.getElementById('userSelect');
  if (select && select.value) {
    loggedUser = select.value;
    localStorage.setItem('loggedUser', loggedUser); // Salva na memória do celular
    console.log(`✅ [AUTH] Login efetuado: ${loggedUser}`);
    initApp();
  } else {
    alert('Por favor, selecione seu nome na lista!');
  }
}

/**
 * Função: logout
 * Objetivo: Sair da conta e limpar a memória.
 */
function logout() {
  if(confirm("Tem certeza que deseja sair?")) {
    console.log("👋 [AUTH] Logout realizado.");
    localStorage.removeItem('loggedUser');
    location.reload(); // Recarrega a página para voltar ao início
  }
}

// ============================================================
// 3. INTEGRAÇÃO IA (Cérebro do App)
// ============================================================

/**
 * Função: chamarGemini
 * Objetivo: Conectar com a API do Google Gemini.
 * Recebe: Um texto (prompt) com a pergunta.
 * Retorna: A resposta da Inteligência Artificial.
 */
async function chamarGemini(prompt) {
  if (!GEMINI_KEY) {
      console.warn("⚠️ [IA] Sem chave API Gemini configurada.");
      return null;
  }
  console.log("🤖 [IA] Perguntando ao Gemini...");
  
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    if (res.status === 403) {
        console.error("❌ [IA] Erro: Chave inválida.");
        return null;
    }
    
    const data = await res.json();
    // Extrai o texto da resposta complexa do Google
    const resposta = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return resposta;
  } catch (e) { 
    console.error("❌ [IA] Erro na requisição:", e);
    return null; 
  }
}

// --- 3.1 Chat Assistente (Botão Flutuante) ---

/**
 * Função: toggleChat
 * Objetivo: Abrir e fechar a janelinha de chat.
 */
function toggleChat() {
    const el = document.getElementById('chatModal');
    const history = document.getElementById('chatHistory');
    
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden'); // Mostra
        
        // Animação de subida
        const content = el.querySelector('div.absolute');
        content.classList.remove('slide-up');
        void content.offsetWidth;
        content.classList.add('slide-up');
        
        setTimeout(() => document.getElementById('chatInput').focus(), 300);
        
        // Mensagem de boas-vindas na primeira vez
        if(!history.hasChildNodes() || history.innerHTML.trim() === "") {
             history.innerHTML = `
                <div class="flex gap-3 fade-in">
                    <div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div>
                    <div class="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[85%]">
                        Olá ${loggedUser ? loggedUser.split(' ')[0] : 'Vendedor'}! Sou o assistente MHNET. Como posso ajudar nas vendas?
                    </div>
                </div>`;
        }
    } else {
        el.classList.add('hidden'); // Esconde
    }
}

/**
 * Função: enviarMensagemChat
 * Objetivo: Enviar o que o usuário digitou para a IA e mostrar a resposta no chat.
 */
async function enviarMensagemChat() {
    const input = document.getElementById('chatInput');
    const history = document.getElementById('chatHistory');
    const msg = input.value.trim();
    if(!msg) return;

    // 1. Mostra a mensagem do usuário na tela (lado direito, azul)
    history.innerHTML += `
        <div class="flex gap-3 justify-end fade-in">
            <div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">
                ${msg}
            </div>
        </div>`;
    input.value = '';
    history.scrollTop = history.scrollHeight; // Rola para baixo

    // 2. Mostra animação de "digitando..."
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

    // 3. Pede resposta à IA
    const prompt = `Aja como um especialista comercial da MHNET Telecom. Responda de forma curta e útil: "${msg}"`;
    const response = await chamarGemini(prompt);
    
    // 4. Remove animação e mostra resposta
    document.getElementById(loadingId)?.remove();

    if(response) {
         // Formata texto (negrito, quebras de linha) para HTML
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

// --- 3.2 Outras Funções de IA ---

// Gera texto de venda para o WhatsApp baseado no nome do cliente
async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if (!nome) return alert("⚠️ Preencha o nome do cliente primeiro!");
  
  showLoading(true, "CRIANDO PITCH...");
  const prompt = `Crie uma mensagem curta para WhatsApp para vender internet fibra MHNET para ${nome}. Use emojis.`;
  const txt = await chamarGemini(prompt);
  showLoading(false);
  
  if (txt) document.getElementById('leadObs').value = txt.replace(/["*]/g, '');
}

// Analisa os bairros visitados e sugere rota
async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Sem leads para analisar.");
  
  showLoading(true, "ANALISANDO...");
  const bairros = [...new Set(leadsCache.slice(0, 30).map(l => l.bairro || 'Geral'))].join(', ');
  const prompt = `Analise estes bairros e sugira uma rota lógica: ${bairros}.`;
  const txt = await chamarGemini(prompt);
  showLoading(false);
  
  if (txt) alert(`💡 DICA:\n\n${txt}`);
}

// Dá uma frase motivacional baseada no número de vendas hoje
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
// 4. OPERAÇÕES DE DADOS (Salvar e Ler da Planilha)
// ============================================================

/**
 * Função: enviarLead
 * Objetivo: Pegar os dados do formulário e mandar para o Google Sheets.
 */
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
  
  // Cria o pacote de dados (JSON) para enviar
  const payload = {
    vendedor: loggedUser,
    nomeLead: nome,  
    lead: nome, // Envia duplicado para garantir que o backend entenda
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
  
  console.log("📦 Payload gerado:", payload);

  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  if (res && res.status === 'success') {
    console.log("✅ Sucesso ao salvar lead.");
    alert('✅ Lead salvo com sucesso!');
    
    // Limpa os campos para o próximo cadastro
    document.getElementById('leadNome').value = ''; 
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = ''; 
    document.getElementById('leadObs').value = '';
    
    // Atualiza a lista e volta para a tela de gestão
    carregarLeads(); 
    navegarPara('gestaoLeads');
  } else {
    console.error("❌ Falha ao salvar lead:", res);
    alert('❌ Erro ao salvar: ' + (res ? res.message : 'Verifique conexão'));
  }
  console.groupEnd();
}

/**
 * Função: carregarLeads
 * Objetivo: Baixar a lista de clientes da planilha para mostrar no app.
 */
async function carregarLeads() {
  console.group("📥 [DATA] Carregando Leads");
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) lista.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8">Atualizando...</div>';

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    console.log(`Recebidos ${res.data.length} leads brutos.`);
    
    // Filtra para mostrar apenas os leads DESTE vendedor
    leadsCache = (res.data || []).filter(l => {
      const v = (l.vendedor || l.Vendedor || '').toLowerCase();
      return v.includes(loggedUser.toLowerCase());
    });
    
    console.log(`Filtrados ${leadsCache.length} leads para ${loggedUser}.`);
    renderLeads(); // Desenha os cards na tela
    atualizarDashboard(); // Atualiza o contador de hoje
  } else {
    console.error("Erro ao carregar leads:", res);
    if(lista) lista.innerHTML = '<div style="text-align:center; color:red; padding:20px">Erro ao carregar histórico.</div>';
  }
  console.groupEnd();
}

/**
 * Função: renderLeads
 * Objetivo: Transformar a lista de dados (leadsCache) em HTML bonito (Cards).
 */
function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  // Filtra pelo que o usuário digitou na busca
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead || l.lead || '').toLowerCase().includes(term) || 
    (l.bairro || '').toLowerCase().includes(term) ||
    (l.telefone || '').includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = '<div style="text-align:center; padding:60px; color:#cbd5e1">Nenhum registro.</div>';
    return;
  }

  // Gera o HTML para cada lead
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

// Atualiza o número grande no topo do Dashboard
function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const count = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

// ============================================================
// 5. ROTA E GPS (Geolocalização)
// ============================================================

function startRoute() {
  console.log("📍 [GPS] Solicitando localização...");
  if (!navigator.geolocation) return alert('Ative o GPS.');
  
  routeCoords = []; 
  seconds = 0; 
  routeStartTime = new Date().toISOString();
  
  updateRouteUI(true);
  
  // Inicia cronômetro
  timerInterval = setInterval(() => {
    seconds++;
    const h = Math.floor(seconds / 3600).toString().padStart(2,'0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2,'0');
    const s = (seconds % 60).toString().padStart(2,'0');
    document.getElementById('timer').innerText = `${h}:${m}:${s}`;
  }, 1000);

  // Inicia rastreamento
  watchId = navigator.geolocation.watchPosition(p => {
    routeCoords.push({lat: p.coords.latitude, lon: p.coords.longitude});
    document.getElementById('points').innerText = routeCoords.length;
    document.getElementById('gpsStatus').innerText = "Rastreando";
    if(routeCoords.length === 1) console.log("📍 [GPS] Primeira coordenada capturada.");
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
// 6. CONEXÃO API (Motor de Comunicação)
// ============================================================

/**
 * Função: apiCall
 * Objetivo: Enviar e receber dados do Google Apps Script.
 * Usa um truque (text/plain) para evitar bloqueios de segurança do navegador.
 */
async function apiCall(route, payload, show=true, suppress=false) {
  if(show) showLoading(true);
  console.log(`📡 [API] Chamando: ${route}`, payload);
  
  try {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Importante para CORS
        body: JSON.stringify({route, payload, token: TOKEN})
    });
    
    const text = await res.text();
    let json;
    
    try { 
        json = JSON.parse(text); 
        console.log(`✅ [API] Resposta JSON (${route}):`, json);
    } catch (e) { 
        console.error(`❌ [API] Resposta inválida (${route}):`, text);
        throw new Error("Servidor não retornou JSON."); 
    }

    if(show) showLoading(false);
    
    if (json.status === 'error') throw new Error(json.message);
    return json;

  } catch(e) {
    if(show) showLoading(false);
    console.error(`❌ [API] Erro na requisição (${route}):`, e);
    
    if(!suppress) alert("Erro conexão: " + e.message);
    return null;
  }
}

// Controle da tela de carregamento (Spinner)
function showLoading(show, txt) {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
  if(txt) document.getElementById('loaderText').innerText = txt;
}
