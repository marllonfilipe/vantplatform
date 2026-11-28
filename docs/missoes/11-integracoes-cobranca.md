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

## Execuções do worker

A área Financeiro apresenta quatro contagens para o dia de São Paulo, calculadas sobre o histórico persistido pela automação da própria empresa.

- **Execuções iniciadas** conta cada job uma vez, no dia da primeira tentativa com ação. Etapas posteriores e retentativas preservam a mesma execução.
- **Tentativas de ação** conta cada tentativa registrada com ação, inclusive uma tentativa que falhou ou exigiu repetição.
- **Tentativas que exigiram repetição** conta as tentativas com resultado `retry`.
- **Avaliações sem ação** conta os registros `skipped`, inclusive condições sem ação aplicável.

A virada do dia usa meia-noite local como início inclusivo e a meia-noite seguinte como fim exclusivo. Uma nova tentativa hoje de uma execução iniciada ontem entra somente na contagem de tentativas de hoje. Jobs aguardando prazo ou capacidade ainda sem tentativa registrada ficam fora do consumo medido. A consulta também abrange o histórico anterior à migration. Esses totais não geram faturas.

O cenário de integração cria leads pela API, executa processos reais do worker, produz uma avaliação sem ação e uma retentativa, confere a API de billing e abre o relatório no Chromium. O cenário reposiciona a primeira tentativa no banco de teste para verificar a fronteira diária.

## Franquia diária de execuções de fluxos

O operador pode atribuir `flow_starts_per_day` ao vínculo versionado da empresa. Zero impede novos inícios. A ausência do campo preserva a condição vigente, e `null` remove o teto. Em **Financeiro → Planos comerciais**, as vagas usadas no dia refletem as admissões do worker. A primeira ação elegível de um job reserva uma vaga. Etapas seguintes e novas tentativas do mesmo job podem continuar mesmo após uma redução do teto. O início do preparo de uma entrega externa também reserva a vaga.

O worker deixa a execução excedente na fila antes de aplicar seu efeito. O monitor informa a espera por franquia, com nova consulta em até cinco minutos ou na virada do dia em São Paulo. Uma espera por liberação do agente desfaz a reserva recém-aberta. O consumo por admissão e o histórico de tentativas são consultáveis separadamente porque uma execução pode estar preparada e ainda aguardar a confirmação da ação.

A atualização aproveita tentativas anteriores e entregas já preparadas para preservar a continuidade. O teste de integração cria dois leads em um fluxo de duas etapas, disputa uma vaga entre dois workers, reduz a franquia para zero, amplia o limite e confere as quatro atividades persistidas.

## Inferências locais e franquia diária

Em **Financeiro → Planos comerciais → Inferências de hoje**, a gestão pode conferir quantos textos do tenant retornaram vetores válidos, aguardam confirmação ou terminaram sem vetor. Um lote de três textos com três vetores válidos conta como três unidades. A medição começa com a migration 048. O histórico anterior do CRM não permite reconstruir todas as chamadas ao modelo.

O vínculo aceita `inference_texts_per_day` em unidades inteiras. A omissão preserva o valor vigente, zero suspende novas inferências e `null` remove o teto contratual. Não foram atribuídas quantidades ou preços de IA aos planos originais. O backend verifica todos os textos do lote antes de encaminhá-lo ao modelo. Empresas e dias de São Paulo têm contagens próprias. No limite, a API retorna HTTP 429 com o código `inference_daily_limit`. Fluxos dependentes aguardam na fila.

A reserva e a confirmação usam transações separadas da operação comercial. Mesmo que a gravação no CRM seja desfeita, os vetores efetivamente processados continuam computados. Uma falha conhecida libera a reserva. Uma interrupção de processo após reservar e antes de confirmar deixa uma reserva identificável, que ocupa capacidade no dia de origem até conciliação. O catálogo fixo de frases do copiloto é compartilhado e fica fora do consumo dos clientes. A medição armazena a empresa, o dia, a versão do modelo, a quantidade e o resultado. Textos, vetores, dados de contato e preços ficam fora desse registro.

O cenário `tests/core/inference-capacity.test.mjs` disputa capacidade entre duas chamadas ao modelo real em CPU e verifica isolamento, rollback comercial, teto zero e virada do período. A suíte de memória verifica a resposta HTTP de limite atingido. O Chromium verifica o painel de consumo. Cobrança, fatura, tarifação por custo e homologação com o gateway continuam pendentes.

## Histórico das condições comerciais

Em **Financeiro → Histórico de planos**, proprietários e gestores podem consultar as revisões do vínculo da própria empresa. Cada revisão identifica o plano, a data e a hora de registro em Brasília e os limites vigentes na ocasião. A tela apresenta dez revisões por página, a partir da mais recente. A API `GET /api/v1/billing/plan-history` aceita `limit` e a revisão exclusiva `before`. Novas revisões preservam as anteriores.

O histórico é de condições contratadas. Valores pagos e faturas dependem dos registros financeiros do gateway. Campos de franquia sem teto definido permanecem distintos de um limite zero. A conta operacional da aplicação tem acesso de leitura ao histórico. O teste de integração verifica valores anteriores, paginação, isolamento entre empresas, restrições a vendedores, limites nulos e zero e os dois sentidos da navegação no Chromium.

A seleção do primeiro provedor e o procedimento de consulta estão no [roteiro do sandbox do Asaas](11-asaas-sandbox.md).

## Solicitação comercial de assinatura

Em **Financeiro → Solicitação de assinatura**, o proprietário pode registrar o plano desejado e cancelar uma solicitação pendente. O gestor consulta o estado atual. O valor de referência vem do catálogo no momento da solicitação e o Enterprise mantém o preço sob consulta. Registrar interesse não dispara cobrança nem altera as permissões da empresa.

A API autenticada `GET /api/v1/billing/subscription-requests` retorna a última solicitação da empresa. O `POST` recebe um identificador UUID estável e o código do plano. O `DELETE /api/v1/billing/subscription-requests/{id}` registra o cancelamento. O mesmo identificador e plano retornam o registro existente inclusive após cancelamento. Uma referência reapresentada com outro plano gera conflito. O banco permite uma pendência por empresa e conserva as revisões comerciais e a auditoria. A ativação de uma assinatura real exige a confirmação do gateway.

O teste verifica solicitações concorrentes, consulta pelo gestor, ações restritas ao proprietário, isolamento entre empresas, idempotência e uso de preço definido pelo servidor. O Chromium exercita cancelamento e criação de uma solicitação Enterprise. A assinatura efetivada pelo provedor e o pagamento seguem pendentes.

## Central de integrações

Em **Operação → Central de integrações**, proprietários e gestores consultam evidências de dois recursos já disponíveis. A importação CSV apresenta até dez lotes confirmados de leads ou contas de prospecção. A auditoria do CRM é gravada na mesma transação do lote. Se uma linha causar rollback, o lote fica fora da lista de importações confirmadas. O histórico anterior de prospecção permanece disponível. Os lotes antigos de leads sem auditoria de importação não são reconstruídos a partir de cadastros individuais.

O webhook de saída apresenta até dez tentativas do worker, com momento, resultado, motivo técnico e status HTTP quando disponível. A última entrega confirmada é calculada sobre todo o histórico da empresa. Quando faltam registros, a central informa isso. O painel oferece acesso aos fluxos e às telas de importação. O destino e a chave continuam configurados no worker. O endpoint autenticado `GET /api/v1/integrations` omite endereço de destino, corpo da mensagem, assinatura e credenciais.

O teste do CRM confronta um lote aceito e outro revertido, verifica isolamento e abre o painel no Chromium. O cenário de webhook usa o receptor HTTPS de teste da suíte para confirmar uma tentativa HTTP 429 e a entrega posterior HTTP 204. Os demais conectores e suas respectivas homologações continuam em aberto.

### Último erro de importação CSV

O painel da empresa apresenta a hora, a origem e o motivo do último lote recusado por dados inválidos, conflito de registros ou limite do plano. Abrange leads no CRM e contas na prospecção. Uma importação posterior bem-sucedida preserva o último erro para consulta. O endpoint expõe esses três campos em `csv.last_failure` e retorna `null` quando não há ocorrência registrada.

O PostgreSQL desfaz as alterações do lote antes de registrar a categoria na auditoria. A resposta HTTP mantém o erro original da importação. O registro dispensa valores das linhas, mensagens do banco e conteúdo do arquivo. Falhas anteriores à autorização, indisponibilidade do serviço e ocorrências anteriores a esta entrega ficam fora deste histórico.

## Leitura do Google Sheets

A Central permite consultar o intervalo autorizado da empresa e acompanhar a última leitura e o histórico de tentativas. A configuração privada e a homologação externa constam do [roteiro do Google Sheets](11-google-sheets.md).

## Consulta do Google Calendar

A Central oferece uma prévia dos próximos sete dias da agenda da empresa e o histórico das consultas. A [documentação do Calendar](11-google-calendar.md) descreve as permissões, o limite de 50 ocorrências e a homologação externa.

## Consulta do HubSpot

A Central oferece uma prévia de empresas ativas por conta autorizada. O [roteiro do HubSpot](11-hubspot.md) documenta a permissão, o acesso, o histórico de tentativas e a homologação real.

## Consulta do Pipedrive

A gestão pode consultar ID e nome de até 50 organizações da conta da empresa. O [roteiro do Pipedrive](11-pipedrive.md) descreve configuração, permissões, histórico e homologação externa.

## Consulta de empresas do RD Station CRM

O painel de gestão permite consultar a primeira página de empresas da conta RD Station CRM do tenant. A ação usa o leitor autorizado da Central, registra a tentativa e mostra apenas o nome e o identificador. Veja [configuração e homologação](11-rd-station.md).
