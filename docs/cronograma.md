# Cronograma de execução

Estimativas em dias úteis de engenharia, com execução sequencial, contadas a partir do início de cada missão. São faixas de planejamento. Acesso a contas de homologação, infraestrutura e tempo de ativação de serviços influenciam o calendário. A estimativa é revisada com a evidência da missão anterior.

| Missão | Trabalho | Esforço estimado | Evidência para avançar |
|---|---|---|---|
| 01 | Auditar e definir a arquitetura | 1–2 dias | Inventário, contratos, mapa dos 12 módulos e plano revisados |
| 02 | Fundação SaaS | 5–10 dias | PostgreSQL migrado, autenticação, papéis, testes entre duas empresas, backup e restauração |
| 03 | Dashboard e navegação | 4–7 dias | Consultas reais da API, filtros, estados vazios, falhas e navegação responsiva |
| 04 | CRM e gestão comercial | 7–12 dias | Lead importado, oportunidade movimentada e histórico persistente |
| 05 | Inbox e WhatsApp | 5–10 dias | Instância Evolution pareada, mensagem real nos dois sentidos e reconexão |
| 06 | V4NT Intelligence Core | 10–20 dias | Inferência em modelo próprio ou de pesos abertos sob controle da V4NT, RAG e isolamento |
| 07 | Agentes e copiloto | 7–12 dias | Agentes operando sobre CRM e inbox com permissões, aprovação e registro |
| 08 | Automações | 7–12 dias | Fluxo versionado executado por worker, com espera, ramificação e retentativa |
| 09 | Prospecção | 4–8 dias | Conta-alvo com fonte, segmentação, deduplicação e conversão para o CRM |
| 10 | Inteligência de receita | 5–9 dias | Previsão e indicadores reconciliados com oportunidades e ganhos |
| 11 | Integrações e assinatura | 7–12 dias | Cobrança em sandbox, evento autenticado, mudança de plano e conciliação |
| 12 | Enterprise e produção | 7–15 dias | Homologação, restauração, observabilidade, carga, recuperação e checklist operacional |
| 13 | Administração global | 7–12 dias | Teste de acesso administrativo separado, gestão de tenants e trilha de auditoria |

## Dependências para os testes de integração

A missão 02 exige um PostgreSQL descartável para exercitar permissões e migrations. Para a 05, é necessário acesso a uma instância Evolution e a um número que possa ser pareado. A 06 exige host e pesos de modelo permitidos pela licença escolhida. A 11 depende de conta de testes no provedor de cobrança e a 12 depende de ambiente de homologação sob controle da V4NT.

## Processo de entrega

O relatório de cada missão registra caminhos de arquivos, funções entregues, integrações exercitadas, testes com resultados, limitações e procedimento de reprodução. O commit identifica a missão. A próxima começa quando os critérios de aceite da atual estão comprovados. Trabalho parcial pode ser publicado com as pendências explícitas.

A [diretriz temporária de continuidade](continuidade.md) define o trabalho que pode avançar durante a homologação da missão 05.
