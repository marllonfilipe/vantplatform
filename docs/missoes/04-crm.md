# Missão 04 · CRM e gestão comercial

O CRM reutiliza autenticação, isolamento, tabelas e indicadores das missões anteriores. A migration 004 acrescenta atribuição a equipes, histórico comercial, arquivos e conversas. A API está em /api/v1/crm. O formulário, a pesquisa, os filtros, as tabelas e o Kanban leem e escrevem no PostgreSQL.

## Validar uma operação

1. Entre com o proprietário ou gerente de uma empresa. Crie um funil e pelo menos duas etapas.
2. Cadastre uma empresa, um decisor e um lead. Importe um CSV UTF-8 com coluna nome. São aceitos email, telefone, segmento, origem, tags e observações. O limite é de 500 registros por lote. Uma falha desfaz o lote inteiro.
3. Crie uma oportunidade, mova-a entre etapas e confira o histórico no detalhe. Confira o valor no dashboard. As etapas podem ser reordenadas sem perder negócios.
4. Registre uma conversa e transforme-a em lead. A repetição da ação abre o mesmo lead. Anexe um arquivo de até 2 MB, consulte o histórico e agende uma atividade. Os vencimentos alimentam a central de alertas.

## Entrega

Arquivos principais: migrations/004_crm.sql, src/crm.mjs, src/csv.mjs, src/routes.mjs, public/crm.js, public/crm-schema.js e tests/crm.integration.mjs. O frontend usa o contrato compartilhado dos campos comerciais. A escrita valida o papel no backend. A exclusão de lead exige gestão e ausência de vínculos operacionais. O banco mantém a separação entre empresas para relacionamentos, anexos e histórico.

O teste de integração usa PostgreSQL e Chromium. Exercita rollback de CSV, filtros, papéis, isolamento, cadastro de conta e contato, anexos, conversão de conversa, criação e reordenação de etapas, movimentação de negócios e histórico. A execução é feita por scripts/ci.sh conforme docs/infraestrutura.md. A conexão da caixa de entrada com o provedor de WhatsApp pertence à missão 05.
