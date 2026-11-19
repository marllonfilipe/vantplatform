# Missão 03 · Dashboard e experiência

O dashboard em public/ usa login por empresa, sessão, papéis e tabelas protegidas da fundação. A migration 002 define os fatos comerciais necessários às consultas. src/dashboard.mjs calcula valores no PostgreSQL e src/pages.mjs entrega a interface na mesma origem da API. A tela usa português, valores em BRL e dias comerciais de São Paulo.

O período filtra novos leads, receita fechada, conversão e séries temporais. O pipeline aberto, as pendências e o volume atual de leads representam o estoque vigente. Receita potencial é o valor aberto ponderado pela probabilidade. Conversão usa ganhos divididos pelo total ganho ou perdido no período. Equipe e desempenho pessoal restringem o responsável consultado. A navegação cresce à medida que os módulos ficam disponíveis.

## Validação

Executar bash scripts/ci.sh no runner descrito em .github/workflows/fundacao.yml. A suíte do dashboard valida agregados com registros persistidos de duas empresas, acesso ao dashboard pelo navegador, alteração de período, resultado de busca, layout móvel e encerramento de sessão. A página inicial é /. Para reproduzir com tenant próprio, seguir docs/infraestrutura.md. Uma conta recém-criada exibe totais zerados. Recomendações dependem das análises que serão produzidas pelo Core.
