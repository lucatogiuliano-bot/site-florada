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