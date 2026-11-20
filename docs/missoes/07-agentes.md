# Missão 07 · Agentes e copiloto comercial

## Agente de qualificação e propostas internas

O primeiro incremento usa uma análise persistida pelo Intelligence Core. A revisão 0b915b2 do Core passou na [suíte de tarefas, isolamento, falha e recuperação](https://github.com/marllonfilipe/vantplatform/actions/runs/44658763655). A ação disponível é criar uma atividade interna do CRM. A atribuição segue o responsável atual pelo lead ou pela oportunidade. O texto sugerido vem da análise consultada.

Na ficha do registro, abra a análise atual ou seu histórico e selecione **Preparar tarefa sugerida**. A proposta fica pendente. O responsável ou gestor pode aprovar e criar a tarefa ou cancelar a proposta. A agenda só recebe a atividade na aprovação. O CRM e a auditoria registram a operação na mesma transação. Um novo envio da mesma decisão retorna o resultado original. Uma decisão incompatível com a anterior retorna conflito.

| Operação | Rota |
|---|---|
| Consultar decisão e permissão | `GET /api/v1/agents/proposals/{runId}` |
| Preparar proposta | `POST /api/v1/agents/proposals/{runId}` |
| Aprovar e criar tarefa, com prazo ISO opcional em `due_at` | `POST /api/v1/agents/proposals/{runId}/approve` |
| Cancelar antes da execução | `POST /api/v1/agents/proposals/{runId}/cancel` |

## Evidência e retomada

A suíte de inteligência sobe a aplicação com PostgreSQL, pgvector, Chromium e o modelo em CPU. O teste de API verifica autorização, isolamento, reversão da transação com prazo inválido, aprovação simultânea, repetição e cancelamento. O teste de navegador percorre análise, preparação, decisão e conferência da atividade na agenda. Consulte o [workflow de inteligência](https://github.com/marllonfilipe/vantplatform/actions/workflows/inteligencia.yml) e o check da revisão para o resultado.

A Missão 07 permanece parcial. Próxima entrega independente: consultas do copiloto para priorizar leads, localizar oportunidades em risco e identificar follow-ups vencidos com dados e permissões do CRM. Ações externas de atendimento e envio aguardam a homologação do canal da Missão 05. As evidências comerciais e o aceite integral da Missão 06 seguem no [relatório do Core](06-inteligencia.md).

## Consultas do copiloto

O commit `3303abb` passou no [teste do agente com Chromium e PostgreSQL](https://github.com/marllonfilipe/vantplatform/actions/runs/44659027723) e na [regressão SaaS](https://github.com/marllonfilipe/vantplatform/actions/runs/44659027526).

O botão **Abrir copiloto comercial** no dashboard e a seção **Inteligência** aceitam perguntas sobre prioridades de leads, riscos em oportunidades abertas e follow-ups vencidos. O endpoint `POST /api/v1/agents/copilot` recebe `question`. O modelo local classifica a pergunta por similaridade com enunciados de referência. Perguntas com baixa similaridade ou pouca diferença entre as duas primeiras intenções pedem reformulação. A API seleciona uma das três consultas SQL fixas, com parâmetros vinculados ao tenant e ao perfil do vendedor. A pergunta não é enviada a serviços externos nem gravada no log de auditoria.

O resultado contém até dez registros. As listas de prioridade e riscos usam a última análise de cada registro e informam a data. A lista de follow-ups usa o prazo e o estado atuais da agenda. Um vendedor vê sua carteira. O histórico de auditoria guarda ator e intenção reconhecida. As consultas não disparam ações comerciais.

O teste HTTP cobre as três consultas, limite de acesso do vendedor, isolamento entre empresas e uma pergunta fora de escopo. O teste de navegador parte do dashboard e consulta um lead realmente cadastrado e analisado.

Próxima atividade independente: preparar contexto de reunião com fatos do CRM, atividades e perguntas que faltam na qualificação. Continuam em aberto os demais agentes, cobertura do copiloto, validação comercial e funcionalidades de canal previstas na missão.

## Preparação de reuniões

O [teste do copiloto na revisão 69c8219](https://github.com/marllonfilipe/vantplatform/actions/runs/44659300931) passou para as três intenções, isolamento, consulta fora do escopo e navegação pelo dashboard.

Em **Agenda comercial**, selecione uma atividade de reunião e clique em **Preparar reunião**. O agente recupera a necessidade e a objeção do lead, a oportunidade vinculada, até cinco atividades concluídas e referências da memória comercial via inferência local. Ele propõe perguntas sobre informações ausentes. Se os principais dados estiverem registrados, sugere confirmar o responsável pelo próximo passo. O histórico armazena o contexto e a versão do modelo usados em cada preparação.

As rotas são `POST /api/v1/agents/meetings/{id}/briefs` e `GET /api/v1/agents/meetings/{id}/briefs`. O vendedor precisa ser responsável pela reunião. Os vínculos de CRM e as atividades consultadas também respeitam sua carteira. O perfil de leitura pode consultar preparações, e o histórico do vendedor limita-se às suas preparações daquela reunião. O teste de integração usa uma reunião real do banco de CI e verifica ações recusadas, histórico, fatos e perguntas.

Próxima atividade independente: registrar o resultado de uma reunião a partir de notas fornecidas pelo responsável e vinculá-lo ao histórico. Também permanecem abertas as demais capacidades do SDR, recuperação e agente executivo, além dos critérios de homologação da missão.

## Resultado após a reunião

Na revisão 9eac26e, passaram a [suíte de inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44659547917) e a [regressão da fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/44659547933).

Depois de concluir a atividade na agenda, o responsável ou gestor abre **Resultado da reunião**, registra as notas e salva a versão. O modelo local seleciona até três frases das notas, considerando decisões, próximos passos e necessidades. O resumo preserva o texto de cada trecho, sua posição e as notas originais.

A rota `/api/v1/agents/meetings/{id}/minutes` oferece as últimas dez revisões por GET e registro por POST com `notes` e `expectedRevision`. A primeira revisão parte de zero. Reenviar notas idênticas retorna a última versão. Uma edição com conteúdo diferente e revisão vencida retorna conflito. A aplicação conserva as revisões anteriores e audita o ator.

A suíte HTTP verifica conclusão da atividade, extração literal, autorização, isolamento, revisão e histórico no PostgreSQL. O teste em Chromium cobre preparação, conclusão da atividade e leitura do resultado. Os checks associados ao commit registram o resultado da execução. O incremento é parcial. A próxima atividade independente da missão é a recuperação de oportunidades do CRM com acompanhamento sujeito à decisão humana.

## Recuperação de oportunidades

No commit [2dda266](https://github.com/marllonfilipe/vantplatform/commit/2dda266ff7f17e37412f734d43092ea40d0a2188), o fluxo das notas de reunião passou nas suítes de [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44693169813) e [fundação SaaS](https://github.com/marllonfilipe/vantplatform/actions/runs/44693169653).

No dashboard, o copiloto aceita a pergunta **Quais oportunidades estão paradas?**. A consulta mostra até dez oportunidades abertas da carteira acessível com pelo menos 14 dias de calendário desde o último movimento. Usa a mais recente entre a atualização da ficha e as datas de ligações, reuniões e follow-ups concluídos. A ordenação prioriza as mais antigas.

Em **Oportunidades**, abra a ficha e selecione **Analisar no Intelligence Core**. Para registros que exigem atenção, a análise apresenta motivo, intervalo desde o último movimento e perguntas para preparar a abordagem. Em uma perda, registra o motivo disponível no CRM. O responsável decide se prepara uma tarefa interna e se a aprova. A aprovação exige uma nova análise caso a oportunidade tenha mudado de situação entre a sugestão e a decisão.

O teste HTTP cobre contato recente em uma ficha antiga, inatividade de 18 dias, carteiras e empresas diferentes, exclusão das oportunidades fechadas da lista, motivo de perda e conflito de aprovação. Os checks do commit registram o resultado. Próxima atividade independente: agente executivo com indicadores conciliados e consulta de conversão por vendedor. A Missão 07 continua parcial.
