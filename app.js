/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V47 (DEBUG MATERIAIS)
 * ============================================================
 * 📝 CORREÇÕES:
 * - Logs detalhados para debug de materiais
 * - Timeout na navegação para garantir renderização
 * - Botão "Tentar Novamente" em caso de erro
 * - Mantém toda a lógica de PWA, Login e Leads
 * ============================================================
 */

// CONFIGURAÇÃO
const DEPLOY_ID = 'AKfycbx3ZFBSY-io3kFcISj_IDu8NqxFpeCAg8xVARDGweanwKrd4sR5TpmFYGmaGAa0QUHS'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

console.log('🔧 DEPLOY_ID configurado:', DEPLOY_ID);
console.log('🌐 API_URL:', API_URL);

// Validação inicial
if (!DEPLOY_ID || DEPLOY_ID.length < 20) {
    console.error('⚠️ DEPLOY_ID inválido! Configure a URL correta do Google Apps Script.');
}

let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let leadAtualParaAgendar = null; 
let chatHistoryData = []; 
let currentFolderId = null;

// 1. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 MHNET App v47 - Debug Materiais");
  console.log("📍 URL da API:", API_URL);
  
  // Teste de conectividade da API
  console.log("🔌 Testando conectividade da API...");
  try {
      const testRes = await fetch(API_URL + '?route=getVendors', {
          method: 'GET',
          mode: 'cors'
      });
      console.log("✅ API respondeu com status:", testRes.status);
  } catch (err) {
      console.error("❌ API não está acessível:", err.message);
      console.warn("⚠️ Modo offline será usado automaticamente");
  }
  
  // Carrega vendedores com timeout de segurança
  try {
      await carregarVendedores();
  } catch (err) {
      console.error('❌ Erro crítico ao carregar vendedores:', err);
      // Força carregar lista offline em caso de erro crítico
      const select = document.getElementById('userSelect');
      if(select && select.options.length <= 1) {
          console.log('🔄 Forçando lista offline de emergência...');
          const VENDEDORES = [
              "Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader",
              "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges",
              "Elton da Silva Rodrigo Gonçalves", "Bruno Garcia Queiroz"
          ];
          select.innerHTML = '<option value="">Selecione seu nome...</option>';
          VENDEDORES.forEach(nome => {
              const opt = document.createElement('option');
              opt.value = nome; 
              opt.innerText = nome; 
              select.appendChild(opt);
          });
          console.log('✅ Lista offline de emergência carregada');
      }
  }
  
  const saved = localStorage.getItem('mhnet_leads_cache');
  if(saved) {
      try { 
          leadsCache = JSON.parse(saved); 
          console.log('💾 Cache de leads carregado:', leadsCache.length, 'leads');
      } catch(e) {
          console.error('❌ Erro ao carregar cache:', e);
      }
  }
  
  if (loggedUser) {
      console.log('👤 Usuário já logado:', loggedUser);
      initApp();
  } else {
      console.log('🔐 Aguardando login...');
      document.getElementById('userMenu').style.display = 'flex';
      document.getElementById('mainContent').style.display = 'none';
  }
});

// --- CARREGAMENTO DE VENDEDORES ---
async function carregarVendedores() {
    console.log('📋 Iniciando carregamento de vendedores...');
    
    const select = document.getElementById('userSelect');
    if(!select) {
        console.error('❌ Elemento userSelect não encontrado');
        return;
    }
    
    const VENDEDORES_OFFLINE = [
        "Ana Paula Rodrigues", 
        "Vitoria Caroline Baldez Rosales", 
        "João Vithor Sader",
        "João Paulo da Silva Santos", 
        "Claudia Maria Semmler", 
        "Diulia Vitoria Machado Borges",
        "Elton da Silva Rodrigo Gonçalves", 
        "Bruno Garcia Queiroz"
    ];

    select.innerHTML = '<option value="">Carregando equipe...</option>';

    try {
        console.log('🌐 Tentando buscar vendedores da API...');
        const res = await apiCall('getVendors', {}, false);
        
        console.log('📦 Resposta getVendors:', res);
        
        if (res && res.status === 'success' && res.data && res.data.length > 0) {
            console.log('✅ Vendedores carregados da API:', res.data.length);
            select.innerHTML = '<option value="">Toque para selecionar...</option>';
            res.data.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.nome; 
                opt.innerText = v.nome; 
                select.appendChild(opt);
            });
        } else { 
            throw new Error("Lista vazia ou erro na API"); 
        }
    } catch (e) {
        console.warn('⚠️ Falha ao carregar da API, usando lista offline:', e);
        select.innerHTML = '<option value="">Selecione seu nome...</option>';
        VENDEDORES_OFFLINE.forEach(nome => {
            const opt = document.createElement('option');
            opt.value = nome; 
            opt.innerText = nome; 
            select.appendChild(opt);
        });
        console.log('✅ Lista offline carregada com', VENDEDORES_OFFLINE.length, 'vendedores');
    }
}

// 2. CORE SYSTEM

function initApp() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'flex'; 
  
  const elUser = document.getElementById('userInfo');
  if(elUser) {
      elUser.innerText = loggedUser;
      elUser.classList.remove('truncate', 'max-w-[150px]'); 
  }

  atualizarDataCabecalho();
  
  if(leadsCache.length > 0) {
    renderLeads();
    atualizarDashboard();
    verificarAgendamentosHoje();
  }
  
  navegarPara('dashboard');
  carregarLeads(false); 
}

function atualizarDataCabecalho() {
    const elData = document.getElementById('headerDate');
    if(!elData) return;
    const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const agora = new Date();
    elData.innerText = `${dias[agora.getDay()]}, ${agora.getDate()} ${meses[agora.getMonth()]}`;
}

function navegarPara(pageId) {
  document.querySelectorAll('.page').forEach(el => {
      el.style.display = 'none';
      el.classList.remove('fade-in');
  });

  const target = document.getElementById(pageId);
  if(target) {
      target.style.display = 'block';
      void target.offsetWidth; 
      target.classList.add('fade-in');
  }
  
  const scroller = document.getElementById('main-scroll');
  if(scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });

  // Reset de Filtros da Lista de Leads
  if (pageId === 'gestaoLeads') {
      const busca = document.getElementById('searchLead');
      if(busca && busca.placeholder.includes("Retornos")) {
          busca.value = "";
          busca.placeholder = "Buscar por nome, bairro...";
      }
      renderLeads();
  }

  // 🆕 Lógica de Entrada em Materiais
  if (pageId === 'materiais') { 
      currentFolderId = null; // Reseta para a raiz (Menu Principal)
      setTimeout(() => carregarMateriais(), 100); // Delay para garantir renderização
  }
  
  if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
}

function verificarAgendamentosHoje() {
  try {
      const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
      const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
      const banner = document.getElementById('lembreteBanner');
      const txt = document.getElementById('lembreteTexto');
      
      if (retornos.length > 0) {
        if(banner) banner.classList.remove('hidden');
        if(txt) txt.innerText = `Você tem ${retornos.length} retornos hoje.`;
      } else {
        if(banner) banner.classList.add('hidden');
      }
  } catch (e) { console.error("Erro verificarAgendamentos:", e); }
}

// 3. COMUNICAÇÃO API

async function apiCall(route, payload, show=true) {
  console.log('🌐 API Call:', route, payload);
  
  if(show) showLoading(true);
  
  try {
    const res = await fetch(API_URL, { 
        method: 'POST', 
        headers: {'Content-Type': 'text/plain;charset=utf-8'}, 
        body: JSON.stringify({ route: route, payload: payload }),
        mode: 'cors'
    });
    
    console.log('📡 Status HTTP:', res.status, res.statusText);
    
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const text = await res.text();
    console.log('📄 Resposta raw (primeiros 500 chars):', text.substring(0, 500));
    
    let json;
    try { 
        json = JSON.parse(text); 
        console.log('✅ JSON parseado com sucesso');
    } catch(e) { 
        console.error('❌ Erro ao parsear JSON:', e);
        console.error('Texto recebido:', text);
        throw new Error("Resposta inválida do servidor"); 
    }
    
    if(show) showLoading(false);
    return json;
    
  } catch(e) {
    console.error('❌ Erro na chamada API:', e.message);
    console.error('Stack:', e.stack);
    
    if(show) showLoading(false);
    
    // Fallback para operações que podem funcionar offline
    if(['addLead', 'updateAgendamento', 'updateObservacao'].includes(route)) {
        console.log('💾 Usando modo offline para:', route);
        return {status:'success', local: true};
    }
    
    // Para outras rotas, retorna erro
    return {status: 'error', message: e.message};
  }
}

// ============================================================
// 🖼️ MATERIAIS & PORTFÓLIOS (COM DEBUG)
// ============================================================

async function carregarMateriais(folderId = null, search = "") {
    console.log('📂 Carregando materiais:', { folderId, search });
    
    const div = document.getElementById('materiaisGrid');
    if (!div) {
        console.error('❌ Elemento materiaisGrid não encontrado');
        return;
    }
    
    currentFolderId = folderId; // Atualiza estado atual

    // Loader Visual
    div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10 fade-in"><i class="fas fa-circle-notch fa-spin text-2xl mb-2 text-[#00aeef]"></i><br>Carregando...</div>';

    try {
        // Chama Backend
        const res = await apiCall('getImages', { folderId: folderId, search: search }, false);
        
        console.log('📦 Resposta do backend:', res);
        
        if (res && res.status === 'success' && res.data) {
            // Atualiza UI de Navegação (Botão Voltar)
            atualizarNavegacaoMateriais(res.isRoot);
            renderMateriais(res.data);
        } else {
            console.error('❌ Erro na resposta:', res);
            div.innerHTML = '<div class="col-span-2 text-center text-red-400 py-10"><i class="fas fa-exclamation-triangle mb-2"></i><br>Erro ao carregar.<br><button onclick="carregarMateriais()" class="mt-3 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">Tentar Novamente</button></div>';
        }
    } catch (error) {
        console.error('❌ Erro ao carregar materiais:', error);
        div.innerHTML = '<div class="col-span-2 text-center text-red-400 py-10"><i class="fas fa-exclamation-triangle mb-2"></i><br>Erro de conexão.<br><button onclick="carregarMateriais()" class="mt-3 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">Tentar Novamente</button></div>';
    }
}

function atualizarNavegacaoMateriais(isRoot) {
    const btnVoltar = document.querySelector('#materiais button'); // Pega o botão de voltar do header
    const titleEl = document.querySelector('#materiais h2');
    
    if(btnVoltar) {
        if(isRoot) {
            // Se está na raiz, voltar vai para o Dashboard
            btnVoltar.onclick = () => navegarPara('dashboard');
            if(titleEl) titleEl.innerText = "Marketing";
        } else {
            // Se está em uma subpasta, voltar vai para a raiz
            btnVoltar.onclick = () => {
                const searchInput = document.getElementById('searchMateriais');
                if (searchInput) searchInput.value = ""; // Limpa busca se existir
                carregarMateriais(null);
            };
            if(titleEl) titleEl.innerText = "Voltar";
        }
    }
}

function buscarMateriais() {
    const input = document.getElementById('searchMateriais');
    if (input) {
        carregarMateriais(currentFolderId, input.value);
    }
}

function renderMateriais(items) {
    const div = document.getElementById('materiaisGrid');
    if(!div) return;
    
    if(items.length === 0) {
        div.innerHTML = '<div class="col-span-2 text-center text-gray-400 py-10">Esta pasta está vazia.</div>';
        return;
    }

    div.innerHTML = items.map(item => {
        // 📁 RENDERIZAÇÃO DE PASTA
        if (item.type === 'folder') {
            return `
            <div onclick="carregarMateriais('${item.id}')" class="bg-white p-4 rounded-2xl shadow-sm border border-blue-50 flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-95 transition h-36 hover:bg-blue-50 group">
                <i class="fas fa-folder text-5xl text-[#00aeef] group-hover:scale-110 transition drop-shadow-sm"></i>
                <span class="text-xs font-bold text-slate-600 text-center leading-tight line-clamp-2">${item.name}</span>
            </div>`;
        } 
        // 🖼️ RENDERIZAÇÃO DE IMAGEM
        else {
            return `
            <div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-48 relative overflow-hidden group">
                <img src="${item.thumbnail}" class="w-full h-32 object-cover rounded-xl bg-gray-50" alt="${item.name}" loading="lazy">
                <div class="flex-1 flex items-center justify-between mt-2 px-1">
                    <span class="text-[10px] text-gray-500 font-bold truncate w-20">${item.name}</span>
                    <button onclick="compartilharImagem('${item.viewUrl}')" class="bg-green-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md active:scale-90 transition hover:bg-green-600">
                        <i class="fab fa-whatsapp"></i>
                    </button>
                </div>
                <a href="${item.viewUrl}" target="_blank" class="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition">
                    <i class="fas fa-expand"></i>
                </a>
            </div>`;
        }
    }).join('');
}

function compartilharImagem(url) {
    const texto = `Olá! Segue o material da MHNET que combinamos: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

// 4. GESTÃO DE LEADS

async function carregarLeads(showLoader = true) {
  const res = await apiCall('getLeads', { vendedor: loggedUser }, showLoader);
  if (res && res.status === 'success') {
      leadsCache = res.data || [];
      leadsCache.sort((a, b) => b._linha - a._linha);
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      
      const elLista = document.getElementById('listaLeadsGestao');
      if(elLista && elLista.offsetParent !== null) renderLeads();
      
      atualizarDashboard();
      verificarAgendamentosHoje();
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const lista = leadsCache.filter(l => 
    (l.nomeLead||'').toLowerCase().includes(term) || 
    (l.bairro||'').toLowerCase().includes(term) ||
    (l.provedor||'').toLowerCase().includes(term)
  );
  
  if (!lista.length) { 
      div.innerHTML = '<div class="flex flex-col items-center mt-10 text-slate-300"><i class="fas fa-search text-4xl mb-2"></i><p class="text-sm font-bold">Nenhum cliente encontrado.</p></div>'; 
      return; 
  }

  div.innerHTML = lista.map((l, i) => {
      const realIndex = leadsCache.indexOf(l);
      return criarCardLead(l, realIndex);
  }).join('');
}

function criarCardLead(l, index, destaque = false) {
    let badge = "bg-slate-100 text-slate-500";
    if (l.interesse === 'Alto') badge = "bg-green-100 text-green-700 ring-1 ring-green-200";
    if (l.interesse === 'Baixo') badge = "bg-blue-50 text-blue-400";

    const borda = destaque ? "border-l-4 border-l-orange-500 shadow-md bg-orange-50/50" : "border border-slate-100 shadow-sm bg-white";

    return `
    <div onclick="abrirLeadDetalhes(${index})" class="${borda} p-5 rounded-2xl mb-3 cursor-pointer active:scale-[0.98] transition-all duration-200 relative overflow-hidden group">
      <div class="flex justify-between items-start relative z-10">
        <div class="flex-1 min-w-0 pr-3">
            <div class="font-bold text-slate-800 text-lg leading-tight mb-2 truncate">${l.nomeLead}</div>
            <div class="flex flex-wrap gap-2">
                ${l.bairro ? `<span class="text-[10px] bg-slate-50 text-slate-500 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider flex items-center border border-slate-200"><i class="fas fa-map-pin mr-1.5 text-slate-400"></i>${l.bairro}</span>` : ''}
                ${l.provedor ? `<span class="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider flex items-center border border-indigo-100"><i class="fas fa-wifi mr-1.5"></i>${l.provedor}</span>` : ''}
            </div>
        </div>
        <div class="flex flex-col items-end gap-2 shrink-0">
            <span class="text-[10px] font-bold px-3 py-1 rounded-full ${badge}">${l.interesse || 'Médio'}</span>
            ${l.agendamento ? `<span class="text-[10px] text-orange-600 font-bold bg-white px-2 py-1 rounded-lg border border-orange-100 shadow-sm flex items-center"><i class="fas fa-clock mr-1"></i> ${l.agendamento.split(' ')[0]}</span>` : ''}
        </div>
      </div>
    </div>`;
}

// 5. MODAIS

function abrirLeadDetalhes(index) {
    const l = leadsCache[index];
    if(!l) return;
    leadAtualParaAgendar = l;
    
    const setText = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };
    setText('modalLeadNome', l.nomeLead);
    setText('modalLeadInfo', `${l.bairro || 'Sem bairro'} • ${l.telefone}`);
    setText('modalLeadCidade', l.cidade || 'Cidade não informada');
    setText('modalLeadProvedor', l.provedor || 'Não informado');
    
    const obsEl = document.getElementById('modalLeadObs');
    if(obsEl) obsEl.value = l.observacao || "";
    
    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) {
        const num = l.telefone.replace(/\D/g,'');
        btnWhats.onclick = () => window.open(`https://wa.me/55${num}`, '_blank');
    }

    const m = document.getElementById('leadModal');
    if (m) { 
        m.classList.remove('hidden'); 
        const c = m.querySelector('div.slide-up'); 
        if(c) { c.classList.remove('slide-up'); void c.offsetWidth; c.classList.add('slide-up'); } 
    }
}

function fecharLeadModal() { 
    document.getElementById('leadModal').classList.add('hidden'); 
    leadAtualParaAgendar = null; 
}

window.editarLeadAtual = function() {
    if (!leadAtualParaAgendar) { alert("Selecione um lead."); return; }
    if(!confirm(`Editar cadastro de ${leadAtualParaAgendar.nomeLead}?`)) return;

    const lead = leadAtualParaAgendar;
    
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ""; };
    setVal('leadNome', lead.nomeLead);
    setVal('leadTelefone', lead.telefone);
    setVal('leadProvedor', lead.provedor);
    setVal('leadObs', lead.observacao);
    setVal('leadEndereco', lead.endereco);
    setVal('leadBairro', lead.bairro);
    setVal('leadCidade', lead.cidade);
    
    const selInt = document.getElementById('leadInteresse');
    if(selInt) selInt.value = lead.interesse || "Médio";

    fecharLeadModal();
    navegarPara('cadastroLead');
};

async function enviarLead() {
  const nome = document.getElementById('leadNome').value.trim();
  const tel = document.getElementById('leadTelefone').value.trim();
  if (!nome || !tel) return alert("Preencha Nome e WhatsApp");
  
  const novoLead = {
    vendedor: loggedUser, nomeLead: nome, telefone: tel,
    endereco: document.getElementById('leadEndereco').value,
    cidade: document.getElementById('leadCidade').value,
    bairro: document.getElementById('leadBairro').value,
    interesse: document.getElementById('leadInteresse').value,
    provedor: document.getElementById('leadProvedor').value,
    observacao: document.getElementById('leadObs').value,
    agendamento: ""
  };
   
  const res = await apiCall('addLead', novoLead);
  
  if (res && (res.status === 'success' || res.local)) {
      alert('✅ Cadastro Salvo!');
      leadsCache.unshift(novoLead); 
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      ['leadNome', 'leadTelefone', 'leadObs', 'leadEndereco', 'leadBairro', 'leadProvedor'].forEach(id => document.getElementById(id).value = '');
      navegarPara('gestaoLeads');
  } else {
      alert('Erro ao salvar.');
  }
}

async function salvarAgendamento() {
  if (!leadAtualParaAgendar) return;
  const dt = document.getElementById('agendarData').value;
  const hr = document.getElementById('agendarHora').value;
  if (!dt) return alert("Data obrigatória");
  
  const [a, m, d] = dt.split('-');
  const ag = `${d}/${m}/${a} ${hr || '09:00'}`;
  
  const res = await apiCall('updateAgendamento', {
      vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: ag
  });
  
  if(res && (res.status === 'success' || res.local)) {
      alert("✅ Agendado! O Gestor será notificado.");
      leadAtualParaAgendar.agendamento = ag;
      localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      fecharLeadModal();
      verificarAgendamentosHoje();
      renderLeads();
  }
}

async function salvarObservacaoModal() {
    if (!leadAtualParaAgendar) return;
    const obs = document.getElementById('modalLeadObs').value;
    const res = await apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: obs });
    if(res) {
        alert("Salvo!");
        leadAtualParaAgendar.observacao = obs;
        localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    }
}

window.filtrarRetornos = function() {
    const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
    navegarPara('gestaoLeads');
    const input = document.getElementById('searchLead');
    if(input) { input.value = ""; input.placeholder = `📅 Retornos de Hoje (${hoje})`; }
    const div = document.getElementById('listaLeadsGestao');
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    if(!retornos.length) { div.innerHTML = '<div class="text-center mt-10 font-bold text-slate-400">Nenhum retorno hoje! 😴</div>'; return; }
    div.innerHTML = retornos.map(l => {
        const idx = leadsCache.indexOf(l);
        return criarCardLead(l, idx, true);
    }).join('');
};

// 6. IA HÍBRIDA

async function perguntarIABackend(pergunta) {
  chatHistoryData.push(`User: ${pergunta}`);
  const contexto = chatHistoryData.slice(-6);
  try {
    const res = await apiCall('askAI', { question: pergunta, history: contexto }, false);
    if (res && res.status === 'success') {
      const resp = res.answer;
      chatHistoryData.push(`IA: ${resp}`);
      return resp;
    } else return "⚠️ IA indisponível.";
  } catch (e) { return "Erro de conexão."; }
}

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if(!nome) return alert("Preencha o nome!");
  showLoading(true, "CRIANDO PITCH...");
  const txt = await perguntarIABackend(`Crie pitch curto WhatsApp para ${nome}.`);
  showLoading(false);
  if(txt) document.getElementById('leadObs').value = txt.replace(/["*#]/g, '').trim();
}

async function gerarCoachIA() {
  showLoading(true, "COACH...");
  const txt = await perguntarIABackend(`Frase motivacional vendas curta.`);
  showLoading(false);
  if(txt) alert(`🚀 ${txt.replace(/\*\*/g,'')}`);
}

async function consultarPlanosIA() {
    toggleChat();
    if(document.getElementById('chatHistory').innerHTML === "") {
        document.getElementById('chatHistory').innerHTML = `<div class="flex gap-3 fade-in"><div class="w-8 h-8 bg-blue-100 rounded-full flex-shrink-0 flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm">Olá! Pergunte sobre planos.</div></div>`;
    }
}

function toggleChat() {
    const el = document.getElementById('chatModal');
    if(el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        setTimeout(() => document.getElementById('chatInput')?.focus(), 300);
    } else { el.classList.add('hidden'); }
}

async function enviarMensagemChat() {
    const input = document.getElementById('chatInput');
    const hist = document.getElementById('chatHistory');
    const msg = input.value.trim();
    if(!msg) return;
    hist.innerHTML += `<div class="flex gap-3 justify-end fade-in mb-3"><div class="bg-[#004c99] p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-sm max-w-[85%]">${msg}</div></div>`;
    input.value = '';
    const loadId = 'load-' + Date.now();
    hist.innerHTML += `<div id="${loadId}" class="flex gap-3 fade-in mb-3"><div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs"><i class="fas fa-spinner fa-spin"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-400 italic">...</div></div>`;
    hist.scrollTop = hist.scrollHeight;
    const resp = await perguntarIABackend(msg);
    document.getElementById(loadId)?.remove();
    if(resp) {
          const cleanResp = resp.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
          hist.innerHTML += `<div class="flex gap-3 fade-in mb-3"><div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-[#004c99] text-xs"><i class="fas fa-robot"></i></div><div class="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 text-sm text-gray-600 shadow-sm max-w-[90%] leading-relaxed">${cleanResp}</div></div>`;
          hist.scrollTop = hist.scrollHeight;
    }
}

// 7. UTILITÁRIOS

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
  const count = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

function setLoggedUser() {
  const v = document.getElementById('userSelect').value;
  if (v) { loggedUser = v; localStorage.setItem('loggedUser', v); initApp(); } else alert('Selec
