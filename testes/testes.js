fetch('casos_teste.json')
  .then(resposta => resposta.json())
  .then(dados => {
    console.log('Arquivo carregado:', dados.casos.length, 'casos');
    for (const caso of dados.casos) {
      console.log(caso.nome, '–', caso.dias.length, 'dias – florada prevista esperada:', caso.esperado.florada_prevista);
    }
  })
  .catch(erro => console.error('Erro ao carregar:', erro));