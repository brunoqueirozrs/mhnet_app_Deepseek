<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#004AAD">
  <title>Mhnet Vendas v4.2</title>
  
  <link rel="manifest" href="manifest.json">
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="dashboard.css">
  <style>
    /* Aviso de Offline */
    #offline-banner {
      display: none;
      background: #dc3545;
      color: white;
      text-align: center;
      padding: 8px;
      font-size: 0.85rem;
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 2000;
    }
  </style>
</head>
<body>

  <!-- Aviso Offline -->
  <div id="offline-banner">⚠️ Sem conexão com a internet</div>

  <!-- Dica de Instalação (Mobile) -->
  <div id="mobileTip" style="display:none; background:#004AAD; color:white; padding:12px; border-radius:0 0 12px 12px; text-align:center; font-size:14px; margin-bottom:15px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    📱 <b>Instalar App:</b> Toque em <b>⋮</b> (ou Compartilhar) e selecione <b>"Adicionar à Tela Inicial"</b>.
  </div>

  <div class="container">
    
    <!-- Cabeçalho Fixo -->
    <div class="header">
      <img class="logo" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNTAgNzMiIHdpZHRoPSIyNTAiIGhlaWdodD0iNzMiPgogIDx0ZXh0IHg9IjEwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjQ4IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0iIzAwNEFBRCI+TWhuZXQ8L3RleHQ+Cjwvc3ZnPg==" alt="Mhnet Logo">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
        <div>
          <h2 style="margin:0; font-size:1.2rem;">Vendas Externas</h2>
          <small class="version" id="userInfo">Aguardando login...</small>
        </div>
        <button class="btn ghost" onclick="toggleUserMenu()" style="width:auto; padding:8px 12px; font-size:1.2rem;">👤</button>
      </div>
    </div>

    <!-- TELA 1: LOGIN / SELEÇÃO DE VENDEDOR (Inicial) -->
    <div id="userMenu" class="user-menu-card" style="display:block;">
      <h3>👋 Bem-vindo!</h3>
      <div class="form-group">
        <label>Quem é você?</label>
        <select id="userSelect">
          <option value="">Carregando equipe...</option>
        </select>
      </div>
      <button class="btn primary" onclick="setLoggedUser()">Entrar no Sistema</button>
    </div>

    <!-- CONTEÚDO PRINCIPAL (Escondido até o login) -->
    <main id="mainContent" style="display:none;">

      <!-- PÁGINA: DASHBOARD -->
      <section id="dashboard" class="page">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-title">Leads Hoje</div>
            <div class="stat-value" id="statLeads">0</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Tempo Rota</div>
            <div class="stat-value" id="timer">00:00</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Pontos GPS</div>
            <div class="stat-value" id="points">0</div>
          </div>
        </div>

        <div class="actions-grid">
          <button class="action-card blue" onclick="showPage('iniciarRota')">
            <span class="action-icon">📍</span>
            <span class="action-title">Iniciar Rota</span>
          </button>
          <button class="action-card green" onclick="showPage('gestaoLeads')">
            <span class="action-icon">📋</span>
            <span class="action-title">Gerir Leads</span>
          </button>
        </div>

        <button class="btn ghost" onclick="gerarCoachIA()" style="border-color: #6b21a8; color: #6b21a8; margin-bottom: 20px; border-width: 2px;">
          ✨ Pedir Dica do Coach IA
        </button>

        <div class="lead-management">
          <h3>Último Lead Cadastrado</h3>
          <div id="lastLeadContent">
            <span style="color:#666; font-style:italic;">Nenhum registro recente.</span>
          </div>
        </div>
      </section>

      <!-- PÁGINA: CONTROLE DE ROTA -->
      <section id="iniciarRota" class="page" style="display:none;">
        <div style="text-align:center; margin-bottom:20px;">
          <h2>📍 Controle de Rota</h2>
          <div class="status-badge" id="gpsStatus">GPS: Aguardando...</div>
        </div>
        
        <div class="actions">
          <button id="btnStart" class="btn btn-start">▶ INICIAR RASTREAMENTO</button>
          <button id="btnStop" class="btn btn-stop">⏹ FINALIZAR E ENVIAR</button>
        </div>
        
        <div style="margin-top:20px; background:#f8f9fa; padding:15px; border-radius:10px; font-size:0.9rem; color:#666;">
          ℹ️ <b>Como funciona:</b> Clique em iniciar ao sair para a rua. O app gravará seu trajeto automaticamente. Ao terminar o turno, clique em finalizar.
        </div>

        <button class="btn ghost" onclick="showPage('dashboard')" style="margin-top:20px;">↩ Voltar ao Menu</button>
      </section>

      <!-- PÁGINA: GESTÃO DE LEADS -->
      <section id="gestaoLeads" class="page" style="display:none;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
          <h2>📋 Meus Leads</h2>
          <button class="lead-action-btn primary" onclick="showPage('cadLead')" style="width:auto;">➕ Novo</button>
        </div>

        <input id="searchLead" type="text" class="search-input" placeholder="🔍 Buscar por nome, telefone ou bairro..." oninput="renderLeads()">
        
        <div id="listaLeadsGestao" style="min-height:200px;"></div>
        <div id="infoLeads" style="text-align:center; color:#999; font-size:0.8rem; margin-top:10px;"></div>
        
        <button class="btn ghost" onclick="showPage('dashboard')" style="margin-top:20px;">↩ Voltar</button>
      </section>

      <!-- PÁGINA: CADASTRAR NOVO LEAD -->
      <section id="cadLead" class="page" style="display:none;">
        <h2>➕ Novo Cadastro</h2>
        
        <div class="form-group">
          <label>Nome do Cliente</label>
          <input id="leadNome" type="text" placeholder="Ex: João da Silva">
        </div>

        <div class="form-group">
          <label>WhatsApp / Telefone</label>
          <input id="leadTelefone" type="tel" placeholder="Ex: (51) 99999-9999">
        </div>

        <div class="form-group">
          <label>Endereço Completo</label>
          <input id="leadEndereco" type="text" placeholder="Rua, Número, Complemento">
        </div>

        <div class="form-group">
          <label>Bairro</label>
          <input id="leadBairro" type="text" placeholder="Ex: Centro">
        </div>

        <div class="form-group">
          <label>Cidade</label>
          <input id="leadCidade" type="text" value="Lajeado">
        </div>

        <div class="form-group">
          <label>Nível de Interesse</label>
          <select id="leadInteresse">
            <option value="ALTO">🔥 Alto</option>
            <option value="MEDIO" selected>😐 Médio</option>
            <option value="BAIXO">❄️ Baixo</option>
          </select>
        </div>

        <div class="form-group">
          <label style="display:flex; justify-content:space-between; align-items:center;">
            Observações / Abordagem
            <button onclick="gerarAbordagemIA()" style="background:none; border:none; color:#6b21a8; font-weight:bold; cursor:pointer; font-size:0.8rem;">
              ✨ Gerar com IA
            </button>
          </label>
          <textarea id="leadObs" placeholder="Detalhes adicionais..."></textarea>
        </div>

        <div class="actions">
          <button class="btn primary" onclick="enviarLead()">💾 SALVAR LEAD</button>
          <button class="btn ghost" onclick="showPage('gestaoLeads')">Cancelar</button>
        </div>
      </section>

    </main>

    <!-- Rodapé -->
    <footer style="text-align:center; margin-top:30px; padding-top:20px; border-top:1px solid #eee; color:#ccc; font-size:0.8rem;">
      <small>MHNET Vendas Externas • <span id="footerUser"></span></small>
    </footer>

  </div>

  <!-- Overlay de Carregamento -->
  <div id="loader" class="overlay">
    <div class="spinner"></div>
    <div id="loaderText">Carregando...</div>
  </div>

  <!-- Scripts -->
  <script src="app.js"></script>
  <script>
    // Registro do Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
          .then(reg => console.log('Service Worker registrado:', reg.scope))
          .catch(err => console.log('Falha no Service Worker:', err));
      });
    }

    // Monitoramento de Conexão
    window.addEventListener('online', () => {
      document.getElementById('offline-banner').style.display = 'none';
    });
    window.addEventListener('offline', () => {
      document.getElementById('offline-banner').style.display = 'block';
    });
  </script>
</body>
</html>
