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
