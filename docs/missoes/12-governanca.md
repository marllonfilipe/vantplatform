# Missão 12 · Governança corporativa

## Sessões do próprio usuário

Em **Meu perfil → Sessões ativas**, o usuário consulta o início e a expiração das sessões ativas na empresa atual. A própria sessão aparece primeiro. A lista mostra até vinte acessos. Uma confirmação permite encerrar outro acesso individualmente ou encerrar todos os demais, inclusive os que excedem as vinte posições.

A API autenticada oferece `GET /api/v1/auth/sessions`, `DELETE /api/v1/auth/sessions/{id}` e `DELETE /api/v1/auth/sessions/others`. A listagem expõe somente identificador público, datas e indicação de sessão atual. A migration 064 atribui identificadores independentes também às sessões existentes. Cada revogação efetiva gera uma entrada de auditoria na mesma transação. A conferência da sessão no banco a cada requisição impede novos usos após a revogação.

Os testes da fundação verificam dois usuários na mesma empresa, outra empresa, revogação individual e coletiva, repetição, preservação da sessão atual e navegação real pelo perfil. Esta etapa cobre a gestão das próprias sessões. Estrutura multiunidade, políticas corporativas e auditoria de produção permanecem abertas.

## Cadastro de unidades

Em **Gestão → Unidades**, gestores e proprietários cadastram e editam filiais, departamentos e unidades comerciais da empresa. Um nome pode existir em categorias diferentes. Dentro de uma categoria a comparação ignora maiúsculas e minúsculas. Os registros possuem revisão para proteger edições concorrentes.

A API autenticada lista em `GET /api/v1/business-units` com `limit` e `cursor`. O cadastro aceita `POST` com `id` UUID, `name` e `kind` (`branch`, `department` ou `commercial`). Repetir a mesma referência e conteúdo reutiliza o cadastro. Alterações usam `PATCH /api/v1/business-units/{id}` com nome, tipo e revisão. A migration 065 aplica isolamento por empresa; o backend registra criação e atualização na auditoria. Nesta etapa as unidades formam um cadastro próprio. A atribuição de equipes, pipelines, indicadores e restrições por unidade segue em desenvolvimento.
