# Missão 03 · Dashboard e experiência

O dashboard em public/ usa login por empresa, sessão, papéis e tabelas protegidas da fundação. A migration 002 define os fatos comerciais necessários às consultas. src/dashboard.mjs calcula valores no PostgreSQL e src/pages.mjs entrega a interface na mesma origem da API. A tela usa português, valores em BRL e dias comerciais de São Paulo.

O período filtra novos leads, receita fechada, conversão e séries temporais. O pipeline aberto, as pendências e o volume atual de leads representam o estoque vigente. Receita potencial é o valor aberto ponderado pela probabilidade. Conversão usa ganhos divididos pelo total ganho ou perdido no período. Equipe e desempenho pessoal restringem o responsável consultado. A navegação cresce à medida que os módulos ficam disponíveis.

## Validação

Executar bash scripts/ci.sh no runner descrito em .github/workflows/fundacao.yml. A suíte do dashboard valida agregados com registros persistidos de duas empresas, acesso ao dashboard pelo navegador, alteração de período, resultado de busca, layout móvel e encerramento de sessão. A página inicial é /. Para reproduzir com tenant próprio, seguir docs/infraestrutura.md. Uma conta recém-criada exibe totais zerados. Recomendações dependem das análises que serão produzidas pelo Core.

Validação concluída em [GitHub Actions](https://github.com/marllonfilipe/vantplatform/actions/runs/44596783017).

Na busca global, selecione um lead, empresa, contato, oportunidade ou atividade para abrir sua ficha no módulo correspondente. O cabeçalho exibe o grupo do menu disponível para o papel da sessão. O cenário de regressão em tests/crm.integration.mjs navega da Central de integrações até a ficha de um lead e confere o histórico e o grupo ativo.
