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

## Etapas por caminho e retomada

Os gatilhos temporais em [df0420d](https://github.com/marllonfilipe/vantplatform/commit/df0420d2217f0398776f176ea6d4fe63125632ef) passaram na [fundação com subprocessos do worker](https://github.com/marllonfilipe/vantplatform/actions/runs/44744219236) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44744219237).

No editor, **Etapas após a ação principal** e **Etapas após a ação alternativa** permitem acrescentar ações em ordem. Cada etapa define tipo, título, espera antes de executar e prazo da atividade criada. Um caminho comporta até oito ações, contando a inicial. A API aceita `steps.match` e `steps.otherwise`; cada item contém `kind`, `title`, `wait_minutes` e `due_minutes`. O caminho alternativo precisa de uma ação inicial para receber etapas subsequentes.

O worker confirma de forma atômica a atividade, o histórico e a posição da próxima etapa. Na pausa, o trabalho conserva a posição. Ao retomar, usa a versão que capturou o evento. Uma falha permite até três tentativas naquela etapa. O monitor apresenta a tentativa, o resultado e o número da etapa. O limite de oito ações garante que uma sequência publicada tenha fim. As versões anteriores seguem com sua ação única.

O Chromium publica uma etapa adicional e confere o follow-up no monitor. Um teste com subprocessos força pausa, troca de versão e falha do autor durante a segunda etapa. Confere a retomada, a ordem e as três atividades do CRM. O CI da revisão registra o resultado. A missão continua parcial. Próximas atividades independentes: limites de frequência entre execuções do mesmo fluxo e ações internas de atribuição de responsável com rastreabilidade.

## Intervalo mínimo por fluxo

O gestor define o intervalo em **Automações → Criar fluxo** ou **Editar fluxo**. O campo aceita de 0 a 43.200 minutos. Zero permite iniciar imediatamente. A API recebe `cooldown_minutes` em cada versão. Trabalhos já enfileirados usam o intervalo da versão que capturou o evento.

Após a primeira ação bem-sucedida, o banco guarda o instante do início por empresa e fluxo. Dois workers que disputam o mesmo fluxo consultam e atualizam esse registro atomicamente. Quando o intervalo ainda está em vigor, o trabalho fica na fila com a próxima data elegível, sem consumir tentativa. O monitor mostra a espera. Etapas seguintes obedecem à espera configurada na etapa. Uma falha na primeira ação reverte a reserva na mesma transação.

A suíte de fundação executa `tests/frequency.integration.mjs` com PostgreSQL, API e dois subprocessos do worker. A suíte verifica concorrência, isolamento entre empresas, alteração de versão, continuação da sequência e contagem das atividades. O banco descartável permite antecipar a elegibilidade para verificar a retomada. Consulte os checks do commit deste incremento para o resultado. A missão segue parcial. A atribuição de responsável no CRM é a próxima ação interna prevista.

O intervalo mínimo foi publicado em [dff0bfa](https://github.com/marllonfilipe/vantplatform/commit/dff0bfaa04932098233d4f6fd6644f315d3cd02a). Passaram a [fundação com o teste de concorrência](https://github.com/marllonfilipe/vantplatform/actions/runs/44751419545) e a [suíte de inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44751419595).

## Atribuição de responsável no CRM

Em **Automações**, selecione um evento de novo lead, alteração de score, qualificação ou oportunidade criada, movimentada ou perdida. Escolha **Atribuir responsável** como ação principal, alternativa ou etapa e selecione um membro ativo da empresa. O fluxo mantém essa escolha na versão publicada. A ação atua sobre o lead ou a oportunidade que originou o evento. A opção fica indisponível para o gatilho genérico de atualização de lead, para impedir que uma reatribuição realimente o mesmo conjunto de fluxos.

Na API, o valor de ação é `assign_owner`. O membro de destino vai em `action_owner_id` na ação principal, em `else_owner_id` na alternativa e em `owner_id` nas etapas. O worker volta a consultar o autor e o destino antes da execução. Se o destino estiver inativo, o histórico indica o motivo e a fila aplica a política de retentativas. Uma atribuição efetiva aparece no histórico do CRM, na auditoria e na tentativa do fluxo. Quando o registro já pertence ao responsável escolhido, o monitor registra esse resultado e segue para a próxima etapa.

A suíte de fundação executa `tests/assignment.integration.mjs`. Ela publica um fluxo pelo Chromium, provoca a inativação e reativação do destino no banco descartável e confere o responsável de um lead após a troca de versão. Também verifica isolamento entre empresas, caminho alternativo de uma oportunidade, reatribuição ao mesmo membro e o responsável da tarefa subsequente. A missão segue parcial. A próxima ação independente é notificação interna com destinatário e histórico.

A atribuição foi publicada em [c66dfe0](https://github.com/marllonfilipe/vantplatform/commit/c66dfe0c4d71066350df55fbbdb384c584267d2a). Passaram a [fundação com o teste de atribuição](https://github.com/marllonfilipe/vantplatform/actions/runs/44752259890) e a [suíte de inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44752259860).

## Notificações internas para o responsável

Em **Automações**, selecione **Notificar responsável** como ação principal, alternativa ou etapa. O título informado aparece em **Alertas da operação → Suas notificações** para a pessoa responsável pelo registro no momento da ação. A notificação permanece disponível após a leitura. O monitor do fluxo registra a criação da notificação. Esse resultado é distinto da leitura pelo destinatário.

A API de fluxos aceita `notify_owner`. O worker persiste a notificação, a posição do fluxo e a tentativa na mesma transação. Uma restrição de unicidade garante uma entrega por empresa, trabalho e etapa. `GET /api/v1/notifications` pagina os itens da sessão por `limit` e `cursor`. `POST /api/v1/notifications/{id}/read` registra a primeira leitura e preserva esse instante nas chamadas seguintes.

Em `tests/notifications.integration.mjs`, subprocessos do worker entregam duas notificações de um fluxo. A API verifica ordem, paginação e restrição ao destinatário em duas empresas. O Chromium entra com a conta destinatária e marca um dos itens como lido. O estado da outra notificação é conferido na API. Consulte os checks da revisão para o resultado. A missão segue parcial. O próximo incremento independente é registrar uma atividade comercial no histórico do CRM a partir de um fluxo.

As notificações foram publicadas em [6a01963](https://github.com/marllonfilipe/vantplatform/commit/6a01963e282c2820d4cb62c4f892e73c9871de4e). Passaram a [fundação com o cenário de leitura no Chromium](https://github.com/marllonfilipe/vantplatform/actions/runs/44752716088) e a [suíte de inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44752715927).

## Registro de atividade no CRM

**Registrar comentário no CRM** cria uma atividade concluída do tipo `comment`, com o título publicado na versão do fluxo. O responsável é o do registro no momento da execução. A agenda mostra o comentário, e o histórico dos leads e oportunidades vinculados exibe seu texto, autor, fluxo, execução e número de etapa. O registro de um comentário interno preserva a data da última interação com o cliente.

A ação funciona como principal, alternativa ou etapa posterior. Em `tests/timers.integration.mjs`, o worker conclui um fluxo de quatro ações após pausa e retentativa. O teste consulta a atividade, o histórico do lead e a data de contato e verifica que a anotação foi registrada uma única vez. A suíte de fundação da revisão contém a evidência. A missão segue parcial. A próxima atividade independente é atualizar campos comerciais de um lead ou oportunidade com auditoria.

Os comentários de fluxo foram publicados em [a264d2b](https://github.com/marllonfilipe/vantplatform/commit/a264d2bb6afac0cbda12578ef8298ddc752cdf42). Passaram a [fundação com a sequência de quatro ações](https://github.com/marllonfilipe/vantplatform/actions/runs/44753122430) e a [suíte de inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44753122438).

## Atualizações comerciais por fluxo

Em **Automações**, escolha **Atualizar registro do CRM**. Para novo lead, qualificação e alteração de score, o gestor pode definir o segmento ou acrescentar uma tag preservando as anteriores. Para oportunidade criada, movimentada ou perdida, pode definir a probabilidade em porcentagem inteira de 0 a 100. O campo exibido acompanha o gatilho selecionado. A opção fica disponível na ação principal, no caminho alternativo e nas etapas. O evento genérico de atualização de lead fica fora desse conjunto para evitar realimentação.

A API recebe `update_record` e os parâmetros `action_changes`, `else_changes` ou `changes`, conforme a posição. Para lead, aceita `segment` e `add_tag`; para oportunidade, `probability`. O worker lê o registro sob bloqueio e aplica os valores da versão capturada pelo evento. Se os valores já coincidirem, o histórico do fluxo indica isso. Alterações efetivas têm os valores anteriores e posteriores na trilha do CRM.

A suíte de fundação executa `tests/flow-updates.integration.mjs`. O teste publica no Chromium, cria um lead com tag anterior, publica uma versão diferente e confere a atualização pelo worker e a trilha do CRM. Uma oportunidade exercita a ação alternativa, a etapa repetida e a preservação de valor e estágio. Os checks da revisão registram o resultado. A missão continua parcial. A próxima atividade independente é gerar um resumo interno do registro a partir dos dados do CRM e do Intelligence Core.
