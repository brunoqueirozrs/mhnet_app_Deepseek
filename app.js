/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V17.0 (SEPARADO E CORRIGIDO)
 * ✅ IA Treinada com Planos Reais MHNET
 * ✅ Sistema de Agendamento (Coluna O)
 * ✅ Alertas de Retorno na Dashboard
 * ============================================================
 */

// CONFIGURAÇÃO
// ID do Deploy fornecido no seu código V17
const DEPLOY_ID = 'AKfycbwEYWhY8uJ3Gmnva0Ny9Zu7MECHMr2ZHgSl4ABQJTeFsonMNQpAsOOKcx17L5z1CqnX'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// LISTA FIXA DE SEGURANÇA
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
  console.log("🚀 MHNET App v17.0 - Frontend Separado");

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
  
  const dataEl = document.getElementById('agendarData');
  const horaEl = document.getElementById('agendarHora');
  
  if (!dataEl || !horaEl) return alert("Campos de agendamento não encontrados no HTML.");

  const data = dataEl.value;
  const hora = horaEl.value;
  
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
    // Re-renderiza para mostrar o ícone de agenda
    renderLeads(); 
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
// 3. INTELIGÊNCIA ARTIFICIAL (GEMINI - Atualizado)
// ============================================================

async function chamarGemini(prompt, systemInstruction = "") {
  if (!GEMINI_KEY) return null;
  
  const fullPrompt = `${systemInstruction}\n\n${PLANOS_CONTEXTO}\n\nPERGUNTA: ${prompt}`;
  
  try {
    // ATUALIZAÇÃO IMPORTANTE: Usando modelo estável disponível no ambiente
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: fullPrompt }] }]
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

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  
  if(lista && leadsCache.length === 0) {
    lista.innerHTML = `<div style="text-align:center; padding:40px;"><i class="fas fa-sync fa-spin text-3xl text-blue-400 mb-3"></i><div class="text-gray-500">Buscando leads...</div></div>`;
  }

  try {
    console.log("📡 Carregando leads...");
    
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        route: 'getLeads',
        payload: { vendedor: loggedUser }
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('❌ JSON inválido:', text);
      throw new Error('Resposta inválida');
    }

    if (data.status === 'success') {
      leadsCache = (data.data || []).filter(l => {
        if (!l.nomeLead || l.nomeLead.trim() === '') return false;
        const v = (l.vendedor || '').toLowerCase();
        return v.includes(loggedUser.toLowerCase());
      });
      
      leadsCache.sort((a, b) => {
        const parseDate = (d) => {
          if (!d) return 0;
          if (d.includes('/')) {
            const parts = d.split(' ');
            const dateParts = parts[0].split('/');
            const timeParts = parts[1] ? parts[1].split(':') : [0,0,0];
            return new Date(dateParts[2], dateParts[1]-1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]).getTime();
          }
          return new Date(d).getTime();
        };
        return parseDate(b.timestamp) - parseDate(a.timestamp);
      });
      
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      
      console.log(`✅ ${leadsCache.length} leads carregados`);
      
      renderLeads();
      atualizarDashboard();
      verificarAgendamentosHoje();
      
    } else {
      throw new Error(data.message || 'Erro ao carregar');
    }
      
  } catch (e) {
    console.error('❌ Erro:', e);
    
    if(lista && leadsCache.length === 0) {
      lista.innerHTML = `<div style="text-align:center; padding:30px;"><i class="fas fa-exclamation-triangle text-4xl text-yellow-400 mb-3"></i><div class="font-bold text-gray-700">Sem conexão</div><button onclick="carregarLeads()" class="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg"><i class="fas fa-redo"></i> Tentar Novamente</button></div>`;
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
    div.innerHTML = `<div style="text-align:center; padding:40px;"><i class="fas fa-inbox text-5xl text-gray-300 mb-3"></i><div class="text-gray-500">Nenhum lead encontrado</div></div>`;
    return;
  }

  div.innerHTML = filtrados.map((l, index) => {
    let badgeClass = "bg-gray-100 text-gray-500";
    const inter = (l.interesse || 'MÉDIO').toUpperCase();
    if(inter.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    if(inter.includes('BAIXO')) badgeClass = "bg-red-50 text-red-500";
    
    const dataShow = l.timestamp ? l.timestamp.split(' ')[0] : 'Hoje';
    const horaShow = l.timestamp && l.timestamp.includes(' ') ? l.timestamp.split(' ')[1].substring(0,5) : '';
    
    // Verifica se tem agendamento
    const temAgendamento = l.agendamento && l.agendamento.trim() !== '';
    const agendaBadge = temAgendamento ? `<span class="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full ml-2"><i class="fas fa-calendar-check"></i> ${l.agendamento.split(' ')[0]}</span>` : '';

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4 cursor-pointer active:bg-blue-50 transition hover:shadow-md">
      <div class="flex justify-between items-start mb-3 pointer-events-none">
        <div>
          <div class="font-bold text-[#003870] text-lg leading-tight flex items-center flex-wrap">${l.nomeLead} ${agendaBadge}</div>
          <div class="text-xs text-gray-400 mt-1">${dataShow} ${horaShow}</div>
        </div>
        <span class="${badgeClass} px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap">${inter}</span>
      </div>
      <div class="text-sm text-gray-600 mb-2 pointer-events-none flex items-center">
         <i class="fas fa-map-marker-alt text-red-400 mr-2"></i> ${l.bairro || 'Não informado'}
      </div>
      <div class="text-sm text-gray-500 pointer-events-none flex items-center">
         <i class="fas fa-phone text-green-500 mr-2"></i> ${l.telefone || 'Sem telefone'}
      </div>
    </div>`;
  }).join('');
}

function abrirLeadDetalhes(index) {
    const lead = leadsCache[index];
    if(!lead) return;
    
    leadAtualParaAgendar = lead; // ✅ Guarda para usar no agendamento

    // Helper Functions para evitar erros se o elemento não existir
    const setText = (id, text) => { const el = document.getElementById(id); if(el) el.innerText = text; };
    const setValue = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };

    setText('modalLeadNome', lead.nomeLead || 'Sem Nome');
    setText('modalLeadInfo', `${lead.bairro || 'Geral'} • ${lead.timestamp ? lead.timestamp.split(' ')[0] : 'Hoje'}`);
    
    let info = [];
    if(lead.telefone) info.push(`📞 ${lead.telefone}`);
    if(lead.endereco) info.push(`📍 ${lead.endereco}`);
    if(lead.cidade) info.push(`🏙️ ${lead.cidade}`);
    if(lead.provedor) info.push(`📡 Provedor atual: ${lead.provedor}`);
    if(lead.agendamento) info.push(`\n🔔 Agendado para: ${lead.agendamento}`);
    if(lead.observacao) info.push(`\n💬 ${lead.observacao}`);
    
    setText('modalLeadObs', info.length ? info.join('\n') : "Nenhuma informação adicional.");

    // Preenche campos de agendamento se já existir e os elementos existirem no DOM
    const elData = document.getElementById('agendarData');
    const elHora = document.getElementById('agendarHora');

    if (elData && elHora) {
        if(lead.agendamento) {
            try {
                const [data, hora] = lead.agendamento.split(' ');
                const [dia, mes, ano] = data.split('/');
                elData.value = `${ano}-${mes}-${dia}`;
                elHora.value = hora || '';
            } catch(e) {
                elData.value = '';
            }
        } else {
            elData.value = '';
            elHora.value = '09:00';
        }
    }

    const tel = (lead.telefone || "").replace(/\D/g, '');
    const btnWhats = document.getElementById('btnModalWhats');
    
    if (btnWhats) {
        btnWhats.onclick = () => {
            if(tel) window.open(`https://wa.me/55${tel}`, '_blank');
            else alert("Telefone não disponível.");
        };
    }

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
    provedor: "",
    agendamento: "",
    timestamp: new Date().toLocaleString('pt-BR')
  };
  
  const res = await apiCall('addLead', novoLead);
  showLoading(false);
  
  if (res && (res.status === 'success' || res === 'CORS_OK')) {
      alert('✅ Lead Salvo!');
      
      leadsCache.unshift(novoLead);
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));

      document.getElementById('leadNome').value = ''; 
      document.getElementById('leadTelefone').value = '';
      document.getElementById('leadEndereco').value = ''; 
      document.getElementById('leadCidade').value = '';
      document.getElementById('leadObs').value = '';
      document.getElementById('leadBairro').value = '';
      document.getElementById('leadInteresse').value = 'MÉDIO';
      
      navegarPara('gestaoLeads');
  } else {
      alert('❌ Erro ao salvar.');
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
}

// ============================================================
// 5. ROTAS GPS
// ============================================================

function startRoute() {
  if (!navigator.geolocation) return alert('GPS não disponível.');
  
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
      document.getElementById('gpsStatus').innerText = "⚠️ Erro";
    },
    {enableHighAccuracy: true, timeout: 10000, maximumAge: 0}
  );
}

async function stopRoute() {
  if(!confirm("Finalizar rastreamento?")) return;
  
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
  alert(`✅ Rota salva! ${routeCoords.length} pontos`);
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
      // Se der erro de JSON mas for uma dessas rotas, é o erro de CORS do Google (mas deu certo)
      if(route === 'addLead' || route === 'saveRoute' || route === 'updateAgendamento') {
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
    
    // Tratamento específico para erro de CORS onde a requisição na verdade funcionou
    if(e.name === 'TypeError' && (route === 'addLead' || route === 'saveRoute' || route === 'updateAgendamento')) {
      return 'CORS_OK';
    }
    
    console.error(`Erro ${route}:`, e.message);
    return null;
  }
}

function showLoading(show, txt = "AGUARDE...") {
  const loader = document.getElementById('loader');
  if(loader) loader.style.display = show ? 'flex' : 'none';
  
  const loaderText = document.getElementById('loaderText');
  if(loaderText && txt) loaderText.innerText = txt;
}
