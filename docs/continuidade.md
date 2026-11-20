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
