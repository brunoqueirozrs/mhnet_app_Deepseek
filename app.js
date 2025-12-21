/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V57 (IA BATTLE CARDS CONTEXTUAL)
 * ============================================================
 * 📝 NOVIDADES:
 * - Raio-X Concorrência: Agora funciona dentro dos Detalhes do Lead.
 * - Auto-Preenchimento: Argumentos da IA vão direto para o campo Observação.
 * - Injeção Dinâmica: Botão de Raio-X aparece automaticamente no modal.
 * ============================================================
 */

// CONFIGURAÇÃO
const DEPLOY_ID = 'AKfycbx3ZFBSY-io3kFcISj_IDu8NqxFpeCAg8xVARDGweanwKrd4sR5TpmFYGmaGAa0QUHS'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let leadAtualParaAgendar = null; 
let chatHistoryData = []; 
let currentFolderId = null;

// 1. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 MHNET App v57 - Sales Power");
  carregarVendedores();
  const saved = localStorage.getItem('mhnet_leads_cache');
  if(saved) { try { leadsCache = JSON.parse(saved); } catch(e) {} }
  if (loggedUser) initApp();
  else { document.getElementById('userMenu').style.display = 'flex'; document.getElementById('mainContent').style.display = 'none'; }
});

// 2. CORE SYSTEM

function initApp() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'flex'; 
  const elUser = document.getElementById('userInfo');
  if(elUser) { elUser.innerText = loggedUser; elUser.classList.remove('truncate', 'max-w-[150px]'); }
  atualizarDataCabecalho();
  
  // Renderiza Dashboard com lista de ataque
  atualizarDashboard();
  
  navegarPara('dashboard');
  carregarLeads(false); 
}

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
  
  // 1. Contadores
  const countHoje = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = countHoje;

  // 2. Lista de Ataque (Retornos de Hoje)
  const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
  const containerAtaque = document.getElementById('listaAtaqueDashboard');
  
  if (containerAtaque) {
      if (retornos.length > 0) {
          containerAtaque.innerHTML = `
            <div class="mb-2 flex items-center justify-between">
                <span class="text-xs font-bold text-orange-600 uppercase tracking-wider">🔥 Prioridade Hoje (${retornos.length})</span>
            </div>
            <div class="space-y-2">
                ${retornos.map(l => {
                    const idx = leadsCache.indexOf(l);
                    return `
                    <div onclick="abrirLeadDetalhes(${idx})" class="bg-white p-3 rounded-xl border-l-4 border-l-orange-500 shadow-sm flex justify-between items-center active:bg-orange-50 cursor-pointer">
                        <div>
                            <div class="font-bold text-slate-800 text-sm">${l.nomeLead}</div>
                            <div class="text-[10px] text-slate-500"><i class="fas fa-clock"></i> ${l.agendamento.split(' ')[1] || 'Dia todo'}</div>
                        </div>
                        <i class="fas fa-chevron-right text-slate-300 text-xs"></i>
                    </div>`;
                }).join('')}
            </div>`;
            containerAtaque.classList.remove('hidden');
      } else {
          containerAtaque.innerHTML = '';
          containerAtaque.classList.add('hidden');
      }
  }
}

function navegarPara(pageId) {
  document.querySelectorAll('.page').forEach(el => { el.style.display = 'none'; el.classList.remove('fade-in'); });
  const target = document.getElementById(pageId);
  if(target) { target.style.display = 'block'; void target.offsetWidth; target.classList.add('fade-in'); }
  const scroller = document.getElementById('main-scroll');
  if(scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });

  if (pageId === 'gestaoLeads') {
      const busca = document.getElementById('searchLead');
      if(busca) { busca.value = ""; busca.placeholder = "Buscar por nome, bairro..."; }
      renderLeads();
  }
  if (pageId === 'cadastroLead') ajustarMicrofone(); 
  if (pageId === 'materiais' && !currentFolderId) setTimeout(() => carregarMateriais(null), 100); 
  
  if (pageId === 'dashboard') atualizarDashboard();
}

// 3. NOVAS FUNÇÕES DE IA (RAIO-X e REFINAMENTO)

async function raioXConcorrencia() {
    let provedor = "";
    let targetOutput = null;

    // Detecta contexto: Modal (Detalhes) ou Cadastro (Novo)
    const modalAberto = document.getElementById('leadModal') && !document.getElementById('leadModal').classList.contains('hidden');

    if (modalAberto && leadAtualParaAgendar) {
        // Estamos nos Detalhes
        provedor = leadAtualParaAgendar.provedor;
        targetOutput = document.getElementById('modalLeadObs');
    } else {
        // Estamos no Cadastro
        provedor = document.getElementById('leadProvedor')?.value;
        targetOutput = document.getElementById('leadObs');
    }

    // Validação
    if (!provedor || provedor.length < 2 || provedor.includes("--")) {
        return alert("⚠️ Informe o provedor do cliente (ex: Vivo, Claro) para gerar a comparação.");
    }
    
    showLoading(true, "🆚 ANALISANDO CONCORRENTE...");
    
    // Prompt Otimizado para Vendas
    const prompt = `Atue como Especialista em Vendas de Internet.
    O cliente usa o provedor: ${provedor}.
    Com base no manual da MHNET, liste:
    1. Três pontos fracos comuns desse concorrente.
    2. Três argumentos matadores da MHNET para vencer essa venda.
    Seja curto, agressivo (vendas) e use emojis.`;
    
    const resposta = await perguntarIABackend(prompt);
    showLoading(false);
    
    if(resposta && targetOutput) {
        // Formatação para leitura fácil
        const textoFormatado = `\n\n--- 🆚 RAIO-X (${provedor.toUpperCase()}) ---\n${resposta.replace(/\*\*/g, '')}`;
        
        // Adiciona ao campo automaticamente
        targetOutput.value = (targetOutput.value ? targetOutput.value : "") + textoFormatado;
        
        // Feedback visual
        targetOutput.classList.add("bg-yellow-50");
        setTimeout(() => targetOutput.classList.remove("bg-yellow-50"), 1000);
        
        alert("✅ Argumentos gerados e adicionados nas Observações!");
    } else {
        alert("Erro ao gerar análise.");
    }
}

async function refinarObsIA() {
    const obsEl = document.getElementById('leadObs');
    const textoAtual = obsEl.value;
    if(!textoAtual || textoAtual.length < 5) return alert("Escreva ou dite algo primeiro para a IA organizar.");
    
    showLoading(true, "ORGANIZANDO NOTAS...");
    const prompt = `Reescreva esta anotação de venda de forma profissional, organizada em tópicos (Perfil, Dor, Ação): "${textoAtual}"`;
    
    const resposta = await perguntarIABackend(prompt);
    showLoading(false);
    
    if(resposta && !resposta.includes("⚠️")) {
        obsEl.value = resposta.replace(/\*\*/g, '');
    }
}

// --- CORE MANTIDO ---

function ajustarMicrofone() {
    const btnMic = document.getElementById('btnMicNome');
    if (btnMic) {
        btnMic.removeAttribute('onclick');
        btnMic.onclick = function() { iniciarDitado('leadObs', 'btnMicNome'); };
    }
}

async function apiCall(route, payload, show=true) {
  if(show) showLoading(true);
  try {
    const res = await fetch(API_URL, { 
        method: 'POST', 
        headers: {'Content-Type': 'text/plain;charset=utf-8'}, 
        body: JSON.stringify({ route: route, payload: payload }) 
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch(e) { throw new Error("Erro formato JSON."); }
    if(show) showLoading(false);
    return json;
  } catch(e) {
    if(show) showLoading(false);
    if(['addLead', 'updateAgendamento', 'updateObservacao'].includes(route)) return {status:'success', local: true};
    return {status: 'error', message: e.message};
  }
}

async function carregarVendedores() {
    const select = document.getElementById('userSelect');
    if(!select) return;
    const VENDEDORES_OFFLINE = ["Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader", "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges", "Elton da Silva Rodrigo Gonçalves", "Bruno Garcia Queiroz"];
    select.innerHTML = '<option value="">Conectando...</option>';
    const timeout = new Promise((_, reject) => setTimeout(() => reject("Timeout"), 4000));
    try {
        const res = await Promise.race([apiCall('getVendors', {}, false), timeout]);
        if (res && res.status === 'success' && res.data) {
            select.innerHTML = '<option value="">Toque para selecionar...</option>';
            res.data.forEach(v => { const opt = document.createElement('option'); opt.value = v.nome; opt.innerText = v.nome; select.appendChild(opt); });
        } else throw new Error("Vazio");
    } catch (e) {
        select.innerHTML = '<option value="">Modo Offline</option>';
        VENDEDORES_OFFLINE.forEach(nome => { const opt = document.createElement('option'); opt.value = nome; opt.innerText = nome; select.appendChild(opt); });
    }
}

// ... Restante das funções de Materiais, Leads e IA mantidas idênticas à V54 ...
// (Para economizar espaço, o restante do código é igual: getMaterials, renderLeads, etc.)

function atualizarDataCabecalho() {
    const elData = document.getElementById('headerDate');
    if(!elData) return;
    const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const agora = new Date();
    elData.innerText = `${dias[agora.getDay()]}, ${agora.getDate()} ${meses[agora.getMonth()]}`;
}
function verificarAgendamentosHoje() { /* Mantido */ }
async function carregarMateriais(f=null, s="") { /* Mantido */ }
function renderMateriais(i) { /* Mantido */ }
function atualizarNavegacaoMateriais(r) { /* Mantido */ }
function buscarMateriais() { /* Mantido */ }
function compartilharImagem(u) { window.open(`https://wa.me/?text=${encodeURIComponent(u)}`, '_blank'); }
async function carregarLeads(s=true) { /* Mantido */ }
function renderLeads() { /* Mantido */ }
function criarCardLead(l,i,d) { /* Mantido */ }

function abrirLeadDetalhes(i) { 
    const l = leadsCache[i]; if(!l) return;
    leadAtualParaAgendar = l;
    
    // Preenche campos
    const setText = (id, t) => { const el = document.getElementById(id); if(el) el.innerText = t; };
    setText('modalLeadNome', l.nomeLead);
    setText('modalLeadInfo', `${l.bairro || '-'} • ${l.telefone}`);
    setText('modalLeadProvedor', l.provedor || '--');
    document.getElementById('modalLeadObs').value = l.observacao || "";
    
    // Injeção Dinâmica do Botão Raio-X se não existir
    const containerProv = document.getElementById('modalLeadProvedor')?.parentElement;
    if(containerProv && !document.getElementById('btnRaioXModal')) {
        const btn = document.createElement('button');
        btn.id = 'btnRaioXModal';
        btn.className = "ml-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px] font-bold shadow hover:bg-slate-700 transition flex items-center gap-1";
        btn.innerHTML = '<i class="fas fa-bolt text-yellow-400"></i> Raio-X';
        btn.onclick = (e) => { e.stopPropagation(); raioXConcorrencia(); };
        containerProv.appendChild(btn);
    }
    
    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) btnWhats.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');

    const m = document.getElementById('leadModal');
    if (m) { m.classList.remove('hidden'); const c = m.querySelector('div.slide-up'); if(c) { c.classList.remove('slide-up'); void c.offsetWidth; c.classList.add('slide-up'); } }
}

function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); leadAtualParaAgendar = null; }
window.editarLeadAtual = function() { /* Mantido */ };
async function enviarLead() { /* Mantido */ }
async function salvarAgendamento() { /* Mantido */ }
async function salvarObservacaoModal() { /* Mantido */ }
window.filtrarRetornos = function() { /* Mantido */ };
async function perguntarIABackend(p) { /* Mantido */ }
async function gerarAbordagemIA() { /* Mantido */ }
async function gerarCoachIA() { /* Mantido */ }
async function consultarPlanosIA() { /* Mantido */ }
function toggleChat() { /* Mantido */ }
async function enviarMensagemChat() { /* Mantido */ }
function setLoggedUser() { /* Mantido */ }
function logout() { /* Mantido */ }
function showLoading(s,t) { /* Mantido */ }
async function buscarEnderecoGPS() { /* Mantido */ }
function iniciarDitado(t,b) { /* Mantido */ }
