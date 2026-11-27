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

## Armazenamento e alertas de capacidade

A franquia opcional `storage_limit_bytes` no comando administrativo aceita um inteiro em bytes de 0 a 9.007.199.254.740.991. Sua omissão preserva o valor anterior. Um valor explícito `null` retira o teto de armazenamento do vínculo. O plano original não especifica quantidades de armazenamento para precificar. A tela mostra o consumo mesmo antes de configurar a franquia.

O total soma os bytes lógicos dos documentos cadastrados e o conteúdo binário dos anexos dos leads. Índices, vetores e backups ficam fora dessa medida. O PostgreSQL controla o aumento dos dois tipos de conteúdo com uma única franquia por empresa. Exclusões e reduções liberam espaço. A consulta identifica limites atingidos e franquias já excedidas após uma redução de capacidade para usuários, leads, pipelines e armazenamento.

O teste de integração usa arquivos UTF-8 enviados pela API, dois uploads concorrentes na última vaga, alterações e exclusões de documentos, isolamento entre empresas e a leitura dos alertas no Chromium.

## Franquia diária de ações dos agentes

O operador global pode registrar `agent_actions_per_day` nas condições do contrato. A quantidade aceita vai de zero a 10.000. Zero bloqueia novas ações desde o início do dia. A omissão preserva a franquia vigente. Um valor explícito `null` mantém somente o limite operacional que o proprietário configura em Supervisão. Para definir a franquia, o operador usa a revisão vigente no comando descrito acima. O plano original não fixa uma quantidade diária por faixa comercial.

O menor valor entre o teto operacional e a franquia comercial determina a capacidade disponível. Em **Financeiro → Planos comerciais**, a gestão consulta quanto já foi usado e o limite efetivo. O período acompanha o dia de São Paulo. Cada ação que passa pela reserva de ferramentas dos agentes e tem a transação confirmada consome uma unidade. Uma operação desfeita libera a reserva. As chamadas de inferência e o tráfego de mensagens exigem medições próprias.

O teste de integração `tests/agent-capacity.integration.mjs` confronta duas reservas simultâneas com uma unidade disponível, uma transação desfeita, a virada do dia, o limite zero, a supervisão local e o isolamento entre empresas. O teste de billing verifica a leitura do consumo no Chromium.

## Automações ativas por empresa

A condição contratual opcional `active_flow_limit` define quantos fluxos podem estar habilitados ao mesmo tempo. Um fluxo pausado pode ser criado ou editado mesmo quando a franquia está cheia. Ativar um novo fluxo exige uma vaga disponível. Editar uma automação já ativa preserva sua vaga. A redução de um contrato conserva os fluxos existentes e o Financeiro informa o excesso. A pausa libera capacidade.

Somente o operador global configura a franquia, usando um inteiro não negativo no vínculo versionado. Omitir o campo preserva o valor anterior. Um valor explícito `null` retira esse teto. O número de fluxos ativos é distinto da quantidade de vezes que o worker os executou.

O teste em PostgreSQL usa a API autenticada para criar dois fluxos simultaneamente com apenas uma vaga, pausar, editar e reativar. Verifica a preservação da versão após uma tentativa recusada, o consumo exibido no Chromium, o limite zero e o isolamento entre empresas.
