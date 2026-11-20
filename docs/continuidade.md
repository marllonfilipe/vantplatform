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
| 08 | Editor de fluxo de novo lead, fila versionada, worker e monitor de execuções | [Relatório](missoes/08-automacoes.md). Conferir os checks do worker e do Chromium. Continuar as ramificações e ações internas. |
| 09–13 | Sem entrega integral registrada nesse ponto de retomada | Os critérios e dependências por missão constam da tabela acima e do cronograma. |

A evidência de CI pertence ao commit testado. Nas próximas execuções, conferir o histórico e os checks mais recentes da main antes de retomar.
