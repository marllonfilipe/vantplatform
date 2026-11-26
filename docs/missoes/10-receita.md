# Missão 10 · Revenue Intelligence e inteligência executiva

**Implementação parcial.** Em **Inteligência → Receita comercial**, selecione as datas de fechamento e, se desejar, a origem e o vendedor. O vendedor consulta a própria carteira. Os dados vêm das oportunidades do CRM da empresa autenticada.

## Cálculo

O intervalo inclui ambas as datas no fuso de São Paulo. O padrão abrange hoje e os 29 dias anteriores. Entram ganhos e perdas com fechamento ocorrido até a consulta. A receita soma os valores ganhos, em centavos. O ticket médio divide esse valor pela quantidade de ganhos. A conversão divide os ganhos pelo total de fechamentos. O ciclo médio considera a duração entre cadastro e fechamento dos ganhos com duração válida, em dias de 24 horas. A tela informa o tamanho dessa amostra. Sem fechamentos, o total é zero e os indicadores sem denominador aparecem sem base.

As quebras por origem, vendedor e etapa usam os dados atuais do negócio fechado. A etapa indica onde o fechamento está registrado. A distribuição de perdas usa o motivo informado. A taxa de passagem entre etapas exige o histórico de movimentação.

## Validação e continuidade

O cenário em `tests/revenue.integration.mjs` cadastra negócios pela API, fixa as datas em banco de teste e confere os totais, os dois limites do mês, exclusão de negócios abertos, filtros, acesso por carteira e isolamento entre empresas. O Chromium verifica o relatório pela interface.

Continuam em aberto previsão documentada, evolução entre etapas, produtividade, demais recortes gerenciais e análises contextuais pelo Core. A atribuição específica ao WhatsApp depende da homologação da Missão 05.

## Exportação da consulta exibida

Depois de aplicar os filtros, **Exportar CSV** baixa uma planilha UTF-8 com separador ponto e vírgula. O total e as quebras identificam o período, a origem e a carteira usados na consulta. Receita e ticket são expressos em centavos. Denominadores ausentes geram células vazias. Rótulos que poderiam ser interpretados como fórmulas são tratados como texto.

Em **Imprimir ou salvar PDF**, escolha **Salvar como PDF** na janela de impressão do navegador. A impressão conserva os resultados e os filtros aplicados e omite a navegação. CSV e impressão usam o mesmo resultado já visível, inclusive se os campos do formulário tiverem sido editados sem aplicar os filtros. O teste de integração verifica o download do CSV no Chromium, um rótulo com caracteres especiais, o total exportado e a geração de um PDF em modo de impressão.

## Receita por equipe, segmento e pipeline

Cada fechamento pertence a uma única categoria em cada uma dessas dimensões. A equipe vem da atribuição explícita do negócio. O pipeline é o do negócio. O segmento vem da conta vinculada ao negócio (ou, se a conta não foi vinculada diretamente, da conta do lead). Sem segmento na conta, o cálculo usa o segmento do lead. Itens sem equipe ou segmento ficam identificados na interface, no CSV e na impressão.

Os filtros de equipe atribuída, segmento e pipeline podem ser combinados com a origem, o período e a carteira. O CSV e a impressão identificam os filtros aplicados. As quebras usam os cadastros vigentes na consulta. A soma das receitas em cada dimensão deve reproduzir a receita total do período. O cenário de integração confere essa igualdade e a atribuição de negócios com e sem equipe ou segmento.

A previsão sobre oportunidades abertas está descrita abaixo.

## Projeção da carteira aberta

Em **Inteligência → Previsão de receita**, escolha 30, 60 ou 90 dias. O horizonte começa hoje em São Paulo e inclui o último dia. O endpoint autenticado é `GET /api/v1/revenue/forecast?days=30`. Vendedores veem somente suas oportunidades.

A primeira projeção usa as oportunidades abertas cuja previsão de fechamento cai no intervalo. Multiplica o valor em centavos pela probabilidade registrada no CRM, divide por 100 e arredonda cada contribuição para o centavo mais próximo antes de somar. A soma das etapas reconcilia com a projeção total. A tela também mostra o valor nominal e a quantidade de negócios considerados. Oportunidades vencidas, sem data e posteriores ao horizonte aparecem separadamente para que a equipe confira a cobertura.

O resultado é uma estimativa condicional aos valores, probabilidades e datas informados. A comparação histórica abaixo oferece uma segunda referência para avaliar essa estimativa.

O teste de integração fixa previsões nos dois extremos do horizonte, no dia anterior e no dia posterior, além de uma oportunidade sem data. Confere o arredondamento dos centavos, a ampliação para 60 dias, as permissões, o isolamento e o seletor no navegador.

### Histórico, duração e sazonalidade

Para cada pipeline e mês de fechamento previsto no horizonte, a tela mostra a idade média das negociações abertas e o ciclo médio dos ganhos da amostra comparável. O segundo cenário aplica a taxa de ganhos observada nos fechamentos ao valor nominal da carteira daquele grupo. O cenário por probabilidade do CRM segue disponível de forma independente.

A janela histórica abrange os últimos três anos até a consulta e inclui ganhos e perdas do mesmo pipeline dentro do acesso do usuário. A referência sazonal exige pelo menos 20 fechamentos no mesmo mês do ano em pelo menos dois anos distintos. Se faltar essa base, o sistema utiliza todo o pipeline quando houver ao menos 10 fechamentos. Com menos dados, mostra a amostra disponível e deixa taxa e estimativa histórica sem valor. Esses limites são regras de exibição e não garantem precisão estatística.

A taxa observada entre negócios encerrados pode diferir da conversão futura da carteira. O modelo não atribui uma probabilidade individual a partir da idade da negociação. O usuário pode comparar essa idade com os ciclos de vendas registrados. Mudanças de pipeline, cadastro e carteira podem afetar a comparabilidade.

O cenário em PostgreSQL cria um pipeline com histórico controlado, verifica a ausência de projeção sem amostra e confere a transição da referência geral para a sazonal. Com seis ganhos em dez fechamentos e uma oportunidade de R$ 100,00, o comparativo esperado é R$ 60,00. A suíte também confere o ciclo, a separação por vendedor e a exibição no Chromium.

## Conversão entre etapas do funil

Em **Inteligência → Receita comercial → Conversão entre etapas**, o denominador de cada etapa é o número de negócios distintos cuja entrada nela está registrada no histórico do CRM durante o período selecionado. Cada negócio contribui uma vez por etapa. O relatório identifica o destino da primeira saída após essa entrada e calcula a porcentagem sobre todos os negócios que entraram. Inclui retornos, saltos e transferências identificados pelo nome do pipeline e da etapa de destino. Uma entrada sem saída observada até o fim do intervalo continua no denominador.

A criação de um negócio registra entrada na sua primeira etapa. Atribuir novamente a mesma etapa não cria entrada. A apuração exige que o histórico da saída registre a mesma etapa de origem da visita. Não se infere um movimento a partir da posição atual do negócio ou da ordem atual do funil. Negócios que já estavam na etapa antes do período só entram no denominador se registrarem nova entrada no intervalo.

As datas usam São Paulo. Os filtros de carteira, equipe, origem e segmento usam o cadastro atual. Para as movimentações, o filtro de pipeline seleciona o pipeline da etapa de origem. CSV e impressão incluem as passagens e os filtros aplicados. Um relatório pode mostrar movimentações mesmo sem qualquer fechamento no período.
