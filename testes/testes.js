fetch('casos_teste.json')
  .then(resposta => resposta.json())
  .then(dados => {
    for (const caso of dados.casos) {
      let certos = 0;
      for (const dia of caso.dias) {
        const calculado = grausDiaOmetto(dia.tmax, dia.tmin, 13, 36);
        if (Math.abs(calculado - dia.gd_esperado) <= 0.001) {
          certos = certos + 1;
        } else {
          console.log('Diferença em ' + dia.data + ': calculado ' + calculado + ', esperado ' + dia.gd_esperado);
        }
      }
      console.log(caso.nome + ': ' + certos + ' de ' + caso.dias.length + ' dias certos');
    }
  })
  .catch(erro => console.error('Erro:', erro));