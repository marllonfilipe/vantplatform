# Missão 11 · Integration Hub, billing e assinaturas

**Implementação parcial.** Proprietários e gestores consultam **Financeiro → Planos comerciais**. Os parâmetros iniciais do plano original ficam armazenados em PostgreSQL. A API autenticada `GET /api/v1/billing/plans` retorna moeda, periodicidade, valores em centavos, limites e recursos previstos.

| Plano | Mensalidade | Usuários | Leads ativos | Pipelines | Conexões WhatsApp previstas |
|---|---:|---:|---:|---:|---:|
| Start | R$ 197 | 1 | 500 | 1 | 0 |
| Growth | R$ 397 | 3 | 2.000 | 3 | 1 |
| Scale | R$ 597 | 10 | 10.000 | 10 | 3 |
| Enterprise | Sob consulta | Personalizado | Personalizado | Personalizado | Personalizado |

No Enterprise, preço e limites sob negociação aparecem sem valor numérico. A consulta apresenta o catálogo. A seção seguinte descreve o vínculo e o consumo por empresa. As permissões de gestão da empresa permitem leitura do catálogo global. A conexão da aplicação tem privilégio de leitura nessa tabela.

A migration 041 cria o catálogo. O cenário `tests/billing.integration.mjs` verifica valores, limites, acesso sem sessão, acesso de vendedor, proteção contra edição e apresentação no Chromium.  A homologação do gateway e a cobrança em produção seguem os critérios originais da missão.


## Vínculo comercial e consumo

Em **Financeiro → Planos comerciais**, a gestão vê o plano vigente, os usuários ativos, os leads cadastrados e os pipelines da própria empresa. A API correspondente é `GET /api/v1/billing/usage`. O CRM atual remove leads por exclusão e conta os registros existentes. A tela identifica empresas anteriores à funcionalidade como **Sem vínculo**. O provisionamento de uma empresa continua funcionando sem atribuir um plano ou gerar uma cobrança.

O operador global registra os limites contratados pelo comando a seguir, em ambiente administrativo com a conexão de banco configurada em `ADMIN_DATABASE_URL`. O terceiro argumento é a revisão vigente, inicialmente zero.

```sh
node scripts/assign-plan.mjs "$TENANT_ID" growth 0
```

Um quarto argumento JSON permite configurar `user_limit`, `active_lead_limit` e `pipeline_limit` para o contrato. Enterprise exige as três quantidades explícitas. O histórico guarda a revisão, o horário, o plano e os valores vigentes em cada alteração. Reaplicar o vínculo atual é idempotente. Uma mudança baseada em revisão ultrapassada é rejeitada. As contas da aplicação podem consultar o próprio vínculo.

O PostgreSQL serializa por empresa as novas ocupações e a troca de plano. Ao atingir o limite, o CRM responde com HTTP 409 e código `plan_limit`. A redução de uma franquia preserva os dados existentes e bloqueia novas ocupações até haver capacidade. Desativar um usuário libera um assento. Os testes de integração cobrem requisições simultâneas, reativação, mudança de plano, redução com excesso existente, isolamento e leitura do consumo no Chromium.

O vínculo administrativo registra a franquia comercial. Assinatura no gateway, cobranças, faturas, confirmação de pagamento, renovação, inadimplência e os demais recursos medidos seguem pendentes.
