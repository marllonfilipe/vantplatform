# Continuidade enquanto a Missão 05 aguarda homologação

Diretriz do proprietário de 19/11/2026. O cronograma original, as entregas já publicadas e os critérios de aceite continuam vigentes. A regra temporária permite trabalhar por dependência técnica. Cada revisão deve consultar este documento, os relatórios de missão, as branches, os pull requests e os testes antes de iniciar trabalho.

A Missão 05 permanece pendente do pareamento e da troca de mensagens entre aparelhos autorizados. Para reconhecer seu aceite, conferir o job de homologação ao vivo efetivamente executado e aprovado, ou evidência equivalente registrada pelo proprietário. Uma execução ignorada e a suíte de infraestrutura não comprovam esse aceite. Até lá, os incrementos seguintes usam dados do CRM e da própria plataforma. Concluída a homologação, retomar a primeira entrega pendente na ordem original e integrar os itens de canal adiados.

## Situação das 13 missões em 27/11/2026

Esta é uma revisão de continuidade. Os critérios originais de aceite constam do [cronograma](cronograma.md). A auditoria final ainda precisa confrontar cada requisito do plano original com código, testes, publicação e homologação.

| Missão | Entrega comprovada | Ponto que determina a continuidade |
|---|---|---|
| [01 · Arquitetura](missoes/01-arquitetura.md) | Inventário, arquitetura e mapa dos 12 módulos revisados no [PR #1](https://github.com/marllonfilipe/vantplatform/pull/1). | Confrontar a arquitetura final implantada com as decisões originais. |
| [02 · Fundação SaaS](missoes/02-fundacao.md) | Autenticação, revogação, papéis, isolamento entre empresas, migrações e restauração testados. | Manter a suíte de regressão e verificar os requisitos de operação em produção na auditoria. |
| [03 · Dashboard](missoes/03-dashboard.md) | Navegação, indicadores e filtros sobre a API. A regressão de histórico após desativar um vendedor foi corrigida no PR #1. | Reconciliar as telas e os indicadores com o escopo final. |
| [04 · CRM](missoes/04-crm.md) | Cadastro, importação de leads, funil, movimentação, atividades e histórico persistente. O teste de regressão cobre a data de fechamento. | Manter os cenários comerciais na suíte integrada. |
| [05 · Central de relacionamento e WhatsApp](missoes/05-whatsapp.md) | Inbox e infraestrutura Evolution exercitadas em CI. | Primeiro aceite pendente. Pareamento, tráfego nos dois sentidos e reconexão precisam de evidência real com os aparelhos autorizados. |
| [06 · Intelligence Core](missoes/06-inteligencia.md) | Inferência em CPU, vetores, memória documental, qualificação e análise sobre o CRM. | Avaliação comercial e capacidade no host de implantação. A memória de conversa depende da integração de canal. |
| [07 · Agentes e copiloto](missoes/07-agentes.md) | SDR assistido, reuniões, recuperação, consultas e supervisão das ações de CRM. | Implementação parcial. Atendimento por canal depende da 05. |
| [08 · Motor de automações](missoes/08-automacoes.md) | Editor, versões, worker, condições, espera, ações de CRM, ações do Core e webhook de saída. | Implementação parcial. Eventos de assinatura dependem da 11 e os de mensageria dependem da 05. |
| [09 · Prospecção](missoes/09-prospeccao.md) | Implementação publicada com ICP, listas, importação, decisores, classificação e conversão no CRM. | Aceite do proprietário pendente. Marco já relatado. |
| [10 · Receita e inteligência executiva](missoes/10-receita.md) | Implementação publicada com filtros, metas, projeções, conversão por canal, análise contextual e exportação. | Aceite operacional pendente. Relatório e envio já registrados. |
| [11 · Integrações e assinaturas](missoes/11-integracoes-cobranca.md) | Catálogo, vínculo versionado, limites de usuários, leads, pipelines, armazenamento, ações de agentes e fluxos. O Financeiro mostra consumo, histórico de planos e solicitações comerciais. A Central de integrações mostra lotes CSV e tentativas de webhook. Permite consultar Google Sheets, Google Calendar, empresas do HubSpot e organizações do Pipedrive. As leituras autenticadas desses quatro conectores aguardam evidência externa. | Implementação parcial. Restam os demais conectores, a ativação de assinaturas, as faturas e a conciliação com o gateway. |
| 12 · Enterprise e produção | A fundação já oferece isolamento, auditoria e restauração. Ainda não há marco integral da 12. | Implementar e validar multiunidade, governança e APIs corporativas, carga, observabilidade e preparação de produção. |
| 13 · Control Center | O provisionamento administrativo existente cobre parte das operações internas. Ainda não há marco integral da 13. | Desenvolver o controle global com identidade separada, operações por empresa, auditoria e monitoramento dos módulos. |

A transição para o segundo ciclo continua pendente de implementação e de auditoria. A homologação externa da 05 está registrada separadamente das lacunas técnicas. Os registros abaixo preservam a sequência de entregas e seus testes.

## Dependências entre as missões

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

## Missão 11 · Franquia diária de ações

A [franquia de armazenamento](https://github.com/marllonfilipe/vantplatform/pull/9) entrou na main após aprovação da [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45924518095) e da [inteligência local](https://github.com/marllonfilipe/vantplatform/actions/runs/45924518217) no [commit de referência](https://github.com/marllonfilipe/vantplatform/commit/3e2202da824e55be0b974e5f06bf045c5954adc1). O incremento seguinte aplica uma franquia diária contratual às ações confirmadas dos agentes e mostra o consumo no Financeiro. Usa a mesma reserva da supervisão e preserva o limite operacional da empresa. O [relatório técnico](missoes/11-integracoes-cobranca.md) detalha os testes de concorrência, rollback, virada de dia e limite zero. Conferir o CI deste incremento. A próxima frente independente é o controle da quantidade de automações por empresa. As assinaturas junto ao gateway, as demais franquias e as integrações continuam em desenvolvimento.

## Missão 11 · Automações ativas

O [PR #10](https://github.com/marllonfilipe/vantplatform/pull/10) integrou a franquia diária de ações dos agentes no [commit testado](https://github.com/marllonfilipe/vantplatform/commit/03132bff36efaba0c753c4b1f9902c1c28908eb7). A [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45924833891) e o [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/45924834092) passaram. A entrega seguinte reserva capacidade no momento de ativar uma automação e libera a vaga na pausa. O [relatório técnico](missoes/11-integracoes-cobranca.md) cobre o teste de ativações concorrentes, os alertas e o tratamento das empresas existentes. Conferir os checks na revisão publicada. A próxima atividade independente é documentar e medir o consumo de execuções de fluxos a partir das etapas e tentativas do worker, com deduplicação em reentregas. A missão financeira e o primeiro ciclo continuam em andamento.

## Missão 11 · Medição das execuções de fluxos

O [PR #11](https://github.com/marllonfilipe/vantplatform/pull/11) integrou o controle das automações ativas. No [commit de referência](https://github.com/marllonfilipe/vantplatform/commit/2b9b7c6284e7e2dba9430a24f38a0335e80b5134) passaram a [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45925130830) e o [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/45925130940). A nova consulta reconcilia execuções únicas, tentativas, pedidos de repetição e avaliações sem ação com o histórico existente. O [relatório](missoes/11-integracoes-cobranca.md) define as contagens e a verificação pelo worker e pelo navegador. Conferir as suítes desta revisão. A próxima atividade é aplicar a franquia de execuções antes da primeira ação, preservando a idempotência e as retomadas. A missão continua parcial, sem novo marco de envio de relatório integral.

## Missão 11 · Admissão diária de execuções

O [PR #12](https://github.com/marllonfilipe/vantplatform/pull/12) integrou a medição das execuções depois do sucesso da [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45925422012) e da [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/45925421968) no [commit testado](https://github.com/marllonfilipe/vantplatform/commit/8f7252f93c0c4e4b3d8e8b4f14b708c7478a451b). A entrega seguinte aplica capacidade contratual antes da primeira ação elegível de cada execução e mantém os trabalhos excedentes na fila. A cobertura de concorrência e de retomada consta do [relatório](missoes/11-integracoes-cobranca.md). O [PR #13](https://github.com/marllonfilipe/vantplatform/pull/13) entrou na main após aprovação da [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45926265693) e do [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/45926265705) na [revisão testada](https://github.com/marllonfilipe/vantplatform/commit/7d0d65344917acb628fd8df546b38df646f5d405). Dois workers disputaram uma vaga e um job permaneceu em fila com zero tentativas. Após ampliar o contrato, os dois jobs terminaram, cada um com duas atividades. A próxima atividade independente é medir as inferências do Core no ponto em que o modelo realmente processa os textos. Os chamadores diretos do modelo são conhecimento, copiloto, atas, classificação de prospecção e análise executiva. Billing, integrações, Enterprise e Control Center continuam com trabalho técnico em aberto.

## Missão 11 · Inferências do Core por empresa

As duas suítes passaram na [revisão anterior das missões](https://github.com/marllonfilipe/vantplatform/commit/7fb0f3d48e0249b7dc9a82d5d5676e676ecb19c0), incluindo [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45926661192) e [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/45926661226). A entrega seguinte registra os textos encaminhados ao modelo local, confirma os vetores que retornaram válidos e aplica a capacidade diária do contrato. A [documentação](missoes/11-integracoes-cobranca.md) explica as unidades, reservas pendentes e testes. Conferir as suítes desta revisão. A próxima frente independente é o histórico das condições comerciais no Financeiro e a preparação do ciclo de assinaturas. A Missão 11 segue parcial, sem marco integral de envio.

## Missão 11 · Histórico de contratos e início da homologação do gateway

O [PR #14](https://github.com/marllonfilipe/vantplatform/pull/14) integrou a franquia diária de inferências. O [primeiro teste do Core](https://github.com/marllonfilipe/vantplatform/actions/runs/45959293421) detectou que a fila recusava uma chamada antes do limite existente. A [correção](https://github.com/marllonfilipe/vantplatform/commit/092cd7e56cf4d22924551752f943aabe56a56107) passou em [inteligência com modelo em CPU](https://github.com/marllonfilipe/vantplatform/actions/runs/45959555656) e na [fundação com PostgreSQL e Chromium](https://github.com/marllonfilipe/vantplatform/actions/runs/45959555589). O consumo confirmado persiste mesmo quando o CRM desfaz a operação comercial.

A entrega seguinte disponibiliza o histórico paginado dos vínculos por empresa e a verificação de conexão no sandbox do Asaas. Acesso autenticado exige a chave privada do ambiente de homologação. As instruções, a comparação dos provedores e o alcance dos testes estão no [roteiro de conexão](missoes/11-asaas-sandbox.md). Conferir os checks do PR. A próxima frente independente é o vínculo de assinaturas do sandbox por referência externa e a conciliação das mudanças de estado. A Missão 11 continua parcial.

## Missão 11 · Solicitações de assinatura

O [PR #15](https://github.com/marllonfilipe/vantplatform/pull/15) integrou o histórico comercial após sucesso da [fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/45959981606) e do [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/45959981725) na [revisão testada](https://github.com/marllonfilipe/vantplatform/commit/5d1f0fdd3bca49804faf41c88c856a77f3deea0e). A [consulta pública ao Asaas](https://github.com/marllonfilipe/vantplatform/actions/runs/45959981665) recebeu HTTP 401 da API oficial. A etapa com credencial foi ignorada nesse PR. A ação externa de autenticação consta do [roteiro do sandbox](missoes/11-asaas-sandbox.md). Mantê-la pendente até uma execução autenticada com HTTP 200. O aceite do gateway e o processamento de pagamentos continuam em aberto.

O incremento independente registra, consulta e cancela o interesse de assinatura pelo proprietário, com preço de referência do catálogo, auditoria e idempotência. Conferir os checks do PR, incluindo a navegação em Chromium. A solicitação não efetiva uma assinatura no provedor, não movimenta dinheiro e não ativa um plano. A próxima atividade independente é consolidar as integrações já implementadas numa visão de estado da empresa. Vínculos e conciliação do gateway precisam de evidência autenticada. A Missão 11 continua parcial.

## Missão 11 · Central de integrações para CSV e webhook

A solicitação comercial foi integrada pelo [PR #16](https://github.com/marllonfilipe/vantplatform/pull/16). A [revisão testada](https://github.com/marllonfilipe/vantplatform/commit/2935aa119d5c1cc0c32e6f82155c69ee8ad1453f) passou na [fundação com PostgreSQL e Chromium](https://github.com/marllonfilipe/vantplatform/actions/runs/45960378924) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/45960378941). O incremento seguinte reúne as evidências de importação e entrega de webhooks por empresa. Os testes verificam rollback de lote, isolamento, acesso pelo navegador e resultados HTTP do worker. O [relatório técnico](missoes/11-integracoes-cobranca.md) descreve o acesso à central. Conferir as suítes do PR. A Missão 11 continua parcial. A próxima atividade independente é ampliar as evidências operacionais da central e prosseguir com os conectores previstos no plano.

## Resultado de 27/11/2026 · Missão 11

O [PR #16](https://github.com/marllonfilipe/vantplatform/pull/16) entrou na `main` no [commit da solicitação de assinatura](https://github.com/marllonfilipe/vantplatform/commit/9ded46c921e83a63648744dce5351d94b4c3aea1). O [PR #17](https://github.com/marllonfilipe/vantplatform/pull/17) entrou no [commit da Central de integrações](https://github.com/marllonfilipe/vantplatform/commit/fe173350824ac8241c26317e8fb6f19fae6222e5). Na [revisão testada](https://github.com/marllonfilipe/vantplatform/commit/778c151991b5db5bf055e2486708f2b3afcdaffc), passaram a [fundação com PostgreSQL e Chromium](https://github.com/marllonfilipe/vantplatform/actions/runs/46001784255) e o [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/46001784207). A suíte verificou lote CSV confirmado, reversão de lote com erro, isolamento por empresa, acesso no navegador e duas respostas do receptor HTTPS de teste do worker (429 e 204).

A próxima atividade independente é registrar o último erro de importação CSV por empresa na Central, preservando a reversão integral do lote e omitindo os valores das linhas importadas. A conexão autenticada do Asaas aguarda a execução descrita no [roteiro de homologação](missoes/11-asaas-sandbox.md). A Missão 11 continua parcial. O marco é um incremento interno da plataforma, sem envio de relatório integral por e-mail.

## Missão 11 · Erros de importação por empresa

A Central de integrações apresenta o último lote CSV recusado no CRM ou na prospecção. O [relatório técnico](missoes/11-integracoes-cobranca.md) documenta as categorias e o que o operador vê. A suíte de regressão exercita dois locatários, permissões, dados inválidos, um conflito que exige reverter um lote e a consulta no Chromium. A Missão 11 continua parcial. A próxima frente independente é a leitura autorizada de planilhas do Google Sheets, com controle de acesso por empresa e registro do resultado na Central.

Em 27/11/2026, o [PR #18](https://github.com/marllonfilipe/vantplatform/pull/18) entrou na [main](https://github.com/marllonfilipe/vantplatform/commit/1029c07057dc41a7d1aa9a8c16b0a3aa09f48046). A [revisão testada](https://github.com/marllonfilipe/vantplatform/commit/85d3edcb6cbb4532be6ac2b03a2ebf4c8d6458f0) passou na [fundação com PostgreSQL e Chromium](https://github.com/marllonfilipe/vantplatform/actions/runs/46008725444) e na [inteligência local](https://github.com/marllonfilipe/vantplatform/actions/runs/46008725657). O CRM devolveu HTTP 409 para o lote duplicado e o registro anterior à duplicata foi revertido. A prospecção registrou dados inválidos e preservou o último erro depois de importar um lote válido. A recusa por franquia manteve o código HTTP e o motivo comercial. A segunda empresa continuou sem ocorrência. O navegador exibiu a categoria do conflito. Entrega parcial registrada no histórico. O próximo passo é a leitura de um intervalo autorizado do Google Sheets por empresa.

## Missão 11 · Google Sheets

A Central fornece leitura manual de um intervalo autorizado por empresa, com histórico de tentativas e acesso pela gestão. A implementação, os testes técnicos e o procedimento para obter evidência externa constam do [roteiro](missoes/11-google-sheets.md). A leitura com a conta de serviço real aguarda homologação. A Missão 11 continua parcial. A próxima frente independente é a consulta autorizada de eventos da agenda por empresa.

O [PR #19](https://github.com/marllonfilipe/vantplatform/pull/19) entrou na [main](https://github.com/marllonfilipe/vantplatform/commit/214c06c3eac2dedaa3319e03312d6b046b693807) em 27/11/2026. Na [revisão testada](https://github.com/marllonfilipe/vantplatform/commit/c9a65e40d66c866f8f9984fad7e10b60cac7fcfd) passaram a [fundação SaaS](https://github.com/marllonfilipe/vantplatform/actions/runs/46045949312) e o [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/46045949136). A fundação exercitou RSA com par de chaves gerado para o teste, escopo somente leitura, limites do intervalo, dados formatados e intervalo vazio, recusa de alteração do intervalo pelo cliente, isolamento entre empresas, permissões e a tela de gestão no Chromium. A suíte usou PostgreSQL e passou pela restauração do backup.

Ponto de retomada da tarefa **Continuar missões da V4NT**: conferir a execução de homologação autenticada do Sheets quando houver evidência no GitHub. A ação externa indicada ao operador é configurar a planilha de homologação e executar o [fluxo protegido](https://github.com/marllonfilipe/vantplatform/actions/workflows/google-sheets.yml) conforme o [roteiro](missoes/11-google-sheets.md). Em paralelo, prosseguir com a consulta autorizada do Google Calendar. O incremento da Missão 11 fica registrado no chat desta tarefa, sem marco de missão integral para envio de e-mail.

## Missão 11 · Google Calendar

A consulta dos próximos sete dias da agenda está disponível para a gestão na Central de integrações. O [roteiro](missoes/11-google-calendar.md) descreve configuração por empresa, limites de leitura e critérios de homologação externa. A implementação da Missão 11 continua parcial. A próxima frente independente é o conector de leitura do HubSpot com permissões por empresa.

Em 27/11/2026, o [PR #20](https://github.com/marllonfilipe/vantplatform/pull/20) entrou na [main](https://github.com/marllonfilipe/vantplatform/commit/92ac58eed4a123a10dae050e84069aea75dbbcb5). Na [revisão testada](https://github.com/marllonfilipe/vantplatform/commit/49affe0cdbabf3eeb13c42aa0757642d3b065d2b) passaram a [fundação com PostgreSQL e Chromium](https://github.com/marllonfilipe/vantplatform/actions/runs/46046752355) e o [Core com inferência local](https://github.com/marllonfilipe/vantplatform/actions/runs/46046752335). O teste local da prévia também passou. A suíte cobriu escopo somente leitura, janela de sete dias, dados privados, eventos de dia inteiro, limite de 50, indicação de mais resultados, separação de credenciais por empresa e recusa de substituição da agenda pelo cliente. A tela de gestão foi aberta no Chromium e a restauração do banco passou.

A tarefa **Continuar missões da V4NT** retoma pelo conector de leitura do HubSpot. Para homologar o Calendar, o operador compartilha a agenda de teste com a conta de serviço, configura o segredo no ambiente protegido e inicia o [fluxo de homologação](https://github.com/marllonfilipe/vantplatform/actions/workflows/google-calendar.yml), conforme o [roteiro](missoes/11-google-calendar.md). A integração fica pendente de leitura autenticada. Entrega parcial da Missão 11, sem marco integral de e-mail.

## Missão 11 · HubSpot

O conector consulta nome e domínio de até 50 empresas pela conta HubSpot configurada para a empresa da sessão. O [relatório técnico](missoes/11-hubspot.md) descreve acesso e homologação. O teste local de projeção de campos, paginação e limite passou. A Missão 11 continua parcial. A próxima frente independente é a consulta autorizada de organizações do Pipedrive.

Em 27/11/2026, o [PR #21](https://github.com/marllonfilipe/vantplatform/pull/21) entrou na [main](https://github.com/marllonfilipe/vantplatform/commit/745304f416c7f2d25ad13e743e047562e72ee405). A [revisão validada](https://github.com/marllonfilipe/vantplatform/commit/568dd498e1a0c585346c4f30981fad0ca7d5e445) passou na [fundação com PostgreSQL e Chromium](https://github.com/marllonfilipe/vantplatform/actions/runs/46048412003) e no [Core com inferência em CPU](https://github.com/marllonfilipe/vantplatform/actions/runs/46048412117). A fundação verificou o isolamento de duas empresas, permissões, a exibição no navegador e a restauração do banco. A [verificação pública](https://github.com/marllonfilipe/vantplatform/actions/runs/46048412129) recebeu HTTP 401 da API oficial. O job autenticado foi ignorado no PR. Nenhum cadastro de uma conta HubSpot foi lido nesta execução.

Para homologação, o operador cadastra o token de uma conta autorizada, com escopo de leitura de empresas, em `VANT_HUBSPOT_CHECK` no ambiente protegido `hubspot-homologacao` e executa o [fluxo](https://github.com/marllonfilipe/vantplatform/actions/workflows/hubspot.yml) na `main`. O [roteiro](missoes/11-hubspot.md) contém as instruções. A tarefa **Continuar missões da V4NT** retoma pelas organizações do Pipedrive. Entrega parcial da Missão 11, sem marco integral para envio de e-mail.

## Missão 11 · Pipedrive

O conector apresenta ID e nome das organizações de uma conta Pipedrive autorizada. A [documentação](missoes/11-pipedrive.md) detalha configuração, acesso pela Central e homologação externa. Passaram os dois testes locais do Pipedrive e a regressão da prévia do HubSpot. A Missão 11 continua parcial. A próxima frente independente é a consulta de organizações do RD Station CRM.

Em 27/11/2026, o [PR #22](https://github.com/marllonfilipe/vantplatform/pull/22) entrou na [main](https://github.com/marllonfilipe/vantplatform/commit/6eda25188ff7175571831b1410bcb9006a213fed). A [revisão testada](https://github.com/marllonfilipe/vantplatform/commit/8d36463ead0f7ed5b8339a0e5a5b0b9128b55e0c) passou na [fundação com PostgreSQL e Chromium](https://github.com/marllonfilipe/vantplatform/actions/runs/46055918412) e no [Core com inferência em CPU](https://github.com/marllonfilipe/vantplatform/actions/runs/46055918473). A suíte verificou autorização por papel, isolamento entre duas empresas, configuração privada e acesso à Central. A leitura em conta real permanece pendente. Para homologar, o operador configura `VANT_PIPEDRIVE_CHECK` no ambiente protegido `pipedrive-homologacao` e executa o [fluxo manual](https://github.com/marllonfilipe/vantplatform/actions/workflows/pipedrive.yml) na `main`, conforme o [roteiro](missoes/11-pipedrive.md).

A tarefa **Continuar missões da V4NT** retoma pela leitura de organizações do RD Station CRM. Este registro corresponde a uma entrega parcial da Missão 11. O relatório por e-mail continua vinculado ao marco de implementação integral da missão.

## Auditoria retroativa e correções das missões 02, 03, 04 e 06

A [matriz das 13 missões](auditoria-primeiro-ciclo.md) confronta os critérios originais com as subetapas do repositório. O [PR #23](https://github.com/marllonfilipe/vantplatform/pull/23) entrou na `main` no commit `51ad335ed20b0a408b5b2bb631df9912ab8439b2`. A [Fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/46086710583) e o [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/46086710644) passaram para `da705a3e5f5fafb346e3e8e5a269d762cf1d335e`. O PR comprovou acesso ao banco restaurado, navegação da busca à ficha, preservação de campos do CRM e gerenciamento de memória com paginação e revisão. A etapa seguinte de leitura do RD Station CRM está no [PR #24](https://github.com/marllonfilipe/vantplatform/pull/24). A transição continua bloqueada por implementação.

## Missão 11 · Retomada do Kommo em 28/11/2026

Os PRs #24 e #25 já estavam integrados. Recuperamos a implementação de `e3ee041969d197555d8ad79e5369191b46048a71` preservando as duas verificações adicionais do RD Station publicadas na main. Passaram 14 testes locais de fundação e adaptadores CRM. A [consulta de empresas do Kommo](missoes/11-kommo.md) fica disponível na Central para gestores. A leitura em conta externa permanece pendente e tem roteiro próprio. A próxima etapa independente da 11 é integrar o canal de e-mail. A missão permanece parcial.

### E-mail da empresa · conexão SMTP

A Central verifica TLS e autenticação no relay privado da empresa. Os dois testes locais de SMTP passaram com sockets de loopback e certificado temporário. A suíte integrada inclui permissões, seleção do tenant e navegação. A homologação do servidor de destino está descrita no [roteiro](missoes/11-email.md). Próxima subetapa: envio de uma mensagem de verificação a destino privado autorizado, com controle de repetição e confirmação separada da leitura da caixa postal.

### Mensagem de diagnóstico SMTP

O gestor pode enviar uma mensagem fixa ao destino privado autorizado e consultar o resultado em Operação → Central de integrações. A API reserva a referência no PostgreSQL antes do envio, controla frequência por empresa e diferencia aceitação pelo relay de resultado incerto. O teste de protocolo em TLS e STARTTLS verificou aceitação, recusa e desconexão em loopback. A regressão dos três adaptadores passou em oito testes locais. A configuração SMTP e o aceite de recebimento real estão no [roteiro](missoes/11-email.md). A verificação da conexão publicada em `d7daee3bc25ffa1aa105141f2397acf411e8824a` passou na [Fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/46113127571) e na [Inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/46113127565). Próximo incremento independente da missão 11: disponibilizar o histórico das solicitações comerciais já persistidas, inclusive cancelamentos, à gestão da empresa.

### Financeiro · histórico de solicitações

Base de retomada `6029303d01ef9bebbeefc1da29b341db14217f09`, aprovada na [Fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/46113386632) e na [Inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/46113386694). A API e a tela de assinatura passam a oferecer as solicitações anteriores em ordem cronológica inversa, com mensalidade original e cancelamento. O teste integrado em `tests/billing.integration.mjs` verifica paginação por empresa, acesso do gestor, recusa do vendedor e navegação. Na retomada passaram cinco testes unitários e a análise de sintaxe dos três módulos alterados. A suíte com PostgreSQL e Chromium roda na Fundação. A próxima etapa independente é apresentar na Central o estado da conexão de WhatsApp já persistido por empresa. A homologação bidirecional da Missão 05 permanece pendente.
