/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V26.0 (AGILIDADE NO CAMPO)
 * ✅ Feature: Preenchimento Automático de Endereço (GPS)
 * ✅ Feature: Ditado de Voz para Observações
 * ✅ Base V25 mantida (IA Docs + Fixes)
 * ============================================================
 */

// CONFIGURAÇÃO
// ⚠️ MANTENHA O ID DA SUA IMPLANTAÇÃO V27 AQUI:
const DEPLOY_ID = 'AKfycbxhFr84X6j3J2R3plUiFcIrwurlXP7mbj2CkixFY_qmZHPFxz2V19iRDuYA8_ZQorei'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// Chave para funções criativas locais (Pitch de Vendas/Coach)
const GEMINI_KEY_FRONT = "AIzaSyAj_eaHKlHb7Kotpn0xKZIU38BegtVb-PE"; 

// LISTA FIXA DE SEGURANÇA
const VENDEDORES_OFFLINE = [
    "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
    "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves"
];

// Contexto leve para funções offline/criativas
const CONTEXTO_CRIATIVO = `
VOCÊ É UM ESPECIALISTA DE VENDAS DA MHNET TELECOM.
Foco: Vender planos de fibra óptica (500 Mega a 700 Mega).
Diferenciais: Wi-Fi grátis, Instalação rápida, Estabilidade.
`;

let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let routeCoords = [];
let watchId = null;
let timerInterval = null;
let seconds = 0;
let routeStartTime = null;
let leadAtualParaAgendar = null; 

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 MHNET App v26.0 - Agilidade (GPS & Voz)");

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

  const saved = localStorage.getItem('mhnet_leads_cache');
  if(saved) {
      try { 
        leadsCache = JSON.parse(saved);
        console.log(`📦 Cache: ${leadsCache.length} leads`);
      } catch(e) {}
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
  
  if(leadsCache.length > 0) {
    renderLeads();
    atualizarDashboard();
    verificarAgendamentosHoje();
  }
  
  carregarLeads();
}

// ============================================================
// 📍 AGILIDADE NO CAMPO (NOVAS FUNÇÕES V26)
// ============================================================

// 1. GPS -> ENDEREÇO (REVERSE GEOCODING)
async function buscarEnderecoGPS() {
    if (!navigator.geolocation) return alert("Seu dispositivo não suporta GPS.");
    
    showLoading(true, "📍 LOCALIZANDO...");
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const { latitude, longitude } = pos.coords;
            // Usa API Gratuita do OpenStreetMap (Nominatim)
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
            
            const res = await fetch(url);
            const data = await res.json();
            
            if (data && data.address) {
                // Preenche os campos automaticamente
                const rua = data.address.road || '';
                const bairro = data.address.suburb || data.address.neighbourhood || '';
                const cidade = data.address.city || data.address.town || data.address.municipality || '';
                
                document.getElementById('leadEndereco').value = rua;
                document.getElementById('leadBairro').value = bairro;
                document.getElementById('leadCidade').value = cidade;
                
                alert(`✅ Localizado:\n${rua}, ${bairro}`);
            } else {
                alert("Endereço não encontrado nesta coordenada.");
            }
        } catch (e) {
            console.error(e);
            alert("Erro ao buscar endereço. Verifique sua internet.");
        }
        showLoading(false);
    }, (err) => {
        showLoading(false);
        alert("Erro no GPS. Verifique se a localização está ativada.");
    }, { enableHighAccuracy: true });
}

// 2. DITADO DE VOZ (SPEECH TO TEXT)
function iniciarDitado() {
    // Verifica suporte do navegador (Chrome/Android WebView suportam webkitSpeechRecognition)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        return alert("Seu navegador não suporta ditado de voz. Tente usar o Google Chrome.");
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR"; // Português Brasil
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const btnMic = document.getElementById('btnMic');
    if(btnMic) {
        btnMic.classList.remove('text-gray-400');
        btnMic.classList.add('text-red-600', 'animate-pulse'); // Feedback visual gravando
    }

    recognition.start();

    recognition.onresult = (event) => {
        const fala = event.results[0][0].transcript;
        const campoObs = document.getElementById('leadObs');
        
        // Adiciona o texto falado ao que já existe
        campoObs.value += (campoObs.value ? " " : "") + fala;
        
        if(btnMic) {
            btnMic.classList.remove('text-red-600', 'animate-pulse');
            btnMic.classList.add('text-gray-400');
        }
    };

    recognition.onerror = (event) => {
        alert("Não entendi. Tente novamente.");
        if(btnMic) {
            btnMic.classList.remove('text-red-600', 'animate-pulse');
            btnMic.classList.add('text-gray-400');
        }
    };
    
    recognition.onend = () => {
        if(btnMic) {
            btnMic.classList.remove('text-red-600', 'animate-pulse');
            btnMic.classList.add('text-gray-400');
        }
    };
}

// ============================================================
// 🔔 SISTEMA DE AGENDAMENTO E OBSERVAÇÕES
// ============================================================

function verificarAgendamentosHoje() {
  const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0]; // dd/MM/yyyy
  
  const retornosHoje = leadsCache.filter(l => {
    if (!l.agendamento) return false;
    const dataAgendamento = l.agendamento.split(' ')[0];
    return dataAgendamento === hoje;
  });
  
  const banner = document.getElementById('lembreteBanner');
  const texto = document.getElementById('lembreteTexto');

  if (retornosHoje.length > 0) {
    if(banner) banner.classList.remove('hidden');
    if(texto) texto.innerText = `Você tem ${retornosHoje.length} cliente(s) para retornar hoje!`;
  } else {
    if(banner) banner.classList.add('hidden');
  }
}

async function salvarAgendamento() {
  if (!leadAtualParaAgendar) return alert("Erro ao identificar lead.");
  const dataEl = document.getElementById('agendarData');
  const horaEl = document.getElementById('agendarHora');
  if (!dataEl || !horaEl) return alert("Campos de agendamento não encontrados.");
  const data = dataEl.value;
  const hora = horaEl.value;
  if (!data) return alert("❌ Selecione uma data!");
  showLoading(true, "AGENDANDO...");
  const [ano, mes, dia] = data.split('-');
  const dataFormatada = `${dia}/${mes}/${ano} ${hora || '09:00'}`;
  const res = await apiCall('updateAgendamento', {
    vendedor: loggedUser,
    nomeLead: leadAtualParaAgendar.nomeLead,
    agendamento: dataFormatada
  });
  showLoading(false);
  if (res && res.status === 'success') {
    alert(`✅ Agendamento salvo!\n\nRetorno: ${dataFormatada}`);
    const index = leadsCache.findIndex(l => l.nomeLead === leadAtualParaAgendar.nomeLead && l.vendedor === loggedUser);
    if (index !== -1) {
      leadsCache[index].agendamento = dataFormatada;
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    }
    fecharLeadModal();
    renderLeads(); 
    verificarAgendamentosHoje();
  } else {
    alert('❌ Erro ao salvar agendamento.');
  }
}

async function salvarObservacaoModal() {
    if (!leadAtualParaAgendar) return alert("Erro: Nenhum lead selecionado.");
    const novaObs = document.getElementById('modalLeadObs').value;
    showLoading(true, "ATUALIZANDO...");
    const res = await apiCall('updateObservacao', {
        vendedor: loggedUser,
        nomeLead: leadAtualParaAgendar.nomeLead,
        observacao: novaObs
    });
    showLoading(false);
    if (res && res.status === 'success') {
        alert("✅ Observação atualizada!");
        const index = leadsCache.findIndex(l => l.nomeLead === leadAtualParaAgendar.nomeLead && l.vendedor === loggedUser);
        if (index !== -1) {
            leadsCache[index].observacao = novaObs;
            localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        }
    } else {
        alert("❌ Erro ao atualizar.");
    }
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

  if (pageId === 'dashboard') {
      atualizarDashboard();
      verificarAgendamentosHoje();
  }
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
// 3. INTELIGÊNCIA ARTIFICIAL (HÍBRIDA)
// ============================================================

// A) IA CRIATIVA (USA CHAVE FRONTEND PARA RAPIDEZ)
async function chamarGeminiCriativo(prompt, systemInstruction = "") {
  if (!GEMINI_KEY_FRONT) return null;
  const fullPrompt = `${systemInstruction}\n\n${CONTEXTO_CRIATIVO}\n\nPERGUNTA: ${prompt}`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY_FRONT}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { return null; }
}

// B) IA DE CONHECIMENTO (CHAMA O BACKEND + DOCS)
async function perguntarIABackend(pergunta) {
  try {
    // Chama a rota 'askAI' no backend que lê o Google Doc
    const res = await apiCall('askAI', { question: pergunta }, false); 
    
    if (res && res.status === 'success') {
      return res.answer;
    } else {
      console.error("❌ Erro Backend AI:", res);
      const msgErro = (res && res.message) ? res.message : "Resposta desconhecida do servidor";
      return `⚠️ O sistema de IA encontrou um erro: ${msgErro}. Tente novamente.`;
    }
  } catch (e) {
    return "Erro de comunicação com o servidor.";
  }
}

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  const bairro = document.getElementById('leadBairro').value || "sua região";
  if(!nome) return alert("⚠️ Preencha o nome do cliente primeiro!");
  showLoading(true, "✨ CRIANDO PITCH...");
  const txt = await chamarGeminiCriativo(`Crie msg curta WhatsApp MHNET 500 Mega para ${nome} em ${bairro}.`, "Vendedor telecom");
  showLoading(false);
  if(txt) document.getElementById('leadObs').value = txt.replace(/["*#]/g, '').trim();
}

async function gerarCoachIA() {
  showLoading(true, "🚀 MOTIVANDO...");
  const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
  const leadsHoje = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  const txt = await chamarGeminiCriativo(`Fiz ${leadsHoje} vendas hoje. Frase motivacional curta.`);
  showLoading(false);
  if(txt) alert(`🚀 COACH:\n\n${txt.replace(/\*\*/g, '')}`);
}

async function consultarPlanosIA() {
    toggleChat();
    const history = document.getElementById('chatHistory');
    const msg = "Quais são os planos atuais da MHNET?";
    history.innerHTML += `<div class="flex gap-3 justify-end fade-in"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">${msg}</div></div>`;
    const loadId = 'load-' + Date.now();
    history.innerHTML += `<div id="${loadId}" class="flex gap-3 fade-in"><div class="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center text-xs"><i class="fas fa-spinner fa-spin"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-400 italic shadow-sm">Consultando base de conhecimento...</div></div>`;
    history.scrollTop = history.scrollHeight;
    const response = await perguntarIABackend(msg);
    const loader = document.getElementById(loadId);
    if(loader) loader.remove();
    if(response) {
         history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${response.replace(/\n/g, '<br>')}</div></div>`;
         history.scrollTop = history.scrollHeight;
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
    const loadId = 'load-' + Date.now();
    history.innerHTML += `<div id="${loadId}" class="flex gap-3 fade-in"><div class="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center text-xs"><i class="fas fa-spinner fa-spin"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-400 italic shadow-sm">Pesquisando...</div></div>`;
    history.scrollTop = history.scrollHeight;
    const response = await perguntarIABackend(msg);
    const loader = document.getElementById(loadId);
    if(loader) loader.remove();
    if(response) {
         history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${response.replace(/\n/g, '<br>')}</div></div>`;
         history.scrollTop = history.scrollHeight;
    }
}

// ============================================================
// 4. GESTÃO DE LEADS
// ============================================================

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista && leadsCache.length === 0) lista.innerHTML = `<div class="text-center p-10"><i class="fas fa-sync fa-spin text-3xl text-blue-400"></i></div>`;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ route: 'getLeads', payload: { vendedor: loggedUser } })
    });

    const data = await res.json();
    if (data.status === 'success') {
      leadsCache = (data.data || []).filter(l => l.vendedor.toLowerCase().includes(loggedUser.toLowerCase()));
      leadsCache.sort((a, b) => b._linha - a._linha); 
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      renderLeads();
      atualizarDashboard();
      verificarAgendamentosHoje();
    }
  } catch (e) { console.error('Erro:', e); }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead || '').toLowerCase().includes(term) || 
    (l.bairro || '').toLowerCase().includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = `<div class="text-center p-10 text-gray-500">Nenhum lead encontrado</div>`;
    return;
  }

  div.innerHTML = filtrados.map((l, index) => {
    let badgeClass = "bg-gray-100 text-gray-500";
    const interesseStr = String(l.interesse || '').toUpperCase();
    if(interesseStr.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    
    const temAgendamento = l.agendamento && l.agendamento.trim() !== '';
    const agendaBadge = temAgendamento ? `<span class="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full ml-2"><i class="fas fa-calendar-check"></i> ${l.agendamento.split(' ')[0]}</span>` : '';

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4 cursor-pointer active:bg-blue-50 transition hover:shadow-md">
      <div class="flex justify-between items-start mb-3 pointer-events-none">
        <div>
          <div class="font-bold text-[#003870] text-lg leading-tight flex items-center flex-wrap">${l.nomeLead} ${agendaBadge}</div>
          <div class="text-xs text-gray-400 mt-1">${l.timestamp ? l.timestamp.split(' ')[0] : 'Hoje'}</div>
        </div>
        <span class="${badgeClass} px-3 py-1 rounded-lg text-[10px] font-bold">${l.interesse}</span>
      </div>
      <div class="text-sm text-gray-600 mb-2 pointer-events-none"><i class="fas fa-map-marker-alt text-red-400 mr-2"></i> ${l.bairro || 'Geral'}</div>
    </div>`;
  }).join('');
}

function abrirLeadDetalhes(index) {
    const lead = leadsCache[index];
    if(!lead) return;
    leadAtualParaAgendar = lead;
    const setText = (id, text) => { const el = document.getElementById(id); if(el) el.innerText = text; };
    const setValue = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    setText('modalLeadNome', lead.nomeLead || 'Sem Nome');
    setText('modalLeadInfo', `${lead.bairro || 'Geral'} • ${lead.timestamp ? lead.timestamp.split(' ')[0] : 'Hoje'}`);
    setValue('modalLeadObs', lead.observacao || "");
    const elData = document.getElementById('agendarData');
    const elHora = document.getElementById('agendarHora');
    if (elData && elHora) {
        if(lead.agendamento) {
            try {
                const [data, hora] = lead.agendamento.split(' ');
                const [dia, mes, ano] = data.split('/');
                elData.value = `${ano}-${mes}-${dia}`;
                elHora.value = hora || '';
            } catch(e) { elData.value = ''; }
        } else {
            elData.value = '';
            elHora.value = '09:00';
        }
    }
    const tel = (lead.telefone || "").replace(/\D/g, '');
    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) btnWhats.onclick = () => window.open(tel ? `https://wa.me/55${tel}` : '#', '_blank');
    const modal = document.getElementById('leadModal');
    if (modal) {
        modal.classList.remove('hidden');
        const content = modal.querySelector('div.absolute');
        if (content) {
            content.classList.remove('slide-up');
            void content.offsetWidth;
            content.classList.add('slide-up');
        }
    }
}

function fecharLeadModal() {
    const modal = document.getElementById('leadModal');
    if(modal) modal.classList.add('hidden');
    leadAtualParaAgendar = null;
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
    provedor: "", agendamento: "", timestamp: new Date().toLocaleString('pt-BR')
  };
  const res = await apiCall('addLead', novoLead);
  showLoading(false);
  if (res && (res.status === 'success' || res === 'CORS_OK')) {
      alert('✅ Lead Salvo!');
      leadsCache.unshift(novoLead);
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      document.getElementById('leadNome').value = ''; 
      document.getElementById('leadTelefone').value = '';
      navegarPara('gestaoLeads');
  } else { alert('❌ Erro ao salvar.'); }
}

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
  const count = leadsCache.filter(l => (l.timestamp || '').split(' ')[0] === hoje).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

// ============================================================
// 5. ROTAS GPS
// ============================================================
function startRoute() {
  if (!navigator.geolocation) return alert('GPS não disponível.');
  routeCoords = []; seconds = 0; routeStartTime = new Date().toISOString();
  document.getElementById('btnStart').style.display = 'none';
  document.getElementById('btnStop').style.display = 'flex';
  
  timerInterval = setInterval(() => {
    seconds++;
    const h = Math.floor(seconds/3600).toString().padStart(2,'0'), m = Math.floor((seconds%3600)/60).toString().padStart(2,'0'), s = (seconds%60).toString().padStart(2,'0');
    document.getElementById('timer').innerText = `${h}:${m}:${s}`;
  }, 1000);
  
  watchId = navigator.geolocation.watchPosition(p => {
      routeCoords.push({lat: p.coords.latitude, lon: p.coords.longitude});
      document.getElementById('points').innerText = routeCoords.length;
      document.getElementById('gpsStatus').innerText = "📍 Rastreando";
  }, e => console.error(e), {enableHighAccuracy: true});
}

async function stopRoute() {
  if(!confirm("Finalizar rastreamento?")) return;
  clearInterval(timerInterval); navigator.geolocation.clearWatch(watchId);
  showLoading(true, "SALVANDO ROTA...");
  await apiCall('saveRoute', { vendedor: loggedUser, inicioISO: routeStartTime, fimISO: new Date().toISOString(), coordenadas: routeCoords });
  showLoading(false); alert(`✅ Rota salva!`); resetRouteUI(); navegarPara('dashboard');
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
    const res = await fetch(API_URL, { method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({ route, payload }) });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) {
      if(['addLead', 'saveRoute', 'updateAgendamento', 'updateObservacao'].includes(route)) return 'CORS_OK';
      throw new Error("Resposta inválida");
    }
    if(show) showLoading(false);
    return json;
  } catch(e) {
    if(show) showLoading(false);
    if(e.name === 'TypeError' && ['addLead', 'saveRoute', 'updateAgendamento', 'updateObservacao'].includes(route)) return 'CORS_OK';
    return null;
  }
}

function showLoading(show, txt = "AGUARDE...") {
  const loader = document.getElementById('loader');
  if(loader) loader.style.display = show ? 'flex' : 'none';
  const loaderText = document.getElementById('loaderText');
  if(loaderText && txt) loaderText.innerText = txt;
}

// ============================================================
// 🚀 REGISTRO DO PWA
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('✅ Service Worker:', reg.scope))
      .catch(err => console.log('❌ Service Worker Fail:', err));
  });
}
