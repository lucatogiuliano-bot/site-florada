// app.js – cuida da tela (o cálculo fica no modelo.js)

// 1. Acha os elementos da página pelo id
const campoArquivo      = document.getElementById('arquivo');
const campoTipo         = document.getElementById('tipo');
const botaoPrever       = document.getElementById('botao-prever');
const areaResultado     = document.getElementById('resultado');
const conteudoResultado = document.getElementById('conteudo-resultado');

// 2. Diz o que fazer quando clicarem no botão
botaoPrever.addEventListener('click', aoClicarPrever);

async function aoClicarPrever() {
  const arquivo = campoArquivo.files[0];
  areaResultado.hidden = false;

  if (!arquivo) {
    conteudoResultado.innerHTML = '<p class="aviso">Escolha primeiro a planilha do clima.</p>';
    return;
  }

  try {
    const texto = await arquivo.text();
    const { dados, problemas } = lerCSV(texto);
    if (dados.datas.length === 0) throw new Error('nenhuma linha da planilha pôde ser lida.');

    const tipo = campoTipo.value;
    const r = calcularPrevisao(dados, tipo);
    let html = montarResultado(r, tipo);

    if (problemas.length > 0) {
      html += `<p class="aviso">Atenção: ${problemas.length} linha(s) com problema foram puladas
               (linhas ${problemas.slice(0, 5).join(', ')}${problemas.length > 5 ? '...' : ''}).</p>`;
    }
    conteudoResultado.innerHTML = html;
  } catch (erro) {
    conteudoResultado.innerHTML = `<p class="aviso">Não consegui calcular: ${erro.message}</p>`;
  }
}

// 3. Roda o motor e devolve um objeto com tudo o que a tela precisa
function calcularPrevisao(dados, tipo) {
  verificarPeriodo(dados.datas);
  const p = PARAMETROS_CONSENSO;

  const gd = dados.tmax.map((t, i) => grausDiaOmetto(t, dados.tmin[i], p.tb, p.TB));

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

  // Água que caiu no dia da liberação (chuva e irrigação)
  let aguaLiberacao = null;
  if (r.liberacao !== null) {
    const i = dados.datas.indexOf(r.liberacao);
    aguaLiberacao = { chuva: dados.chuva[i], irrigacao: dados.irrigacao[i] };
  }

  // Decide a situação
  if (!r.borda) {
    const f = FAIXAS_PREVISAO[tipo];
    return {
      situacao: 'prevista', liberacao: r.liberacao, florada: r.florada, aguaLiberacao,
      referencia: ano + '-' + DATA_REFERENCIA[tipo].dia,
      provavel: [somarDias(r.florada, -f.provavel[0]), somarDias(r.florada, f.provavel[1])],
      ampla:    [somarDias(r.florada, -f.ampla[0]),    somarDias(r.florada, f.ampla[1])]
    };
  }
  if (ultimoDia >= ano + '-12-31') {
    return { situacao: 'borda', liberacao: r.liberacao, florada: r.florada, aguaLiberacao };
  }
  if (r.liberacao === null) {
    return { situacao: 'sem-liberacao', ultimoDia };
  }
  const iLib = dados.datas.indexOf(r.liberacao);
  let soma = 0;
  for (let i = iLib + p.defasagem; i < gd.length; i++) soma += gd[i];
  return { situacao: 'somando', liberacao: r.liberacao, aguaLiberacao, ultimoDia, soma: Math.round(soma), meta: p.somaGD };
}

// 4. Transforma o objeto em HTML para a tela
function montarResultado(r, tipo) {
  if (r.situacao === 'sem-liberacao') {
    return `<p>Até <b>${formatarData(r.ultimoDia)}</b> ainda não houve a chuva (ou irrigação) que libera a florada.</p>
            <p class="detalhe">A indução termina em 21/06. Depois disso, a liberação vem no primeiro dia com excesso de água no solo.</p>`;
  }

  const textoAgua = `<p class="detalhe">Liberação da florada em <b>${formatarData(r.liberacao)}</b>
                     (${descreverAgua(r.aguaLiberacao)}).</p>`;

  if (r.situacao === 'somando') {
    const pct = Math.min(100, Math.round(100 * r.soma / r.meta));
    return `${textoAgua}
            <p>Até <b>${formatarData(r.ultimoDia)}</b>, a soma térmica está em <b>${r.soma} de ${r.meta} graus-dia</b>.</p>
            <div class="progresso"><div class="progresso-feito" style="width:${pct}%"></div></div>
            <p class="detalhe">Carregue a planilha de novo com mais dias para ver a data prevista.</p>`;
  }

  if (r.situacao === 'borda') {
    return `${r.liberacao ? textoAgua : ''}
            <p>O modelo não chegou à florada dentro do ano.</p>
            <p class="detalhe">Pela regra do protocolo, a data prevista fica em <b>${formatarData(r.florada)}</b> (data de borda). Use com cuidado.</p>`;
  }

  // situacao === 'prevista'
  let html = `<p class="rotulo">Florada prevista (plena florada)</p>
              <p class="data-grande">${formatarData(r.florada)}</p>
              ${montarLinhaDoTempo(r)}
              <ul class="legenda">
                <li><span class="cor cor-provavel"></span>Provável (5 em cada 10 floradas): ${formatarCurto(r.provavel[0])} a ${formatarCurto(r.provavel[1])}</li>
                <li><span class="cor cor-ampla"></span>Ampla (8 em cada 10 floradas): ${formatarCurto(r.ampla[0])} a ${formatarCurto(r.ampla[1])}</li>
                <li><span class="cor cor-referencia"></span>Data de referência, sem modelo: ${formatarCurto(r.referencia)}</li>
              </ul>
              ${textoAgua}
              ${montarComparacao(r, tipo)}`;
  if (tipo === 'sequeiro') {
    html += `<p class="detalhe">No sequeiro, o modelo costuma prever um pouco tarde: a florada tende a vir antes da data prevista.</p>`;
  }
  return html;
}

// Compara a previsão com a data de referência
function montarComparacao(r, tipo) {
  const dif = diasEntre(r.referencia, r.florada);    // positivo: previsão depois da referência
  let posicao;
  if (dif === 0) posicao = 'cai no mesmo dia da';
  else if (dif > 0) posicao = `fica ${dif} dia(s) depois da`;
  else posicao = `fica ${-dif} dia(s) antes da`;

  let explicacao;
  if (tipo === 'irrigado') {
    explicacao = 'Em pomar irrigado, o modelo acerta a época média, mas acompanha pouco a diferença entre safras. ' +
                 'Na maioria dos anos, a previsão fica perto da data de referência, e as duas erram parecido.';
  } else {
    explicacao = 'No sequeiro, a chuva muda de ano para ano e o modelo acompanha essa mudança. ' +
                 'É aqui que ele mais se afasta da data de referência e onde mais ajuda.';
  }
  return `<div class="comparacao">
            <p>A previsão ${posicao} data de referência (<b>${formatarCurto(r.referencia)}</b>, ${DATA_REFERENCIA[tipo].texto}).</p>
            <p class="detalhe">${explicacao}</p>
          </div>`;
}

// Barra com as duas faixas, um traço na data prevista e outro na data de referência
function montarLinhaDoTempo(r) {
  // A barra vai da data mais cedo à mais tarde (faixa ampla ou referência), com 5 dias de folga
  const primeiro = r.referencia < r.ampla[0] ? r.referencia : r.ampla[0];
  const ultimo   = r.referencia > r.ampla[1] ? r.referencia : r.ampla[1];
  const inicio = somarDias(primeiro, -5);
  const total  = diasEntre(inicio, somarDias(ultimo, 5));
  const pos = iso => (100 * diasEntre(inicio, iso) / total).toFixed(1) + '%';
  const larg = (a, b) => (100 * diasEntre(a, b) / total).toFixed(1) + '%';

  return `<div class="linha-tempo">
            <div class="faixa faixa-ampla"    style="left:${pos(r.ampla[0])};    width:${larg(r.ampla[0], r.ampla[1])}"></div>
            <div class="faixa faixa-provavel" style="left:${pos(r.provavel[0])}; width:${larg(r.provavel[0], r.provavel[1])}"></div>
            <div class="marcador marcador-referencia" style="left:${pos(r.referencia)}"></div>
            <div class="marcador" style="left:${pos(r.florada)}"></div>
          </div>`;
}

function descreverAgua(a) {
  const partes = [];
  if (a.chuva > 0) partes.push(a.chuva.toFixed(1).replace('.', ',') + ' mm de chuva');
  if (a.irrigacao > 0) partes.push(a.irrigacao.toFixed(1).replace('.', ',') + ' mm de irrigação');
  return partes.length > 0 ? partes.join(' e ') : 'água acumulada no solo';
}

// 5. Confere se a planilha serve para o modelo
function verificarPeriodo(datas) {
  const ano = datas[0].slice(0, 4);
  if (datas[0] !== ano + '-01-01') {
    throw new Error('a planilha tem que começar em 01/01, porque o balanço hídrico começa com o solo cheio nesse dia. ' +
                    'A sua começa em ' + formatarData(datas[0]) + '.');
  }
  for (let i = 1; i < datas.length; i++) {
    if (somarDias(datas[i - 1], 1) !== datas[i]) {
      throw new Error('falta dia na planilha: depois de ' + formatarData(datas[i - 1]) +
                      ' vem ' + formatarData(datas[i]) + '.');
    }
  }
  if (datas[datas.length - 1] < ano + '-06-21') {
    throw new Error('a planilha precisa ir pelo menos até 21/06, o fim da indução.');
  }
}

// 6. Funções de data (sempre no formato 'AAAA-MM-DD', em UTC)
function somarDias(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diasEntre(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

function formatarData(iso) {           // '2012-06-21' → '21/06/2012'
  const [ano, mes, dia] = iso.split('-');
  return dia + '/' + mes + '/' + ano;
}

function formatarCurto(iso) {          // '2012-06-21' → '21/06'
  const [, mes, dia] = iso.split('-');
  return dia + '/' + mes;
}
