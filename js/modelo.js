// ============================================================
// Motor do modelo de consenso – florescimento da laranjeira Pera
// ============================================================

// Graus-dia de Ometto (1981): calor útil de um dia entre a
// temperatura-base (tb) e a temperatura máxima útil (TB).
// No consenso: tb = 13 °C e TB = 36 °C.
function grausDiaOmetto(tmax, tmin, tb, TB) {
  // Proteção 1: dado faltando ou que não é número → não calcula
  if (!Number.isFinite(tmax) || !Number.isFinite(tmin)) {
    return NaN;
  }

  // Proteção 2: máxima e mínima invertidas (erro de digitação na estação)
  if (tmin > tmax) {
    const troca = tmin;
    tmin = tmax;
    tmax = troca;
  }

  // Proteção 3: máxima igual à mínima → as fórmulas dividiriam por zero.
  // O dia inteiro fica na mesma temperatura; conta só a parte útil.
  if (tmax - tmin < 1e-9) {
    return Math.min(Math.max(tmax - tb, 0), TB - tb);
  }

  const amplitude = tmax - tmin;

  // Caso 1: o dia inteiro abaixo da temperatura-base
  if (tmax <= tb) {
    return 0;
  }

  // Caso 2: o dia inteiro entre tb e TB
  if (tmin >= tb && tmax <= TB) {
    return amplitude / 2 + tmin - tb;
  }

  // Caso 3: começa abaixo de tb e não passa de TB
  if (tmin < tb && tmax <= TB) {
    return (tmax - tb) ** 2 / (2 * amplitude);
  }

  // Caso 4: começa acima de tb e passa de TB
  if (tmin >= tb && tmax > TB) {
    return amplitude / 2 + tmin - tb - (tmax - TB) ** 2 / (2 * amplitude);
  }

  // Caso 5: começa abaixo de tb e passa de TB
  return ((tmax - tb) ** 2 - (tmax - TB) ** 2) / (2 * amplitude);
}

// Balanço hídrico de Thornthwaite e Mather (1955), dia a dia.
// chuva e etc: listas com um valor por dia (mm)
// cad: capacidade de água disponível do solo (mm); no consenso, 100
// Devolve uma lista com o excesso hídrico de cada dia (mm).
// O balanço começa com o solo cheio (armazenamento = cad).
function balancoThornthwaiteMather(chuva, etc, cad) {
  let armazenamento = cad;   // água no solo hoje (mm)
  let negativoAcumulado = 0; // soma dos déficits (sempre <= 0)
  const excesso = [];        // resultado: um valor por dia

  for (let i = 0; i < chuva.length; i++) {
    const saldo = chuva[i] - etc[i];   // P − ETc do dia

    if (saldo < 0) {
      // Dia seco: o solo perde água pela curva exponencial
      negativoAcumulado = negativoAcumulado + saldo;
      armazenamento = cad * Math.exp(negativoAcumulado / cad);
      excesso.push(0);
    } else {
      // Dia com sobra: o solo enche; o que passar da CAD é excesso
      excesso.push(Math.max(armazenamento + saldo - cad, 0));
      armazenamento = Math.min(cad, armazenamento + saldo);
      negativoAcumulado = cad * Math.log(armazenamento / cad);
    }
  }
  return excesso;
}
// Balanço hídrico do gotejo com duas frações.
// chuva, irrigacao, etc: listas com um valor por dia (mm)
//   (irrigação em mm sobre a área total do pomar)
// cad: capacidade de água disponível (mm); no consenso, 100
// fracaoMolhada: parte da área molhada pelos gotejadores; no consenso, 0,35
// Devolve o excesso hídrico do pomar em cada dia (mm).
function balancoGotejoDuasFracoes(chuva, irrigacao, etc, cad, fracaoMolhada) {
  // Faixa molhada: chuva + irrigação concentrada nessa faixa
  const aguaFaixaMolhada = chuva.map((c, i) => c + irrigacao[i] / fracaoMolhada);
  const excessoMolhada = balancoThornthwaiteMather(aguaFaixaMolhada, etc, cad);

  // Entrelinha: só a chuva
  const excessoEntrelinha = balancoThornthwaiteMather(chuva, etc, cad);

  // Média ponderada pela área de cada faixa
  return excessoMolhada.map((e, i) =>
    fracaoMolhada * e + (1 - fracaoMolhada) * excessoEntrelinha[i]
  );
}
// Previsão da florada pelo modelo de consenso.
// datas: lista de datas do ano no formato 'AAAA-MM-DD' (uma por dia, em ordem)
// excesso: excesso hídrico de cada dia (mm), do balanço do pomar
// gd: graus-dia de cada dia
// p: parâmetros do consenso
// Devolve { liberacao, florada } (datas 'AAAA-MM-DD'), com null quando não há previsão.
function preverFlorada(datas, excesso, gd, p) {
  const ano = datas[0].slice(0, 4);
  const dataBorda = ano + '-10-31';           // regra de borda do protocolo (8.12)
  const inicio = datas.indexOf(ano + '-' + p.inicio);
  if (inicio === -1) return { liberacao: null, florada: null, borda: false };

  // 1. Liberação: primeiro dia com excesso de água depois dos 90 dias de indução
  let liberacao = null;
  for (let i = inicio + p.diasInducao; i < datas.length; i++) {
    if (excesso[i] > 0) { liberacao = i; break; }
  }
  if (liberacao === null) return { liberacao: null, florada: dataBorda, borda: true };

  // 2. Soma de graus-dia depois da defasagem
  let soma = 0;
  for (let i = liberacao + p.defasagem; i < datas.length; i++) {
    soma += gd[i];
    if (soma >= p.somaGD) return { liberacao: datas[liberacao], florada: datas[i], borda: false };
  }

  // 3. Não fechou os 200 GD até o fim dos dados: data de borda
  return { liberacao: datas[liberacao], florada: dataBorda, borda: true };
}
const PARAMETROS_CONSENSO = {
  inicio: '03-23',       // início da indução (23/03)
  diasInducao: 90,       // dias de indução
  defasagem: 14,         // dias entre a liberação e o início da soma térmica
  somaGD: 200,           // graus-dia até a antese
  tb: 13,                // temperatura basal inferior
  TB: 36,                // temperatura basal superior
  cad: 100,              // capacidade de água disponível (mm)
  etcSequeiro: 0.7,      // ETc = 0,7 × ETo no sequeiro
  kcIrrigado: 0.73,      // kc da GL
  fracaoMolhada: 0.35    // fração molhada do gotejo
};
// Faixas de erro da previsão (protocolo, seção R42)
// [dias antes, dias depois] da data prevista
const FAIXAS_PREVISAO = {
  irrigado: { provavel: [11, 12], ampla: [20, 24] },
  sequeiro: { provavel: [24, 1],  ampla: [35, 10] }
};
// Data de referência sem modelo (data fixa de calibração do protocolo, seção R43)
const DATA_REFERENCIA = {
  irrigado: { dia: '08-05', texto: 'mediana das floradas irrigadas da calibração' },
  sequeiro: { dia: '09-19', texto: 'mediana das floradas de sequeiro da calibração' }
};