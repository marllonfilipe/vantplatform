# Missão 02 · Fundação SaaS

A auditoria da missão 01 identificou ausência de aplicação. Esta implementação introduz PostgreSQL com pgvector, migrations transacionais versionadas, registro de tenants e membros, sessões com expiração e revogação, autorização no backend, políticas de linha, chave composta por empresa, auditoria, criptografia de credenciais e primitivas de armazenamento privado.

O serviço HTTP expõe saúde, login, sessão e gestão básica de equipes. O login não devolve segredos ao frontend. A política de escrita de equipes permite proprietário e gerente. Os arquivos estão em migrations/, src/, scripts/, tests/, compose.yaml, .env.example, package.json e .github/workflows/fundacao.yml. Consulte [infraestrutura](../infraestrutura.md) para provisionar, executar e restaurar o serviço.

## Validação

Execute npm test para a suíte unitária. A suíte npm run test:integration exige PostgreSQL de testes com pgvector, migrations aplicadas, dois papéis de banco e APP_ENV=test. Os cenários exercitam login por tenant, bloqueio por origem, permissões, paginação de equipes, revogação, expiração, RLS, integridade entre empresas e auditoria. O CI executa as suítes e restaura um backup em outro banco. Os dados dos testes são exclusivos de uma base descartável.

A integração externa desta missão é PostgreSQL com pgvector. Credenciais e contas reais de clientes, evolução do schema comercial e operação em produção ficam nas respectivas etapas. O resultado vinculante desta entrega é o job postgres do commit da implementação.
