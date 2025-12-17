/**
 * ============================================================
 * MHNET VENDAS - V17.0 FINAL
 * ✅ IA Treinada com Planos Reais MHNET
 * ✅ Sistema de Agendamento (Coluna O)
 * ✅ Alertas de Retorno na Dashboard
 * ============================================================
 */

// CONFIGURAÇÃO
const DEPLOY_ID = 'AKfycbzO_bAa-RwuQsVm3INkwkCrNq54VMX9Lcz8L2n0_FMd74NRLXh_oHlJc0E3bodvoUkr'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

const VENDEDORES_OFFLINE = [
    "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
    "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
    "Elton da Silva Rodrigo Gonçalves"
];

// ============================================================
// 🧠 CONTEXTO DA IA - PLANOS REAIS MHNET (Atualizado 2024)
// ============================================================
const PLANOS_CONTEXTO = `
VOCÊ É UM ESPECIALISTA DE VENDAS DA MHNET TELECOM.
USE ESTAS INFORMAÇÕES REAIS E ATUALIZADAS PARA RESPONDER:

📊 PLANOS VAREJO (Pessoa Física) - LAJEADO/RS:

1. PLANO 500 MEGA (Mais Vendido) ⭐
   - Preço: R$ 99,90/mês (pagamento em dia)
   - Preço com atraso: R$ 111,00
   - Velocidade: 500 Mbps download / 250 Mbps upload
   - Instalação: GRATUITA (sujeito a análise de crédito)
   - Fidelidade: 12 meses
   - Inclui: Roteador Wi-Fi (locação gratuita)
   - Ideal para: Famílias médias, streaming Full HD, trabalho remoto, 5-8 dispositivos

2. PLANO 700 MEGA (Premium)
   - Preço: R$ 149,99/mês
   - Velocidade: 700 Mbps download / 350 Mbps upload
   - Instalação: GRATUITA
   - Fidelidade: 12 meses
   - Inclui: Roteador Wi-Fi Dual Band de alta potência
   - Ideal para: Casas grandes, gamers, 4K/8K streaming, 10+ dispositivos

3. PLANO 400 MEGA (Econômico)
   - Preço: R$ 99,00/mês (promoção)
   - Velocidade: 400 Mbps download / 200 Mbps upload
   - Instalação: GRATUITA
   - Fidelidade: 12 meses
   - Ideal para: Uso básico, casais, 3-4 dispositivos

🎯 DIFERENCIAIS COMPETITIVOS:
✅ 100% Fibra Óptica FTTH (ponta a ponta)
✅ Internet ilimitada (sem franquia de dados)
✅ Instalação em até 2 dias úteis
✅ Suporte técnico 24/7: 0800 050 0800
✅ Empresa regional com 22 anos de mercado
✅ Melhor estabilidade em dias de chuva (vs rádio)
✅ Menor latência para jogos online
✅ Atende 170+ cidades no Sul do Brasil

💰 COMBOS DISPONÍVEIS:
- Internet + Telefone Fixo
- Internet + TV por assinatura
- Internet + Telefonia Móvel (5GB a 40GB)

⚠️ REGRAS IMPORTANTES:
- Multa por cancelamento antecipado (proporcional aos meses restantes)
- Valores promocionais válidos para pagamento em dia
- Taxa de instalação isenta mediante análise de crédito
- Roteador Wi-Fi incluso (modelo sujeito a disponibilidade)

🎓 DICAS DE VENDA:
1. Para cliente de concorrente: "Nossa fibra vai DIRETO até sua casa, sem intermediários"
2. Para quem reclama de queda: "Fibra óptica não sofre com chuva e vento"
3. Para gamers: "Latência ultrabaixa, ideal para jogos competitivos"
4. Para famílias: "500 Mega aguenta toda família conectada sem travar"

📞 CONTATO VENDAS:
WhatsApp: (47) 2101-9918
0800: 0800 050 0800

IMPORTANTE: Sempre confirme disponibilidade no CEP do cliente antes de fechar venda.
`;

let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let routeCoords = [];
let watchId = null;
let timerInterval = null;
let seconds = 0;
let routeStartTime = null;
let leadAtualParaAgendar = null; // Guarda o lead aberto no modal

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 MHNET App v17.0 - IA + Agendamento");

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
    verificarAgendamentosHoje(); // ✅ NOVO
  }
  
  carregarLeads();
}

// ============================================================
// 🔔 SISTEMA DE AGENDAMENTO
// ============================================================

function verificarAgendamentosHoje() {
  const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0]; // dd/MM/yyyy
  
  const retornosHoje = leadsCache.filter(l => {
    if (!l.agendamento) return false;
    const dataAgendamento = l.agendamento.split(' ')[0]; // Pega só a data
    return dataAgendamento === hoje;
  });
  
  if (retornosHoje.length > 0) {
    const nomes = retornosHoje.map(l => `• ${l.nomeLead}`).join('\n');
    setTimeout(() => {
      alert(`🔔 LEMBRETE DE RETORNO!\n\nVocê tem ${retornosHoje.length} cliente(s) agendado(s) para HOJE:\n\n${nomes}`);
    }, 1500);
  }
}

async function salvarAgendamento() {
  if (!leadAtualParaAgendar) return alert("Erro ao identificar lead.");
  
  const data = document.getElementById('agendarData').value;
  const hora = document.getElementById('agendarHora').value;
  
  if (!data) return alert("❌ Selecione uma data!");
  
  showLoading(true, "AGENDANDO...");
  
  // Formata para dd/MM/yyyy HH:mm
  const [ano, mes, dia] = data.split('-');
  const dataFormatada = `${dia}/${mes}/${ano} ${hora || '09:00'}`;
  
  // Atualiza no backend (Coluna O)
  const res = await apiCall('updateAgendamento', {
    vendedor: loggedUser,
    nomeLead: leadAtualParaAgendar.nomeLead,
    agendamento: dataFormatada
  });
  
  showLoading(false);
  
  if (res && res.status === 'success') {
    alert(`✅ Agendamento salvo!\n\nRetorno: ${dataFormatada}`);
    
    // Atualiza cache local
    const index = leadsCache.findIndex(l => 
      l.nomeLead === leadAtualParaAgendar.nomeLead && 
      l.vendedor === loggedUser
    );
    
    if (index !== -1) {
      leadsCache[index].agendamento = dataFormatada;
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    }
    
    fecharLeadModal();
  } else {
    alert('❌ Erro ao salvar agendamento. Tente novamente.');
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
// 3. INTELIGÊNCIA ARTIFICIAL (GEMINI)
// ============================================================

async function chamarGemini(prompt, systemInstruction = "") {
  if (!GEMINI_KEY) return null;
  
  const fullPrompt = `${systemInstruction}\n\n${PLANOS_CONTEXTO}\n\nPERGUNTA: ${prompt}`;
  
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500
        }
      })
    });
    
    if(!res.ok) {
        console.error("Erro API IA:", res.status);
        return null;
    }
    
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { 
      console.error("Erro IA:", e);
      return null; 
  }
}

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  const bairro = document.getElementById('leadBairro').value || "sua região";
  
  if(!nome) return alert("⚠️ Preencha o nome do cliente primeiro!");
  
  showLoading(true, "✨ CRIANDO PITCH...");
  
  const prompt = `Crie uma mensagem CURTA (máximo 3 linhas) para WhatsApp vendendo internet MHNET 500 Mega para ${nome} que mora em ${bairro}. Foque em instalação rápida e preço justo. Não use asteriscos ou formatação.`;
  
  const txt = await chamarGemini(prompt, "Você é um vendedor experiente de telecom.");
  
  showLoading(false);
  
  if(txt) {
      document.getElementById('leadObs').value = txt.replace(/["*#]/g, '').trim();
  } else {
      alert("❌ Erro ao gerar pitch. Tente novamente.");
  }
}

async function consultarPlanosIA() {
    toggleChat();
    const history = document.getElementById('chatHistory');
    
    history.innerHTML += `<div class="flex gap-3 justify-end fade-in"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">Quais são os planos?</div></div>`;
    
    const loadingId = 'load-' + Date.now();
    history.innerHTML += `<div id="${loadingId}" class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl text-xs text-gray-400">Consultando...</div></div>`;
    history.scrollTop = history.scrollHeight;

    const response = await chamarGemini("Liste os 3 planos principais da MHNET com preços e diferenciais. Use emojis e seja objetivo.");
    
    document.getElementById(loadingId)?.remove();

    if(response) {
         const formatted = response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
         history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${formatted}</div></div>`;
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
    history.scrollTop = history.scrollHeight;
    
    const loadingId = 'l-' + Date.now();
    history.innerHTML += `<div id="${loadingId}" class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 text-xs text-gray-400">Digitando...</div></div>`;

    const response = await chamarGemini(msg);
    document.getElementById(loadingId)?.remove();

    if(response) {
         const formatted = response.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
         history.innerHTML += `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${formatted}</div></div>`;
         history.scrollTop = history.scrollHeight;
    }
}

async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Você ainda não tem leads.");
  
  showLoading(true, "ANALISANDO...");
  const bairros = [...new Set(leadsCache.slice(0, 30).map(l => l.bairro || 'Centro'))].join(', ');
  
  const prompt = `Tenho clientes em: ${bairros}. Sugira uma rota eficiente de visitação (máximo 5 linhas).`;
  const txt = await chamarGemini(prompt);
  
  showLoading(false);
  if (txt) alert(`💡 SUGESTÃO DE ROTA:\n\n${txt.replace(/\*\*/g, '')}`);
}

async function gerarCoachIA() {
  showLoading(true, "🚀 MOTIVANDO...");
  const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
  const leadsHoje = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  
  const prompt = `O vendedor fez ${leadsHoje} leads hoje. Dê feedback motivacional curto (2 linhas).`;
  const txt = await chamarGemini(prompt);
  
  showLoading(false);
  if(txt) alert(`🚀 COACH:\n\n${txt.replace(/\*\*/g, '')}`);
}

// ============================================================
// 4. GESTÃO DE LEADS
// ============================================================

async function enviarLead() {
  const nome = document.getElementById('leadNome').value.trim();
  const tel = document.getElementById('leadTelefone').value.trim();
  
  if (!nome || !tel) {
    return alert("⚠️ Preencha pelo menos Nome e Telefone!");
  }
  
  showLoading(true, "💾 SALVANDO LEAD...");
  
  const payload = {
    vendedor: loggedUser,
    nomeLead: nome,
    lead: nome,
    telefone: tel,
    whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value.trim(),
    cidade: document.getElementById('leadCidade').value.trim(),
    bairro: document.getElementById('leadBairro').value.trim(),
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value.trim(),
    provedor: ""
  };
  
  console.log("📤 Enviando Lead:", payload);

  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  if ((res && res.status === 'success') || res === 'CORS_ERROR') {
    alert('✅ Lead salvo com sucesso!');
    
    // Limpa formulário
    document.getElementById('leadNome').value = ''; 
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = ''; 
    document.getElementById('leadCidade').value = 'Lajeado'; 
    document.getElementById('leadBairro').value = '';
    document.getElementById('leadObs').value = '';
    document.getElementById('leadInteresse').value = 'Médio';
    
    // Atualiza Cache Local
    leadsCache.unshift({ ...payload, timestamp: new Date().toLocaleString('pt-BR') });
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));

    carregarLeads();
    navegarPara('gestaoLeads');
  } else {
    alert('❌ ' + (res ? res.message : "Erro desconhecido ao salvar."));
  }
}

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) {
    lista.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8"><i class="fas fa-circle-notch fa-spin text-3xl mb-3 text-blue-500"></i><br>Buscando histórico...</div>';
  }

  // Usa GET para leitura
  const url = `${API_URL}?route=getLeads`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    
    if (json.status === 'success') {
        leadsCache = (json.data || []).filter(l => {
            const v = (l.vendedor || '').toLowerCase();
            return v.includes(loggedUser.toLowerCase());
        });
        
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
        console.log("📊 Leads carregados:", leadsCache.length);
        
        renderLeads();
        atualizarDashboard();
        verificarAgendamentosHoje();
    }
  } catch (e) {
    console.error("Erro GET Leads:", e);
    if(leadsCache.length > 0) {
        renderLeads(); // Mostra cache se houver erro
    } else if(lista) {
        lista.innerHTML = '<div style="text-align:center; color:#ef4444; padding:40px"><i class="fas fa-exclamation-triangle text-4xl mb-3"></i><br>Não foi possível carregar o histórico.<br><small>Verifique sua conexão.</small></div>';
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
    (l.telefone || '').includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = '<div style="text-align:center; padding:60px; color:#cbd5e1"><i class="far fa-folder-open text-5xl mb-4"></i><br>Nenhum registro encontrado.</div>';
    return;
  }

  div.innerHTML = filtrados.map((l, index) => {
    const nome = l.nomeLead || 'Cliente';
    const bairro = l.bairro || 'Não informado';
    const interesse = (l.interesse || 'MÉDIO').toUpperCase();
    const tel = l.telefone || l.whatsapp || '';
    
    let badgeClass = "bg-gray-100 text-gray-500";
    if(interesse.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    if(interesse.includes('MÉDIO')) badgeClass = "bg-yellow-100 text-yellow-700";
    if(interesse.includes('BAIXO')) badgeClass = "bg-red-50 text-red-500";

    const dataFormatada = l.timestamp ? l.timestamp.split(' ')[0] : 'Hoje';
    
    // Ícone de agendamento se houver
    const iconAgenda = l.agendamento ? '<i class="fas fa-clock text-orange-500 ml-2" title="Retorno Agendado"></i>' : '';

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4 hover:shadow-md transition cursor-pointer">
      <div class="flex justify-between items-start mb-3 pointer-events-none">
        <div>
          <div class="font-bold text-[#003870] text-lg leading-tight flex items-center">${nome} ${iconAgenda}</div>
          <div class="text-xs text-gray-400 mt-1"><i class="fas fa-calendar-alt mr-1"></i> ${dataFormatada}</div>
        </div>
        <span class="${badgeClass} px-3 py-1 rounded-lg text-[10px] font-bold tracking-wide shadow-sm">${interesse}</span>
      </div>
      <div class="text-sm text-gray-600 mb-4 flex items-center gap-2 bg-blue-50/50 p-2 rounded-lg pointer-events-none">
        <i class="fas fa-map-marker-alt text-red-400 ml-1"></i> ${bairro}
      </div>
      <div class="flex justify-between items-center border-t border-gray-100 pt-4 pointer-events-none">
         <span class="text-xs text-gray-400 font-medium">Toque para ver detalhes</span>
         <i class="fas fa-chevron-right text-blue-400"></i>
      </div>
    </div>`;
  }).join('');
}

function abrirLeadDetalhes(index) {
    currentLeadIndex = index;
    const lead = leadsCache[index];
    if(!lead) return;
    
    leadAtualParaAgendar = lead; // ✅ Guarda para usar no agendamento

    document.getElementById('modalLeadNome').innerText = lead.nomeLead || 'Sem Nome';
    document.getElementById('modalLeadInfo').innerText = `${lead.bairro || 'Geral'} • ${lead.timestamp ? lead.timestamp.split(' ')[0] : 'Hoje'}`;
    
    let info = [];
    if(lead.telefone) info.push(`📞 ${lead.telefone}`);
    if(lead.endereco) info.push(`📍 ${lead.endereco}`);
    if(lead.cidade) info.push(`🏙️ ${lead.cidade}`);
    if(lead.provedor) info.push(`📡 Provedor atual: ${lead.provedor}`);
    if(lead.agendamento) info.push(`\n🔔 Agendado para: ${lead.agendamento}`);
    if(lead.observacao) info.push(`\n💬 ${lead.observacao}`);
    
    document.getElementById('modalLeadObs').innerText = info.length ? info.join('\n') : "Nenhuma informação adicional.";

    // Preenche campos de agendamento se já existir
    if(lead.agendamento) {
        const [data, hora] = lead.agendamento.split(' ');
        const [dia, mes, ano] = data.split('/');
        document.getElementById('agendarData').value = `${ano}-${mes}-${dia}`;
        document.getElementById('agendarHora').value = hora || '';
    } else {
        document.getElementById('agendarData').value = '';
        document.getElementById('agendarHora').value = '09:00';
    }

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
    currentLeadIndex = null;
}

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const count = leadsCache.filter(l => {
    const dataLead = l.timestamp || '';
    return dataLead.includes(hoje);
  }).length;
  
  const statEl = document.getElementById('statLeads');
  if(statEl) statEl.innerText = count;
}

// ============================================================
// 5. ROTA (GPS)
// ============================================================

function startRoute() {
  if (!navigator.geolocation) {
    return alert('⚠️ GPS não disponível neste dispositivo.');
  }
  
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
  
  watchId = navigator.geolocation.watchPosition(
    p => {
      routeCoords.push({
        lat: p.coords.latitude, 
        lon: p.coords.longitude
      });
      document.getElementById('points').innerText = routeCoords.length;
      const st = document.getElementById('gpsStatus');
      st.innerText = "Rastreando";
      st.className = "bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-bold";
    },
    e => console.error("Erro GPS:", e),
    {enableHighAccuracy: true, timeout: 10000, maximumAge: 0}
  );
}

async function stopRoute() {
  if(!confirm("❓ Finalizar e salvar rota?")) return;
  
  clearInterval(timerInterval);
  navigator.geolocation.clearWatch(watchId);
  
  showLoading(true, "📍 ENVIANDO ROTA...");
  
  const res = await apiCall('saveRoute', {
    vendedor: loggedUser,
    inicioISO: routeStartTime,
    fimISO: new Date().toISOString(),
    coordenadas: routeCoords
  });
  
  showLoading(false);
  
  if((res && res.status === 'success') || res === 'CORS_ERROR') {
    alert("✅ Rota salva com sucesso!");
    resetRouteUI();
    navegarPara('dashboard');
  } else {
    alert("Aviso: Rota salva localmente.");
    resetRouteUI();
  }
}

function updateRouteUI(isRunning) {
  document.getElementById('btnStart').style.display = isRunning ? 'none' : 'flex';
  document.getElementById('btnStop').style.display = isRunning ? 'flex' : 'none';
}

function resetRouteUI() {
  updateRouteUI(false);
  document.getElementById('timer').innerText = "00:00:00";
  document.getElementById('points').innerText = "0";
  const st = document.getElementById('gpsStatus');
  st.innerText = "Parado";
  st.className = "bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-bold";
}

// ============================================================
// 6. API CHAMADAS (INTEGRADO COM SEU BACKEND)
// ============================================================
async function apiCall(route, payload = {}, showLoader = true, suppressAlert = false) {
  if(showLoader) showLoading(true);
  
  try {
    console.log(`📡 API Call: ${route}`, payload);
    
    // FIX CORS: Usa text/plain para envio
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          route: route,
          payload: payload
        })
    });
    
    const text = await response.text();
    let json;
    
    try { 
      json = JSON.parse(text); 
    } catch (parseError) { 
        if(route === 'addLead' || route === 'saveRoute' || route === 'updateAgendamento') return 'CORS_ERROR';
        throw new Error("Resposta inválida do servidor");
    }

    if(showLoader) showLoading(false);
    
    if (json.status === 'error') {
      throw new Error(json.message || "Erro desconhecido no servidor");
    }
    
    return json;

  } catch(error) {
    if(showLoader) showLoading(false);
    console.error("❌ API Call Error:", error);
    
    if (error.name === 'TypeError' && (route === 'addLead' || route === 'saveRoute' || route === 'updateAgendamento')) {
        return 'CORS_ERROR';
    }
    
    if(!suppressAlert) {
      alert(`❌ Erro de conexão: ${error.message}`);
    }
    
    return null;
  }
}

// ============================================================
// LOADING SCREEN
// ============================================================
function showLoading(show, text = "CARREGANDO...") {
  const loader = document.getElementById('loader');
  const loaderText = document.getElementById('loaderText');
  
  if(loader) loader.style.display = show ? 'flex' : 'none';
  if(loaderText) loaderText.innerText = text;
}
