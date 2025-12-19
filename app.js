/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V26.2 (IA CENTRALIZADA)
 * ✅ Fix: Erro 404 na IA resolvido (tudo via Backend)
 * ✅ Feature: Pitch e Coach agora leem o Documento do Drive
 * ✅ Feature: Campo "Provedor Atual" e Flags de Interesse
 * ============================================================
 */

// CONFIGURAÇÃO
// ⚠️ MANTENHA SEU ID DE IMPLANTAÇÃO ATUALIZADO AQUI:
const DEPLOY_ID = 'AKfycbzowsMhxfNZX9kmbVSaAskqI0MziAE4DTxRfi1DzW9uvMf_AiNyGtWcpHGNzycoKMrC'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

// LISTA FIXA DE SEGURANÇA
const VENDEDORES_OFFLINE = [
    "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
    "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves"
];

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
  console.log("🚀 MHNET App v26.2 - IA Centralizada");

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
// 📍 AGILIDADE NO CAMPO (GPS & VOZ DINÂMICO)
// ============================================================

// 1. GPS -> ENDEREÇO
async function buscarEnderecoGPS() {
    if (!navigator.geolocation) return alert("Seu dispositivo não suporta GPS.");
    
    showLoading(true, "📍 LOCALIZANDO...");
    
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const { latitude, longitude } = pos.coords;
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
            
            const res = await fetch(url);
            const data = await res.json();
            
            if (data && data.address) {
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

// 2. DITADO DE VOZ (DINÂMICO)
function iniciarDitado(targetId, btnId) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        return alert("Seu navegador não suporta ditado de voz. Tente usar o Google Chrome.");
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const btn = document.getElementById(btnId);
    
    // Feedback visual de gravação
    if(btn) {
        btn.classList.remove('text-gray-400');
        btn.classList.add('text-red-600', 'animate-pulse');
    }

    recognition.start();

    recognition.onresult = (event) => {
        const fala = event.results[0][0].transcript;
        const campo = document.getElementById(targetId);
        
        if (campo) {
            campo.value += (campo.value ? " " : "") + fala;
        }
        
        restaurarBotao(btn);
    };

    recognition.onerror = (event) => {
        alert("Não entendi. Tente novamente.");
        restaurarBotao(btn);
    };
    
    recognition.onend = () => {
        restaurarBotao(btn);
    };
}

function restaurarBotao(btn) {
    if(btn) {
        btn.classList.remove('text-red-600', 'animate-pulse');
        btn.classList.add('text-gray-400');
    }
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
// 3. INTELIGÊNCIA ARTIFICIAL (CENTRALIZADA NO BACKEND)
// ============================================================

/**
 * Função unificada que chama o Backend.
 * O Backend é quem lê o Documento do Drive e conecta com o Gemini.
 */
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

// --- FUNÇÕES DE UI DA IA (AGORA USAM O BACKEND) ---

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  const bairro = document.getElementById('leadBairro').value || "sua região";
  if(!nome) return alert("⚠️ Preencha o nome do cliente primeiro!");
  
  showLoading(true, "✨ LENDO DOC E CRIANDO PITCH...");
  
  // Agora chama o BACKEND (askAI) em vez de tentar conexão direta
  const prompt = `Crie uma mensagem curta de WhatsApp para o cliente ${nome} que mora em ${bairro}. Use as informações do nosso arquivo base sobre planos e diferenciais para ser persuasivo.`;
  const txt = await perguntarIABackend(prompt);
  
  showLoading(false);
  
  if(txt && !txt.includes("⚠️")) {
      document.getElementById('leadObs').value = txt.replace(/["*#]/g, '').trim();
  } else {
      alert("Erro ao gerar pitch: " + txt);
  }
}

async function gerarCoachIA() {
  showLoading(true, "🚀 CONSULTANDO O CÉREBRO DA MHNET...");
  const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
  const leadsHoje = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  
  // Chama o Backend
  const prompt = `Sou um vendedor e fiz ${leadsHoje} cadastros hoje. Com base nos valores da nossa empresa descritos no documento, me dê uma frase motivacional curta.`;
  const txt = await perguntarIABackend(prompt);
  
  showLoading(false);
  if(txt) alert(`🚀 COACH MHNET:\n\n${txt.replace(/\*\*/g, '')}`);
}

async function consultarPlanosIA() {
    toggleChat();
    const history = document.getElementById('chatHistory');
    const msg = "Quais são os planos atuais da MHNET?";
    
    history.innerHTML += `<div class="flex gap-3 justify-end fade-in"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">${msg}</div></div>`;
    
    const loadId = 'load-' + Date.now();
    history.innerHTML += `<div id="${loadId}" class="flex gap-3 fade-in"><div class="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center text-xs"><i class="fas fa-spinner fa-spin"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-400 italic shadow-sm">Consultando base de conhecimento...</div></div>`;
    history.scrollTop = history.scrollHeight;

    // Chama Backend
    const response = await perguntarIABackend(msg);
    
    // Remove loading
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
    
    // Adiciona mensagem do usuário
    history.innerHTML += `<div class="flex gap-3 justify-end fade-in"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">${msg}</div></div>`;
    input.value = '';
    
    // Loading visual
    const loadId = 'load-' + Date.now();
    history.innerHTML += `<div id="${loadId}" class="flex gap-3 fade-in"><div class="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center text-xs"><i class="fas fa-spinner fa-spin"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-400 italic shadow-sm">Pesquisando...</div></div>`;
    history.scrollTop = history.scrollHeight;

    // Chama Backend (Google Doc)
    const response = await perguntarIABackend(msg);
    
    // Remove loading
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
    
    // Helpers
    const setText = (id, text) => { const el = document.getElementById(id); if(el) el.innerText = text; };
    const setValue = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };

    setText('modalLeadNome', lead.nomeLead || 'Sem Nome');
    setText('modalLeadInfo', `${lead.bairro || 'Geral'} • ${lead.timestamp ? lead.timestamp.split(' ')[0] : 'Hoje'}`);
    
    // ✅ MOSTRAR FLAG DE INTERESSE
    const elFlag = document.getElementById('modalLeadFlag');
    if(elFlag) {
        elFlag.className = ""; // Reset
        elFlag.style.display = "inline-block";
        const int = String(lead.interesse || "Médio").toUpperCase();
        if(int.includes("ALTO")) {
            elFlag.className = "bg-green-100 text-green-700 px-3 py-1 rounded-lg text-[10px] font-bold";
            elFlag.innerText = "🔥 ALTO";
        } else if(int.includes("BAIXO")) {
            elFlag.className = "bg-gray-100 text-gray-500 px-3 py-1 rounded-lg text-[10px] font-bold";
            elFlag.innerText = "❄️ BAIXO";
        } else {
            elFlag.className = "bg-orange-100 text-orange-600 px-3 py-1 rounded-lg text-[10px] font-bold";
            elFlag.innerText = "🤔 MÉDIO";
        }
    }

    // ✅ PROVEDOR ATUAL
    const elProv = document.getElementById('modalLeadProvedor');
    if(elProv) elProv.innerText = lead.provedor || "Não informado";

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
    provedor: document.getElementById('leadProvedor').value.trim(), // ✅ NOVO CAMPO
    observacao: document.getElementById('leadObs').value.trim(),
    agendamento: "", timestamp: new Date().toLocaleString('pt-BR')
  };
  
  const res = await apiCall('addLead', novoLead);
  showLoading(false);
  if (res && (res.status === 'success' || res === 'CORS_OK')) {
      alert('✅ Lead Salvo!');
      leadsCache.unshift(novoLead);
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      
      // Limpa campos
      document.getElementById('leadNome').value = ''; 
      document.getElementById('leadTelefone').value = '';
      document.getElementById('leadProvedor').value = ''; 
      document.getElementById('leadObs').value = '';
      document.getElementById('leadEndereco').value = '';
      
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
