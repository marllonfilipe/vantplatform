# Missão 12 · Governança corporativa

## Sessões do próprio usuário

Em **Meu perfil → Sessões ativas**, o usuário consulta o início e a expiração das sessões ativas na empresa atual. A própria sessão aparece primeiro. A lista mostra até vinte acessos. Uma confirmação permite encerrar outro acesso individualmente ou encerrar todos os demais, inclusive os que excedem as vinte posições.

A API autenticada oferece `GET /api/v1/auth/sessions`, `DELETE /api/v1/auth/sessions/{id}` e `DELETE /api/v1/auth/sessions/others`. A listagem expõe somente identificador público, datas e indicação de sessão atual. A migration 064 atribui identificadores independentes também às sessões existentes. Cada revogação efetiva gera uma entrada de auditoria na mesma transação. A conferência da sessão no banco a cada requisição impede novos usos após a revogação.

Os testes da fundação verificam dois usuários na mesma empresa, outra empresa, revogação individual e coletiva, repetição, preservação da sessão atual e navegação real pelo perfil. Esta etapa cobre a gestão das próprias sessões. Estrutura multiunidade, políticas corporativas e auditoria de produção permanecem abertas.
