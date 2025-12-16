/**
 * ============================================================
 * MHNET VENDAS - v7.0 BLINDADA
 * ============================================================
 */

// CONFIGURAÇÃO
const DEPLOY_ID = 'AKfycbyWYgd3r5pA1dYB5LD_PY6m4V2FjWG-Oi6vYjlvNBre9r_eGiPlhia-HtJjD2Mnfc9F'; 
const API_URL = `https://script.google.com/macros/s/${DEPLOY_ID}/exec`;
const TOKEN = "MHNET2025#SEG";
const GEMINI_KEY = "AIzaSyD8btK2gPgH9qzuPX84f6m508iggUs6Vuo"; 

// ESTADO GLOBAL
let loggedUser = localStorage.getItem('loggedUser');
let leadsCache = [];
let routeCoords = [];
let watchId = null;
let timerInterval = null;
let seconds = 0;
let routeStartTime = null;

// INIT
document.addEventListener('DOMContentLoaded', () => {
  // A lista já está no HTML, não precisamos esperar nada para mostrá-la
  
  if (loggedUser) {
    initApp();
  } else {
    // Apenas mostra o menu que já está pronto
    document.getElementById('userMenu').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
  }
});

function initApp() {
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('userInfo').textContent = `Vendedor: ${loggedUser}`;
  navegarPara('dashboard');
  carregarLeads(); // Tenta buscar o histórico
}

// NAVEGAÇÃO SIMPLIFICADA
function navegarPara(pageId) {
  // Esconde todas as páginas
  document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
  
  // Mostra a alvo
  const target = document.getElementById(pageId);
  if(target) target.style.display = 'block';
  window.scrollTo(0, 0);

  // Atualiza botões do rodapé
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active', 'text-blue-700');
    el.classList.add('text-slate-400');
  });

  // Mapeamento ID botão -> ID página
  let btnId = '';
  if(pageId === 'dashboard') btnId = 'nav-home';
  if(pageId === 'cadastroLead') btnId = 'nav-novo';
  if(pageId === 'gestaoLeads') btnId = 'nav-lista';
  if(pageId === 'rota') btnId = 'nav-rota';

  const btn = document.getElementById(btnId);
  if(btn) {
    // Se não for o botão central (que tem estilo especial), pinta de azul
    if(!btn.querySelector('div')) {
        btn.classList.add('active', 'text-blue-700');
        btn.classList.remove('text-slate-400');
    }
  }

  if (pageId === 'dashboard') atualizarDashboard();
}

function setLoggedUser() {
  const select = document.getElementById('userSelect');
  if (select && select.value) {
    loggedUser = select.value;
    localStorage.setItem('loggedUser', loggedUser);
    initApp();
  } else {
    alert('Por favor, selecione seu nome na lista!');
  }
}

function logout() {
  if(confirm("Sair do sistema?")) {
    localStorage.removeItem('loggedUser');
    location.reload();
  }
}

// *** IA GEMINI ***
async function chamarGemini(prompt) {
  if (!GEMINI_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (e) { return null; }
}

async function gerarAbordagemIA() {
  const nome = document.getElementById('leadNome').value;
  if (!nome) return alert("Preencha o nome!");
  showLoading(true, "CRIANDO PITCH...");
  const txt = await chamarGemini(`Mensagem WhatsApp para ${nome}. Venda de internet fibra MHNET. Curta, persuasiva e com emojis.`);
  if (txt) document.getElementById('leadObs').value = txt;
  showLoading(false);
}

async function analisarCarteiraIA() {
  if (!leadsCache.length) return alert("Sem leads.");
  showLoading(true, "ANALISANDO...");
  const txt = await chamarGemini(`Analise estes bairros e sugira rota: ${leadsCache.slice(0,20).map(l=>l.bairro).join(', ')}`);
  showLoading(false);
  if (txt) alert(`💡 Dica:\n${txt}`);
}

async function gerarCoachIA() {
  showLoading(true, "COACH...");
  const hoje = leadsCache.filter(l => new Date(l.timestamp || l.Data).toLocaleDateString() === new Date().toLocaleDateString()).length;
  const txt = await chamarGemini(`Vendedor fez ${hoje} vendas hoje. Motive-o em 1 frase curta.`);
  showLoading(false);
  if(txt) alert(`🚀 Coach:\n${txt}`);
}

// *** ENVIO DE LEADS ***
async function enviarLead() {
  const nome = document.getElementById('leadNome').value;
  const tel = document.getElementById('leadTelefone').value;
  
  if (!nome || !tel) return alert("Preencha Nome e Telefone");
  
  showLoading(true, "SALVANDO...");
  
  const payload = {
    vendedor: loggedUser, nomeLead: nome, lead: nome, 
    telefone: tel, whatsapp: tel,
    endereco: document.getElementById('leadEndereco').value,
    cidade: document.getElementById('leadCidade').value,
    bairro: document.getElementById('leadBairro').value,
    interesse: document.getElementById('leadInteresse').value,
    observacao: document.getElementById('leadObs').value,
    provedor: "", timestamp: new Date().toISOString()
  };
  
  const res = await apiCall('addLead', payload);
  showLoading(false);
  
  if (res && res.status === 'success') {
    alert('✅ Lead salvo com sucesso!');
    document.getElementById('leadNome').value = ''; 
    document.getElementById('leadTelefone').value = '';
    document.getElementById('leadEndereco').value = ''; 
    document.getElementById('leadObs').value = '';
    document.getElementById('leadBairro').value = '';
    
    carregarLeads(); 
    navegarPara('gestaoLeads');
  } else {
    alert('❌ Erro ao salvar.');
  }
}

// *** LISTAGEM DE LEADS ***
async function carregarLeads() {
  const lista = document.getElementById('listaLeadsGestao');
  if(lista) lista.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8"><i class="fas fa-circle-notch fa-spin text-3xl mb-3 text-blue-500"></i><br>Buscando histórico...</div>';

  const res = await apiCall('getLeads', {}, false, true);
  
  if (res && res.status === 'success') {
    // Filtro mais robusto
    leadsCache = (res.data || []).filter(l => {
      const v = (l.vendedor || l.Vendedor || '').toLowerCase();
      return v.includes(loggedUser.toLowerCase());
    });
    renderLeads();
    atualizarDashboard();
  } else {
    if(lista) lista.innerHTML = '<div style="text-align:center; color:red; padding:20px">Não foi possível carregar o histórico.</div>';
  }
}

function renderLeads() {
  const div = document.getElementById('listaLeadsGestao');
  if (!div) return;
  const term = (document.getElementById('searchLead')?.value || '').toLowerCase();
  
  const filtrados = leadsCache.filter(l => 
    (l.nomeLead || l.lead || '').toLowerCase().includes(term) || 
    (l.bairro || '').toLowerCase().includes(term)
  );
  
  if (!filtrados.length) {
    div.innerHTML = '<div style="text-align:center; padding:60px; color:#cbd5e1"><i class="far fa-folder-open text-5xl mb-4"></i><br>Nenhum registro encontrado.</div>';
    return;
  }

  filtrados.sort((a,b) => {
    const getDate = (d) => {
      if(!d) return 0;
      if(d.includes('/')) {
        const parts = d.split(' '); 
        const dateParts = parts[0].split('/');
        return new Date(dateParts[2], dateParts[1]-1, dateParts[0]);
      }
      return new Date(d);
    };
    return getDate(b.timestamp) - getDate(a.timestamp);
  });

  div.innerHTML = filtrados.map(l => {
    const nome = l.nomeLead || l.lead || 'Cliente';
    const bairro = l.bairro || 'Geral';
    const interesse = (l.interesse || 'Novo').toUpperCase();
    const tel = l.telefone || l.whatsapp || '';
    
    let badgeClass = "bg-gray-100 text-gray-500";
    if(interesse.includes('ALTO')) badgeClass = "bg-green-100 text-green-700";
    if(interesse.includes('MÉDIO')) badgeClass = "bg-yellow-100 text-yellow-700";
    if(interesse.includes('BAIXO')) badgeClass = "bg-red-50 text-red-500";

    return `
    <div class="bg-white p-5 rounded-[1.5rem] border border-blue-50 shadow-sm mb-4">
      <div class="flex justify-between items-start mb-3">
        <div>
          <div class="font-bold text-[#003870] text-lg leading-tight">${nome}</div>
          <div class="text-xs text-gray-400 mt-1"><i class="fas fa-calendar-alt mr-1"></i> ${l.timestamp ? l.timestamp.split(' ')[0] : 'Hoje'}</div>
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

function atualizarDashboard() {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const count = leadsCache.filter(l => (l.timestamp || '').includes(hoje)).length;
  if(document.getElementById('statLeads')) document.getElementById('statLeads').innerText = count;
}

// ROTA (GPS)
function startRoute() {
  if (!navigator.geolocation) return alert('Ative o GPS.');
  routeCoords = []; seconds = 0; routeStartTime = new Date().toISOString();
  document.getElementById('btnStart').style.display = 'none';
  document.getElementById('btnStop').style.display = 'flex';
  
  timerInterval = setInterval(() => {
    seconds++;
    const h = Math.floor(seconds / 3600).toString().padStart(2,'0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2,'0');
    const s = (seconds % 60).toString().padStart(2,'0');
    document.getElementById('timer').innerText = `${h}:${m}:${s}`;
  }, 1000);

  watchId = navigator.geolocation.watchPosition(p => {
    routeCoords.push({lat: p.coords.latitude, lon: p.coords.longitude});
    document.getElementById('points').innerText = routeCoords.length;
    const st = document.getElementById('gpsStatus');
    st.innerText = "Rastreando";
    st.className = "bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-bold";
  }, e => console.error(e), {enableHighAccuracy:true});
}

async function stopRoute() {
  if(!confirm("Finalizar rota?")) return;
  clearInterval(timerInterval);
  navigator.geolocation.clearWatch(watchId);
  showLoading(true, "ENVIANDO ROTA...");
  await apiCall('saveRoute', {vendedor: loggedUser, inicioISO: routeStartTime, fimISO: new Date().toISOString(), coordenadas: routeCoords});
  showLoading(false);
  alert("Rota salva!");
  document.getElementById('btnStart').style.display = 'flex';
  document.getElementById('btnStop').style.display = 'none';
  document.getElementById('timer').innerText = "00:00:00";
  document.getElementById('points').innerText = "0";
  document.getElementById('gpsStatus').innerText = "Parado";
  navegarPara('dashboard');
}

// API
async function apiCall(route, payload, show=true, suppress=false) {
  if(show) showLoading(true);
  try {
    const res = await fetch(API_URL, {method:'POST', body: JSON.stringify({route, payload, token: TOKEN})});
    const json = await res.json();
    if(show) showLoading(false);
    return json;
  } catch(e) {
    if(show) showLoading(false);
    if(!suppress) alert("Erro conexão API.");
    return null;
  }
}

function showLoading(show, txt) {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
  if(txt) document.getElementById('loaderText').innerText = txt;
}