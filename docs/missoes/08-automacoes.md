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

## Editor e monitor na interface

Em **Operação → Automações**, o gestor cria ou edita o fluxo de novo lead, escolhe a origem, a espera em minutos, o título da tarefa e o estado ativo ou pausado. Cada publicação produz uma versão. Em **Execuções recentes**, pode expandir um trabalho para conferir a versão executada, o lead, a disponibilidade, as tentativas e o identificador da atividade criada.

A [primeira execução da fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44695010510) mostrou uma retentativa indevida ao tentar criar a atividade. O [ajuste do worker](https://github.com/marllonfilipe/vantplatform/commit/0e25c9016416120f8e3c41322a5140dcdab96dcd) corrigiu a leitura do autor com o papel restrito. A [execução correspondente](https://github.com/marllonfilipe/vantplatform/actions/runs/44695154037) verifica a criação da atividade e a recuperação controlada após reativar o autor.

O teste de navegador abre a tela com login, publica o fluxo, cadastra um lead pela API, executa o worker em outro processo e confere a tarefa pelo monitor. A evidência de CI da revisão identifica o resultado desse percurso. Esta versão do editor representa um único gatilho e uma ação de tarefa. Próxima atividade: ampliar as ramificações e as ações internas versionadas, com testes de histórico e retomada. A execução em produção depende de instalar o worker no host de aplicação da empresa.

## Ramificações por origem e ações na agenda

O incremento de editor e monitor em [cf9aee9](https://github.com/marllonfilipe/vantplatform/commit/cf9aee99715150d3e008a431e96c35dbb2df4226) passou nas suítes de [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44695428084) e [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44695428065).

Em **Operação → Automações**, o gestor escolhe a ação principal e o que acontece quando a origem difere. Cada caminho pode criar tarefa, lembrete ou follow-up interno. O caminho alternativo também pode encerrar o fluxo. A origem usada é a registrada na criação do lead. O prazo opcional conta a partir da execução da ação. Lembretes exigem prazo explícito. A espera anterior à execução continua independente do prazo da atividade.

A API recebe `action_kind`, `else_kind`, `else_title` e `due_minutes` junto à configuração existente. A migration 016 preserva as versões precedentes com ação principal de tarefa. Cada tentativa nova guarda o caminho e a ação selecionados. O monitor apresenta o resultado com o tipo de atividade criado.

O teste em Chromium publica um fluxo com dois caminhos. O teste de integração executa o worker com origens distintas e confere o lembrete alternativo, seu prazo de 45 minutos e o registro no histórico. O CI da revisão confirma o resultado. Próxima atividade independente: eventos de alteração de lead com captura de estado e deduplicação por ocorrência.
