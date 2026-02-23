const usuario = JSON.parse(sessionStorage.getItem("usuario"));

if (!usuario) {
  alert("Sessão expirada. Faça login novamente.");
  window.location.href = "index.html";
}

if (usuario.perfil !== "ADM") {
  alert("Acesso restrito à administração");
  window.location.href = "index.html";
  
}
const { jsPDF } = window.jspdf;

function $(id){ return document.getElementById(id); }

const admin = JSON.parse(sessionStorage.getItem("usuario"));
if (!admin || admin.perfil !== "ADM") {
  alert("Acesso não autorizado");
  window.location.href = "index.html";
}
function formatarDataBR(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

/* BOAS-VINDAS */
$("boasVindas").innerHTML =
  `<h3>SEJA BEM-VINDO, ${admin.graduacao} ${admin.nome_completo}</h3>`;
 telaInicial("dashboard");

/* CONTROLE DE TELAS */
function mostrar(id) {

  // esconde dashboard
  const dashboard = document.getElementById("dashboard");
  if (dashboard) dashboard.style.display = "none";

  // esconde todas as telas
  [
    "cadastro",
    "pontos",
    "compensar",
    "consulta",
    "resetSenhaBox",
    "ranking",
    "compensacoes"
  ].forEach(div => {
    const el = document.getElementById(div);
    if (el) el.style.display = "none";
  });

  // mostra somente a tela clicada
  const el = document.getElementById(id);
  if (el) el.style.display = "block";
}


/* LOGOUT */
function logout() {
  sessionStorage.removeItem("usuario");
  window.location.href = "index.html";
}

async function gerarHashSenha(senha) {
  const encoder = new TextEncoder();
  const data = encoder.encode(senha);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
async function buscarPolicialReset() {

  const matricula = document.getElementById("resetMatricula").value
    .trim()
    .toUpperCase();

  if (!matricula) return;

  const { data, error } = await supabaseClient
    .from("usuarios")
    .select("nome_completo")
    .eq("matricula", matricula)
    .eq("perfil", "POLICIAL")
    .single();

  if (error || !data) {
    alert("Policial não encontrado");
    document.getElementById("resetNome").value = "";
    return;
  }

  document.getElementById("resetNome").value = data.nome_completo;
}
function renovarSessao() {
  const usuario = JSON.parse(sessionStorage.getItem("usuario"));
  if (usuario) {
    usuario.loginTime = Date.now();
    sessionStorage.setItem("usuario", JSON.stringify(usuario));
  }
}

document.addEventListener("click", renovarSessao);


async function resetarSenhaPolicial() {

  const matricula = document.getElementById("resetMatricula").value
    .trim()
    .toUpperCase();

  const nome = document.getElementById("resetNome").value;
  const senha = document.getElementById("resetSenha").value;
  const senhaConf = document.getElementById("resetSenhaConf").value;

  if (!matricula || !nome) {
    alert("Informe uma matrícula válida");
    return;
  }

  if (!senha || !senhaConf) {
    alert("Informe a nova senha");
    return;
  }

  if (senha !== senhaConf) {
    alert("As senhas não conferem");
    return;
  }

  const senhaHash = await gerarHashSenha(senha);

   // 🔐 Chamada RPC ao invés de update direto
  const { data, error } = await supabaseClient.rpc("resetar_senha", {
    p_matricula: matricula,
    p_nova_senha: senhaHash
  });

  if (error) {
    alert("Erro ao redefinir senha");
    return;
  }

  alert(`Senha redefinida com sucesso para ${nome}`);

  document.getElementById("resetMatricula").value = "";
  document.getElementById("resetNome").value = "";
  document.getElementById("resetSenha").value = "";
  document.getElementById("resetSenhaConf").value = "";
}




/* CADASTRAR POLICIAL */
async function cadastrarPolicial() {

  if (cadSenha.value !== cadSenhaConf.value) {
    alert("As senhas não conferem");
    return;
  }

  const senhaHash = await gerarHashSenha(cadSenha.value);

  const { data, error } = await supabaseClient.rpc("inserir_usuario", {
    p_matricula: cadMat.value.trim().toUpperCase(),
    p_nome_completo: cadNome.value.trim().toUpperCase(),
    p_graduacao: cadGrad.value,
    p_opm: cadOpm.value.trim().toUpperCase(),
    p_senha_hash: senhaHash,
    p_perfil: "POLICIAL"
  });

  if (error) return alert(error.message);

  alert("Policial cadastrado com sucesso");

  cadMat.value = "";
  cadNome.value = "";
  cadSenha.value = "";
  cadSenhaConf.value = "";
  cadOpm.value = "";
}

function abrirResetSenha() {
  document.getElementById("resetSenhaBox").style.display = "block";
}


/* BUSCAR NOME */
async function buscarNome(valor, destino) {

  const div = document.getElementById(destino);
  div.innerHTML = "";

  if (!valor) return;

  // Quebra por vírgula
  const matriculas = valor
    .split(",")
    .map(m => m.trim())
    .filter(m => m);

  if (!matriculas.length) return;

  // Busca todos de uma vez
  const { data, error } = await supabaseClient
    .from("usuarios")
    .select("matricula, graduacao, nome_completo")
    .in("matricula", matriculas);

  if (error) {
    div.innerHTML = "<span style='color:red'>Erro na consulta</span>";
    return;
  }

  let html = "<strong>Policiais envolvidos:</strong><br>";

  matriculas.forEach(mat => {
    const achou = data.find(u => u.matricula === mat);

    if (achou) {
      html += `• ${achou.graduacao} ${achou.nome_completo}<br>`;
    } else {
      html += `<span style="color:red">⚠ Matrícula ${mat} não cadastrada</span><br>`;
    }
  });

  div.innerHTML = html;
}

/* LANÇAR PONTOS */
async function cadastrarPonto() {

  if (!pontMat.value) return alert("Informe a(s) matrícula(s)");

  const matriculas = pontMat.value
    .split(",")
    .map(m => m.trim().toUpperCase())
    .filter(m => m);

  if (!matriculas.length) {
    alert("Nenhuma matrícula válida informada");
    return;
  }

  if (!pontData.value) {
    alert("Informe a data do lançamento");
    return;
  }

  if (!pontHora.value) {
    alert("Informe o horário do lançamento");
    return;
  }

  if (!pontProc.value.trim()) {
    alert("Informe o número do procedimento");
    return;
  }

  if (!pontInfo.value.trim()) {
    alert("Informe a observação");
    return;
  }

  // ===== VALIDA DATA =====
  const hoje = new Date().toISOString().split("T")[0];
  if (pontData.value > hoje) {
    alert("A data do lançamento não pode ser posterior à data atual");
    return;
  }

  const tiposCincoPontos = [
    "APF - MANDADO DE PRISÃO",
    "VEÍCULO ENCONTRADO"
  ];

  let pontos = 0;
  let quantidadeArmas = 1;

  if (pontTipo.value === "ARMA") {

    quantidadeArmas = parseInt(pontQtdArmas.value);

    if (isNaN(quantidadeArmas) || quantidadeArmas <= 0) {
      alert("Informe a quantidade de armas corretamente");
      return;
    }

    pontos = quantidadeArmas * 10;

  } else {
    pontos = tiposCincoPontos.includes(pontTipo.value) ? 5 : 10;
  }

  // Buscar policiais
  const { data: usuarios } = await supabaseClient
    .from("usuarios")
    .select("matricula")
    .in("matricula", matriculas);

  if (!usuarios || usuarios.length !== matriculas.length) {
    alert("Uma ou mais matrículas não estão cadastradas");
    return;
  }

  let sucesso = 0;

  for (let mat of matriculas) {
    const { error } = await supabaseClient.rpc("inserir_pontuacao", {
      p_matricula: mat,
      p_tipo: pontTipo.value,
      p_pontos: pontos,
      p_data: pontData.value,
      p_horario: pontHora.value,
      p_numero_procedimento: pontProc.value,
      p_info: pontInfo.value
    });

    if (!error) sucesso++;
    else console.error(`Erro ao lançar pontuação para ${mat}:`, error);
  }

  alert(`Pontuação lançada para ${sucesso} policial(is)`);

  // LIMPEZA
  pontMat.value = "";
  pontData.value = "";
  pontHora.value = "";
  pontProc.value = "";
  pontInfo.value = "";
  pontQtdArmas.value = 1;
  document.getElementById("campoQtdArmas").style.display = "none";
  $("nomePolicial").innerHTML = "";
}


/* COMPENSAÇÃO */
async function verificarCompensacao(){
  const mat = compMat.value;

  const { data:user } = await supabaseClient
    .from("usuarios").select("id")
    .eq("matricula", mat).single();
  if(!user) return alert("Matrícula não cadastrada");

  const { data:p } = await supabaseClient
    .from("pontuacoes").select("pontos").eq("matricula",mat);
  const { data:c } = await supabaseClient
    .from("compensacoes").select("pontos_utilizados").eq("matricula",mat);

  const totalP = p.reduce((s,x)=>s+x.pontos,0);
  const totalC = c?c.reduce((s,x)=>s+x.pontos_utilizados,0):0;
  const saldo = totalP-totalC;

  if(saldo<40){
    compResultado.innerHTML=`<span style="color:red">Saldo insuficiente: ${saldo}</span>`;
    return;
  }
  compResultado.innerHTML=`Saldo disponível: <b>${saldo}</b><br><button onclick="compensarFolga()">CONFIRMAR</button>`;
}

 async function compensarFolga() {
  const codigo = "2BPM-" + Math.random().toString(36)
  .substr(2, 8)
  .toUpperCase();
  if (!compData.value) {
    alert("Informe a data da folga");
    return;
  }

  if (!compCmd.value) {
    alert("Informe o comandante autorizador");
    return;
  }

  const matricula = compMat.value;
  const dataNova = new Date(compData.value);

  /* 🔍 BUSCA ÚLTIMA COMPENSAÇÃO */
  const { data: ultimas, error: erroBusca } = await supabaseClient
    .from("compensacoes")
    .select("data_compensacao")
    .eq("matricula", matricula)
    .order("data_compensacao", { ascending: false })
    .limit(1);

  if (erroBusca) {
    alert("Erro ao verificar compensações anteriores");
    return;
  }

  if (ultimas && ultimas.length > 0) {
    const dataUltima = new Date(ultimas[0].data_compensacao);

    const diffDias =
      (dataNova - dataUltima) / (1000 * 60 * 60 * 24);

    if (diffDias < 23) {
      alert(
        `⚠️ Compensação não permitida.\nÚltima folga há ${Math.floor(diffDias)} dias.\nÉ necessário aguardar 23 dias.`
      );
      return;
    }
  }

  /* ✅ INSERE COMPENSAÇÃO VIA RPC */
const { error } = await supabaseClient.rpc("inserir_compensacao", {
  p_matricula: matricula,
  p_pontos_utilizados: 40,
  p_data_compensacao: compData.value,
  p_comandante_autorizador: compCmd.value,
  p_codigo_controle: codigo
});

  if (error) {
    alert(error.message);
    return;
  }

  alert("Folga compensada com sucesso");

  gerarPDFCompensacao({
    policial: document.getElementById("nomeComp").innerText,
    matricula: matricula,
    comandante: compCmd.value,
    data: compData.value,
    codigo: codigo
  });

  /* LIMPA CAMPOS */
  compMat.value = "";
  compCmd.value = "";
  compData.value = "";
  compResultado.innerHTML = "";
  nomeComp.innerHTML = "";

}


/* PDF COMPENSAÇÃO */
const nomeLimpo = document
  .getElementById("nomeComp")
  .innerText
  .replace("Policiais envolvidos:", "")
  .replace("•", "")
  .trim();

function gerarPDFCompensacao(d) {

  const jsPDF = window.jspdf.jsPDF;
  const doc = new jsPDF("p", "mm", "a4");

  const margemX = 20;
  let y = 20;

  const azulPM = [0, 51, 102];
  const cinzaClaro = [230, 230, 230];

  /* ===== CABEÇALHO ===== */
  doc.setFillColor(...azulPM);
  doc.rect(0, 0, 210, 30, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("POLÍCIA MILITAR DO RIO GRANDE DO NORTE", 105, 15, { align: "center" });
  doc.setFontSize(11);
  doc.text("2º BATALHÃO DE POLÍCIA MILITAR", 105, 22, { align: "center" });

  /* ===== TÍTULO ===== */
  y = 45;
  doc.setTextColor(0);
  doc.setFontSize(13);
  doc.text("TERMO DE COMPENSAÇÃO DE FOLGA", 105, y, { align: "center" });

  /* ===== BLOCO DE DADOS ===== */
  y += 12;
  doc.setFillColor(...cinzaClaro);
  doc.rect(margemX - 2, y - 6, 170, 60, "F");

  doc.setFontSize(11);
  doc.setTextColor(0);

  doc.text(`${d.policial}`, margemX, y);
  y += 10;
  doc.text(`Matrícula: ${d.matricula}`, margemX, y);
  y += 10;
  doc.text(`Pontos Utilizados: 40`, margemX, y);
  y += 10;
  doc.text(`Data da Folga: ${formatarDataBR(d.data)}`, margemX, y);
  y += 10;
  doc.text(`Comandante Autorizador: ${d.comandante}`, margemX, y);

  /* ===== TEXTO FORMAL ===== */
  y += 15;
  doc.setFontSize(10);
  doc.text(
    "Declaro, para os devidos fins, que a compensação de folga acima descrita " +
    "foi concedida conforme normas internas do 2º Batalhão de Polícia Militar, " +
    "observando-se o saldo mínimo de pontos exigido.",
    margemX,
    y,
    { maxWidth: 170, align: "justify" }
  );

  /* ===== ASSINATURA ===== */
y += 35;

// linha centralizada
doc.line(65, y, 145, y); // 80 mm de largura, centrada

y += 5;

// texto centralizado
doc.text("Policial Militar", 105, y, { align: "center" });

  /* ===== CÓDIGO DE CONTROLE ===== */
  y += 15;
  doc.setFontSize(9);
  doc.text(`Código de controle: ${d.codigo}`, margemX, y);

  /* ===== FINAL ===== */
  doc.save(`Compensacao_Folga_${d.matricula}.pdf`);
}



/* CONSULTA */
let dadosConsulta = [];

 async function consultarPontos(){

  const matFiltro = consMat.value || null;

  const opmFiltro = document.getElementById("filtroOpm")?.value || null;

 /* USUÁRIOS */
let qUser = supabaseClient
  .from("usuarios")
  .select("matricula, nome_completo, opm")
  

 if (matFiltro) qUser = qUser.eq("matricula", matFiltro);
 if (opmFiltro) qUser = qUser.eq("opm", opmFiltro);


  if (matFiltro) qUser = qUser.eq("matricula", matFiltro);
  const dataInicio = document.getElementById("dataInicio")?.value || null;
const dataFim = document.getElementById("dataFim")?.value || null;

  const { data: usuarios } = await qUser;
  if (!usuarios || usuarios.length === 0) {
    $("resultadoConsulta").innerHTML = "Nenhum registro encontrado";
    return;
  }

  /* PONTUAÇÕES */
  let qPont = supabaseClient
  .from("pontuacoes")
  .select(`
    matricula,
    tipo,
    pontos,
    data,
    numero_procedimento,
    info_adicional
  `);

if (dataInicio) qPont = qPont.gte("data", dataInicio);
if (dataFim) qPont = qPont.lte("data", dataFim);

const { data: pontuacoes } = await qPont;


  /* COMPENSAÇÕES */
  let qComp = supabaseClient
  .from("compensacoes")
  .select("matricula, pontos_utilizados, data_compensacao");

if (dataInicio) qComp = qComp.gte("data_compensacao", dataInicio);
if (dataFim) qComp = qComp.lte("data_compensacao", dataFim);

const { data: compensacoes } = await qComp;


  let html = `
    <table>
      <tr>
        <th>Matrícula</th>
        <th>Nome</th>
        <th>Tipo</th>
        <th>Movimentação</th>
        <th>Data</th>
        <th>Pontos</th>
      </tr>
  `;

  dadosConsulta = [];

  usuarios.forEach(u => {

    let totalP = 0;
    let totalC = 0;

    /* ===== JUNTA MOVIMENTAÇÕES ===== */
    let movimentos = [];

    pontuacoes
      .filter(p => p.matricula === u.matricula)
      .forEach(p => {
        totalP += p.pontos;
        movimentos.push({
      tipo: p.tipo,
      mov: "ADIÇÃO",
      data: p.data,
      pontos: p.pontos,
      numero_procedimento: p.numero_procedimento,
      info_adicional: p.info_adicional
      });

      });

    compensacoes
      .filter(c => c.matricula === u.matricula)
      .forEach(c => {
        totalC += c.pontos_utilizados;
        movimentos.push({
          tipo: "FOLGA",
          mov: "COMPENSAÇÃO",
          data: c.data_compensacao,
          pontos: -c.pontos_utilizados
        });
      });

    /* ===== ORDENA POR DATA ===== */
    movimentos.sort((a, b) => new Date(a.data) - new Date(b.data));

    /* ===== MONTA LINHAS ===== */
    movimentos.forEach(m => {

      const classe = m.mov === "COMPENSAÇÃO" ? "comp" : "";

      html += `
        <tr class="${classe}">
          <td>${u.matricula}</td>
          <td>${u.nome_completo}</td>
          <td>${m.tipo}</td>
          <td>${m.mov}</td>
          <td>${formatarDataBR(m.data)}</td>
          <td>${m.pontos}</td>
        </tr>
      `;

      dadosConsulta.push({
      matricula: u.matricula,
      nome: u.nome_completo,
      tipo: m.tipo,
      mov: m.mov,
      data: m.data,
      pontos: m.pontos,
      numero_procedimento: m.numero_procedimento,
      info_adicional: m.info_adicional
    });

    });

    /* ===== SALDO ===== */
    const saldo = totalP - totalC;

    html += `
      <tr class="saldo">
        <td colspan="5">SALDO ATUAL – ${u.nome_completo}</td>
        <td>${saldo}</td>
      </tr>
    `;
  });

  html += "</table>";
  $("resultadoConsulta").innerHTML = html;
  consMat.value = "";
  document.getElementById("dataInicio").value = "";
 document.getElementById("dataFim").value = "";
 document.getElementById("filtroOpm").value = "";

}


/* =========================
   TELA INICIAL / LIMPAR
========================= */
function telaInicial(id = "dashboard") {
  ["cadastro", "pontos", "compensar", "consulta", "resetSenhaBox", "ranking", "compensacoes" ].forEach(div => {
    const el = document.getElementById(div);
    if (el) el.style.display = "none";
  });
  // esconde dashboard
  const dash = document.getElementById("dashboard");
  if (dash) dash.style.display = "none";

  // mostra a tela solicitada
  const alvo = document.getElementById(id);
  if (alvo) alvo.style.display = "block";
}
let dadosCompensacoes = [];

function linhaPDF(doc, x, y, cols, larguras, fundo = null, corTexto = [0,0,0]) {

  // Fundo da linha (se existir)
  if (fundo) {
    doc.setFillColor(...fundo);
    doc.rect(x, y - 4, larguras.reduce((a,b)=>a+b), 6, "F");
  }

  let posX = x;
  doc.setTextColor(...corTexto);

  cols.forEach((txt, i) => {
    doc.text(String(txt ?? "-"), posX + 1, y);
    posX += larguras[i];
  });
}
function gerarPDFConsulta() {

  if (!dadosConsulta || !dadosConsulta.length) {
    alert("Sem dados para gerar relatório");
    return;
  }

  const jsPDF = window.jspdf.jsPDF;
  const doc = new jsPDF("p", "mm", "a4");

  const margemX = 12;
  let y = 20;
  const larguras = [25, 45, 30, 40, 40];

  /* TÍTULO */
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("RELATÓRIO DE PONTUAÇÃO – 2º BPM", 105, 12, { align: "center" });

  const militares = {};

  /* AGRUPA PONTUAÇÕES */
  dadosConsulta.forEach(p => {
    if (!militares[p.matricula]) {
      militares[p.matricula] = {
        nome: p.nome,
        pontuacoes: [],
        compensacoes: [],
        saldo: 0
      };
    }
    militares[p.matricula].pontuacoes.push(p);
    militares[p.matricula].saldo += Number(p.pontos);
  });

  /* AGRUPA COMPENSAÇÕES */
  if (dadosCompensacoes) {
    dadosCompensacoes.forEach(c => {
      if (militares[c.matricula]) {
        militares[c.matricula].compensacoes.push(c);
        militares[c.matricula].saldo -= Number(c.pontos_utilizados);
      }
    });
  }

  Object.keys(militares).forEach(matricula => {

    const m = militares[matricula];

    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    /* CABEÇALHO DO MILITAR */
    doc.setFillColor(230, 230, 230);
    doc.rect(margemX, y, 186, 8, "F");
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Matrícula: ${matricula} | Nome: ${m.nome}`, margemX + 2, y + 5);
    y += 12;

    /* ===== PONTUAÇÕES ===== */
    doc.setFontSize(10);
    doc.setTextColor(0, 51, 102);
    doc.text("PONTUAÇÕES", margemX, y);
    y += 6;

    /* CABEÇALHO DA TABELA */
    doc.setFontSize(9);
    linhaPDF(
      doc,
      margemX,
      y,
      ["Data", "Tipo", "Mov.", "Procedimento", "Observação"],
      larguras,
      [0, 51, 102],       // AZUL INSTITUCIONAL
      [255, 255, 255]    // TEXTO BRANCO
    );
    y += 6;

    /* LINHAS DE PONTUAÇÃO */
    m.pontuacoes.forEach((p, i) => {

      const fundoLinha = i % 2 === 0 ? [245, 245, 245] : null;

      linhaPDF(
        doc,
        margemX,
        y,
        [
          p.data,
          p.tipo,
          `+${p.pontos}`,
          p.numero_procedimento || "-",
          p.info_adicional || "-"
        ],
        larguras,
        fundoLinha,
        [0, 0, 0]
      );

      y += 5;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    /* ===== COMPENSAÇÕES ===== */
    if (m.compensacoes.length) {

      y += 6;
      doc.setFontSize(10);
      doc.setTextColor(128, 0, 0);
      doc.text("COMPENSAÇÕES", margemX, y);
      y += 6;

      linhaPDF(
        doc,
        margemX,
        y,
        ["Data", "Tipo", "Mov.", "Procedimento", "Comandante"],
        larguras,
        [128, 0, 0],       // VERMELHO INSTITUCIONAL
        [255, 255, 255]
      );
      y += 6;

      m.compensacoes.forEach((c, i) => {

        const fundoLinha = i % 2 === 0 ? [255, 235, 235] : null;

        linhaPDF(
          doc,
          margemX,
          y,
          [
            c.data_compensacao,
            "FOLGA",
            `-${c.pontos_utilizados}`,
            "-",
            c.comandante_autorizador
          ],
          larguras,
          fundoLinha,
          [0, 0, 0]
        );

        y += 5;
      });
    }

    /* ===== SALDO ===== */
    y += 6;
    doc.setFontSize(11);
    doc.setTextColor(m.saldo >= 0 ? 0 : 150, m.saldo >= 0 ? 100 : 0, 0);
    doc.text(`SALDO ATUAL: ${m.saldo} PONTOS`, margemX, y);

    y += 15;
  });

  doc.save("Relatorio_Pontuacao_Geral_2BPM.pdf");
}

async function carregarDashboard() {

  /* USUÁRIOS */
  const { data: usuarios } = await supabaseClient
    .from("usuarios")
    .select("matricula, nome_completo")
    

  /* PONTUAÇÕES */
  const { data: pontos } = await supabaseClient
    .from("pontuacoes")
    .select("matricula, pontos");

  /* COMPENSAÇÕES */
  const { data: compensacoes } = await supabaseClient
    .from("compensacoes")
    .select("matricula, pontos_utilizados")
    
    

  if (!usuarios) return;

  let totalPontosBPM = 0;
  let totalFolgas = compensacoes?.length || 0;

  const mapa = {};

  usuarios.forEach(u => {
    mapa[u.matricula] = {
      nome: u.nome_completo,
      pontos: 0,
      usados: 0
    };
  });

  pontos?.forEach(p => {
    if (mapa[p.matricula]) {
      mapa[p.matricula].pontos += p.pontos;
      totalPontosBPM += p.pontos;
    }
  });

  compensacoes?.forEach(c => {
    if (mapa[c.matricula]) {
      mapa[c.matricula].usados += c.pontos_utilizados;
    }
  });

  let aptos = [];

  Object.keys(mapa).forEach(mat => {
    const saldo = mapa[mat].pontos - mapa[mat].usados;
    if (saldo >= 40) {
      aptos.push({
        matricula: mat,
        nome: mapa[mat].nome,
        saldo
      });
    }
  });

  /* ATUALIZA CARDS */
  $("dashTotalPoliciais").innerText = usuarios.length;
  $("dashAptos").innerText = aptos.length;
  $("dashPontos").innerText = totalPontosBPM;
  $("dashFolgas").innerText = totalFolgas;

  /* LISTA APTOS */
  let html = `
    <table>
      <tr>
        <th>Matrícula</th>
        <th>Nome</th>
        <th>Saldo</th>
      </tr>
  `;

  aptos.forEach(a => {
    html += `
      <tr>
        <td>${a.matricula}</td>
        <td>${a.nome}</td>
        <td>${a.saldo}</td>
      </tr>
    `;
  });

  html += "</table>";

  $("listaAptos").innerHTML = html;
}
function verificarTipoPontuacao() {
  const tipo = pontTipo.value;
  const campo = document.getElementById("campoQtdArmas");

  if (tipo === "ARMA") {
    campo.style.display = "block";
  } else {
    campo.style.display = "none";
    pontQtdArmas.value = 1;
  }
}
async function buscarRanking() {

  const dataInicio = document.getElementById("rankInicio").value;
  const dataFim = document.getElementById("rankFim").value;

  if (!dataInicio || !dataFim) {
    alert("Informe o período inicial e final");
    return;
  }


  /* 1️⃣ Buscar policiais da OPM */
  const { data: usuarios } = await supabaseClient
    .from("usuarios")
    .select("matricula, nome_completo")
    
  if (!usuarios || usuarios.length === 0) {
    document.getElementById("resultadoRanking").innerHTML =
      "Nenhum policial encontrado";
    return;
  }

  const matriculas = usuarios.map(u => u.matricula);

  /* 2️⃣ Buscar pontuações no período (SEM COMPENSAÇÃO) */
  const { data: pontuacoes } = await supabaseClient
    .from("pontuacoes")
    .select("matricula, pontos")
    .in("matricula", matriculas)
    .gte("data", dataInicio)
    .lte("data", dataFim);

  if (!pontuacoes || pontuacoes.length === 0) {
    document.getElementById("resultadoRanking").innerHTML =
      "Nenhuma pontuação no período";
    return;
  }

  /* 3️⃣ Soma pontos por policial */
  const ranking = {};

  pontuacoes.forEach(p => {
    if (!ranking[p.matricula]) {
      ranking[p.matricula] = 0;
    }
    ranking[p.matricula] += p.pontos;
  });

  /* 4️⃣ Junta nome + pontos */
  const resultado = usuarios.map(u => ({
    nome: u.nome_completo,
    pontos: ranking[u.matricula] || 0
  }));

  /* 5️⃣ Ordena e pega TOP 3 */
  const top3 = resultado
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 3);

  /* 6️⃣ Exibe */
  let html = `
    <table>
      <tr>
        <th>Posição</th>
        <th>Policial</th>
        <th>Pontos</th>
      </tr>
  `;

  top3.forEach((p, i) => {
    html += `
      <tr>
        <td>${i + 1}º</td>
        <td>${p.nome}</td>
        <td>${p.pontos}</td>
      </tr>
    `;
  });

  html += "</table>";

  document.getElementById("resultadoRanking").innerHTML = html;
}

async function buscarCompensacoes() {

  const matricula = document.getElementById("compBuscaMat").value || null;
  const dataIni = document.getElementById("compDataInicio").value || null;
  const dataFim = document.getElementById("compDataFim").value || null;
  const codigo = document.getElementById("compCodigoBusca").value || null;

  let query = supabaseClient
    .from("compensacoes")
    .select(`
      matricula,
      data_compensacao,
      comandante_autorizador,
      codigo_controle
    `)
    .order("data_compensacao", { ascending: false });

  if (matricula) query = query.eq("matricula", matricula);
  if (codigo) query = query.eq("codigo_controle", codigo);
  if (dataIni) query = query.gte("data_compensacao", dataIni);
  if (dataFim) query = query.lte("data_compensacao", dataFim);

  const { data: compensacoes, error } = await query;

  if (error || !compensacoes || compensacoes.length === 0) {
    document.getElementById("resultadoCompensacoes").innerHTML =
      "Nenhuma compensação encontrada";
    return;
  }

  /* =========================
     BUSCA NOMES DOS POLICIAIS
  ========================= */

  const matriculas = [...new Set(compensacoes.map(c => c.matricula))];

  const { data: usuarios } = await supabaseClient
    .from("usuarios")
    .select("matricula, nome_completo")
    .in("matricula", matriculas);

  const mapaNomes = {};
  usuarios.forEach(u => {
    mapaNomes[u.matricula] = u.nome_completo;
  });

  /* =========================
     MONTA TABELA
  ========================= */

  let html = `
    <table>
      <tr>
        <th>Matrícula</th>
        <th>Nome do Policial</th>
        <th>Data da Folga</th>
        <th>Comandante Autorizador</th>
        <th>Código de Controle</th>
      </tr>
  `;

  compensacoes.forEach(c => {
    html += `
      <tr>
        <td>${c.matricula}</td>
        <td>${mapaNomes[c.matricula] || "—"}</td>
        <td>${formatarDataBR(c.data_compensacao)}</td>
        <td>${c.comandante_autorizador}</td>
        <td>${c.codigo_controle}</td>
      </tr>
    `;
  });

  html += "</table>";

  document.getElementById("resultadoCompensacoes").innerHTML = html;
}




carregarDashboard();



  


