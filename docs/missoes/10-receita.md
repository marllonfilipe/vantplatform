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

A próxima atividade é ampliar a análise por equipe, segmento e pipeline com a mesma conciliação dos totais.
