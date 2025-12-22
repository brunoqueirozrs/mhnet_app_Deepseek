/**
 * ============================================================================
 * MHNET VENDAS - BACKEND V79 (INDICADORES & DIAS ÚTEIS)
 * ============================================================================
 * 📝 NOVIDADES:
 * 1. Rota 'getIndicators': Calcula vendas do período comercial (25 a 24).
 * 2. Cálculo de Dias Úteis: Para dar noção de urgência.
 * 3. IA Analista: Analisa a meta vs dias restantes.
 * ============================================================================
 */

const CONFIG = {
  PLANILHA_ID: "19U8KDUFQUhMOLPIniKCkUfGXZCBY7i3uFyjOQYU003w", 
  KNOWLEDGE_DOC_ID: "1j3AKQhU1w2OTkWEVO7x_MFKcXioRAJWV3fwfq_vPpOs", 
  
  MATERIAIS_DRIVE_ID: "15DamfOElAjWe6cnhehdv2TlUusYL9NZW", 
  PORTFOLIOS: [
    { name: "Fibra + Móvel", id: "15DamfOElAjWe6cnhehdv2TlUusYL9NZW" },
    { name: "Plano Kids", id: "1-6FHjXqV5r5LeD8UnEikjhwoHMNYTBXK" },
    { name: "Câmeras", id: "1-_oMBZJ91F64amddRmIolz1FA8rJroiK" },
    { name: "Fibra Pura", id: "1hxIddEZi3MSaJOSJV3V7QsGeGVsiSLin" },
    { name: "Móvel + Starbem", id: "10sp1FBFAbkBVubeSs55DiC4FOkoOU4nJ" },
    { name: "Globoplay", id: "11WehgsyJUPsHJKw-feZGHUdS2c0QAwVc" },
    { name: "MHPlay", id: "170T6YExVLzIiTs3fKziKPn7k5jusMclg" },
    { name: "MHPlay + Fibra", id: "1YE8HpMVnW-V1eaV6l83AY3R_ZVQFHcj5" },
    { name: "Plano Gamer", id: "15O45cRsN24zmjbdFRWBbI5NDrjnjO8iH" },
    { name: "IP Negócios", id: "1-860wKXpC8HRmZiJyrDuCehTH1NxR5m1" },
    { name: "Telefone Fixo", id: "17xR_76Xm8aPAK3hZ2YId4t8j5wqXk9Wl" },
    { name: "Guias Rápidos", id: "11u320opPf2iEpJ3LY0wPoQv_8RKvZacV" }
  ],

  GEMINI_API_KEY: "AIzaSyDsSx-m5bZxZWKZqPjIVSIHbVaZHMD6AdY", 
  GEMINI_MODEL: "gemini-2.5-flash", 
  GESTOR_WHATSAPP: "+555184487818", 
  API_KEY_WHATS: "4345895",

  ABA_LEADS: "Acompanhamento de Lead | Abordagens",
  ABA_LOGS_IA: "Logs_IA",
  ABA_VENDEDORES: "Vendedores",
  ABA_OBJECOES: "Matriz Objeções"
};

// --- ROTEAMENTO ---
function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    let route = "desconhecida";
    let data = {};

    if (e.postData && e.postData.contents) {
      try {
        const body = JSON.parse(e.postData.contents);
        route = body.route;
        data = body.payload || {};
      } catch (err) {}
    } else if (e.parameter) {
      route = e.parameter.route;
      data = e.parameter;
    }

    let result = { status: 'error', message: 'Rota não encontrada' };

    switch(route) {
      // --- INDICADORES (NOVO) ---
      case 'getIndicators': result = getSalesIndicators(data); break;
      case 'analyzeIndicators': result = analyzeIndicatorsAI(data); break;

      // --- LEADS ---
      case 'getLeads': result = getLeads(data); break;
      case 'addLead': result = addLead(data); break; 
      case 'deleteLead': result = deleteLead(data); break;
      case 'updateStatus': result = updateLeadStatus(data); break;
      case 'updateAgendamento': result = updateAgendamento(data); break; 
      case 'updateObservacao': result = updateObservacao(data); break;
      case 'getNotifications': result = getNotifications(data); break;
      case 'saveObjectionLead': result = saveObjectionLead(data); break;
      
      // --- OUTROS ---
      case 'getImages': 
      case 'getMaterials': result = getMaterials(data); break;
      case 'solveObjection': result = solveObjectionWithAI(data); break;
      case 'testPortfolios': result = testPortfolios(); break;
      case 'askAI': result = askInternalAI(data); break;
      case 'testKnowledge': result = testKnowledgeBase(); break;
      case 'testAI': result = testHybridAI(); break;
      case 'checkStalled': result = verificarLeadsParados(); break;
      case 'testWhatsapp': result = testCallMeBot(); break;
      case 'validateKey': result = validateGeminiKey(); break;
      case 'addVendor': result = addVendor(data); break;
      case 'delVendor': result = deleteVendor(data); break;
      case 'getVendors': result = getVendors(data); break;
      case 'testPermissions': result = testAllPermissions(); break;
    }

    output.setContent(JSON.stringify(result));
    return output;

  } catch (error) {
    output.setContent(JSON.stringify({ status: 'error', message: error.toString() }));
    return output;
  }
}

// ============================================================================
// 📊 INDICADORES E METAS (LÓGICA COMERCIAL)
// ============================================================================

function getSalesIndicators(d) {
  try {
    const vendedor = d.vendedor;
    if (!vendedor) return { status: 'error', message: 'Vendedor não informado' };

    // 1. Calcular Período Comercial (25 a 24)
    const hoje = new Date();
    let inicio, fim, mesReferencia;

    // Se hoje é >= 25, o mês comercial é o próximo
    if (hoje.getDate() >= 25) {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 25);
      fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 24);
      mesReferencia = Utilities.formatDate(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1), "GMT-3", "MMMM/yyyy");
    } else {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 25);
      fim = new Date(hoje.getFullYear(), hoje.getMonth(), 24);
      mesReferencia = Utilities.formatDate(hoje, "GMT-3", "MMMM/yyyy");
    }
    
    // Ajuste hora para comparação precisa
    inicio.setHours(0,0,0,0);
    fim.setHours(23,59,59,999);

    // 2. Calcular Dias Úteis Restantes
    const diasUteisInfo = calcularDiasUteis(new Date(), fim); // De hoje até o fim do ciclo

    // 3. Buscar Dados na Planilha (Aba Leads)
    // Estamos filtrando a aba GERAL por data, o que equivale a uma aba "Mês Atual" dinâmica
    const s = SpreadsheetApp.openById(CONFIG.PLANILHA_ID).getSheetByName(CONFIG.ABA_LEADS);
    const data = s.getRange(2, 1, s.getLastRow()-1, 15).getValues(); // Até coluna O

    let totalLeads = 0;
    let vendasFechadas = 0;

    data.forEach(row => {
      // Filtra por vendedor (case insensitive)
      if (String(row[2]).toLowerCase().trim() === vendedor.toLowerCase().trim()) {
        const dataLead = parseDate(row[0]); // Coluna A (Timestamp)
        
        // Verifica se está dentro do mês comercial
        if (dataLead >= inicio && dataLead <= fim) {
          totalLeads++;
          
          // Verifica Venda Fechada (Status na Coluna L ou Interesse na K)
          const status = String(row[11]); // Coluna L
          const interesse = String(row[10]); // Coluna K
          
          if (status === "Venda Fechada" || interesse === "VENDIDO") {
            vendasFechadas++;
          }
        }
      }
    });

    // Meta fixa (Idealmente viria da aba Vendedores, mas vamos fixar em 30 por enquanto)
    const metaIndividual = 30; 
    const porcentagem = Math.round((vendasFechadas / metaIndividual) * 100);

    return {
      status: 'success',
      data: {
        mes: mesReferencia.toUpperCase(),
        ciclo: `${Utilities.formatDate(inicio, "GMT-3", "dd/MM")} a ${Utilities.formatDate(fim, "GMT-3", "dd/MM")}`,
        totalLeads: totalLeads,
        vendas: vendasFechadas,
        meta: metaIndividual,
        porcentagem: porcentagem,
        diasUteisRestantes: diasUteisInfo.trabalhados // Dias úteis que faltam
      }
    };

  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

function analyzeIndicatorsAI(d) {
  try {
    const { vendas, meta, diasUteisRestantes } = d;
    const faltam = meta - vendas;
    
    const prompt = `
      Atue como Gerente Comercial da MHNET.
      Analise os dados do vendedor:
      - Meta: ${meta}
      - Vendas Fechadas: ${vendas}
      - Faltam para meta: ${faltam > 0 ? faltam : 0}
      - Dias úteis restantes para dia 24: ${diasUteisRestantes}
      
      Crie uma mensagem curta (max 35 palavras).
      Se estiver longe da meta, dê um "choque de realidade" motivador, dizendo quantas vendas por dia ele precisa fazer.
      Se estiver perto ou bateu, parabenize com entusiasmo.
      Use emojis.
    `;

    const resposta = callGeminiWithRetry({ contents: [{ parts: [{ text: prompt }] }] });
    return { status: 'success', message: resposta || "Foco total na meta! 🚀" };

  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

// --- HELPER DATAS ---

function calcularDiasUteis(inicio, fim) {
  let trabalhados = 0;
  const cursor = new Date(inicio);
  cursor.setHours(0,0,0,0);
  
  const fimData = new Date(fim);
  fimData.setHours(23,59,59,999);

  while (cursor <= fimData) {
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) { // 0=Dom, 6=Sab
      trabalhados++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { trabalhados };
}

function parseDate(dateStr) {
  if (dateStr instanceof Date) return dateStr;
  if (!dateStr) return new Date(0); 
  // Tenta parsear formato DD/MM/YYYY
  try {
    const parts = dateStr.split(' ')[0].split('/');
    if(parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
  } catch(e) {}
  return new Date(0);
}

// ... (MANTENHA TODAS AS OUTRAS FUNÇÕES EXISTENTES ABAIXO) ...
// (Copiar aqui: callGeminiWithRetry, deleteLead, saveObjectionLead, solveObjectionWithAI, etc...)
function callGeminiWithRetry(payload) { const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`; const options = { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true }; let tentativas = 0; while (tentativas < 3) { try { const response = UrlFetchApp.fetch(url, options); if (response.getResponseCode() === 429) throw new Error("QUOTA"); const json = JSON.parse(response.getContentText()); return json?.candidates?.[0]?.content?.parts?.[0]?.text; } catch (e) { tentativas++; Utilities.sleep(2000 * tentativas); } } }
function deleteLead(d){try{const s=SpreadsheetApp.openById(CONFIG.PLANILHA_ID).getSheetByName(CONFIG.ABA_LEADS);if(!s)return{status:'error',message:'Aba não encontrada'};const v=s.getRange(2,1,s.getLastRow()-1,4).getValues();for(let i=0;i<v.length;i++){if(String(v[i][2]).toLowerCase()===d.vendedor.toLowerCase()&&String(v[i][3]).toLowerCase()===d.nomeLead.toLowerCase()){s.deleteRow(i+2);return{status:'success',message:'Lead excluído com sucesso.'}}}return{status:'error',message:'Lead não encontrado para exclusão.'}}catch(e){return{status:'error',message:e.message}}}
function saveObjectionLead(d){try{const s=SpreadsheetApp.openById(CONFIG.PLANILHA_ID).getSheetByName(CONFIG.ABA_LEADS);const v=s.getRange(2,1,s.getLastRow()-1,4).getValues();for(let i=0;i<v.length;i++){if(String(v[i][2]).toLowerCase().includes(d.vendedor.toLowerCase())&&String(v[i][3]).toLowerCase().includes(d.nomeLead.toLowerCase())){s.getRange(i+2,18).setValue(d.objection);s.getRange(i+2,19).setValue(d.answer);return{status:'success',message:'Objeção salva!'}}}return{status:'error',message:'Lead não encontrado'}}catch(e){return{status:'error',message:e.message}}}
function solveObjectionWithAI(d){try{const o=d.objection||"";if(!o)return{status:'error',message:'Vazio'};const m=getObjectionMatrixContent();const p=`Atue como Especialista MHNET.\nMatriz:\n${m}\n\nCliente disse: "${o}"\nCrie script curto para combater.`;const r=callGeminiWithRetry({contents:[{parts:[{text:p}]}]});return{status:'success',answer:r||"Erro IA"};}catch(e){return{status:'error',message:e.message}}}
function getObjectionMatrixContent(){const c=CacheService.getScriptCache();const k=c.get("matrix_obj");if(k)return k;try{const s=SpreadsheetApp.openById(CONFIG.PLANILHA_ID);let h=s.getSheetByName(CONFIG.ABA_OBJECOES);if(!h){h=s.insertSheet(CONFIG.ABA_OBJECOES);h.appendRow(["Objeção","Argumento"])}const d=h.getDataRange().getValues();let t=d.map(r=>`${r[0]}: ${r[1]}`).join("\n");c.put("matrix_obj",t,600);return t}catch(e){return""}}
function getMaterials(d){/*Igual V77*/}
function testPortfolios(){/*Igual V77*/}
function updateLeadStatus(d){/*Igual V77*/}
function updateAgendamento(d){/*Igual V77*/}
function updateObservacao(d){/*Igual V77*/}
function getNotifications(d){/*Igual V77*/}
function askInternalAI(d){/*Igual V77*/}
function testKnowledgeBase(){/*Igual V77*/}
function testHybridAI(){/*Igual V77*/}
function verificarLeadsParados(){/*Igual V77*/}
function testCallMeBot(){/*Igual V77*/}
function validateGeminiKey(){/*Igual V77*/}
function addVendor(d){/*Igual V77*/}
function delVendor(d){/*Igual V77*/}
function deleteVendor(d){/*Igual V77*/}
function getVendors(d){/*Igual V77*/}
function testAllPermissions(){/*Igual V77*/}
function fd(v){if(!v)return"";if(v instanceof Date)return Utilities.formatDate(v,"GMT-3","dd/MM/yyyy HH:mm:ss");return String(v)}
function addLead(d){/*Igual V77*/}
function getLeads(d){/*Igual V77*/}
function notifyNewLead(d){/*Igual V77*/}
function notifyGestor(d){/*Igual V77*/}
function gerarDicaFechamentoIA(d){/*Igual V77*/}
function enviarWhatsApp(n,m){/*Igual V77*/}
function enviarWhatsAppCallMeBot(n,m,k,i){/*Igual V77*/}
