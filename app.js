/**
 * ============================================================================
 * MHNET VENDAS — APP.JS V200
 * Melhorias:
 *  - IA híbrida com contexto MHNET (doc + Gemini)
 *  - FTTA com abas corretas de planilha
 *  - Almanaque de Concorrentes editável pelo admin
 *  - Lembretes de tarefa direcionam ao lead
 *  - Histórico de faltas por vendedor / admin vê todos
 *  - Envio de faltas por e-mail
 *  - PWA instalável (manifest + sw)
 * ============================================================================
 */

// ============================================================
// CONFIG
// ============================================================
const DEPLOY_ID = 'AKfycbydgHNvi0o4tZgqa37nY7-jzZd4g8Qcgo1K297KG6QKj90T2d8eczNEwWatGiXbvere';
const API_URL   = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const GEMINI_KEY = 'AIzaSyC854djGrgcGEPbhTYm46Q2ayyJBp-tNv4';
const CALENDAR_URL = 'https://calendar.google.com/calendar/u/0?cid=ZTZlNjQ2OWVkNzQ1YzMzYmIwMjg2YmFmYmM4NzA2ZmU4YzM3MWVhMDU1MWRiNDY2NDJkNTc2NTI5MmFhMDZmN0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t';
const ADMIN_NAME_CHECK = 'BRUNO GARCIA QUEIROZ';
const EMAIL_ADMIN = 'bruno.queiroz@mhnet.com.br';

// Contexto MHNET para IA híbrida
const MHNET_CONTEXT = `
Você é o assistente de vendas da MHNET, empresa de internet fibra óptica em Lajeado e Estrela/RS.

INFORMAÇÕES DA MHNET:
- Empresa regional de telecomunicações no Vale do Taquari/RS
- Tecnologia FTTA (Fiber to the Antenna) - fibra óptica de alta performance
- Cidades atendidas: Lajeado, Estrela e região
- Diferenciais: atendimento local humanizado, técnico no mesmo dia, sem fidelidade longa, preços competitivos
- Planos: Fibra 100Mbps, 200Mbps, 300Mbps, 500Mbps, 1Gbps
- Serviços adicionais: MHPlay (streaming), câmeras de segurança, telefone fixo, IP fixo para negócios
- Suporte 24h, equipe técnica local
- Sem call center nacional - atendimento direto com a equipe da cidade

PROCESSO DE VENDAS:
- Abordagem porta a porta nas zonas FTTA
- Cadastro de leads no sistema
- Follow-up com agendamento de visita
- Fechamento com instalação rápida

OBJETOS MAIS COMUNS E RESPOSTAS:
- "Já tenho internet": Perguntar sobre qualidade, preço e suporte atual
- "Está caro": Comparar custo-benefício, mostrar velocidade e suporte local
- "Estou na fidelidade": Verificar data de vencimento e preparar proposta futura
- "Não tenho interesse": Entender necessidades e mostrar diferenciais
`;

const VENDEDORES_OFFLINE = [
  'Bruno Garcia Queiroz','Ana Paula Rodrigues','Vitoria Caroline Baldez Rosales',
  'João Vithor Sader','João Paulo da Silva Santos','Claudia Maria Semmler',
  'Diulia Vitoria Machado Borges','Elton da Silva Rodrigo Gonçalves','Vendedor Teste'
];

// ============================================================
// ALMANAQUE DE CONCORRENTES — Gerenciável pelo Admin
// ============================================================
let CONCORRENTES = JSON.parse(localStorage.getItem('mhnet_concorrentes') || 'null') || [
  {
    id: 'vero', name: 'Vero Internet', type: 'Fibra Óptica', cor: '#1565c0', sigla: 'VR',
    pros: ['Marca consolidada no RS','Alta cobertura urbana','App mobile completo','Velocidades até 1 Gbps'],
    cons: ['Preços mais altos','Fidelidade de 12 meses longa','Suporte por vezes lento','Pouca flexibilidade nos planos'],
    mhnet: 'MHNET oferece melhor custo-benefício, atendimento humanizado local, sem fidelidade longa e com velocidades similares a preço menor.'
  },
  {
    id: 'claro', name: 'Claro NET', type: 'Fibra + TV', cor: '#e53935', sigla: 'CL',
    pros: ['Combo Fibra + TV + Móvel','Marca nacional reconhecida','Grande investimento em infraestrutura'],
    cons: ['Preços elevados','Contratos longos e multas altas','SAC difícil e demorado','Reajustes anuais agressivos'],
    mhnet: 'MHNET tem atendimento local ágil, sem surpresas na fatura, preços fixos sem reajuste abusivo e foco no cliente da região.'
  },
  {
    id: 'tim', name: 'TIM Live', type: 'Fibra + Móvel', cor: '#1a237e', sigla: 'TM',
    pros: ['Integração com plano móvel TIM','Cobertura em cidades menores','Promoções agressivas de entrada'],
    cons: ['Qualidade variável por região','Fidelidade de 12 meses','Infraestrutura ainda em expansão','Suporte centralizado'],
    mhnet: 'MHNET é uma empresa regional com infraestrutura própria na área, garantindo mais estabilidade e suporte técnico local no mesmo dia.'
  },
  {
    id: 'oi', name: 'Oi Fibra', type: 'Fibra Óptica', cor: '#f9a825', sigla: 'OI',
    pros: ['Preços competitivos','Cobertura em cidades menores','Planos sem fidelidade em alguns casos'],
    cons: ['Instabilidade de serviço','Empresa em recuperação judicial','Suporte com reclamações frequentes','Investimento limitado em rede'],
    mhnet: 'MHNET tem maior estabilidade financeira regional, rede bem mantida e suporte técnico dedicado, sem os riscos de uma empresa em reestruturação.'
  },
  {
    id: 'gvt', name: 'Vivo Fibra (GVT)', type: 'Fibra + Serviços', cor: '#7b1fa2', sigla: 'VV',
    pros: ['Marca Telefônica/Vivo forte','Combo com TV e serviços','Alta velocidade disponível','Cobertura nacional'],
    cons: ['Preços muito altos','Burocracia no suporte','Fidelidade longa','Reajuste anual automático'],
    mhnet: 'MHNET oferece planos mais acessíveis, instalação rápida, sem burocracia e com técnico na sua cidade — não um call center nacional.'
  },
  {
    id: 'surf', name: 'Surf Telecom', type: 'Fibra Regional', cor: '#00838f', sigla: 'SF',
    pros: ['Empresa regional','Preços mais acessíveis','Atendimento mais próximo'],
    cons: ['Cobertura limitada','Velocidades menores disponíveis','Menos recursos no app','Suporte técnico menor'],
    mhnet: 'MHNET possui maior cobertura, mais opções de planos, tecnologia FTTA mais moderna e maior equipe técnica para suporte.'
  }
];

// ============================================================
// ESTADO GLOBAL
// ============================================================
let loggedUser      = localStorage.getItem('loggedUser') || null;
let leadsCache      = [];
let vendorsCache    = [];
let tasksCache      = [];
let materialsCache  = [];
let fttaCache       = { lajeado: [], estrela: [], prospeccao: [] };
let fttaTabAtual    = 'lajeado';
let leadAtualParaAgendar = null;
let currentFolderId = null;
let editingLeadIndex = null;
let compSelecionado  = null;
let syncQueue = JSON.parse(localStorage.getItem('mhnet_sync_queue') || '[]');
let editingCompId   = null; // para modal de edição de concorrente

function isAdminUser() {
  if (!loggedUser) return false;
  return loggedUser.trim().toUpperCase().includes('BRUNO GARCIA');
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  carregarVendedores();
  const saved = localStorage.getItem('mhnet_leads_cache');
  if (saved) { try { leadsCache = JSON.parse(saved); } catch(e) {} }

  if (loggedUser) {
    initApp();
    if (navigator.onLine) processarFilaSincronizacao();
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    window._pwaPrompt = e;
    document.getElementById('btnInstalarPWA')?.classList.remove('hidden');
  });
});

window.addEventListener('online', () => processarFilaSincronizacao());

function instalarPWA() {
  if (window._pwaPrompt) {
    window._pwaPrompt.prompt();
    window._pwaPrompt.userChoice.then(() => {
      window._pwaPrompt = null;
      document.getElementById('btnInstalarPWA')?.classList.add('hidden');
    });
  }
}

function initApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('header').classList.remove('hidden');
  document.getElementById('mainScroll').classList.remove('hidden');
  document.getElementById('bottomNav').classList.remove('hidden');

  const nameEl = document.getElementById('userInfo');
  if (nameEl) nameEl.innerText = loggedUser;
  const dsbName = document.getElementById('dsb-username');
  if (dsbName) dsbName.innerText = loggedUser;

  atualizarDataCabecalho();

  if (isAdminUser()) {
    document.getElementById('btnAdminSettings')?.classList.remove('hidden');
    document.getElementById('adminPanel')?.classList.remove('hidden');
    document.getElementById('divEncaminhar').style.display = 'block';
    document.getElementById('btnAdminConcorrente')?.classList.remove('hidden');
  }

  carregarLeads(false);
  carregarTarefas(false);
  inicializarConcorrentes();
  navegarPara('dashboard');
}

// ============================================================
// AUTH
// ============================================================
function setLoggedUser() {
  const v = document.getElementById('userSelect').value;
  if (!v) { alert('⚠️ Selecione um vendedor!'); return; }
  loggedUser = v;
  localStorage.setItem('loggedUser', v);
  initApp();
}

function logout() {
  if (confirm('Sair do sistema?')) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

async function carregarVendedores() {
  const sel = document.getElementById('userSelect');
  if (!sel) return;
  const offOpts = VENDEDORES_OFFLINE.map(v => `<option value="${v}">${v}</option>`).join('');
  sel.innerHTML = `<option value="">Selecione...</option>${offOpts}`;
  try {
    const res = await apiCall('getVendors', {}, false);
    if (res?.status === 'success' && res.data?.length > 0) {
      vendorsCache = res.data;
      const opts = res.data.map(v => `<option value="${v.nome}">${v.nome}</option>`).join('');
      sel.innerHTML = `<option value="">Selecione...</option>${opts}`;
      atualizarSelectsVendedores(opts);
    }
  } catch(e) {}
}

function atualizarSelectsVendedores(opts) {
  ['modalLeadDestino','leadVendedorDestino','transfOrigem','transfDestino'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">Selecione...</option>${opts}`;
  });
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
function navegarPara(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const t = document.getElementById(pageId);
  if (t) t.classList.add('active');
  document.getElementById('mainScroll')?.scrollTo(0, 0);

  const navMap = { dashboard:'navDash', gestaoLeads:'navLeads', tarefas:'navTasks', ftta:'navFtta' };
  document.querySelectorAll('.nav-i').forEach(n => n.classList.remove('on'));
  if (navMap[pageId]) document.getElementById(navMap[pageId])?.classList.add('on');

  document.querySelectorAll('.dsb-item').forEach(i => i.classList.remove('on'));

  if (pageId === 'dashboard')     { atualizarDashboard(); verificarAgendamentosHoje(); }
  if (pageId === 'tarefas')       renderTarefas();
  if (pageId === 'indicadores')   carregarIndicadores();
  if (pageId === 'materiais' && !currentFolderId) carregarMateriais(null);
  if (pageId === 'ftta')          carregarFtta();
  if (pageId === 'cadastroLead' && editingLeadIndex === null) limparFormLead();
  if (pageId === 'faltas')        carregarHistoricoFaltas();
}

function verTodosLeads() {
  navegarPara('gestaoLeads');
  const inp = document.getElementById('searchLead');
  if (inp) inp.value = '';
  document.querySelectorAll('.filter-scroll .ftag').forEach(b => b.classList.remove('on'));
  document.getElementById('ftTodos')?.classList.add('on');
  renderLeads();
}

function cancelarCadastro() {
  editingLeadIndex = null;
  document.getElementById('cadastroTitle').innerText = 'Novo Lead';
  navegarPara('gestaoLeads');
}

// ============================================================
// HEADER UTILS
// ============================================================
function atualizarDataCabecalho() {
  const el = document.getElementById('headerDate');
  if (el) el.innerText = new Date().toLocaleDateString('pt-BR');
}

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const count = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje)).length;
  ['statLeads','statLeadsBody'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerText = count;
  });
}

function verificarAgendamentosHoje() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const r = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
  const t = tasksCache.filter(k => k.dataLimite && k.dataLimite.includes(hoje) && k.status !== 'CONCLUIDA');
  const banner = document.getElementById('lembreteBanner');
  if (banner) {
    banner.classList.toggle('show', r.length > 0 || t.length > 0);
    // Atualiza texto com quantidade
    const total = r.length + t.length;
    const txtEl = banner.querySelector('.lb-sub');
    if (txtEl) txtEl.textContent = `${total} retorno${total !== 1 ? 's' : ''} e/ou tarefa${total !== 1 ? 's' : ''} hoje.`;
  }
}

// ============================================================
// LEADS
// ============================================================
async function carregarLeads(showLoader = true) {
  if (!navigator.onLine) { renderLeads(); return; }
  const user = isAdminUser() ? ADMIN_NAME_CHECK : loggedUser;
  const res = await apiCall('getLeads', { vendedor: user }, showLoader);
  if (res?.status === 'success') {
    leadsCache = res.data || [];
    leadsCache.sort((a, b) => b._linha - a._linha);
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    if (document.getElementById('gestaoLeads').classList.contains('active')) renderLeads();
    atualizarDashboard();
    verificarAgendamentosHoje();
  }
}

function renderLeads(lista = null) {
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  const final = lista || leadsCache.filter(l =>
    String(l.nomeLead || '').toLowerCase().includes(term) ||
    String(l.bairro || '').toLowerCase().includes(term)
  );
  renderListaLeadsHTML(final, 'listaLeadsGestao');
}

function renderListaLeadsHTML(lista, containerId = 'listaLeadsGestao') {
  const div = document.getElementById(containerId);
  if (!div) return;
  if (!lista.length) {
    div.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Nenhum lead encontrado.</p></div>';
    return;
  }
  const badgeClass = s => {
    if (s === 'Venda Fechada') return 'fechado';
    if (s === 'Agendado')      return 'agendado';
    if (s === 'Negociação')    return 'negociacao';
    if (s === 'Novo')          return 'novo';
    return 'default';
  };
  div.innerHTML = lista.map(l => {
    const idx = leadsCache.indexOf(l);
    const fone = String(l.telefone || '').replace(/\D/g, '');
    const endCompleto = encodeURIComponent([l.endereco, l.bairro, l.cidade].filter(Boolean).join(', '));
    return `
    <div class="lead-card">
      <div class="lc-top">
        <div class="lc-name" onclick="abrirLeadDetalhes(${idx})">${l.nomeLead || '-'}</div>
        <span class="badge ${badgeClass(l.status)}">${l.status || 'Novo'}</span>
      </div>
      <div class="lc-city"><i class="fas fa-map-marker-alt" style="margin-right:4px;"></i>${l.bairro || '-'} · ${l.cidade || '-'}</div>
      ${l.telefone ? `<div class="lc-phone"><i class="fas fa-phone" style="font-size:.7rem;opacity:.6;"></i> ${l.telefone}</div>` : ''}
      ${l.provedor ? `<div class="lc-provedor"><i class="fas fa-wifi"></i> ${l.provedor}</div>` : ''}
      ${l.agendamento ? `<div class="lc-sched"><i class="fas fa-clock"></i> ${l.agendamento.split(' ')[0]}</div>` : ''}
      <div class="lc-btns">
        ${fone ? `<button class="lc-btn call" onclick="ligarPara('${fone}')"><i class="fas fa-phone"></i> Ligar</button>` : ''}
        ${fone ? `<button class="lc-btn whats" onclick="abrirWhatsAppDireto('${fone}')"><i class="fab fa-whatsapp"></i></button>` : ''}
        ${endCompleto ? `<button class="lc-btn map" onclick="abrirMaps('${endCompleto}')"><i class="fas fa-map-marker-alt"></i></button>` : ''}
        <button class="lc-btn detail" onclick="abrirLeadDetalhes(${idx})"><i class="fas fa-expand-alt"></i> Detalhes</button>
      </div>
    </div>`;
  }).join('');
}

function filtrarPorStatus(status, btn) {
  document.querySelectorAll('#gestaoLeads .ftag').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  const lista = status === 'Todos' ? leadsCache : leadsCache.filter(l => l.status === status);
  renderListaLeadsHTML(lista, 'listaLeadsGestao');
}

function filtrarLeadsHoje() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const lista = leadsCache.filter(l => l.timestamp && l.timestamp.includes(hoje));
  if (!lista.length) { alert('📅 Nenhum lead cadastrado hoje! Vamos pra cima! 🚀'); return; }
  navegarPara('gestaoLeads');
  renderListaLeadsHTML(lista, 'listaLeadsGestao');
}

function filtrarRetornos() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  // Encontra o primeiro lead com agendamento hoje
  const leadsHoje = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
  if (!leadsHoje.length) {
    // Verifica tarefas
    const tarefasHoje = tasksCache.filter(t => t.dataLimite && t.dataLimite.includes(hoje) && t.status !== 'CONCLUIDA');
    if (tarefasHoje.length) {
      navegarPara('tarefas');
      return;
    }
    alert('Nenhum retorno agendado para hoje.');
    return;
  }
  // Abre o primeiro lead com agendamento hoje diretamente
  const idx = leadsCache.indexOf(leadsHoje[0]);
  if (idx >= 0) {
    navegarPara('gestaoLeads');
    renderListaLeadsHTML(leadsHoje, 'listaLeadsGestao');
    setTimeout(() => abrirLeadDetalhes(idx), 300);
  }
}

// ============================================================
// AÇÕES DIRETAS NO CARD
// ============================================================
function ligarPara(fone) { window.location.href = `tel:+55${fone}`; }
function abrirWhatsAppDireto(fone) { window.open(`https://wa.me/55${fone}`, '_blank'); }
function abrirMaps(endCompleto) { window.open(`https://maps.google.com/?q=${endCompleto}`, '_blank'); }

// ============================================================
// LEAD MODAL — DETALHES
// ============================================================
function abrirLeadDetalhes(index) {
  const l = leadsCache[index];
  if (!l) return;
  leadAtualParaAgendar = l;

  const setText = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v || '-'; };
  const setVal  = (id, v) => { const el = document.getElementById(id); if(el) el.value  = v || ''; };

  setText('modalLeadNome',     l.nomeLead);
  setText('modalLeadBairro',   l.bairro);
  setText('modalLeadCidade',   l.cidade);
  setText('modalLeadTelefone', l.telefone);
  setText('modalLeadProvedor', l.provedor || '-');
  setText('modalLeadPlano',    l.planoAtual || '-');
  setText('modalLeadValor',    l.valorPlano ? `R$ ${l.valorPlano}` : '-');
  setVal('modalStatusFunil',   l.status);
  setVal('modalLeadObs',       l.observacao);
  setVal('inputObjecaoLead',   l.objecao || '');
  setVal('respostaObjecaoLead', l.respostaObjecao || '');

  const fidBox = document.getElementById('modalFidelidadeBox');
  if (l.fidelidade) {
    const fid = new Date(l.fidelidade);
    const hoje = new Date();
    const diffDays = Math.ceil((fid - hoje) / (1000 * 60 * 60 * 24));
    fidBox.classList.remove('hidden');
    if (diffDays <= 0) {
      fidBox.innerHTML = `<i class="fas fa-unlock"></i> Fidelidade <b>VENCIDA</b> — ótima hora para fechar!`;
      fidBox.style.background = '#d1fae5'; fidBox.style.color = '#065f46';
    } else if (diffDays <= 30) {
      fidBox.innerHTML = `<i class="fas fa-clock"></i> Fidelidade vence em <b>${diffDays} dias</b> — momento ideal para abordar!`;
    } else {
      fidBox.innerHTML = `<i class="fas fa-lock"></i> Fidelidade até ${fid.toLocaleDateString('pt-BR')}`;
    }
  } else { fidBox.classList.add('hidden'); }

  if (l.agendamento) {
    const p = String(l.agendamento).split(' ');
    if (p[0]) {
      const [d, m, a] = p[0].split('/');
      const elD = document.getElementById('agendarData');
      if (elD && a) elD.value = `${a}-${(m||'01').padStart(2,'0')}-${(d||'01').padStart(2,'0')}`;
    }
    const elH = document.getElementById('agendarHora');
    if (elH && p[1]) elH.value = p[1];
  } else {
    const elD = document.getElementById('agendarData'); if (elD) elD.value = '';
    const elH = document.getElementById('agendarHora'); if (elH) elH.value = '';
  }

  const adm = document.getElementById('adminEncaminharArea');
  if (adm) adm.classList.toggle('hidden', !isAdminUser());

  const fone = String(l.telefone || '').replace(/\D/g, '');
  const btnW = document.getElementById('btnModalWhats');
  if (btnW) btnW.onclick = () => abrirWhatsAppDireto(fone);
  const btnC = document.getElementById('btnModalCall');
  if (btnC) btnC.onclick = () => ligarPara(fone);
  const endCompleto = encodeURIComponent([l.endereco, l.bairro, l.cidade].filter(Boolean).join(', '));
  const btnM = document.getElementById('btnModalMap');
  if (btnM) btnM.onclick = () => abrirMaps(endCompleto);

  renderTarefasNoModal(l.nomeLead);
  document.getElementById('leadModal').classList.add('open');
}

function fecharLeadModal() {
  document.getElementById('leadModal').classList.remove('open');
}

async function salvarEdicaoModal() {
  if (!leadAtualParaAgendar) return;
  const s = document.getElementById('modalStatusFunil').value;
  const o = document.getElementById('modalLeadObs').value;
  const d = document.getElementById('agendarData').value;
  const h = document.getElementById('agendarHora').value;

  if (o && o !== leadAtualParaAgendar.observacao) {
    const hist = leadAtualParaAgendar.historico || [];
    hist.unshift({ texto: o, data: new Date().toLocaleDateString('pt-BR') });
    leadAtualParaAgendar.historico = hist;
  }

  leadAtualParaAgendar.status = s;
  leadAtualParaAgendar.observacao = o;
  if (d) {
    const [a, m, day] = d.split('-');
    leadAtualParaAgendar.agendamento = `${day}/${m}/${a} ${h || ''}`.trim();
  }

  localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
  if (document.getElementById('gestaoLeads').classList.contains('active')) renderLeads();

  showLoading(true);
  await Promise.all([
    apiCall('updateStatus',     { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: s }, false),
    apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: o }, false)
  ]);
  if (d) await apiCall('updateAgendamento', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: leadAtualParaAgendar.agendamento }, false);
  showLoading(false);
  fecharLeadModal();
}

function editarLeadAtual() {
  if (!leadAtualParaAgendar) return;
  const l = leadAtualParaAgendar;
  const setVal = (id, v) => { const el = document.getElementById(id); if(el) el.value = v || ''; };
  setVal('leadNome',       l.nomeLead);
  setVal('leadTelefone',   l.telefone);
  setVal('leadEndereco',   l.endereco);
  setVal('leadNumero',     l.numero || '');
  setVal('leadComplemento',l.complemento || '');
  setVal('leadBairro',     l.bairro);
  setVal('leadCidade',     l.cidade);
  setVal('leadProvedor',   l.provedor);
  setVal('leadValorPlano', l.valorPlano || '');
  setVal('leadPlanoAtual', l.planoAtual || '');
  setVal('leadFidelidade', l.fidelidade || '');
  setVal('leadObs',        l.observacao);
  const st = document.getElementById('leadStatus'); if (st) st.value = l.status || 'Novo';
  renderHistoricoForm(l.historico || []);
  editingLeadIndex = leadsCache.indexOf(l);
  document.getElementById('cadastroTitle').innerText = 'Editar Lead';
  fecharLeadModal();
  navegarPara('cadastroLead');
}

function renderHistoricoForm(hist) {
  const div = document.getElementById('leadHistoricoContainer');
  if (!div || !hist.length) return;
  div.innerHTML = `<div style="font-size:.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin-bottom:7px;">Histórico</div>` +
    hist.map(h => `<div class="hist-entry"><span class="he-date">${h.data}</span>${h.texto}</div>`).join('');
}

function limparFormLead() {
  ['leadNome','leadTelefone','leadEndereco','leadNumero','leadComplemento','leadBairro','leadObs','leadProvedor','leadValorPlano','leadPlanoAtual','leadFidelidade'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = '';
  });
  const st = document.getElementById('leadStatus'); if(st) st.value = 'Novo';
  const ci = document.getElementById('leadCidade'); if(ci) ci.value = 'Lajeado';
  const hist = document.getElementById('leadHistoricoContainer'); if(hist) hist.innerHTML = '';
  document.getElementById('cadastroTitle').innerText = 'Novo Lead';
}

async function enviarLead() {
  const nome = document.getElementById('leadNome').value.trim();
  if (!nome) { alert('⚠️ Informe o nome do cliente!'); return; }

  const p = {
    vendedor:    loggedUser,
    nomeLead:    nome,
    telefone:    document.getElementById('leadTelefone').value,
    endereco:    [document.getElementById('leadEndereco').value, document.getElementById('leadNumero').value].filter(Boolean).join(', '),
    numero:      document.getElementById('leadNumero').value,
    complemento: document.getElementById('leadComplemento').value,
    bairro:      document.getElementById('leadBairro').value,
    cidade:      document.getElementById('leadCidade').value,
    provedor:    document.getElementById('leadProvedor').value,
    valorPlano:  document.getElementById('leadValorPlano').value,
    planoAtual:  document.getElementById('leadPlanoAtual').value,
    fidelidade:  document.getElementById('leadFidelidade').value,
    interesse:   document.getElementById('leadInteresse').value,
    status:      document.getElementById('leadStatus').value,
    observacao:  document.getElementById('leadObs').value,
    novoVendedor: document.getElementById('leadVendedorDestino')?.value || ''
  };

  let route = 'addLead';
  if (editingLeadIndex !== null) {
    route = 'updateLeadFull';
    p._linha = leadsCache[editingLeadIndex]._linha;
  } else if (p.novoVendedor) {
    route = 'forwardLead';
    p.origem = loggedUser;
  }

  const res = await apiCall(route, p);
  if (res?.status === 'success' || res?.local) {
    if (editingLeadIndex !== null) {
      leadsCache[editingLeadIndex] = { ...leadsCache[editingLeadIndex], ...p };
    } else {
      leadsCache.unshift({ ...p, timestamp: new Date().toLocaleDateString('pt-BR'), _linha: Date.now() });
    }
    localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
    editingLeadIndex = null;
    alert('✅ Lead salvo com sucesso!');
    carregarLeads(false);
    navegarPara('gestaoLeads');
  } else {
    alert('❌ Erro ao salvar. Verifique a conexão.');
  }
}

async function excluirLead() {
  if (!confirm('Excluir este lead?')) return;
  await apiCall('deleteLead', { vendedor: loggedUser, _linha: leadAtualParaAgendar._linha });
  leadsCache = leadsCache.filter(l => l !== leadAtualParaAgendar);
  localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
  fecharLeadModal();
  renderLeads();
}

async function marcarVendaFechada() {
  if (!confirm('Confirmar Venda Fechada? 🎉')) return;
  await apiCall('updateStatus', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, status: 'Venda Fechada' });
  leadAtualParaAgendar.status = 'Venda Fechada';
  localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
  alert('🎉 Parabéns pela venda!');
  fecharLeadModal();
  renderLeads();
}

async function encaminharLeadModal() {
  const n = document.getElementById('modalLeadDestino').value;
  if (!n) { alert('Selecione um vendedor destino'); return; }
  if (!confirm(`Encaminhar para ${n}?`)) return;
  await apiCall('forwardLead', { nomeLead: leadAtualParaAgendar.nomeLead, novoVendedor: n, origem: loggedUser });
  alert('✅ Lead encaminhado!');
  fecharLeadModal();
  carregarLeads();
}

function abrirWhatsApp() {
  if (!leadAtualParaAgendar) return;
  const fone = String(leadAtualParaAgendar.telefone || '').replace(/\D/g, '');
  if (fone) window.open(`https://wa.me/55${fone}`, '_blank');
  else alert('Telefone não cadastrado.');
}

// ============================================================
// FTTA — Corrigido para usar abas reais
// ============================================================
async function carregarFtta() {
  const div = document.getElementById('listaFtta');
  if (!div) return;
  div.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Carregando...</p></div>';

  try {
    const [resL, resE] = await Promise.all([
      apiCall('getFttaLeads', { aba: 'FTTA LAJEADO' }, false),
      apiCall('getFttaLeads', { aba: 'FTTA ESTRELA' }, false)
    ]);
    if (resL?.status === 'success') fttaCache.lajeado = resL.data || [];
    if (resE?.status === 'success') fttaCache.estrela = resE.data || [];

    // Prospecção = leads normais marcados como prospecção
    fttaCache.prospeccao = leadsCache.filter(l =>
      String(l.observacao || '').toLowerCase().includes('prospeccao') ||
      String(l.observacao || '').toLowerCase().includes('prospecção') ||
      String(l.status || '').toLowerCase().includes('prospecção')
    );
  } catch(e) {
    console.error('Erro FTTA:', e);
  }

  renderFttaLista();
}

function setFttaTab(tab) {
  fttaTabAtual = tab;
  document.querySelectorAll('#ftta .ftag').forEach(b => b.classList.remove('on'));
  const tabMap = { lajeado:'fttaTabLaj', estrela:'fttaTabEst', prospeccao:'fttaTabPro' };
  document.getElementById(tabMap[tab])?.classList.add('on');
  filtrarFtta();
}

function filtrarFtta() {
  const term = (document.getElementById('searchFtta')?.value || '').toLowerCase();
  let lista = fttaCache[fttaTabAtual] || [];
  if (term) lista = lista.filter(l =>
    String(l.nomeLead || '').toLowerCase().includes(term) ||
    String(l.bairro || '').toLowerCase().includes(term)
  );
  renderFttaLista(lista);
}

function renderFttaLista(lista = null) {
  if (!lista) lista = fttaCache[fttaTabAtual] || [];
  const div = document.getElementById('listaFtta');
  if (!div) return;

  const nomeAba = fttaTabAtual === 'lajeado' ? 'FTTA Lajeado' : fttaTabAtual === 'estrela' ? 'FTTA Estrela' : 'Prospecção';

  if (!lista.length) {
    div.innerHTML = `<div class="empty-state"><i class="fas fa-network-wired"></i><p>Nenhum registro em ${nomeAba}.</p></div>`;
    return;
  }

  const badgeClass = s => {
    if (!s) return 'default';
    s = String(s).toLowerCase();
    if (s.includes('fechad')) return 'fechado';
    if (s.includes('agend'))  return 'agendado';
    if (s.includes('negoc'))  return 'negociacao';
    if (s === 'novo')         return 'novo';
    return 'default';
  };

  div.innerHTML = lista.map((l) => {
    const fone = String(l.telefone || '').replace(/\D/g, '');
    const endCompleto = encodeURIComponent([l.endereco, l.bairro, l.cidade].filter(Boolean).join(', '));
    return `
    <div class="lead-card">
      <div class="lc-top">
        <div class="lc-name">${l.nomeLead || l.nome || '-'}</div>
        <span class="badge ${badgeClass(l.status)}">${l.status || 'Reg.'}</span>
      </div>
      <div class="lc-city"><i class="fas fa-map-marker-alt" style="margin-right:4px;"></i>${l.bairro || '-'} · ${l.cidade || '-'}</div>
      ${l.telefone ? `<div class="lc-phone"><i class="fas fa-phone" style="font-size:.7rem;opacity:.6;"></i> ${l.telefone}</div>` : ''}
      ${l.provedor ? `<div class="lc-provedor"><i class="fas fa-wifi"></i> ${l.provedor}</div>` : ''}
      <div class="lc-btns">
        ${fone ? `<button class="lc-btn call" onclick="ligarPara('${fone}')"><i class="fas fa-phone"></i> Ligar</button>` : ''}
        ${fone ? `<button class="lc-btn whats" onclick="abrirWhatsAppDireto('${fone}')"><i class="fab fa-whatsapp"></i></button>` : ''}
        ${endCompleto ? `<button class="lc-btn map" onclick="abrirMaps('${endCompleto}')"><i class="fas fa-map-marker-alt"></i></button>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// TAREFAS
// ============================================================
async function carregarTarefas(show = true) {
  const res = await apiCall('getTasks', { vendedor: loggedUser }, false);
  if (res?.status === 'success') {
    tasksCache = res.data || [];
    if (show) renderTarefas();
  }
  verificarAgendamentosHoje();
}

function renderTarefas() {
  const div = document.getElementById('listaTarefasContainer');
  if (!div) return;
  if (!tasksCache.length) {
    div.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>Nenhuma tarefa pendente!</p></div>';
    return;
  }
  const sorted = [...tasksCache].sort((a,b) => a.status === 'PENDENTE' ? -1 : 1);
  div.innerHTML = sorted.map(t => {
    const done = t.status === 'CONCLUIDA';
    const temLead = !!t.nomeLead;
    return `
    <div class="task-item ${done ? 'done-item' : ''}">
      <div class="t-check ${done ? 'done' : ''}" onclick="toggleTask('${t.id}','${t.status}')">
        ${done ? '<i class="fas fa-check"></i>' : ''}
      </div>
      <div class="t-body">
        <div class="t-desc ${done ? 'done' : ''}">${t.descricao}</div>
        <div class="t-meta">
          ${t.dataLimite ? `<span class="t-chip date"><i class="far fa-calendar"></i> ${t.dataLimite}</span>` : ''}
          ${temLead ? `<span class="t-chip lead" onclick="irParaLeadDaTarefa('${t.nomeLead}')" style="cursor:pointer;">👤 ${t.nomeLead}</span>` : ''}
        </div>
      </div>
      <div class="t-del" onclick="excluirTarefa('${t.id}')"><i class="fas fa-trash-alt"></i></div>
    </div>`;
  }).join('');
}

// Navega para o lead associado à tarefa
function irParaLeadDaTarefa(nomeLead) {
  const idx = leadsCache.findIndex(l => l.nomeLead === nomeLead);
  if (idx >= 0) {
    navegarPara('gestaoLeads');
    setTimeout(() => abrirLeadDetalhes(idx), 200);
  } else {
    alert(`Lead "${nomeLead}" não encontrado na carteira.`);
  }
}

function abrirModalTarefa() {
  const s = document.getElementById('taskLeadSelect');
  s.innerHTML = '<option value="">Nenhum</option>' + leadsCache.map(l => `<option value="${l.nomeLead}">${l.nomeLead}</option>`).join('');
  document.getElementById('taskModal').classList.add('open');
}

async function salvarTarefa() {
  const desc = document.getElementById('taskDesc').value.trim();
  if (!desc) { alert('Informe a descrição!'); return; }
  await apiCall('addTask', {
    vendedor:  loggedUser,
    descricao: desc,
    dataLimite: document.getElementById('taskDate').value,
    nomeLead:  document.getElementById('taskLeadSelect').value
  });
  document.getElementById('taskModal').classList.remove('open');
  document.getElementById('taskDesc').value = '';
  document.getElementById('taskDate').value = '';
  carregarTarefas(true);
}

async function toggleTask(id, currentStatus) {
  const t = tasksCache.find(x => x.id === id);
  if (t) { t.status = currentStatus === 'PENDENTE' ? 'CONCLUIDA' : 'PENDENTE'; renderTarefas(); }
  await apiCall('toggleTask', { taskId: id, status: currentStatus, vendedor: loggedUser }, false);
}

async function excluirTarefa(id) {
  if (!confirm('Excluir tarefa?')) return;
  tasksCache = tasksCache.filter(t => t.id !== id);
  renderTarefas();
  await apiCall('toggleTask', { taskId: id, status: 'DELETED', vendedor: loggedUser }, false);
}

async function limparTarefasConcluidas() {
  if (!confirm('Arquivar tarefas concluídas?')) return;
  tasksCache = tasksCache.filter(t => t.status !== 'CONCLUIDA');
  renderTarefas();
  await apiCall('archiveTasks', { vendedor: loggedUser }, false);
}

function renderTarefasNoModal(nomeLead) {
  const sec = document.getElementById('sectionTarefasLead');
  const lst = document.getElementById('listaTarefasLead');
  const t = tasksCache.filter(x => x.nomeLead === nomeLead && x.status !== 'CONCLUIDA');
  if (t.length > 0) {
    sec.classList.remove('hidden');
    lst.innerHTML = t.map(x => `<div style="background:var(--surface);padding:9px;border-radius:7px;margin-bottom:5px;font-size:.8rem;display:flex;gap:7px;align-items:center;"><input type="checkbox" onchange="toggleTask('${x.id}','${x.status}')"> ${x.descricao}</div>`).join('');
  } else { sec.classList.add('hidden'); }
}

function abrirCalendario() { window.open(CALENDAR_URL, '_blank'); }

// ============================================================
// FALTAS — Com histórico e envio por e-mail
// ============================================================
async function enviarJustificativa() {
  const p = {
    vendedor:   loggedUser,
    dataFalta:  document.getElementById('faltaData').value,
    motivo:     document.getElementById('faltaMotivo').value,
    observacao: document.getElementById('faltaObs').value,
    emailAdmin: EMAIL_ADMIN
  };
  if (!p.dataFalta || !p.motivo) { alert('Preencha data e tipo!'); return; }
  const f = document.getElementById('faltaArquivo').files[0];
  showLoading(true);
  if (f) {
    const r = new FileReader();
    r.onload = async e => {
      p.fileData = e.target.result; p.fileName = f.name; p.mimeType = f.type;
      const res = await apiCall('registerAbsence', p, false);
      showLoading(false);
      if (res?.status === 'success') {
        alert('✅ Solicitação enviada! Um e-mail foi encaminhado ao gestor.');
        limparFormFalta();
        carregarHistoricoFaltas();
      } else { alert('❌ Erro ao enviar. Tente novamente.'); }
    };
    r.readAsDataURL(f);
  } else {
    const res = await apiCall('registerAbsence', p, false);
    showLoading(false);
    if (res?.status === 'success') {
      alert('✅ Solicitação enviada! Um e-mail foi encaminhado ao gestor.');
      limparFormFalta();
      carregarHistoricoFaltas();
    } else { alert('❌ Erro ao enviar. Tente novamente.'); }
  }
}

function limparFormFalta() {
  document.getElementById('faltaData').value = '';
  document.getElementById('faltaMotivo').value = '';
  document.getElementById('faltaObs').value = '';
  document.getElementById('faltaArquivo').value = '';
}

async function carregarHistoricoFaltas() {
  const div = document.getElementById('listaHistoricoFaltas');
  if (!div) return;
  div.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-3);"><i class="fas fa-spinner fa-spin"></i></div>';

  // Admin vê todos; vendedor vê só os seus
  const params = isAdminUser() ? { vendedor: 'TODOS' } : { vendedor: loggedUser };
  const res = await apiCall('getAbsences', params, false);

  if (res?.status === 'success' && res.data?.length) {
    div.innerHTML = res.data.map(f => `
      <div class="hist-falta">
        ${isAdminUser() ? `<div style="font-size:.65rem;font-weight:800;color:var(--navy);margin-bottom:3px;">${f.vendedor}</div>` : ''}
        <div class="hf-motivo">${f.motivo}</div>
        <div class="hf-meta">
          <span><i class="far fa-calendar"></i> ${f.dataFalta}</span>
          <span class="hf-status">${f.status || 'ENVIADO'}</span>
          ${f.obs ? `<span style="color:var(--text-3);">${f.obs}</span>` : ''}
          ${f.link ? `<a href="${f.link}" target="_blank" style="color:var(--navy);font-size:.7rem;font-weight:700;">📎 Anexo</a>` : ''}
        </div>
      </div>`).join('');
  } else {
    div.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>Sem histórico de solicitações.</p></div>';
  }
}

// ============================================================
// INDICADORES
// ============================================================
function abrirIndicadores() { navegarPara('indicadores'); carregarIndicadores(); }

async function carregarIndicadores() {
  const res = await apiCall('getIndicators', { vendedor: loggedUser }, false);
  if (res?.status === 'success') {
    const d = res.data;
    document.getElementById('indMes').innerText = d.mes || '';
    document.getElementById('funnelLeads').innerText   = d.totalLeads || 0;
    document.getElementById('indRealizado').innerText  = d.vendas     || 0;
    document.getElementById('indNegociacao').innerText = d.negociacao || 0;
    const total = d.totalLeads || 1;
    document.getElementById('pbLeads').style.width  = '100%';
    document.getElementById('pbVendas').style.width = Math.min(100, (d.vendas     / total) * 100) + '%';
    document.getElementById('pbNeg').style.width    = Math.min(100, (d.negociacao / total) * 100) + '%';
    const iaRes = await apiCall('analyzeIndicators', { meta: 20, vendas: d.vendas }, false);
    if (iaRes?.message) {
      document.getElementById('iaMsgBox').classList.remove('hidden');
      document.getElementById('iaMsgTxt').innerText = iaRes.message;
    }
  }
}

// ============================================================
// MATERIAIS
// ============================================================
async function carregarMateriais(f = null) {
  const div = document.getElementById('materiaisGrid');
  if (!div) return;
  currentFolderId = f;
  div.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Carregando...</p></div>';
  const res = await apiCall('getImages', { folderId: f }, false);
  if (res?.status === 'success' && res.data) {
    materialsCache = res.data;
    const btnV = document.getElementById('btnVoltarMateriais');
    const tit  = document.getElementById('tituloMateriais');
    if (btnV) {
      if (res.isRoot) {
        btnV.onclick = () => navegarPara('dashboard');
        if (tit) tit.innerText = 'Materiais';
      } else {
        btnV.onclick = () => carregarMateriais(null);
        if (tit) tit.innerText = '← Voltar';
      }
    }
    renderMateriais(materialsCache);
  } else {
    div.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Erro ao carregar.</p></div>';
  }
}

function buscarMateriais() {
  const term = (document.getElementById('searchMateriais')?.value || '').toLowerCase();
  renderMateriais(materialsCache.filter(m => m.name.toLowerCase().includes(term)));
}

function filtrarMateriaisBtn(termo, btn) {
  document.querySelectorAll('#materiais .ftag').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  const inp = document.getElementById('searchMateriais');
  if (inp) { inp.value = termo === 'Todos' ? '' : termo; }
  buscarMateriais();
}

function renderMateriais(items) {
  const div = document.getElementById('materiaisGrid');
  if (!div) return;
  if (!items.length) { div.innerHTML = '<div class="empty-state" style="grid-column:span 2"><i class="fas fa-folder-open"></i><p>Vazio.</p></div>'; return; }
  div.innerHTML = items.map(item => {
    if (item.type === 'folder') {
      return `<div class="mat-folder" onclick="carregarMateriais('${item.id}')"><i class="fas fa-folder"></i><span>${item.name}</span></div>`;
    }
    return `
    <div class="mat-file">
      <div class="mat-thumb"><img src="${item.thumbnail}" loading="lazy" alt="${item.name}"></div>
      <div class="mat-info">
        <div class="mat-name">${item.name}</div>
        <div class="mat-acts">
          <a href="${item.downloadUrl}" target="_blank" class="mat-act dl"><i class="fas fa-download"></i></a>
          <button onclick="window.open('https://wa.me/?text=${encodeURIComponent(item.viewUrl)}','_blank')" class="mat-act wh"><i class="fab fa-whatsapp"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// CONCORRENTES — Admin pode adicionar/editar
// ============================================================
function inicializarConcorrentes() {
  renderGridConcorrentes();
}

function renderGridConcorrentes() {
  const grid = document.getElementById('compGrid');
  if (!grid) return;
  grid.innerHTML = CONCORRENTES.map(c => `
    <div class="comp-card" onclick="selecionarConcorrente('${c.id}')">
      <div class="comp-logo" style="background:${c.cor};">${c.sigla}</div>
      <div class="comp-name">${c.name}</div>
      <div class="comp-type">${c.type}</div>
      ${isAdminUser() ? `<div style="margin-top:6px;display:flex;gap:4px;">
        <button onclick="event.stopPropagation();editarConcorrente('${c.id}')" style="flex:1;background:#dbeafe;color:#1d4ed8;border:none;border-radius:5px;padding:4px;font-size:.65rem;font-weight:700;cursor:pointer;">✏️ Editar</button>
        <button onclick="event.stopPropagation();excluirConcorrente('${c.id}')" style="flex:1;background:#fee2e2;color:#b91c1c;border:none;border-radius:5px;padding:4px;font-size:.65rem;font-weight:700;cursor:pointer;">🗑️</button>
      </div>` : ''}
    </div>`).join('');
}

function selecionarConcorrente(id) {
  compSelecionado = CONCORRENTES.find(c => c.id === id);
  if (!compSelecionado) return;

  document.querySelectorAll('.comp-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.comp-card').forEach(c => {
    if (c.querySelector('.comp-name')?.innerText === compSelecionado.name) c.classList.add('selected');
  });

  const det = document.getElementById('compDetail');
  det.classList.remove('hidden');
  det.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  document.getElementById('compDetailLogo').style.background = compSelecionado.cor;
  document.getElementById('compDetailLogo').innerText = compSelecionado.sigla;
  document.getElementById('compDetailName').innerText = compSelecionado.name;
  document.getElementById('compDetailType').innerText = compSelecionado.type;

  document.getElementById('compPros').innerHTML = compSelecionado.pros.map(p => `<div class="pc-item">${p}</div>`).join('');
  document.getElementById('compCons').innerHTML = compSelecionado.cons.map(c => `<div class="pc-item">${c}</div>`).join('');
  document.getElementById('compMhnet').innerText = compSelecionado.mhnet;

  const resp = document.getElementById('compAiResp');
  resp.classList.add('hidden');
  resp.innerText = '';
  document.getElementById('compAiQuestion').value = '';
}

function abrirModalNovoConcorrente() {
  editingCompId = null;
  document.getElementById('compModalTitle').innerText = 'Novo Concorrente';
  ['compFormNome','compFormSigla','compFormTipo','compFormCor','compFormMhnet'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = id === 'compFormCor' ? '#1565c0' : '';
  });
  document.getElementById('compFormPros').value = '';
  document.getElementById('compFormCons').value = '';
  document.getElementById('modalConcorrente').classList.add('open');
}

function editarConcorrente(id) {
  const c = CONCORRENTES.find(x => x.id === id);
  if (!c) return;
  editingCompId = id;
  document.getElementById('compModalTitle').innerText = 'Editar Concorrente';
  document.getElementById('compFormNome').value = c.name;
  document.getElementById('compFormSigla').value = c.sigla;
  document.getElementById('compFormTipo').value = c.type;
  document.getElementById('compFormCor').value = c.cor;
  document.getElementById('compFormMhnet').value = c.mhnet;
  document.getElementById('compFormPros').value = c.pros.join('\n');
  document.getElementById('compFormCons').value = c.cons.join('\n');
  document.getElementById('modalConcorrente').classList.add('open');
}

function salvarConcorrente() {
  const nome   = document.getElementById('compFormNome').value.trim();
  const sigla  = document.getElementById('compFormSigla').value.trim().toUpperCase();
  const tipo   = document.getElementById('compFormTipo').value.trim();
  const cor    = document.getElementById('compFormCor').value;
  const mhnet  = document.getElementById('compFormMhnet').value.trim();
  const pros   = document.getElementById('compFormPros').value.split('\n').filter(Boolean);
  const cons   = document.getElementById('compFormCons').value.split('\n').filter(Boolean);

  if (!nome || !sigla) { alert('Preencha nome e sigla!'); return; }

  if (editingCompId) {
    const idx = CONCORRENTES.findIndex(c => c.id === editingCompId);
    if (idx >= 0) {
      CONCORRENTES[idx] = { ...CONCORRENTES[idx], name: nome, sigla, type: tipo, cor, mhnet, pros, cons };
    }
  } else {
    CONCORRENTES.push({
      id: 'comp_' + Date.now(),
      name: nome, sigla, type: tipo, cor, mhnet, pros, cons
    });
  }

  localStorage.setItem('mhnet_concorrentes', JSON.stringify(CONCORRENTES));
  document.getElementById('modalConcorrente').classList.remove('open');
  renderGridConcorrentes();
  alert('✅ Concorrente salvo!');
}

function excluirConcorrente(id) {
  if (!confirm('Excluir este concorrente?')) return;
  CONCORRENTES = CONCORRENTES.filter(c => c.id !== id);
  localStorage.setItem('mhnet_concorrentes', JSON.stringify(CONCORRENTES));
  renderGridConcorrentes();
  document.getElementById('compDetail').classList.add('hidden');
}

async function analisarConcorrenteIA() {
  if (!compSelecionado) { alert('Selecione um concorrente!'); return; }
  const q = document.getElementById('compAiQuestion').value.trim();
  const prompt = q
    ? `No contexto de vendas de internet em Lajeado/RS, responda sobre o concorrente ${compSelecionado.name}: ${q}. Considere que a MHNET oferece: ${compSelecionado.mhnet}`
    : `Crie um script de vendas para um vendedor MHNET que está abordando um cliente da ${compSelecionado.name}. Mencione 2 desvantagens do concorrente e 2 vantagens da MHNET. Seja objetivo, máximo 5 linhas.`;

  const resp = document.getElementById('compAiResp');
  resp.classList.remove('hidden');
  resp.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analisando...';

  const answer = await callGeminiDirect(prompt);
  resp.innerHTML = answer || 'IA indisponível no momento.';
}

// ============================================================
// IA HÍBRIDA — Gemini direto com contexto MHNET
// ============================================================
async function callGeminiDirect(userPrompt) {
  try {
    const systemPrompt = MHNET_CONTEXT;
    const fullPrompt = `${systemPrompt}\n\nPergunta/Solicitação: ${userPrompt}\n\nResponda de forma direta, útil e profissional. Máximo 5 linhas.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
      })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch(e) {
    console.error('Gemini error:', e);
    return null;
  }
}

// ============================================================
// OBJEÇÕES & IA
// ============================================================
async function combaterObjecaoGeral() {
  const o = document.getElementById('inputObjecaoGeral').value.trim();
  if (!o) { alert('Informe a objeção!'); return; }
  const div = document.getElementById('resultadoObjecaoGeral');
  div.classList.remove('hidden');
  div.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

  // Tenta IA direta primeiro, fallback no backend
  const prompt = `Você é um vendedor expert da MHNET. Um cliente disse: "${o}". Responda de forma persuasiva e empática em até 4 linhas para contornar essa objeção.`;
  let answer = await callGeminiDirect(prompt);
  if (!answer) {
    const res = await apiCall('solveObjection', { objection: o });
    answer = res?.answer;
  }
  div.innerText = answer || 'Entendo sua preocupação! Posso te mostrar como a MHNET resolve exatamente isso...';
}

async function combaterObjecaoLead() {
  const o = document.getElementById('inputObjecaoLead').value.trim();
  if (!o) { alert('Informe a objeção!'); return; }
  const prompt = `Você é um vendedor expert da MHNET. Um cliente disse: "${o}". Responda de forma persuasiva e empática em até 4 linhas.`;
  let answer = await callGeminiDirect(prompt);
  if (!answer) {
    const res = await apiCall('solveObjection', { objection: o });
    answer = res?.answer;
  }
  if (answer) document.getElementById('respostaObjecaoLead').value = answer;
}

async function salvarObjecaoLead() {
  if (!leadAtualParaAgendar) return;
  await apiCall('saveObjectionLead', {
    vendedor: loggedUser,
    nomeLead: leadAtualParaAgendar.nomeLead,
    objection: document.getElementById('inputObjecaoLead').value,
    answer:    document.getElementById('respostaObjecaoLead').value
  });
  alert('✅ Objeção salva!');
}

async function gerarCoachIA() {
  showLoading(true);
  const prompt = 'Dê uma frase motivacional curta e poderosa para um vendedor externo de internet porta a porta. Máximo 2 linhas. Seja criativo e energizante.';
  let answer = await callGeminiDirect(prompt);
  if (!answer) {
    const res = await apiCall('askAI', { question: prompt }, false);
    answer = res?.answer;
  }
  showLoading(false);
  if (answer) alert('💪 ' + answer);
}

// ============================================================
// CHAT IA — Híbrido com contexto MHNET
// ============================================================
function consultarPlanosIA() {
  document.getElementById('chatModal').classList.add('open');
  const hist = document.getElementById('chatHistory');
  if (!hist.children.length) {
    hist.innerHTML = '<div class="c-msg ai">👋 Olá! Sou o assistente MHNET. Posso ajudar com planos, scripts de vendas, objeções, informações sobre a empresa e muito mais!</div>';
  }
}

function toggleChat() { document.getElementById('chatModal').classList.remove('open'); }

async function enviarMensagemChat() {
  const input = document.getElementById('chatInput');
  const m = input.value.trim();
  if (!m) return;
  const hist = document.getElementById('chatHistory');
  hist.innerHTML += `<div class="c-msg user">${m}</div>`;
  input.value = '';
  hist.scrollTop = hist.scrollHeight;

  const typingId = 'typing_' + Date.now();
  hist.innerHTML += `<div class="c-msg ai" id="${typingId}"><i class="fas fa-circle-notch fa-spin"></i> Pensando...</div>`;
  hist.scrollTop = hist.scrollHeight;

  // IA híbrida: tenta Gemini direto com contexto MHNET
  let answer = await callGeminiDirect(m);

  // Fallback no backend
  if (!answer) {
    const res = await apiCall('askAI', { question: m }, false);
    answer = res?.answer;
  }

  const el = document.getElementById(typingId);
  if (el) el.outerHTML = `<div class="c-msg ai">${answer || 'Desculpe, IA temporariamente indisponível.'}</div>`;
  hist.scrollTop = hist.scrollHeight;
}

// ============================================================
// GPS
// ============================================================
async function buscarEnderecoGPS() {
  if (!navigator.geolocation) { alert('GPS indisponível.'); return; }
  showLoading(true);
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const { latitude, longitude } = pos.coords;
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
      const data = await res.json();
      if (data?.address) {
        const a = data.address;
        const setV = (id, v) => { const el = document.getElementById(id); if(el && v) el.value = v; };
        setV('leadEndereco', a.road || a.pedestrian);
        setV('leadBairro',   a.suburb || a.neighbourhood || a.quarter || a.city_district);
        setV('leadCidade',   a.city || a.town || a.village || a.municipality);
        alert('✅ Endereço preenchido!');
      }
    } catch(e) { alert('Erro ao obter endereço.'); }
    showLoading(false);
  }, () => { showLoading(false); alert('Permissão GPS negada.'); }, { timeout: 10000 });
}

// ============================================================
// ADMIN
// ============================================================
function abrirConfiguracoes() { document.getElementById('configModal').classList.add('open'); }

async function gerirEquipe(acao) {
  const nome = document.getElementById('cfgNomeVendedor').value.trim();
  const meta  = document.getElementById('cfgMeta').value;
  if (!nome) { alert('Informe o nome!'); return; }
  await apiCall('manageTeam', { acao, nome, meta });
  alert('✅ Feito!');
  carregarVendedores();
  document.getElementById('cfgNomeVendedor').value = '';
}

function abrirTransferenciaEmLote() {
  document.getElementById('modalTransferencia').classList.add('open');
}

async function executarTransferenciaLote() {
  const from = document.getElementById('transfOrigem').value;
  const to   = document.getElementById('transfDestino').value;
  if (!from || !to)   { alert('Selecione origem e destino!'); return; }
  if (from === to)    { alert('Origem e destino iguais!'); return; }
  if (!confirm(`Transferir todos os leads de ${from} para ${to}?`)) return;
  const res = await apiCall('transferAllLeads', { from, to });
  if (res?.status === 'success') alert(`✅ ${res.count} leads transferidos!`);
  document.getElementById('modalTransferencia').classList.remove('open');
  carregarLeads();
}

// ============================================================
// SYNC QUEUE (OFFLINE)
// ============================================================
async function processarFilaSincronizacao() {
  if (!syncQueue.length) return;
  const queue = [...syncQueue];
  syncQueue = [];
  localStorage.setItem('mhnet_sync_queue', '[]');
  for (const item of queue) {
    try { await apiCall(item.route, item.payload, false); }
    catch(e) { syncQueue.push(item); }
  }
  localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue));
  if (queue.length) console.log(`✅ ${queue.length} operações offline sincronizadas.`);
}

// ============================================================
// API CALL
// ============================================================
async function apiCall(route, payload = {}, show = true) {
  if (show) showLoading(true);
  const offlineRoutes = ['addLead','updateStatus','addTask','registerAbsence','updateObservacao','updateAgendamento'];
  if (!navigator.onLine && offlineRoutes.includes(route)) {
    syncQueue.push({ route, payload, timestamp: Date.now() });
    localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue));
    if (show) showLoading(false);
    return { status: 'success', local: true };
  }
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 15000);
    const res  = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ route, payload }),
      signal: ctrl.signal
    });
    clearTimeout(tid);
    const json = await res.json();
    if (show) showLoading(false);
    return json;
  } catch(e) {
    if (show) showLoading(false);
    if (offlineRoutes.includes(route)) {
      syncQueue.push({ route, payload, timestamp: Date.now() });
      localStorage.setItem('mhnet_sync_queue', JSON.stringify(syncQueue));
      return { status: 'success', local: true };
    }
    return { status: 'error', message: 'Conexão falhou' };
  }
}

function showLoading(state) {
  const el = document.getElementById('loader');
  if (el) el.classList.toggle('active', state);
}
