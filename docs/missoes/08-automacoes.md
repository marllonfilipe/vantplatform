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

## Eventos de leads e oportunidades

Na revisão [e90fa44](https://github.com/marllonfilipe/vantplatform/commit/e90fa44f7a9b5330efc78fd2d8b0633e18da93e5), a ramificação por origem e a criação de lembretes passaram nos checks de [fundação e navegador](https://github.com/marllonfilipe/vantplatform/actions/runs/44705933502) e [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44705933457).

No editor, **Evento no CRM** seleciona novo lead, lead atualizado, nova oportunidade, mudança de etapa ou perda. A API aceita `trigger_event`. A migration 017 preserva fluxos e trabalhos anteriores. Os eventos compartilham a transação da alteração comercial. Uma edição de lead que conserva os valores não cria nova ocorrência. Uma negociação que muda de etapa e passa a perdida no mesmo salvamento gera os dois eventos correspondentes. Editar o motivo de uma perda já registrada não dispara outra transição para perdida.

O trabalho guarda ocorrência, versão, origem e identificador do registro. Eventos de mudança de oportunidade incluem etapa e situação anteriores. A atividade é vinculada ao lead ou à oportunidade que originou a execução. Os gatilhos acompanham alterações no PostgreSQL e mantêm o filtro por empresa.

O teste de integração usa as rotas reais do CRM para cadastrar e editar os registros e executa o worker para conferir cinco ocorrências, incluindo uma mudança simultânea de etapa e situação. O check da revisão documenta o resultado. Próxima atividade: eventos de reuniões agendadas e concluídas e condições adicionais ligadas ao registro.

## Agenda comercial como origem de eventos

Os eventos de leads e oportunidades no [commit 23b3d3d](https://github.com/marllonfilipe/vantplatform/commit/23b3d3d68b372f0accc32b1e0d6da7f4a6247197) passaram nos testes de [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44706235966) e [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44706235890).

O editor oferece **Reunião agendada** e **Reunião concluída**. A primeira data atribuída a uma reunião em aberto gera um agendamento. A transição para concluída gera a ocorrência de conclusão. Uma simples edição de título ou um ajuste de data de uma reunião já agendada não repete o agendamento. A ação interna usa o responsável e os vínculos atuais da reunião. Uma reunião sem lead ou oportunidade vinculada também pode gerar uma atividade para seu responsável. A origem para a condição é a da oportunidade vinculada ou, se ausente, a do lead.

A migration 018 instala o gatilho apenas para atividades de reunião. As ações que o worker cria são tarefas, lembretes ou follow-ups e não voltam a acionar o gatilho de reunião. O teste de integração agenda, edita e conclui a atividade por HTTP, executa dois workers e verifica no PostgreSQL os vínculos das atividades produzidas. A missão permanece parcial. Próxima atividade independente: avaliação de condições adicionais a partir dos dados do evento.

## Condições comerciais avaliadas no momento do evento

Os gatilhos de reunião no [commit 05f5441](https://github.com/marllonfilipe/vantplatform/commit/05f5441c29416a6114254b02c71e37f4fc902120) passaram nos testes de [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44706559999) e [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44706559986).

O editor permite combinar a origem com segmento, tag, intenção de compra, score mínimo, dias desde o cadastro ou último contato registrado, responsável, etapa e valor mínimo da oportunidade. Todos os critérios preenchidos precisam corresponder para executar a ação principal. A ausência de um dado exigido leva ao caminho alternativo. Uma lista de condições vazia conserva o comportamento das versões anteriores.

A API recebe `conditions`, um objeto formado por `segment`, `tag`, `intent`, `min_score`, `min_quiet_days`, `owner_id`, `stage_id` e `min_cents`. O formulário recebe o valor em reais e a API usa centavos inteiros. A migration 019 registra na fila somente os valores comerciais exigidos por aquela versão do fluxo. Com isso, alterar a ficha antes de o worker executar não muda a ramificação. Para score, usa a última análise persistida do lead ou, na ausência dela, o score do cadastro.

O Chromium configura uma condição por responsável. O teste de integração altera o segmento duas vezes antes do processamento e confere as duas decisões contra os fatos gravados. Também verifica etapa, valor em centavos e rejeição de condições inválidas. A próxima atividade independente é capturar mudanças de pontuação e qualificação a partir da análise do Core.

A [execução de fundação em 4e0d5fd](https://github.com/marllonfilipe/vantplatform/actions/runs/44706846274) parou no Chromium ao localizar o campo Responsável por nome exato. O editor passou a definir explicitamente o nome acessível de cada seletor, usando o mesmo rótulo exibido no formulário. O teste continua exigindo o campo correto dentro do diálogo e executando o worker real.

O [teste seguinte](https://github.com/marllonfilipe/vantplatform/actions/runs/44743353508) passou pelo formulário e revelou uma restrição antiga no PostgreSQL: a criação de um fluxo com ramo alternativo e apenas condições comerciais retornava HTTP 400. A migration 020 aceita o ramo quando a versão possui origem ou ao menos uma condição, e continua exigindo uma ação e título válidos. O teste preserva os casos de configuração inválida.

O [commit 4f375c4](https://github.com/marllonfilipe/vantplatform/commit/4f375c4350ecd9069e637cbb871651e42390778d) passou na [fundação com Chromium e PostgreSQL](https://github.com/marllonfilipe/vantplatform/actions/runs/44743622471) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44743622515).

## Automações por qualificação do Intelligence Core

O gestor pode publicar fluxos com **Score alterado** ou **Lead qualificado** em **Operação → Automações**. O primeiro score estabelece uma referência. Uma mudança posterior de valor gera um evento; a entrada na classificação **Prioridade alta** gera o de qualificação. A primeira análise já classificada como alta também qualifica o lead. A origem é uma análise persistida pelo Core daquela empresa.

A migration 021 usa o histórico anterior como referência sem criar trabalhos retroativos. Cada ocorrência identifica a análise, o lead e a pontuação anterior e atual. A condição de score mínimo usa a pontuação que gerou o evento. O PostgreSQL serializa a transição por empresa e lead para que duas análises concorrentes com o mesmo novo resultado não dupliquem o disparo.

O teste integrado usa o modelo local, duas sessões de empresas distintas, PostgreSQL e o worker. Ele registra uma primeira análise com score 20, acrescenta uma oportunidade e um contato concluído e solicita duas análises concorrentes que chegam a 80. Confere um trabalho de cada gatilho, as duas atividades efetivamente criadas e o isolamento das ocorrências. Os checks do commit registram os resultados. Próxima atividade independente: gatilhos temporais de tarefas vencidas e leads sem interação.

Na revisão [2676d4f](https://github.com/marllonfilipe/vantplatform/commit/2676d4f0ac33fad92f0ab66bb5d64b06ca54e38a), o [teste de inteligência com inferência e workers](https://github.com/marllonfilipe/vantplatform/actions/runs/44743978570) passou para a mudança de pontuação, qualificação concorrente e criação de atividades.

## Gatilhos temporais no worker

Em **Operação → Automações**, os eventos **Tarefa vencida** e **Lead sem interação** também alcançam registros existentes. O processo do worker varre sua empresa ao iniciar e a cada 30 segundos enquanto está ativo. Cada varredura inclui até 50 episódios ainda não registrados por fluxo. O modo `--once` varre a empresa antes de tentar consumir uma ocorrência. A espera configurada na versão começa quando o worker captura o episódio.

Tarefas do tipo `task` são elegíveis quando têm prazo vencido e estão abertas. Tarefas criadas por esse motor são excluídas da varredura para evitar uma cadeia de novas tarefas vencidas. Para leads, a referência é a mais recente entre cadastro, último contato e interações comerciais concluídas. O intervalo padrão é 14 dias completos; o editor permite configurar **Dias mínimos sem contato**, com mínimo operacional de um dia para esse gatilho.

O identificador da ocorrência usa fluxo, registro e instante de referência. Reinícios ou dois workers não devem duplicar o mesmo episódio. Alterar apenas a versão não recria o episódio capturado. Uma nova data de vencimento ou uma nova interação pode iniciar outro episódio. Antes de efetivar a ação, o worker confere se a tarefa continua aberta com o mesmo vencimento ou se o lead ainda tem a mesma referência de interação. O monitor registra uma tentativa ignorada quando a espera perde a validade.

A suíte de fundação inicia workers reais em subprocessos, verifica isolamento, concorrência, reprocessamento e encerramento do episódio durante a espera. A fixture usa datas passadas e antecipa trabalhos no banco descartável para exercitar a passagem do tempo. A evidência é o check da revisão. A missão permanece parcial. Próxima atividade independente: etapas encadeadas e limites de execução para ações internas.
