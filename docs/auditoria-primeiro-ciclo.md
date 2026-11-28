# Auditoria retroativa do primeiro ciclo

## Abertura em 27/11/2026

Base `8ad4162567b34ce8ccf73bf0fa5a404d9c47232d`, com [Fundação SaaS](https://github.com/marllonfilipe/vantplatform/actions/runs/46056244917) e [Inteligência local](https://github.com/marllonfilipe/vantplatform/actions/runs/46056244965) aprovadas. Na abertura não havia PR em andamento. Última entrega parcial publicada: Pipedrive, PR #22. A retomada prioriza comparar as 13 missões do plano original com os arquivos e critérios antes de implementar novos conectores. A transição está pendente. A primeira ação é registrar a matriz de subetapas e reproduzir a primeira lacuna independente.

## Como ler a matriz

Cada grupo abaixo indica o arquivo que permite verificar o comportamento, a cobertura disponível na revisão de abertura e a ação ainda necessária. “Testada” vale para o caminho descrito. Os critérios originais em cada seção delimitam o aceite integral. Os checks da abertura validaram a mesma árvore. Ainda não há evidência que atribua as lacunas a uma interrupção específica. As missões 12 e 13 são frentes futuras. Nenhum aceite humano novo foi registrado.

## 01 · AUDITORIA E ARQUITETURA DEFINITIVA

Critérios originais de aceite

- Auditoria documentada.
- Arquitetura definida.
- Mapa de módulos e dependências.
- Lista de componentes existentes e ausentes.
- Plano de execução das demais missões.
- Nenhuma funcionalidade existente removida sem justificativa.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| Inventário, legado e componentes | Implementada | [docs/missoes/01-arquitetura.md](../docs/missoes/01-arquitetura.md) | Revisão histórica da raiz vazia e inventário anterior ao primeiro commit. |
| Contratos, 12 módulos, identidade e sequência | Implementada | [docs/cronograma.md](../docs/cronograma.md) | Comparar desvios do produto por subetapa abaixo. |

## 02 · BANCO DE DADOS, SEGURANÇA E INFRAESTRUTURA SaaS

Critérios originais de aceite

- Persistência real em PostgreSQL.
- Migrations executáveis.
- Isolamento multiempresa testado.
- Autenticação funcional.
- Permissões aplicadas no backend.
- Nenhuma credencial sensível exposta no frontend.
- Documentação de infraestrutura.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| PostgreSQL, migrations, RLS, autenticação, papéis | Testada | [tests/integration.test.mjs](../tests/integration.test.mjs) | Dois tenants e login. CI da base aprovado. |
| Credenciais e arquivos privados | Testada | [tests/unit.test.mjs](../tests/unit.test.mjs) | Cinco verificações locais aprovadas nesta revisão, incluindo isolamento e cifra. |
| Backup e recuperação de acesso | Parcial | [scripts/ci.sh](../scripts/ci.sh) | O CI restaura o dump e compara um contador de auditoria. Falta provar login e leitura autenticada na base restaurada. |
| Operação, retenção e privacidade | Parcial | [docs/infraestrutura.md](../docs/infraestrutura.md) | Rotinas existem. Implantação, retenção e ensaio de recuperação no ambiente do cliente seguem abertos. |

## 03 · DASHBOARD PRINCIPAL E EXPERIÊNCIA DA PLATAFORMA

Critérios originais de aceite

- Dashboard funcional.
- Componentes reutilizáveis.
- Navegação sem erros.
- Responsividade.
- Dados reais.
- Nenhum card meramente decorativo.
- Identidade visual consistente em todas as páginas.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| Indicadores do tenant, filtro de período e equipe | Testada | [tests/dashboard.integration.mjs](../tests/dashboard.integration.mjs) | PostgreSQL e Chromium na fundação. |
| Menu, contexto, busca e ações rápidas | Parcial | [public/app.js](../public/app.js) | O cabeçalho substitui por Comercial os grupos não mapeados. A busca exibe nome e tipo sem abrir a ficha. Corrigir e testar pela interface. |
| Layout móvel, alertas e perfil | Testada | [tests/notifications.integration.mjs](../tests/notifications.integration.mjs) | Verificar os fluxos adicionais no navegador após cada correção. |

## 04 · CRM E GESTÃO COMERCIAL

Critérios originais de aceite

- CRM conectado ao banco de dados.
- Pipeline funcional.
- Histórico persistente.
- Importação CSV validada.
- Filtros funcionando.
- Controle de permissões.
- Dados isolados por empresa.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| Cadastro, filtros, importação e rollback | Testada | [tests/crm.integration.mjs](../tests/crm.integration.mjs) | Testes de API e sessão do CRM. |
| Pipeline, atividades, histórico e controle de escrita | Testada | [src/crm.mjs](../src/crm.mjs) | Teste integrado abre tabela e Kanban, move oportunidade e verifica histórico. |
| Conversa e lead | Testada | [docs/missoes/04-crm.md](../docs/missoes/04-crm.md) | Conversão do registro local. O trajeto completo pelo aparelho pertence à 05. |

## 05 · CENTRAL DE RELACIONAMENTO E WHATSAPP COM EVOLUTION API

Critérios originais de aceite

- Conexão real com Evolution API.
- QR Code funcional.
- Envio e recebimento de mensagens.
- Persistência.
- Reconexão.
- Webhooks.
- Integração com CRM.
- Isolamento por tenant.
- Testes de conexão e falhas.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| Instância, QR, webhook e persistência local | Testada | [tests/inbox.integration.mjs](../tests/inbox.integration.mjs) | Infraestrutura e eventos têm evidência no relatório 05. |
| Pareamento, entrega bidirecional e reconexão | Homologação pendente | [scripts/verify-whatsapp.mjs](../scripts/verify-whatsapp.mjs) | Conferir o job manual com dois aparelhos autorizados. |
| Interpretação de mídia e contexto de conversa | Parcial | [docs/missoes/05-whatsapp.md](../docs/missoes/05-whatsapp.md) | Depende de núcleo e canal. Verificar escopo técnico antes de classificar como homologação. |

## 06 · V4NT INTELLIGENCE CORE E INTELIGÊNCIA DE LEADS

Critérios originais de aceite

- Inferência interna funcional.
- Nenhuma dependência de API externa de IA.
- Contexto por tenant.
- Memória persistente.
- Recuperação contextual.
- Qualificação real de leads.
- Logs e monitoramento.
- Testes de isolamento e desempenho.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| Inferência local, embeddings, indexação e isolamento | Testada | [tests/core/knowledge.test.mjs](../tests/core/knowledge.test.mjs) | CI do Core aprovado, pesos no runner. |
| Qualificação, recuperação e medição de uso | Testada | [tests/core/inference-capacity.test.mjs](../tests/core/inference-capacity.test.mjs) | Conferir qualidade e capacidade no host de destino. |
| Memória operacional e histórica da conversa | Parcial | [src/knowledge.mjs](../src/knowledge.mjs) | Histórico do CRM disponível. Completar a origem de canal após 05. |

## 07 · AGENTES DE IA E COPILOTO COMERCIAL

Critérios originais de aceite

- Agentes executando tarefas reais.
- Comunicação com CRM e WhatsApp.
- Contexto compartilhado de forma controlada.
- Histórico.
- Supervisão.
- Controle de permissões.
- Nenhuma dependência de APIs externas de IA.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| SDR, reuniões, recuperação e propostas de tarefas | Testada | [tests/core/model.test.mjs](../tests/core/model.test.mjs) | Core exercita os caminhos internos com dados do CRM. |
| Copiloto e supervisão | Implementada | [src/supervision.mjs](../src/supervision.mjs) | Conferir cada ação e os limites de autonomia no aceite. |
| Atendimento por WhatsApp | Parcial | [docs/missoes/07-agentes.md](../docs/missoes/07-agentes.md) | Integração de canal depende da 05. |

## 08 · AUTOMATION ENGINE E CONSTRUTOR DE FLUXOS

Critérios originais de aceite

- Fluxos executados de verdade.
- Gatilhos funcionando.
- Ações persistidas.
- Histórico completo.
- Retentativas.
- Monitoramento.
- Testes de ponta a ponta.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| Editor, versões, condições, esperas e persistência | Testada | [tests/automation.integration.mjs](../tests/automation.integration.mjs) | Worker e navegador na Fundação. |
| Retentativa, intervalo e saída HTTP | Testada | [tests/webhooks.integration.mjs](../tests/webhooks.integration.mjs) | Receptor de teste HTTPS e eventos de execução. |
| Eventos de assinatura e mensagens | Parcial | [src/automation.mjs](../src/automation.mjs) | Dependem dos contratos da 11 e da 05. |

## 09 · PROSPECTING INTELLIGENCE

Critérios originais de aceite

- Pesquisa e organização de empresas.
- Importação funcional.
- Integração com CRM.
- Classificação inteligente.
- Rastreabilidade das fontes.
- Controle de qualidade dos dados.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| ICP, fontes, importação, decisores e vínculo ao CRM | Testada | [tests/prospecting.integration.mjs](../tests/prospecting.integration.mjs) | Conferir relatório da missão para os limites das fontes. |
| Classificação e sugestões de abordagem | Testada | [tests/core/prospecting.test.mjs](../tests/core/prospecting.test.mjs) | Marco técnico anterior. Aceite do proprietário pendente. |

## 10 · REVENUE INTELLIGENCE E INTELIGÊNCIA EXECUTIVA

Critérios originais de aceite

- Indicadores calculados com dados reais.
- Filtros.
- Relatórios.
- Exportação.
- Previsões documentadas.
- Análises contextuais.
- Nenhuma métrica inventada.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| Indicadores, relatórios, filtros, previsão e exportação | Testada | [tests/revenue.integration.mjs](../tests/revenue.integration.mjs) | Conciliação sobre os fatos do CRM. |
| Análise executiva com contexto | Testada | [tests/core/revenue.test.mjs](../tests/core/revenue.test.mjs) | Marco técnico anterior. Aceite operacional pendente. |

## 11 · INTEGRATION HUB, BILLING E ASSINATURAS

Critérios originais de aceite

- Integrações reais.
- Assinaturas persistentes.
- Webhooks validados.
- Controle de plano no backend.
- Cobrança real em ambiente de produção após homologação.
- Nenhum pagamento fictício.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| Planos, histórico de contratos, consumo e franquias | Testada | [tests/billing.integration.mjs](../tests/billing.integration.mjs) | Controles ativos. Conferir excedentes, catálogo de recursos e cobrança contra os requisitos. |
| Central, CSV, webhooks e consultas de leitura | Parcial | [src/integrations.mjs](../src/integrations.mjs) | Sheets, Calendar, HubSpot e Pipedrive têm código. Homologações autenticadas estão individualizadas nos roteiros. |
| RD Station CRM | Testada, homologação externa pendente | [PR #24](https://github.com/marllonfilipe/vantplatform/pull/24) · [roteiro](missoes/11-rd-station.md) | Consulta de empresas integrada à main. Fundação e Inteligência passaram. Falta verificar uma conta autorizada. |
| Kommo | Implementada, homologação pendente | [Roteiro](missoes/11-kommo.md) | Validar a consulta da conta autorizada. |
| E-mail | Parcial em desenvolvimento | [Missão 11](missoes/11-integracoes-cobranca.md) | Primeira subetapa: conexão SMTP autenticada por tenant via TLS, com auditoria e teste de protocolo. |
| Gateway, cobrança e conciliação | Parcial | [scripts/verify-asaas-sandbox.mjs](../scripts/verify-asaas-sandbox.mjs) | Configuração de sandbox é separada das lacunas de faturas, renovação e eventos de pagamento. |

## 12 · ENTERPRISE, GOVERNANÇA E PREPARAÇÃO PARA PRODUÇÃO

Critérios originais de aceite

- Governança funcional.
- Multiunidade.
- APIs documentadas.
- Testes críticos aprovados.
- Monitoramento.
- Backup validado.
- Documentação de produção.
- Pendências claramente identificadas.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| Backup, health e logs herdados da fundação | Parcial | [docs/infraestrutura.md](../docs/infraestrutura.md) | Complementar testes de recuperação e carga e comprovar operação em homologação. |
| Multiunidade, governança, personalização e APIs corporativas | Não iniciada como entrega Enterprise | [docs/cronograma.md](../docs/cronograma.md) | Projetar unidades e escopo de acesso sobre o tenant e exercitar usuários de unidades distintas. |

## 13 · V4NT CONTROL CENTER: ADMINISTRAÇÃO GLOBAL DA PLATAFORMA

Critérios originais de aceite

- Acesso administrativo independente.
- Dashboard global funcional.
- Gestão completa de empresas.
- Visão 360º dos clientes.
- Gestão de planos e assinaturas.
- Gestão de usuários.
- Monitoramento do Intelligence Core.
- Monitoramento de integrações.
- Gestão financeira.
- Suporte.
- Auditoria.
- Controle de permissões.
- Dados reais.
- Testes de segurança.
- Nenhum acesso administrativo disponível para clientes comuns.

| Etapa | Estado na base | Evidência | Resultado e próxima ação |
|---|---|---|---|
| Acesso administrativo independente e permissões globais | Não iniciada como Control Center | [scripts/provision.mjs](../scripts/provision.mjs) | CLI provisiona tenants. Falta identidade administrativa própria. |
| Gestão de clientes, visão 360°, planos e usuários | Não iniciada como Control Center | [docs/cronograma.md](../docs/cronograma.md) | Depende do domínio administrativo e da segregação de acesso. |
| Monitoramento, financeiro, suporte, infraestrutura e auditoria global | Não iniciada como Control Center | [docs/cronograma.md](../docs/cronograma.md) | Cada módulo depende dos dados do respectivo domínio. Exigir testes de acesso entre operadores e clientes antes da liberação. |

## Incrementos em validação

- 02 · Iniciado o ensaio com a API, uma equipe criada antes do dump e login novo no banco restaurado. Verificações locais de sintaxe Bash e Node aprovadas. A execução PostgreSQL está atribuída ao CI do PR #23.
- 03 · Próxima correção: derivar o cabeçalho do menu efetivo e ligar resultados da busca às fichas do CRM. Validar no Chromium em contexto de gestor.
- 03 · Correção da navegação e abertura das fichas publicada para validação. Sintaxe dos módulos aprovada. O teste de regressão usa a Central, a busca, a ficha e o histórico no Chromium real.
- 04 · Ao revisar o formulário, identificamos que a edição enviava todas as colunas. Uma alteração de outra sessão podia ser sobrescrita ao salvar um campo diferente, e horários inalterados podiam perder segundos. Reproduzir com duas alterações à mesma oportunidade e testar a preservação de horário ao renomear uma atividade.
- 04 · A edição agora envia somente os campos que mudaram. Testes de regressão da probabilidade concorrente e de um prazo com milissegundos publicados no commit `965008a` para o CI.
- 06 · O catálogo de memória mostra somente os cem documentos mais recentes, sem continuação. Substituição e exclusão na interface não conferem a revisão exibida. Próximo lote: paginar sem perder empates e conferir a revisão no banco antes de gravar, mantendo compatibilidade com clientes existentes.
- 06 · A verificação de sintaxe detectou um nome de variável duplicado no teste recém-adicionado na branch. Nome corrigido e `node --check` aprovado para o teste, a API e a interface. Os cenários exercitam empate nos microssegundos, paginação e recusa de alteração obsoleta.

## Evidência após correção

O [PR #23](https://github.com/marllonfilipe/vantplatform/pull/23) foi incorporado em `51ad335ed20b0a408b5b2bb631df9912ab8439b2`. A revisão `da705a3e5f5fafb346e3e8e5a269d762cf1d335e` passou na [Fundação](https://github.com/marllonfilipe/vantplatform/actions/runs/46086710583) e no [Core](https://github.com/marllonfilipe/vantplatform/actions/runs/46086710644). Estão **testadas** as seguintes subetapas: 02 recuperação de sessão nova e leitura de equipe após restauração, 03 contexto e acesso da busca à ficha, 04 edição de campos independentes e preservação de prazo, 06 catálogo paginado com empate e controle de revisão. A falha intermediária de sintaxe ficou restrita à branch antes do merge. A cobertura da navegação completa e o aceite no ambiente de destino continuam em aberto.

### Atualização da Missão 11 em 28/11/2026

Kommo · consulta por empresa implementada com prévia de 50 registros. A base desta integração é `d9b9c7ee7617a90d09522728960ed4dbf844d04f`. Testes dos adaptadores e da fundação passaram localmente. A comprovação com credenciais da conta usa o [roteiro de homologação](missoes/11-kommo.md). E-mail, cobrança e conciliação seguem como lacunas de implementação.

E-mail · conexão autenticada e mensagem diagnóstica de conteúdo e destino restritos implementadas na Central. A suíte SMTP de loopback diferencia aceite do relay, falha e resultado indeterminado. Homologação em caixa autorizada pendente. Histórico das solicitações comerciais de assinatura: o banco conserva a movimentação e a gestão ainda consulta somente a mais recente. Gateway e conciliação mantêm suas dependências documentadas.

Missão 11 · histórico das solicitações de assinatura implementado em `src/subscription-requests.mjs` e `public/crm.js`. O campo `latest` segue disponível para os clientes existentes. A nova rota lista a movimentação anterior com isolamento por empresa. Ver [documentação e critérios](missoes/11-integracoes-cobranca.md#histórico-de-solicitações-comerciais).
