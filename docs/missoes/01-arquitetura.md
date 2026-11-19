# Missão 01 · Auditoria e arquitetura

## Inventário verificado em 19/11/2026

A API do GitHub retornou uma lista de branches vazia e a consulta à raiz retornou HTTP 404 com a mensagem “This repository is empty.” O diretório de trabalho também não continha código do produto. O repositório auditado foi marllonfilipe/vantplatform. Com isso, frontend, backend, banco, autenticação, filas, integrações e infraestrutura partem do zero. Não foram encontrados componentes parciais, interfaces demonstrativas, dados simulados, serviços duplicados ou integrações prévias para reaproveitar. Não houve remoção. O plano de 13 missões e a identidade do produto fornecidos pelo proprietário são os requisitos de partida.

## Topologia e contratos

Usar monólito modular na API HTTP, PostgreSQL 17 como fonte de verdade e um processo worker separado para trabalhos assíncronos. O navegador acessa a API sob a mesma origem. A interface lê e grava via API. O Intelligence Core terá processo de inferência separado, com modelos de pesos abertos executados sob controle da V4NT. Contratos entre módulos devem permitir trocar o servidor de inferência sem alterar CRM ou inbox.

A API usa Node.js 24 e o driver pg. Rotas versionadas em /api/v1, JSON UTF-8, UUIDs, valores monetários em centavos e instantes UTC ISO 8601. Listas paginam por cursor estável e limite máximo de 100. Respostas de erro contêm error.code, error.message e requestId. Um registro inacessível por tenant e um registro inexistente produzem o mesmo 404 nas rotas de recurso. Separar validação de entrada (400), sessão inválida (401), permissão insuficiente (403), conflito (409) e falha temporária de dependência (503).

Cada operação escolhe o tenant pela sessão autenticada e verifica a permissão no backend. Sessões opacas expiram, são revogáveis e usam cookie HttpOnly, SameSite e Secure em HTTPS. Requisições de mutação via navegador validam a origem. O banco aplica chaves compostas por tenant nas relações e políticas de linha com papel de aplicação sem privilégio de dono. Logs JSON carregam requestId, duração e resultado. Dados pessoais, tokens e corpos de mensagens ficam fora dos logs técnicos.

Eventos persistidos na mesma transação que a mudança carregam id, tenant, tipo, versão, instante e identificador do agregado. Workers reivindicam trabalhos com bloqueio de linha, lease e retentativa limitada. Consumidores registram idempotência por tenant, provedor e identificador do evento. Webhooks de entrada passam por autenticação específica do provedor antes do processamento. Toda ação sensível de um agente exige autorização adequada e deixa trilha de auditoria.

## Módulos de domínio

| Módulo | Dados que controla | Dependências e destino |
|---|---|---|
| Gestão de clientes | Tenants, associação de usuários, cadastro | Fornece contexto a todos os módulos |
| CRM | Leads, contatos, contas, oportunidades, pipeline e atividades | Fornece histórico à inbox, prospecção e receita |
| Prospecção | ICP, contas-alvo, fontes, deduplicação | Envia leads ao CRM com proveniência |
| Central de relacionamento | Instâncias, conversas, mensagens e mídias | Recebe Evolution, associa contatos ao CRM |
| Inteligência proprietária | Modelos, documentos, vetores, memória e inferências | Isola contexto por empresa e serve agentes |
| Agentes comerciais | Perfis, ferramentas, execuções e aprovações | Usam o Core e as permissões da sessão |
| Automação de processos | Fluxos, versões, esperas e execuções | Consome eventos e agenda ações em fila |
| Inteligência de receita | Projeções e indicadores calculados | Agrega fatos do CRM e da operação |
| Gestão de equipes | Equipes, atribuições, papéis e metas | Aplica escopo comercial por associação |
| Integrações | Conectores, segredos, webhooks e consumo | Fornece adaptadores à inbox e à cobrança |
| Assinaturas e cobrança | Planos, assinaturas, pagamentos e direitos | Valida eventos financeiros e habilita recursos |
| Administração global | Identidades administrativas, operações e auditoria | API e autorização próprias, com motivo e operador nas ações críticas |

## Infraestrutura e experiência

Configuração por ambiente e segredos entregues ao processo. Desenvolvimento local e CI usam banco descartável para testes. Homologação e produção recebem bancos, chaves e origens próprios. Migrations são versionadas, aplicadas em transação com lock e verificadas por checksum. Mudanças destrutivas exigem plano de recuperação. Arquivos privados são endereçados por tenant e objeto. O PostgreSQL armazena metadados e o pgvector armazenará vetores. Health checks separam processo vivo de serviço pronto. A retenção, exportação, revogação de acessos e exclusão devem considerar backups e registros sujeitos a retenção.

O produto usa fundo grafite #101116, superfícies #1B1D25, texto #F3F2F8 e roxo de destaque #B29BFF. Tipografia de interface Inter ou system-ui, números tabulares para indicadores. Botões, campos, tabelas, modal, seletor de período, aviso e estado vazio reutilizam tokens. Toda tela prevê teclado, foco visível, estados de carregamento e falha. Navegação recolhível no desktop e gaveta no celular. Um tenant novo vê seus próprios totais zerados e instruções para a primeira ação.

## Validação e entrega

Confrontar o inventário acima com as respostas de /repos/marllonfilipe/vantplatform/branches e /contents no momento anterior ao primeiro commit. Para rever a entrega, abrir o README e o cronograma no commit da missão. Conferir os doze módulos, seus contratos, o isolamento, as treze entregas e as respectivas evidências de aceite. Não havia testes de aplicação a executar no estado inicial.

Arquivos da entrega: README.md, docs/cronograma.md e este relatório. Integrações de produto implementadas nesta missão: zero. A próxima entrega é a fundação SaaS com migração e validação em PostgreSQL real.
