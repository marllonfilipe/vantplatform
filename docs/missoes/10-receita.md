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

A próxima atividade independente é a previsão de receita a partir das oportunidades abertas, com horizonte, base histórica, premissas e indicação de lacunas.
