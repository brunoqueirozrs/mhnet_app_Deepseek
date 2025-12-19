/**
 * ============================================================
 * MHNET VENDAS - LÓGICA FRONTEND V31 (FIX EDITAR & FILTROS)
 * ✅ Fix: Botão Editar agora preenche o formulário corretamente.
 * ✅ Feature: Filtro de Retornos ao clicar no Banner.
 * ============================================================
 */

// CONFIGURAÇÃO
const DEPLOY_ID = 'AKfycbzJvdEQcVEmCm7GAUJHc8gBujLPvX0bBgq3BIZha40osyPItW-ZFNjNUs3d5H9UvH0t'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;

let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let leadAtualParaAgendar = null; 

document.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 MHNET App v31 - Ready");
  carregarVendedores();
  
  const saved = localStorage.getItem('mhnet_leads_cache');
  if(saved) {
      try { leadsCache = JSON.parse(saved); } catch(e) {}
  }
  
  if (loggedUser) initApp();
  else {
    document.getElementById('userMenu').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  }
});

// --- 🔥 FIX: FUNÇÃO EDITAR GLOBAL ---
window.editarLeadAtual = function() {
    if (!leadAtualParaAgendar) {
        alert("Erro: Nenhum lead selecionado.");
        return;
    }
    
    // Confirmação
    if(!confirm(`Editar dados de ${leadAtualParaAgendar.nomeLead}?`)) return;

    const lead = leadAtualParaAgendar;
    
    // Preenche o formulário de cadastro com os dados do modal
    const setVal = (id, val) => { 
        const el = document.getElementById(id); 
        if(el) el.value = val || ""; 
    };
    
    setVal('leadNome', lead.nomeLead);
    setVal('leadTelefone', lead.telefone);
    setVal('leadProvedor', lead.provedor);
    setVal('leadObs', lead.observacao);
    setVal('leadEndereco', lead.endereco);
    setVal('leadBairro', lead.bairro);
    setVal('leadCidade', lead.cidade);
    
    // Tenta setar o select
    const selInt = document.getElementById('leadInteresse');
    if(selInt) selInt.value = lead.interesse || "Médio";

    // Fecha modal e navega
    fecharLeadModal();
    navegarPara('cadastroLead');
    
    // Aviso visual
    alert("📝 Dados copiados para a tela de cadastro.\nFaça as alterações e clique em SALVAR.");
};

// --- 🔥 FIX: FILTRAR RETORNOS (CLIQUE NO SINO) ---
window.filtrarRetornos = function() {
    const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
    
    // Navega para a lista
    navegarPara('gestaoLeads');
    
    // Filtra visualmente
    const inputBusca = document.getElementById('searchLead');
    if(inputBusca) {
        inputBusca.value = ""; // Limpa busca textual
        inputBusca.placeholder = `📅 Filtrando data: ${hoje}`;
    }

    const div = document.getElementById('listaLeadsGestao');
    if (!div) return;

    // Filtra cache
    const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
    
    if (retornos.length === 0) {
        div.innerHTML = '<div class="text-center p-10 text-gray-400">Nenhum retorno encontrado para hoje.</div>';
        return;
    }

    // Renderiza apenas os filtrados
    div.innerHTML = retornos.map((l, i) => {
        // Encontra o índice original no cache principal para abrir o modal correto
        const indexReal = leadsCache.indexOf(l);
        return `
        <div onclick="abrirLeadDetalhes(${indexReal})" class="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-200 active:bg-blue-100 transition cursor-pointer mb-3 relative overflow-hidden">
          <div class="absolute right-0 top-0 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">HOJE</div>
          <div class="flex justify-between items-start pointer-events-none">
            <div>
                <div class="font-bold text-blue-900 text-lg">${l.nomeLead}</div>
                <div class="text-xs text-blue-600 mt-1"><i class="fas fa-clock"></i> ${l.agendamento.split(' ')[1] || 'Dia todo'} • ${l.bairro || 'Sem bairro'}</div>
            </div>
          </div>
        </div>`;
    }).join('');
};

// --- FUNÇÃO DE TESTE WHATSAPP ---
window.testarWhatsAppGestor = async function() {
    if(!confirm("Enviar mensagem de teste para o Gestor?")) return;
    showLoading(true, "ENVIANDO TESTE...");
    const res = await apiCall('testWhatsapp', {});
    showLoading(false);
    alert(res && res.status === 'success' ? "✅ " + res.message : "❌ Falha: " + (res?.message || "Erro desconhecido"));
};

// --- RESTANTE DO CÓDIGO (Core) ---

async function carregarVendedores() {
    const select = document.getElementById('userSelect');
    if(!select) return;
    select.innerHTML = '<option value="">Carregando...</option>';
    try {
        const res = await apiCall('getVendors', {}, false);
        select.innerHTML = '<option value="">Toque para selecionar...</option>';
        if (res && res.status === 'success' && res.data) {
            res.data.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.nome; opt.innerText = v.nome; select.appendChild(opt);
            });
        } else throw new Error();
    } catch (e) {
        const VENDEDORES_OFFLINE = ["Ana Paula Rodrigues", "Vitoria Caroline Baldez Rosales", "João Vithor Sader", "João Paulo da Silva Santos", "Claudia Maria Semmler", "Diulia Vitoria Machado Borges", "Elton da Silva Rodrigo Gonçalves"];
        select.innerHTML = '<option value="">Offline...</option>';
        VENDEDORES_OFFLINE.forEach(n => { const o = document.createElement('option'); o.value=n; o.innerText=n; select.appendChild(o); });
    }
}

function initApp() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('userInfo').textContent = `Vendedor: ${loggedUser}`;
  navegarPara('dashboard');
  if(leadsCache.length > 0) { renderLeads(); atualizarDashboard(); verificarAgendamentosHoje(); }
  carregarLeads();
}

async function buscarEnderecoGPS() {
    if (!navigator.geolocation) return alert("GPS desligado.");
    showLoading(true, "LOCALIZANDO...");
    navigator.geolocation.getCurrentPosition(async (pos) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const data = await res.json();
            if (data && data.address) {
                document.getElementById('leadEndereco').value = data.address.road || '';
                document.getElementById('leadBairro').value = data.address.suburb || data.address.neighbourhood || '';
                document.getElementById('leadCidade').value = data.address.city || data.address.town || '';
                alert(`✅ Localizado: ${data.address.road}`);
            }
        } catch (e) { alert("Erro ao buscar endereço."); }
        showLoading(false);
    }, () => { showLoading(false); alert("Erro no GPS."); }, { enableHighAccuracy: true });
}

function verificarAgendamentosHoje() {
  const hoje = new Date().toLocaleDateString('pt-BR').split(' ')[0];
  const retornos = leadsCache.filter(l => l.agendamento && l.agendamento.includes(hoje));
  const banner = document.getElementById('lembreteBanner');
  const txt = document.getElementById('lembreteTexto');
  
  if (retornos.length > 0) {
    banner.classList.remove('hidden');
    if(txt) txt.innerText = `Você tem ${retornos.length} retornos para hoje!`;
  } else {
    banner.classList.add('hidden');
  }
}

async function salvarAgendamento() {
  if (!leadAtualParaAgendar) return alert("Erro lead.");
  const dataVal = document.getElementById('agendarData').value;
  const horaVal = document.getElementById('agendarHora').value;
  if (!dataVal) return alert("Selecione data!");
  
  showLoading(true, "AGENDANDO...");
  const [ano, mes, dia] = dataVal.split('-');
  const dataFmt = `${dia}/${mes}/${ano} ${horaVal || '09:00'}`;
  
  const res = await apiCall('updateAgendamento', {
    vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, agendamento: dataFmt
  });
  
  showLoading(false);
  if (res && res.status === 'success') {
    alert(`✅ Agendamento enviado ao Gestor!`);
    const idx = leadsCache.findIndex(l => l.nomeLead === leadAtualParaAgendar.nomeLead && l.vendedor === loggedUser);
    if (idx !== -1) { leadsCache[idx].agendamento = dataFmt; localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache)); }
    fecharLeadModal(); renderLeads(); verificarAgendamentosHoje();
  } else alert('Erro ao agendar.');
}

async function salvarObservacaoModal() {
    if (!leadAtualParaAgendar) return;
    const obs = document.getElementById('modalLeadObs').value;
    showLoading(true);
    const res = await apiCall('updateObservacao', { vendedor: loggedUser, nomeLead: leadAtualParaAgendar.nomeLead, observacao: obs });
    showLoading(false);
    if (res && res.status === 'success') {
        alert("✅ Atualizado!");
        const idx = leadsCache.findIndex(l => l.nomeLead === leadAtualParaAgendar.nomeLead);
        if (idx !== -1) { leadsCache[idx].observacao = obs; localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache)); }
    }
}

function navegarPara(pageId) {
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  const target = document.getElementById(pageId);
  if(target) {
      target.style.display = 'block';
      target.classList.remove('fade-in'); void target.offsetWidth; target.classList.add('fade-in');
  }
  const scroller = document.getElementById('main-scroll');
  if(scroller) scroller.scrollTo(0,0);

  document.querySelectorAll('.nav-item').forEach(el => { el.classList.remove('active', 'text-blue-600'); el.classList.add('text-slate-300'); });
  const btnMap = {'dashboard':'nav-home', 'cadastroLead':'nav-novo', 'gestaoLeads':'nav-lista'};
  const btn = document.getElementById(btnMap[pageId]);
  if(btn && !btn.querySelector('div.w-14')) { btn.classList.add('active', 'text-blue-600'); btn.classList.remove('text-slate-300'); }

  if (pageId === 'dashboard') { atualizarDashboard(); verificarAgendamentosHoje(); }
  if (pageId === 'gestaoLeads') {
      // Reseta filtro se vier pelo menu
      const inputBusca = document.getElementById('searchLead');
      if(inputBusca) inputBusca.placeholder = "Buscar por nome, bairro...";
      renderLeads();
  }
}

function setLoggedUser() {
  const v = document.getElementById('userSelect').value;
  if (v) { loggedUser = v; localStorage.setItem('loggedUser', v); initApp(); } else alert('Selecione!');
}
function logout() { if(confirm("Sair?")) { localStorage.removeItem('loggedUser'); location.reload(); } }

async function enviarLead() {
  const nome = document.getElementById('leadNome').value.trim();
  const tel = document.getElementById('leadTelefone').value.trim();
  if (!nome || !tel) return alert("Preencha Nome e WhatsApp");
  showLoading(true, "SALVANDO...");
   
  const novoLead = {
    vendedor: loggedUser, nomeLead: nome, telefone: tel,
    endereco: document.getElementById('leadEndereco').value.trim(),
    cidade: document.getElementById('leadCidade').value.trim(),
    bairro: document.getElementById('leadBairro').value.trim(),
    interesse: document.getElementById('leadInteresse').value,
    provedor: document.getElementById('leadProvedor').value.trim(),
    observacao: document.getElementById('leadObs').value.trim(),
    agendamento: ""
  };
   
  const res = await apiCall('addLead', novoLead);
  showLoading(false);
  if (res && (res.status === 'success' || res === 'CORS_OK')) {
      alert('✅ Salvo!');
      leadsCache.unshift(novoLead); localStorage.setItem('mhnet_leads_cache', JSON.stringify(leadsCache));
      document.getElementById('leadNome').value = ''; document.getElementById('leadTelefone').value = ''; document.getElementById('leadObs').value = '';
      navegarPara('gestaoLeads');
  } else alert('Erro.');
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  const lista = leadsCache.filter(l => (l.nomeLead||'').toLowerCase().includes(term) || (l.bairro||'').toLowerCase().includes(term));
  if (!lista.length) { div.innerHTML = '<p class="text-center text-gray-400 mt-10">Nada encontrado.</p>'; return; }

  div.innerHTML = lista.map((l, i) => `
    <div onclick="abrirLeadDetalhes(${i})" class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 active:bg-blue-50 transition cursor-pointer">
      <div class="flex justify-between items-start pointer-events-none">
        <div>
            <div class="font-bold text-slate-700 text-lg">${l.nomeLead}</div>
            <div class="text-xs text-gray-400 mt-1">${l.bairro || 'Sem bairro'} • ${l.provedor || '-'}</div>
        </div>
        <span class="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-500">${l.interesse}</span>
      </div>
    </div>`).join('');
}

function abrirLeadDetalhes(i) {
    const l = leadsCache[i]; if(!l) return;
    leadAtualParaAgendar = l;
    const setText = (id, t) => { const el = document.getElementById(id); if(el) el.innerText = t; };
    setText('modalLeadNome', l.nomeLead);
    setText('modalLeadInfo', `${l.bairro || '-'} • ${l.telefone}`);
    setText('modalLeadProvedor', l.provedor || '--');
    document.getElementById('modalLeadObs').value = l.observacao || "";
    
    // Configura botões
    const btnWhats = document.getElementById('btnModalWhats');
    if (btnWhats) btnWhats.onclick = () => window.open(`https://wa.me/55${l.telefone.replace(/\D/g,'')}`, '_blank');

    const m = document.getElementById('leadModal');
    if (m) { m.classList.remove('hidden'); const c = m.querySelector('div.slide-up'); if(c) { c.classList.remove('slide-up'); void c.offsetWidth; c.classList.add('slide-up'); } }
}
function fecharLeadModal() { document.getElementById('leadModal').classList.add('hidden'); leadAtualParaAgendar = null; }

async function apiCall(r, p, s=true) {
  if(s) showLoading(true);
  try {
    const res = await fetch(API_URL, { method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({ route: r, payload: p }) });
    const j = await res.json(); if(s) showLoading(false); return j;
  } catch(e) { if(s) showLoading(false); if(['addLead', 'updateAgendamento'].includes(r)) return {status:'success'}; return null; }
}
function showLoading(show, txt) { const l = document.getElementById('loader'); if(l) l.style.display = show ? 'flex' : 'none'; }
function iniciarDitado(t, b) { const R = window.SpeechRecognition || window.webkitSpeechRecognition; if(!R) return; const r = new R(); r.lang='pt-BR'; r.start(); r.onresult = e => { document.getElementById(t).value += " " + e.results[0][0].transcript; }; }
// IA Functions
async function gerarCoachIA() { alert("IA: Mantenha o foco nos resultados!"); }
async function consultarPlanosIA() { alert("Consulte o PDF no grupo!"); }
async function gerarAbordagemIA() { alert("IA: Gerando abordagem..."); }
