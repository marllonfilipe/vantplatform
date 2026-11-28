# Operação da fundação SaaS

## Desenvolvimento

Instale Node.js 24, npm, Docker Compose e Git. Copie .env.example para .env e configure senhas independentes. ADMIN_DATABASE_URL aponta para o dono de um banco exclusivo com permissão de criar extensão e papéis. DATABASE_URL usa o mesmo banco com login vant_runtime e outra senha de pelo menos 16 caracteres. Formato de conexão: postgresql://usuario:senha@127.0.0.1:5432/vant. O cliente deve codificar caracteres reservados no usuário e na senha. O compose usa POSTGRES_PASSWORD como senha inicial do dono.

```sh
docker compose up -d --wait
npm install
node --env-file=.env scripts/migrate.mjs
node --env-file=.env scripts/create-runtime.mjs
```

Para o primeiro acesso, injete TENANT_NAME, OWNER_EMAIL e OWNER_PASSWORD no ambiente do processo de provisionamento. Execute `node --env-file=.env scripts/provision.mjs` e anote o UUID retornado. Cada execução desse comando cria uma empresa. A API recebe somente DATABASE_URL, APP_ORIGIN, APP_ENV e os parâmetros de escuta. Inicie o serviço com `node --env-file=.env src/server.mjs` em desenvolvimento. Em produção, o ambiente do processo da API deve excluir a conexão administrativa. Acesse /health/live e /health/ready para verificar processo e acesso ao banco.

O login aceita POST /api/v1/auth/login com tenantId, email e password. Envie JSON com Origin igual a APP_ORIGIN. O cookie da resposta autentica GET /api/v1/auth/me, GET /api/v1/teams, POST /api/v1/teams e POST /api/v1/auth/logout. A criação de equipe aceita name. O login por empresa permite repetir um endereço de e-mail em tenants distintos. A API consulta o papel e o estado ativo do membro a cada requisição protegida.

## Ambientes e privacidade operacional

Em staging e production, configure APP_ENV, uma origem HTTPS, TLS na borda, segredos gerenciados, conectividade privada com o banco e TLS verificado na conexão. O proxy usa limites de conexões/IP próprios; a API utiliza o endereço de transporte e limita tentativas também por conta. Se vários usuários passam pelo mesmo proxy, o limite por endereço é compartilhado. Configure alertas para indisponibilidade em /health/ready, latência, 5xx, saturação do pool e uso de disco. A aplicação emite eventos JSON com identificador opaco e duração. Tenants usam associação explícita e política de linha também no banco.

Restrinja o diretório privado de arquivos à identidade do serviço. No host de aplicação, armazene os dados fora da árvore pública. Os serviços de armazenamento usam UUID por tenant e objeto. Credenciais de integração usam envelope versionado AES-GCM com chave de 32 bytes fornecida pelo gestor de segredos, tenant e provedor autenticados. Itens e funcionalidades de negócio que consomem arquivos e credenciais são integrados nas respectivas missões.

A rotina scripts/retention.sql remove sessões vencidas, baldes antigos de limite de acesso e convites expirados. Agende a execução diária com conta de manutenção. Defina retenção de auditoria e backups conforme finalidade e obrigações do cliente. Trate solicitações de acesso, correção, exportação e eliminação autenticando o titular e registrando a decisão no tenant. A validação jurídica e a configuração do ambiente real integram a preparação para produção.

## Backup e recuperação

Faça backup diário em formato custom com pg_dump, por conexão de backup autorizada a ler todas as linhas. Mantenha a cópia cifrada em local separado, controle a retenção e inclua o volume de arquivos privados na mesma janela de consistência. Para produção, combine backups com arquivamento de WAL e valide os objetivos de recuperação em homologação. Preserve as chaves necessárias à recuperação em cofre separado.

```sh
pg_dump --format=custom --file=vant.dump "$ADMIN_DATABASE_URL"
pg_restore --exit-on-error --dbname="$RESTORE_DATABASE_URL" vant.dump
```

Use um banco novo e vazio para o destino. Em novo cluster, provisione antes os papéis referenciados, inclusive vant_app e o dono das migrations. Confira contagens de tenants, equipes e eventos, efetue login com conta de homologação e valide uma leitura antes de trocar o endpoint do serviço. O CI repete migrations e restaura um dump em outra base do mesmo cluster.

## Dados previstos

A fundação contém tenants, membros, equipes, associações, convites, sessões, segredos, metadados de arquivos, chunks vetoriais, trabalhos e auditoria. As tabelas de leads, contas, contatos, oportunidades, pipelines, atividades e tarefas serão integradas com dashboard e CRM. Conversas, mensagens e instâncias entram com a inbox. Agentes, contexto, memória e execuções usarão o Core. Assinaturas, planos, consumo, integrações financeiras e notificações terão contratos próprios nos módulos correspondentes.

O CI provisiona uma conta descartável e cria uma equipe pela API antes do backup. O teste abre uma nova sessão no banco restaurado com o papel restrito, verifica a empresa da sessão, lê a equipe recuperada e encerra a sessão. O ensaio no ambiente de implantação também deve abranger os arquivos privados e as chaves mantidas fora do banco.
