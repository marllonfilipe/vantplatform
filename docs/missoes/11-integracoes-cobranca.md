# Missão 11 · Integration Hub, billing e assinaturas

**Implementação parcial.** Proprietários e gestores consultam **Financeiro → Planos comerciais**. Os parâmetros iniciais do plano original ficam armazenados em PostgreSQL. A API autenticada `GET /api/v1/billing/plans` retorna moeda, periodicidade, valores em centavos, limites e recursos previstos.

| Plano | Mensalidade | Usuários | Leads ativos | Pipelines | Conexões WhatsApp previstas |
|---|---:|---:|---:|---:|---:|
| Start | R$ 197 | 1 | 500 | 1 | 0 |
| Growth | R$ 397 | 3 | 2.000 | 3 | 1 |
| Scale | R$ 597 | 10 | 10.000 | 10 | 3 |
| Enterprise | Sob consulta | Personalizado | Personalizado | Personalizado | Personalizado |

No Enterprise, preço e limites sob negociação aparecem sem valor numérico. A consulta apresenta o catálogo. A atribuição de um plano a uma empresa, a aplicação de limites, o consumo e o ciclo financeiro dependem de entregas posteriores. As permissões de gestão da empresa permitem leitura do catálogo global. A conexão da aplicação tem privilégio de leitura nessa tabela.

A migration 041 cria o catálogo. O cenário `tests/billing.integration.mjs` verifica valores, limites, acesso sem sessão, acesso de vendedor, proteção contra edição e apresentação no Chromium. A próxima entrega independente é o vínculo persistente entre empresa e plano, com histórico e aplicação de limites no backend. A homologação do gateway e a cobrança em produção seguem os critérios originais da missão.
