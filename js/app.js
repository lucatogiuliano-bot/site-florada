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
    const texto = await arquivo.text();          // lê o arquivo como texto
    const { dados, problemas } = lerCSV(texto);

    const n = dados.datas.length;
    if (n === 0) throw new Error('Nenhuma linha da planilha pôde ser lida.');

    let mensagem = 'Li ' + n + ' dias, de ' + formatarData(dados.datas[0]) +
                   ' a ' + formatarData(dados.datas[n - 1]) + '.';
    if (problemas.length > 0) {
      mensagem += ' Atenção: ' + problemas.length + ' linha(s) com problema foram puladas ' +
                  '(linhas ' + problemas.slice(0, 5).join(', ') +
                  (problemas.length > 5 ? '...' : '') + ').';
    }
    textoResultado.textContent = mensagem;
    console.log(dados);                           // para você conferir no console
  } catch (erro) {
    textoResultado.textContent = 'Não consegui ler a planilha: ' + erro.message;
  }
}

// '2012-06-21' → '21/06/2012'
function formatarData(iso) {
  const [ano, mes, dia] = iso.split('-');
  return dia + '/' + mes + '/' + ano;
}