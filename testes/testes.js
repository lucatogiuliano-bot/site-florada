fetch('casos_teste.json')
  .then(resposta => resposta.json())
  .then(dados => {
    for (const caso of dados.casos) {

      // ---------- Teste 1: graus-dia de Ometto ----------
      let gdCertos = 0;
      for (const dia of caso.dias) {
        const calculado = grausDiaOmetto(dia.tmax, dia.tmin, 13, 36);
        if (Math.abs(calculado - dia.gd_esperado) <= 0.001) {
          gdCertos = gdCertos + 1;
        } else {
          console.log('GD diferente em ' + dia.data + ': calculado ' + calculado + ', esperado ' + dia.gd_esperado);
        }
      }
      console.log(caso.nome + ' | graus-dia: ' + gdCertos + ' de ' + caso.dias.length + ' dias certos');

      // ---------- Teste 2: balanço hídrico ----------
      const chuva = caso.dias.map(dia => dia.chuva);
      let excesso;

      if (caso.tipo === 'sequeiro') {
        const etc = caso.dias.map(dia => 0.7 * dia.eto);
        excesso = balancoThornthwaiteMather(chuva, etc, 100);
      } else {
        const irrigacao = caso.dias.map(dia => dia.irrigacao);
        const etc = caso.dias.map(dia => 0.73 * dia.eto);
        excesso = balancoGotejoDuasFracoes(chuva, irrigacao, etc, 100, 0.35);
      }

      let excCertos = 0;
      for (let i = 0; i < caso.dias.length; i++) {
        const esperado = caso.dias[i].excesso_esperado;
        if (Math.abs(excesso[i] - esperado) <= 0.001) {
          excCertos = excCertos + 1;
        } else {
          console.log('Excesso diferente em ' + caso.dias[i].data + ': calculado ' + excesso[i] + ', esperado ' + esperado);
        }
      }
      console.log(caso.nome + ' | excesso hídrico (' + caso.tipo + '): ' + excCertos + ' de ' + caso.dias.length + ' dias certos');
    }
  })
  .catch(erro => console.error('Erro:', erro));