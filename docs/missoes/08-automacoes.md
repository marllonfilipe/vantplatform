# Missão 08 · Motor de automações

**Implementação parcial.** O primeiro fluxo publicado usa o evento de criação de lead, um filtro opcional de origem, espera configurável e criação de tarefa interna. O cadastro manual, a importação e demais operações que inserem leads passam pelo mesmo gatilho PostgreSQL. O cadastro e o enfileiramento usam a mesma transação. A fila registra a versão do fluxo, a origem e o identificador do lead. O responsável da atividade é obtido no CRM no momento da execução.

## Operação

Aplique as migrations e inicie a API pelo procedimento existente. No host do worker, configure a conexão restrita da aplicação e `VANT_WORKER_TENANT` para a empresa autorizada. Execute `npm run worker` sob o supervisor de processos do ambiente. A opção `npm run worker -- --once` tenta processar uma ocorrência devida e encerra. A versão atual atende uma empresa configurada por processo.

Na sessão autenticada de um gestor, `POST /api/v1/automations` aceita `name`, `enabled`, `task_title`, `wait_minutes` e `source_filter` opcional. Atualize por `PUT /api/v1/automations/{id}` com os mesmos campos e `expected_version`. Cada edição cria uma versão. A pausa impede a captura de novos leads e suspende o consumo dos trabalhos existentes desse fluxo. Na retomada, os trabalhos anteriores continuam com os parâmetros originais. Consulte a configuração por `GET /api/v1/automations` e as últimas cem execuções por `GET /api/v1/automations/runs`.

O worker bloqueia o trabalho antes da ação, ignora trabalhos já bloqueados e confirma tarefa, histórico e conclusão conjuntamente. Um filtro incompatível ou lead excluído resulta em ocorrência ignorada. Uma falha de ação desfaz o efeito parcial e agenda nova tentativa, até três no total. O histórico distingue criação, condição não atendida, retentativa e falha final. A versão exige que o autor continue ativo e tenha papel de gestão.

## Evidências e próximas etapas

A suíte de fundação executa `tests/automation.integration.mjs`. O teste usa login, API, dois tenants e subprocessos reais do worker contra PostgreSQL. Verifica pinagem de versão, pausa, rejeição de edição vencida, concorrência, espera, condição por origem e recuperação após o autor ser reativado. A antecipação do vencimento no banco descartável exercita a retentativa sem aguardar o período real. O check do commit registra o resultado.

A próxima atividade é o editor visual e a monitorização desses fluxos pela interface. As demais ramificações, gatilhos, ações e critérios de aceite seguem em aberto. Os gatilhos e envios de WhatsApp dependem da homologação da 05. O CI exercita processos temporários e não representa implantação de um worker de produção.

O histórico de tentativa identifica autor sem autorização vigente por `author_unavailable` e demais falhas da ação por `action_failed`. A leitura da autorização usa o papel restrito normal da aplicação.
