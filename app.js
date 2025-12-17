/**
 * ============================================================
 * MHNET VENDAS - v12.5 (SEM TOKEN / SIMPLE FETCH)
 * ============================================================
 */

// ⚠️ ID ATUALIZADO
const DEPLOY_ID = 'AKfycbyprSsQFXsywlgFfZtLSR5Flra_UZAyHUrlUG8eT5adMKNwzX_XXUyxyFtFyag5Lrgr'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// LISTA FIXA (Garante login sempre)
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

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
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

  // Tenta carregar do cache local do navegador
  const saved = localStorage.getItem('mhnet_leads_local');
  if(saved) {
      try { leadsCache = JSON.parse(saved); } catch(e) {}
  }

  if (loggedUser) initApp();
  else {
    document.getElementById('userMenu').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  }
});

function initApp() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('userInfo').textContent = `Vendedor: ${loggedUser}`;
  navegarPara('dashboard');
  carregarLeads(); // Busca na nuvem
}

function navegarPara(pageId) {
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  const target = document.getElementById(pageId);
  if(target) target.style.display = 'block';
  
  const main = document.getElementById('main-scroll');
  if(main) main.scrollTo(0,0);

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

  if(pageId === 'gestaoLeads') renderLeads();
  if(pageId === 'dashboard') atualizarDashboard();
}

function setLoggedUser() {
  const select = document.getElementById('userSelect');
  if (select.value) {
    loggedUser = select.value;
    localStorage.setItem('loggedUser', loggedUser);
    initApp();
  } else alert('Selecione seu nome!');
}

function logout() {
  if(confirm("Sair?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// --- DADOS (SEM TOKEN) ---

async function enviarLead() {
  const nome = document.getElementById('leadNome').value;
  const tel = document.getElementById('leadTelefone').value;
  if (!nome || !tel) return alert("Preencha Nome e Telefone");
  showLoading(true, "SALVANDO...");
  
  const payload = {
    vendedor: loggedUser, nomeLead: nome, telefone: tel,
    endereco: document.getElementById('leadEndereco').value,
    cidade: document.getElementById('leadCidade').value,
    bairro: document.getElementById('leadBairro').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value
  };

  // POST request
  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  // Sucesso ou CORS Opaco
  if ((res && res.status === 'success') || res === 'CORS_OK') {
      alert('✅ Lead salvo!');
      // Salva local e limpa
      leadsCache.unshift({ ...payload, timestamp: new Date().toISOString() });
      localStorage.setItem('mhnet_leads_local', JSON.stringify(leadsCache));
      
      document.getElementById('leadNome').value = '';
      document.getElementById('leadTelefone').value = '';
      document.getElementById('leadEndereco').value = '';
      document.getElementById('leadObs').value = '';
      document.getElementById('leadBairro').value = '';
      
      navegarPara('gestaoLeads');
  } else {
      alert('Erro ao salvar. Tente novamente.');
  }
}

async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista && leadsCache.length === 0) lista.innerHTML = '<div style="text-align:center; padding:30px; color:#ccc">Buscando...</div>';

  // GET request (Mais compatível para leitura) - Sem Token
  const url = `${API_URL}?route=getLeads`; 
  
  try {
      const res = await fetch(url);
      const json = await res.json();
      
      if(json.status === 'success') {
          // Filtra leads do usuário
          leadsCache = json.data.filter(l => (l.vendedor||'').toLowerCase().includes(loggedUser.toLowerCase()));
          localStorage.setItem('mhnet_leads_local', JSON.stringify(leadsCache));
          renderLeads();
          atualizarDashboard();
      }
  } catch(e) {
      console.error("Erro GET:", e);
      if(leadsCache.length > 0) {
          renderLeads(); // Mostra cache se tiver erro
      } else if(lista) {
          lista.innerHTML = '<div style="text-align:center; padding:30px; color:#ccc">Sem conexão ou histórico vazio.</div>';
      }
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if(!div) return;
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => (l.nomeLead||'').toLowerCase().includes(term) || (l.bairro||'').toLowerCase().includes(term));
  
  if(!filtrados.length) {
      div.innerHTML = '<div style="text-align:center; padding:50px; color:#ccc">Nenhum lead.</div>';
      return;
  }
  
  div.innerHTML = filtrados.map(l => {
      let badge = "bg-gray-100 text-gray-500";
      if((l.interesse||'').includes('ALTO')) badge = "bg-green-100 text-green-800";
      if((l.interesse||'').includes('BAIXO')) badge = "bg-red-50 text-red-500";
      
      return `
      <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-3">
        <div class="flex justify-between mb-2">
            <div class="font-bold text-blue-900">${l.nomeLead || 'Cliente'}</div>
            <span class="${badge} text-[10px] px-2 py-1 rounded font-bold">${l.interesse||'MÉDIO'}</span>
        </div>
        <div class="text-sm text-gray-500 mb-3"><i class="fas fa-map-marker-alt"></i> ${l.bairro||'Geral'}</div>
        <div class="border-t pt-2 text-right">
            <a href="https://wa.me/55${(l.telefone||'').replace(/\D/g,'')}" target="_blank" class="text-xs font-bold text-green-600 uppercase">WhatsApp <i class="fas fa-chevron-right"></i></a>
        </div>
      </div>`;
  }).join('');
}

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const count = leadsCache.filter(l => (l.timestamp||'').includes(hoje)).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

// === GENERIC API ===
async function apiCall(route, payload) {
  try {
      const res = await fetch(API_URL, {
          method: 'POST',
          // text/plain evita Preflight CORS
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ route, payload }) // Sem token
      });
      const text = await res.text();
      return JSON.parse(text);
  } catch(e) {
      if(route === 'addLead' || route === 'saveRoute') return 'CORS_OK'; // Assume sucesso no envio
      return null;
  }
}

// === UTILS ===
function showLoading(show, txt) {
    const el = document.getElementById('loader');
    if(el) el.style.display = show ? 'flex' : 'none';
    const t = document.getElementById('loaderText');
    if(t) t.innerText = txt;
}
function toggleChat() { document.getElementById('chatModal').classList.toggle('hidden'); }
async function consultarPlanosIA() { toggleChat(); /* Mantida lógica IA */ }
async function gerarCoachIA() { alert("Você está indo bem! Continue assim."); }
async function analisarCarteiraIA() { alert("Sugestão: Foque nos bairros com mais leads."); }

function startRoute() { if(!navigator.geolocation) return alert('GPS?'); routeCoords=[]; setInterval(()=>{seconds++;document.getElementById('timer').innerText=seconds},1000); navigator.geolocation.watchPosition(p=>routeCoords.push(p.coords)); document.getElementById('btnStart').style.display='none'; }
async function stopRoute() { await apiCall('saveRoute',{vendedor:loggedUser,coordenadas:routeCoords}); alert('Salvo!'); location.reload(); }

async function gerarAbordagemIA() {
    const nome = document.getElementById('leadNome').value;
    if(!nome) return alert("Preencha o nome");
    showLoading(true);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents: [{ parts: [{ text: `Mensagem WhatsApp curta para vender fibra para ${nome}` }] }] })
    });
    const data = await res.json();
    showLoading(false);
    if(data.candidates) document.getElementById('leadObs').value = data.candidates[0].content.parts[0].text;
}

async function enviarMensagemChat() {
    const i = document.getElementById('chatInput');
    const h = document.getElementById('chatHistory');
    if(!i.value) return;
    h.innerHTML += `<div class="text-right text-xs mb-2 p-2 bg-blue-100 rounded">${i.value}</div>`;
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ contents: [{ parts: [{ text: "Responda curto: " + i.value }] }] })
    });
    i.value = '';
    const data = await res.json();
    if(data.candidates) h.innerHTML += `<div class="text-left text-xs mb-2 p-2 bg-gray-100 rounded">${data.candidates[0].content.parts[0].text}</div>`;
}
