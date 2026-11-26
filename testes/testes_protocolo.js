// Passo 0.8 – confere o motor com todas as floradas de calibração do protocolo
async function rodarTesteProtocolo() {
  const resposta = await fetch('casos_protocolo.json');
  const dados = await resposta.json();
  const p = PARAMETROS_CONSENSO;

  const placar = {};      // acertos por grupo
  const falhas = [];      // casos que não bateram

  for (const caso of dados.casos) {
    // 1. Separa as colunas de cada dia: [data, tmax, tmin, chuva, eto, irrigacao]
    const datas     = caso.dias.map(d => d[0]);
    const tmax      = caso.dias.map(d => d[1]);
    const tmin      = caso.dias.map(d => d[2]);
    const chuva     = caso.dias.map(d => d[3]);
    const eto       = caso.dias.map(d => d[4]);
    const irrigacao = caso.dias.map(d => d[5]);

    // 2. Graus-dia de cada dia
    const gd = tmax.map((t, i) => grausDiaOmetto(t, tmin[i], p.tb, p.TB));

    // 3. Balanço hídrico conforme o tipo
    let excesso;
    if (caso.tipo === 'sequeiro') {
      const etc = eto.map(e => p.etcSequeiro * e);
      excesso = balancoThornthwaiteMather(chuva, etc, p.cad);
    } else {
      const etc = eto.map(e => caso.kc * e);   // kc do próprio talhão
      excesso = balancoGotejoDuasFracoes(chuva, irrigacao, etc, p.cad, p.fracaoMolhada);
    }

    // 4. Previsão e comparação com o esperado
    const r = preverFlorada(datas, excesso, gd, p);
    const e = caso.esperado;
    const ok = r.liberacao === e.liberacao && r.florada === e.florada_prevista && r.borda === e.borda;

    if (!placar[caso.grupo]) placar[caso.grupo] = { acertos: 0, total: 0 };
    placar[caso.grupo].total++;
    if (ok) placar[caso.grupo].acertos++;
    else falhas.push(caso.nome + ' | seu: ' + r.liberacao + ' → ' + r.florada +
                     ' | esperado: ' + e.liberacao + ' → ' + e.florada_prevista);
  }

  // 5. Mostra o resultado
  let texto = 'TESTE DO PROTOCOLO (' + dados.casos.length + ' floradas)\n\n';
  let totalOk = 0;
  for (const g in placar) {
    texto += g + ': ' + placar[g].acertos + ' de ' + placar[g].total + '\n';
    totalOk += placar[g].acertos;
  }
  texto += '\nTOTAL: ' + totalOk + ' de ' + dados.casos.length +
           (falhas.length === 0 ? '  ✔ tudo certo' : '  ✘ veja as falhas abaixo') + '\n';
  if (falhas.length > 0) texto += '\n' + falhas.join('\n');

  document.getElementById('resultado').textContent = texto;
  console.log(texto);
}

rodarTesteProtocolo();
