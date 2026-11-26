// leitura.js – transforma o texto do CSV em listas de números

function lerCSV(texto) {
  // 1. Tira o caractere invisível que o Excel às vezes põe no início (BOM)
  texto = texto.replace(/^\uFEFF/, '');

  // 2. Quebra em linhas e descarta linhas vazias
  const linhas = texto.split(/\r?\n/).filter(l => l.trim() !== '');
  if (linhas.length < 2) throw new Error('A planilha está vazia.');

  // 3. Descobre o separador: ';' (Excel em português) ou ',' (padrão americano)
  const separador = linhas[0].includes(';') ? ';' : ',';

  // 4. Lê o cabeçalho e confere as colunas obrigatórias
  const cabecalho = linhas[0].split(separador).map(c => c.trim().toLowerCase());
  const obrigatorias = ['data', 'tmax', 'tmin', 'chuva', 'eto'];
  for (const col of obrigatorias) {
    if (!cabecalho.includes(col)) throw new Error('Falta a coluna "' + col + '" no cabeçalho.');
  }

  // 5. Guarda a posição de cada coluna (ex.: pos.tmax = 1)
  const pos = {};
  cabecalho.forEach((nome, i) => { pos[nome] = i; });

  // 6. Lê linha por linha
  const dados = { datas: [], tmax: [], tmin: [], chuva: [], eto: [], irrigacao: [] };
  const problemas = [];   // números das linhas que não deu para ler

  for (let n = 1; n < linhas.length; n++) {
    const campos = linhas[n].split(separador).map(c => c.trim());
    const data = converterData(campos[pos.data]);

    // Converte um campo em número (troca vírgula por ponto se for padrão brasileiro)
    const numero = nome => {
      if (pos[nome] === undefined) return 0;          // coluna opcional ausente (irrigação)
      const bruto = campos[pos[nome]];
      if (bruto === undefined || bruto === '') return NaN;
      return Number(separador === ';' ? bruto.replace(',', '.') : bruto);
    };

    const valores = {
      tmax: numero('tmax'), tmin: numero('tmin'), chuva: numero('chuva'),
      eto: numero('eto'), irrigacao: numero('irrigacao')
    };

    // Linha com data ruim ou número faltando: anota e pula
    if (data === null || Object.values(valores).some(v => !Number.isFinite(v))) {
      problemas.push(n + 1);   // +1 porque a linha 1 do Excel é o cabeçalho
      continue;
    }

    dados.datas.push(data);
    for (const k in valores) dados[k].push(valores[k]);
  }

  return { dados, problemas };
}

// Aceita '2012-01-31' ou '31/01/2012' e devolve sempre '2012-01-31'
function converterData(texto) {
  if (!texto) return null;
  let m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return null;
}