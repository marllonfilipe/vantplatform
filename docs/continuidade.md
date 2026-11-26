# Continuidade enquanto a Missão 05 aguarda homologação

Diretriz do proprietário de 19/11/2026. O cronograma original, as entregas já publicadas e os critérios de aceite continuam vigentes. A regra temporária permite trabalhar por dependência técnica. Cada revisão deve consultar este documento, os relatórios de missão, as branches, os pull requests e os testes antes de iniciar trabalho.

A Missão 05 permanece pendente do pareamento e da troca de mensagens entre aparelhos autorizados. Para reconhecer seu aceite, conferir o job de homologação ao vivo efetivamente executado e aprovado, ou evidência equivalente registrada pelo proprietário. Uma execução ignorada e a suíte de infraestrutura não comprovam esse aceite. Até lá, os incrementos seguintes usam dados do CRM e da própria plataforma. Concluída a homologação, retomar a primeira entrega pendente na ordem original e integrar os itens de canal adiados.

| Missão | Trabalho independente que pode ser implementado e testado | Dependências para completar |
|---|---|---|
| 06 · Intelligence Core | Inferência local com pesos abertos, documentos e vetores isolados, memória comercial, qualificação de leads e análise de oportunidades do CRM | Pesos instalados no host controlado, testes reais de isolamento, recuperação, latência e qualificação |
| 07 · Agentes e copiloto | Consultas no CRM, preparação de reuniões, priorização e propostas de ações internas com aprovação, histórico e interrupção | Core para análises. Atendimento e interação pelo WhatsApp aguardam 05 |
| 08 · Automações | Editor e versões, fila, esperas, condições e ações de CRM, auditoria e retentativas | Core para ações de IA, billing para eventos de assinatura. Gatilhos de mensagens e envios aguardam 05 |
| 09 · Prospecção | ICP, fontes autorizadas, contas, decisores, listas, importação e conversão no CRM | Core para classificação e recomendação. Enriquecimento externo exige fonte autorizada |
| 10 · Receita | Indicadores, previsão documentada, relatórios e exportações sobre CRM, filtros por origem e vendedor | Core para análise executiva. Atribuição específica ao WhatsApp aguarda 05 |
| 11 · Integrações e cobrança | Planos configuráveis, assinaturas, franquias, limites no backend e adaptadores de outros serviços | Credenciais e sandbox de cada provedor para homologar. Reconexão e consumo real do WhatsApp aguardam 05 |
| 12 · Enterprise | Unidades, políticas de acesso, governança, retenção, sessão, APIs, testes de carga e restauração | Homologação do ambiente e de cada módulo para aceite de produção |
| 13 · Control Center | Identidades administrativas separadas, permissões, gestão de tenants e auditoria sobre módulos existentes | Financeiro depende de 11. Monitoramento do Core depende de 06. Monitoramento operacional do WhatsApp aguarda 05 |

## Retomada

Publicar cada incremento com seu relatório e evidência de teste. Manter em aberto os critérios ainda sem evidência. Se uma parte depender de serviço indisponível, seguir para o próximo item tecnicamente executável. Ao esgotar o trabalho independente, a tarefa existente aguarda a execução programada seguinte.

O último relatório numerado pode representar trabalho parcial. Consulte as pendências de cada missão antes de fechar a etapa ou escolher o próximo incremento.

## Ponto de retomada da execução

As entregas 01–04 têm relatórios no diretório `docs/missoes`. A [revisão de regressões 01–05](https://github.com/marllonfilipe/vantplatform/pull/1) foi incorporada à main. A missão 05 continua em homologação.

| Missão | Entrega mais recente | Evidência e próxima atividade |
|---|---|---|
| 06 | Inferência, documentos, catálogo, análise de leads e oportunidades, histórico de tarefas e métricas | [Relatório e testes](missoes/06-inteligencia.md). Avaliar recomendações com dados representativos e capacidade no host de implantação. |
| 07 | Propostas de tarefa, consultas do copiloto, reuniões, recuperação, indicadores executivos, follow-ups, SDR e supervisão de ações no CRM | [Relatório](missoes/07-agentes.md). Verificar os checks do commit e conferir consultas por empresa e etapa, e avançar no fluxo interno de novo lead da missão 08. |
| 08 | Fluxos de lead, oportunidade, reunião, qualificação, vencimento e inatividade, ramificações e etapas encadeadas de tarefas, lembretes e follow-ups com espera, monitor e intervalo mínimo por fluxo | [Relatório](missoes/08-automacoes.md). Conferir os checks do worker e do Chromium. O [limite de frequência passou no CI](https://github.com/marllonfilipe/vantplatform/actions/runs/44751419545). A [atribuição de responsável passou no CI](https://github.com/marllonfilipe/vantplatform/actions/runs/44752259890). A [notificação interna passou no CI](https://github.com/marllonfilipe/vantplatform/actions/runs/44752716088). O [comentário no CRM passou no CI](https://github.com/marllonfilipe/vantplatform/actions/runs/44753122430). As atualizações de segmento, tag e probabilidade têm cenário em `tests/flow-updates.integration.mjs`. Conferir os checks e seguir para resumo interno com CRM e Core. |
| 09–13 | Sem entrega integral registrada nesse ponto de retomada | Os critérios e dependências por missão constam da tabela acima e do cronograma. |

A evidência de CI pertence ao commit testado. Nas próximas execuções, conferir o histórico e os checks mais recentes da main antes de retomar.

## Validação dos incrementos da Missão 08 em 20/11/2026

| Incremento | Commit testado | Fundação SaaS | Inteligência local |
|---|---|---|---|
| Frequência | [dff0bfa](https://github.com/marllonfilipe/vantplatform/commit/dff0bfaa04932098233d4f6fd6644f315d3cd02a) | [Aprovada](https://github.com/marllonfilipe/vantplatform/actions/runs/44751419545) | [Aprovada](https://github.com/marllonfilipe/vantplatform/actions/runs/44751419595) |
| Atribuição | [c66dfe0](https://github.com/marllonfilipe/vantplatform/commit/c66dfe0c4d71066350df55fbbdb384c584267d2a) | [Aprovada](https://github.com/marllonfilipe/vantplatform/actions/runs/44752259890) | [Aprovada](https://github.com/marllonfilipe/vantplatform/actions/runs/44752259860) |
| Notificação | [6a01963](https://github.com/marllonfilipe/vantplatform/commit/6a01963e282c2820d4cb62c4f892e73c9871de4e) | [Aprovada](https://github.com/marllonfilipe/vantplatform/actions/runs/44752716088) | [Aprovada](https://github.com/marllonfilipe/vantplatform/actions/runs/44752715927) |
| Comentário | [a264d2b](https://github.com/marllonfilipe/vantplatform/commit/a264d2bb6afac0cbda12578ef8298ddc752cdf42) | [Aprovada](https://github.com/marllonfilipe/vantplatform/actions/runs/44753122430) | [Aprovada](https://github.com/marllonfilipe/vantplatform/actions/runs/44753122438) |
| Alteração do CRM | [1ea0100](https://github.com/marllonfilipe/vantplatform/commit/1ea01003338841be744b0a631c161f7ebb9ecd90) | [Aprovada](https://github.com/marllonfilipe/vantplatform/actions/runs/44753548026) | [Aprovada](https://github.com/marllonfilipe/vantplatform/actions/runs/44753547952) |

A última execução de fundação voltou a passar pelos cinco cenários na mesma revisão. O [relatório técnico](missoes/08-automacoes.md) reúne as instruções de operação e os testes de cada incremento. A implementação da Missão 08 continua parcial. O marco que gera relatório de conclusão no ChatGPT e envio por e-mail ainda está pendente. O próximo trabalho independente é o resumo interno do lead ou da oportunidade com o CRM e o Intelligence Core.

## Missão 08 · Resumo comercial

O worker grava o resumo de leads e oportunidades no histórico da etapa, com a análise disponível no Core no momento da execução. Os testes estão em `tests/flow-updates.integration.mjs` e `tests/core/knowledge.test.mjs`. Conferir os checks do commit e continuar a ação supervisionada de agente do CRM. A entrega é parcial.

## Missão 08 · Agente comercial nos fluxos

O [resumo comercial](https://github.com/marllonfilipe/vantplatform/commit/062de758d1486895ed372b62621cf880608ca26c) passou nas suítes de [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44796885432) e [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44796885285). A ação seguinte gera análise e proposta interna, sujeita à supervisão e à franquia da empresa. O cenário de validação está em `tests/core/knowledge.test.mjs`. Conferir os checks da revisão e avançar na condição de comportamento do CRM. O marco de implementação integral segue pendente.

## Missão 08 · Condição de comportamento

O editor permite ramificar pelo último tipo de interação concluída no CRM nos últimos trinta dias. A suíte de fundação confere isolamento por registro, exclusão das atividades inelegíveis e preservação do comportamento observado em cada evento. A próxima atividade independente é tornar a sequência e as ramificações visíveis durante a edição do fluxo.

O [agente supervisionado](https://github.com/marllonfilipe/vantplatform/commit/1d57f63d78352dea35ef3d85d51ed3db439c4fb5) passou na [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44797316529) e no [Core com processo real do worker](https://github.com/marllonfilipe/vantplatform/actions/runs/44797316451). A proposta ficou pendente no CRM.

## Missão 08 · Mapa e edição da ordem

O editor exibe gatilho, condições, esperas, caminhos e encerramento e permite reordenar as etapas antes de publicar a versão. O teste da interface está em `tests/automation.integration.mjs`. A próxima atividade independente é a entrega de webhook de saída com destino configurado pelo operador, histórico e retentativas.

A [condição de comportamento](https://github.com/marllonfilipe/vantplatform/commit/5c33845fb53bf494c34920151c33f7c66c7162d8) passou na [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44797651317) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44797651315).

## Missão 08 · Webhook de saída

O fluxo pode entregar um evento assinado ao receptor configurado para a empresa. A validação técnica usa HTTPS real e um receptor descartável na suíte de fundação. A homologação de implantação requer um receptor autorizado e sua configuração no ambiente do worker. Os gatilhos de mensagens e assinatura continuam dependentes das missões 05 e 11. O próximo trabalho independente é o cadastro de perfil de cliente ideal e a seleção de empresas-alvo na Missão 09.

O [mapa e a edição de ordem](https://github.com/marllonfilipe/vantplatform/commit/231ba29efee08842f8b573ee6a51490b300f106b) passaram na [fundação com Chromium](https://github.com/marllonfilipe/vantplatform/actions/runs/44797989215) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44797989195).

## Missão 09 · Perfil e contas-alvo do CRM

O [webhook da Missão 08](https://github.com/marllonfilipe/vantplatform/commit/c08f4e9b5cb799e158e53abd252358f343387ca4) passou na [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44798377361) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44798377358). A Missão 09 começou com perfis de cliente ideal e listas de empresas do CRM, com origem da seleção, paginação e auditoria. O [relatório da missão](missoes/09-prospeccao.md) descreve o teste e os critérios restantes. O próximo incremento é a importação CSV de contas com origem autorizada e deduplicação. A missão permanece parcial.

## Missão 09 · Importação e origem de contas

O CSV vincula as contas ao perfil escolhido e ao CRM, conserva os dados existentes e registra cada fonte. A suíte de fundação cobre concorrência, isolamento, validação do lote e importação na interface. A próxima atividade independente é a classificação de aderência ao ICP pelo Core. A implementação continua parcial.

Os [perfis e a seleção no CRM](https://github.com/marllonfilipe/vantplatform/commit/033435f604636bf89ebb08e31d5decbc02dba0e1) passaram na [fundação com Chromium e PostgreSQL](https://github.com/marllonfilipe/vantplatform/actions/runs/44798921819) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44798921771).

## Missão 09 · Classificação de aderência

A [importação CSV](https://github.com/marllonfilipe/vantplatform/commit/5aa6fc546c85a34e95e7af18b4b3068933faf326) passou na [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44799366675) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44799366656). A classificação de empresas-alvo usa o modelo local e critérios estruturados, registra a evidência por critério e ordena a lista por aderência atual. O cenário está em `tests/core/prospecting.test.mjs`. A próxima atividade é o registro assistido de decisores e a conversão em lead do CRM. A entrega permanece parcial.

## Missão 09 · Decisores e conversão

A [classificação por ICP](https://github.com/marllonfilipe/vantplatform/commit/868ea99ecaba34ac13eca1125cc911b7758272d9) passou na [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44799783735) e no [Core com modelo local e Chromium](https://github.com/marllonfilipe/vantplatform/actions/runs/44799783736). A ficha da conta registra dados profissionais fornecidos pelo operador, a fonte, a revisão e o vínculo com o lead. Conferir os checks da revisão. Próxima atividade independente: sugestões de contato e oportunidade baseadas na aderência e nos registros do CRM. A implementação permanece parcial.

## Missão 09 · Sugestões para prospecção

O Core combina o ICP, cargos registrados e o estado do funil para sugerir contatos e uma abordagem comercial verificável. O teste de CPU e Chromium está em `tests/core/prospecting.test.mjs`. Próxima atividade: revisão e aplicação de enriquecimentos de fontes autorizadas em campos ausentes do CRM. O aceite continua em aberto.

Os [decisores e a conversão para lead](https://github.com/marllonfilipe/vantplatform/commit/8fdaf445f7b488edbbd38c7933b20a2b0f81dc2f) passaram na [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44800441262) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44800441301).

## Missão 09 · Revisão de enriquecimentos

O fluxo de importação agora propõe valores para campos vazios. A equipe pode revisar a origem e aplicar ou descartar o enriquecimento. A ficha profissional admite preenchimento assistido a partir de texto fornecido e salva somente após revisão. A matriz dos seis critérios originais está no [relatório](missoes/09-prospeccao.md). Confirmar as duas suítes desta revisão antes de registrar o marco de implementação e os canais de relatório. O aceite do proprietário está pendente.

A [sugestão de abordagem e oportunidades](https://github.com/marllonfilipe/vantplatform/commit/7023d36b5de578cd5cc0fd435ea70af88b35831d) passou na [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44800800557) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44800800478).

## Missão 09 · Implementação publicada

Os seis critérios originais têm funcionalidades e cenários vinculados no [relatório técnico](missoes/09-prospeccao.md). Aceite do proprietário pendente. [Commit de implementação](https://github.com/marllonfilipe/vantplatform/commit/3116617cdda959dcb7178c0b9d5b680cd745d7d2) · [Fundação com PostgreSQL e Chromium](https://github.com/marllonfilipe/vantplatform/actions/runs/44801218074) · [Inteligência com inferência em CPU](https://github.com/marllonfilipe/vantplatform/actions/runs/44801218116)

Relatório apresentado no ChatGPT para o marco `3116617`. Envio por e-mail confirmado pela cópia em Itens Enviados para o mesmo marco. Leitura pelo destinatário sem confirmação.

## Missão 10 · Receita dos negócios fechados

Primeiro incremento da missão. O [relatório técnico](missoes/10-receita.md) descreve a apuração, o período e as permissões. Conferir as duas suítes no commit desta entrega. A implementação e o aceite da missão continuam em aberto.

## Missão 10 · Exportação da receita fechada

O [primeiro painel de fechamentos](https://github.com/marllonfilipe/vantplatform/commit/08e72f83aa1c63087d318867a788436eb8004b41) passou nas suítes de [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44846308192) e [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44846308225). Foram conciliados dois ganhos e uma perda, inclusive os limites de data em São Paulo. A tela agora permite exportar a consulta em CSV e imprimir para PDF. O teste do navegador verifica download e geração do documento. Conferir os checks desta revisão. Próxima atividade independente: recortes por equipe, segmento e pipeline. Aceite da missão pendente.

## Missão 10 · Recortes gerenciais

A [exportação da consulta](https://github.com/marllonfilipe/vantplatform/commit/14552464759b624dbd3ef6bfd64fbde7884d6415) passou na [fundação, com download CSV e geração de PDF pelo Chromium](https://github.com/marllonfilipe/vantplatform/actions/runs/44846562533) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44846562575). O painel ganha agrupamentos e filtros combináveis por equipe do negócio, segmento e pipeline. O teste verifica conciliação dos valores e registros sem atribuição. Conferir os checks desta revisão antes de avançar à previsão documentada sobre oportunidades abertas. A missão continua parcial.

## Missão 10 · Projeção pela probabilidade registrada

O [recorte gerencial](https://github.com/marllonfilipe/vantplatform/commit/96d4827d7b9bc357d2abe9803b476041c41cb5f5) passou no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44846819444). Na [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44846819356), os cálculos passaram e o Chromium não conseguiu selecionar o pipeline pelo nome acessível exato. Esta revisão define nomes explícitos nos seletores, conserva a asserção e acrescenta a projeção da carteira por horizonte. O relatório explica o arredondamento, as exclusões e o cenário de teste. Revalidar os filtros, o CSV, a impressão, a projeção e as duas suítes. A próxima atividade é confrontar a estimativa com o histórico comercial e evidenciar a suficiência da amostra. A implementação da missão continua parcial.

## Missão 10 · Comparação histórica da previsão

O [horizonte de projeção e a correção dos seletores](https://github.com/marllonfilipe/vantplatform/commit/b86be3fe90fb36d5201735d48097bd24eeaad3ff) passaram na [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44847064112) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44847064105), incluindo o filtro de pipeline que falhou na revisão anterior. A nova comparação apresenta por pipeline a conversão observada, o tamanho da amostra, a idade média das negociações abertas e o ciclo médio dos ganhos. A referência sazonal depende de histórico suficiente. Os critérios, as limitações e os cenários estão no [relatório da missão](missoes/10-receita.md). Conferir as duas suítes deste commit. Próxima atividade independente: conciliar a passagem entre etapas do funil com o histórico de movimentação do CRM. Aceite da missão pendente.

## Missão 10 · Conversão entre etapas

As suítes de [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44847302197) e [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44847302162) passaram no [comparativo histórico](https://github.com/marllonfilipe/vantplatform/commit/0297c66cb0909ef98a0945ecc68ea63d7163f79b). A entrega seguinte mede a passagem entre etapas a partir das entradas e saídas registradas, com destino, tamanho da amostra e exportação. A metodologia está no [relatório de receita](missoes/10-receita.md). O cenário em PostgreSQL e Chromium cobre reentrada, retorno, salto, fronteiras de data, carteira do vendedor e outra empresa. Confrontar o resultado dos checks com a revisão publicada. A Missão 10 continua parcial. A próxima atividade independente é a análise de atividades comerciais e produtividade por período e responsável.

## Missão 10 · Atividades e produtividade

A conversão entre etapas foi integrada no [PR #2](https://github.com/marllonfilipe/vantplatform/pull/2), após aprovação das suítes de [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45849430808) e [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/45849430912) na [revisão de código](https://github.com/marllonfilipe/vantplatform/commit/7eb2e896b49040abfe018e5b799f4f6951f189c0). O próximo incremento apresenta o volume de atividades concluídas, os vencimentos e a pontualidade por responsável e tipo, na tela, no CSV e na impressão. O teste verifica prazo exato, conclusão tardia, ausência de prazo, encerramento depois do corte, filtros e isolamento. O relatório da missão define os denominadores. Conferir os checks da revisão. A próxima atividade independente é gestão de metas por período e responsável, com conciliação da receita ganha. A missão continua parcial.

## Missão 10 · Metas mensais

O [PR #3](https://github.com/marllonfilipe/vantplatform/pull/3) integrou os indicadores de atividade após aprovação da [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45850078651) e do [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/45850078576) na [revisão de código](https://github.com/marllonfilipe/vantplatform/commit/ea2cc07940bac2727a6158433dca804b7070c55e). A entrega seguinte registra metas mensais por responsável com auditoria, verifica a revisão em cada escrita e reconcilia o atingimento com as oportunidades ganhas. O cenário em PostgreSQL e Chromium verifica duas gravações concorrentes, alteração na interface, percentuais e isolamento. Conferir o resultado das suítes na revisão publicada. A próxima atividade independente é a análise executiva contextual com os indicadores de receita e evidências do CRM. A missão e o ciclo continuam em desenvolvimento.

## Missão 10 · Análise executiva contextual

O [PR #4](https://github.com/marllonfilipe/vantplatform/pull/4) integrou as metas mensais após aprovação da [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45851760297) e do [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/45851760359) na [revisão testada](https://github.com/marllonfilipe/vantplatform/commit/c8d9ce9ddf6c6f346fa7a23c2854e66b075484ca). A revisão seguinte acrescenta uma análise executiva filtrada com comparação temporal, riscos da carteira, oportunidade por valor ponderado, prioridades e referências recuperadas pelo Core. O cenário de integração exercita a inferência em CPU e os documentos CSV e PDF no Chromium. Conferir os checks do pull request. A próxima atividade é verificar a cobertura de conversão por canal comercial em relação à origem de captação e à integração ainda em homologação. A missão segue parcial.

## Missão 10 · Canal comercial e cobertura dos critérios

A [análise executiva](https://github.com/marllonfilipe/vantplatform/pull/5) entrou na main após sucesso da [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45891730039) e do [Core com inferência em CPU, CSV e PDF](https://github.com/marllonfilipe/vantplatform/actions/runs/45891730139) na [revisão de código](https://github.com/marllonfilipe/vantplatform/commit/cc7d5d4947ab4e0b594a1e43b11d567bf1d34073). O incremento de canal atribuído pelo responsável mantém o histórico e separa canal e origem no relatório. A matriz dos sete critérios originais está no [relatório técnico](missoes/10-receita.md). Conferir as duas suítes desta revisão, o merge e o estado das notificações antes de registrar o marco integral de implementação. O aceite humano permanece pendente. A próxima frente independente é a Missão 11, começando pelo cadastro e controle dos planos.

## Missão 10 · Implementação publicada em 26/11/2026

O [PR #6](https://github.com/marllonfilipe/vantplatform/pull/6) entrou na main às 17h39 de Brasília pelo [merge](https://github.com/marllonfilipe/vantplatform/commit/0f396369d238fb99b8dac6c7a156a5f19b7a7aaa). Os testes da [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45892144179) e do [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/45892144256) passaram na [revisão da conversão por canal](https://github.com/marllonfilipe/vantplatform/commit/e7b4a6c4b51cb0adb4f893800485630a4676d8f6). O [relatório técnico](missoes/10-receita.md) mapeia os sete critérios originais. Aceite operacional pendente.

O relatório deste marco foi apresentado no ChatGPT. O Outlook confirmou a operação de envio com cópia em Itens Enviados. O recebimento e a leitura pelo destinatário seguem sem confirmação.

## Missão 11 · Catálogo de planos

A primeira entrega independente disponibiliza os quatro planos originais, preços, recursos previstos e limites em Financeiro. O [relatório](missoes/11-integracoes-cobranca.md) descreve o acesso e os testes de API, permissões no PostgreSQL e tela em Chromium. Conferir as duas suítes no PR desta entrega. A missão continua parcial. A próxima atividade é vincular planos às empresas e medir o consumo para aplicar os limites no backend.

## Missão 11 · Vínculo e capacidade por empresa

O [catálogo comercial](https://github.com/marllonfilipe/vantplatform/pull/7) foi integrado após sucesso das suítes de [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45892858086) e [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/45892858049) no [commit testado](https://github.com/marllonfilipe/vantplatform/commit/d2763fd8a083fcc1587603e5c064bb688999fbf5). A entrega seguinte implementa o vínculo comercial versionado, a medição e os limites de usuários, leads e pipelines. O [relatório técnico](missoes/11-integracoes-cobranca.md) descreve a operação e os testes. Conferir os checks do PR antes do merge. Na sequência, confrontar as demais franquias de uso com a medição já existente de agentes e documentos. O ciclo financeiro, o Integration Hub e a missão permanecem parciais.

## Missão 11 · Franquia de armazenamento e alertas

O [PR #8](https://github.com/marllonfilipe/vantplatform/pull/8) integrou os vínculos comerciais e os três primeiros limites. A [revisão testada](https://github.com/marllonfilipe/vantplatform/commit/483eb2d0eaa28f7033bd448044b2dfd8a38cd93d) passou nas suítes de [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45893392834) e [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/45893392808). O incremento seguinte controla os bytes lógicos de documentos e anexos e exibe alertas por recurso. O [relatório](missoes/11-integracoes-cobranca.md) descreve o contrato e o teste de uploads simultâneos. O limite diário operacional já existente em Supervisão de agentes é um ponto de partida para a próxima entrega de franquias de execução. A missão continua parcial.
