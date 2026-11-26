// app.js – cuida da tela (o cálculo fica no modelo.js)

// 1. Acha os elementos da página pelo id
const campoArquivo   = document.getElementById('arquivo');
const campoTipo      = document.getElementById('tipo');
const botaoPrever    = document.getElementById('botao-prever');
const areaResultado  = document.getElementById('resultado');
const textoResultado = document.getElementById('texto-resultado');

// 2. Diz o que fazer quando clicarem no botão
botaoPrever.addEventListener('click', aoClicarPrever);

async function aoClicarPrever() {
  const arquivo = campoArquivo.files[0];
  areaResultado.hidden = false;

  if (!arquivo) {
    textoResultado.textContent = 'Escolha primeiro a planilha do clima.';
    return;
  }

  try {
    const texto = await arquivo.text();
    const { dados, problemas } = lerCSV(texto);
    if (dados.datas.length === 0) throw new Error('nenhuma linha da planilha pôde ser lida.');

    let mensagem = calcularPrevisao(dados, campoTipo.value);

    if (problemas.length > 0) {
      mensagem += '\n\nAtenção: ' + problemas.length + ' linha(s) com problema foram puladas (linhas ' +
                  problemas.slice(0, 5).join(', ') + (problemas.length > 5 ? '...' : '') + ').';
    }
    textoResultado.textContent = mensagem;
  } catch (erro) {
    textoResultado.textContent = 'Não consegui calcular: ' + erro.message;
  }
}

// 3. Roda o motor e escreve o resultado em português
function calcularPrevisao(dados, tipo) {
  verificarPeriodo(dados.datas);
  const p = PARAMETROS_CONSENSO;

  // Graus-dia de cada dia
  const gd = dados.tmax.map((t, i) => grausDiaOmetto(t, dados.tmin[i], p.tb, p.TB));

  // Balanço hídrico conforme o tipo de pomar
  let excesso;
  if (tipo === 'sequeiro') {
    const etc = dados.eto.map(e => p.etcSequeiro * e);
    excesso = balancoThornthwaiteMather(dados.chuva, etc, p.cad);
  } else {
    const etc = dados.eto.map(e => p.kcIrrigado * e);
    excesso = balancoGotejoDuasFracoes(dados.chuva, dados.irrigacao, etc, p.cad, p.fracaoMolhada);
  }

  const r = preverFlorada(dados.datas, excesso, gd, p);
  const ano = dados.datas[0].slice(0, 4);
  const ultimoDia = dados.datas[dados.datas.length - 1];
  const anoCompleto = ultimoDia >= ano + '-12-31';

  // Caso normal: o modelo achou a florada
  if (!r.borda) {
    return 'Liberação da florada (primeiro dia com excesso de água): ' + formatarData(r.liberacao) + '\n' +
           'Florada prevista (plena florada, BBCH 65): ' + formatarData(r.florada);
  }

  // Ano inteiro e mesmo assim não chegou: regra de borda do protocolo
  if (anoCompleto) {
    return 'O modelo não chegou à florada dentro do ano.\n' +
           'Pela regra do protocolo, a data prevista fica em ' + formatarData(r.florada) + ' (data de borda).';
  }

  // Planilha no meio da safra, ainda sem liberação
  if (r.liberacao === null) {
    return 'Até ' + formatarData(ultimoDia) + ' ainda não houve a chuva (ou irrigação) que libera a florada.\n' +
           'A indução termina em 21/06; depois disso, a liberação vem no primeiro dia com excesso de água.';
  }

  // Planilha no meio da safra, já liberou: mostra quanto falta
  const iLib = dados.datas.indexOf(r.liberacao);
  let soma = 0;
  for (let i = iLib + p.defasagem; i < gd.length; i++) soma += gd[i];
  return 'Liberação da florada: ' + formatarData(r.liberacao) + '\n' +
         'Até ' + formatarData(ultimoDia) + ' a soma é de ' + Math.round(soma) + ' de ' + p.somaGD + ' graus-dia.\n' +
         'Carregue a planilha de novo com mais dias para ver a data prevista.';
}

// 4. Confere se a planilha serve para o modelo
function verificarPeriodo(datas) {
  const ano = datas[0].slice(0, 4);
  if (datas[0] !== ano + '-01-01') {
    throw new Error('a planilha tem que começar em 01/01, porque o balanço hídrico começa com o solo cheio nesse dia. ' +
                    'A sua começa em ' + formatarData(datas[0]) + '.');
  }
  for (let i = 1; i < datas.length; i++) {
    if (diaSeguinte(datas[i - 1]) !== datas[i]) {
      throw new Error('falta dia na planilha: depois de ' + formatarData(datas[i - 1]) +
                      ' vem ' + formatarData(datas[i]) + '.');
    }
  }
  if (datas[datas.length - 1] < ano + '-06-21') {
    throw new Error('a planilha precisa ir pelo menos até 21/06, o fim da indução.');
  }
}

// '2012-02-28' → '2012-02-29' (usa UTC para não ter problema de fuso horário)
function diaSeguinte(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// '2012-06-21' → '21/06/2012'
function formatarData(iso) {
  const [ano, mes, dia] = iso.split('-');
  return dia + '/' + mes + '/' + ano;
}