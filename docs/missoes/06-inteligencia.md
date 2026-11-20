# Missão 06 · Intelligence Core

Em desenvolvimento. A primeira entrega (`b42095e`) instalou o modelo de pesos abertos com revisão fixa, a inferência local em CPU e as tabelas do núcleo. O [teste real de inferência](https://github.com/marllonfilipe/vantplatform/actions/runs/44621350559) passou nessa revisão.

## Memória comercial por empresa

Um proprietário ou gestor cadastra texto comercial por `POST /api/v1/core/documents`, informando `title` e `content`. O limite é de 12.000 caracteres de conteúdo. A API fragmenta o texto e persiste os trechos com o identificador do modelo e os embeddings no PostgreSQL. A atualização por `PUT /api/v1/core/documents/{id}` substitui o índice dentro da transação. A exclusão por `DELETE` remove também os trechos. As três operações registram o ator e o documento na auditoria.

Membros autenticados podem listar os 100 documentos mais recentes por `GET /api/v1/core/documents` e consultar `POST /api/v1/core/search` com `query` e, opcionalmente, `limit` de 1 a 20. A consulta ordena pela distância do cosseno e retorna título, identificador, trecho e similaridade dos documentos da empresa. A resposta inclui revisão do modelo e tempo de inferência. Estes documentos são compartilhados com todos os membros da empresa.

## Verificação e retomada

O workflow **Validar inteligência local** executa `tests/core/knowledge.test.mjs` com chamadas HTTP à aplicação, banco pgvector, papel restrito e pesos locais. Exercita permissões, classificação dos trechos, isolamento entre duas empresas, reindexação, exclusão em cascata e auditoria. O resultado de cada revisão está em [GitHub Actions](https://github.com/marllonfilipe/vantplatform/actions/workflows/inteligencia.yml).

A entrega de documentos no commit `1d26b5f` passou na [suíte do Core](https://github.com/marllonfilipe/vantplatform/actions/runs/44657080360) e na [regressão SaaS](https://github.com/marllonfilipe/vantplatform/actions/runs/44657080312).

## Qualificação e oportunidades

Na ficha de lead ou oportunidade, o vendedor responsável ou um gestor pode solicitar uma análise. Qualquer membro com acesso de leitura ao registro pode consultar as últimas vinte análises. As rotas são `GET` e `POST /api/v1/core/{leads|deals}/{id}/analyses`. A execução registra ator, revisão do modelo, duração da inferência e versão das regras. Os trechos recuperados são apresentados com a análise atual. O histórico guarda referências aos trechos, sem copiar o texto dos documentos.

A pontuação de lead soma sinais observáveis no CRM. Canal de contato, empresa, segmento e pessoa de contato valem dez pontos cada. Contato recente vale 25 e oportunidade aberta vale 35. A interface apresenta os motivos e a próxima ação. A análise de oportunidade verifica vencimento da previsão, inatividade e ausência de atividade pendente. A probabilidade exibida é a cadastrada no CRM. As regras iniciais precisam de avaliação com resultados comerciais antes de qualquer interpretação preditiva. A seleção de trechos usa o modelo local; os documentos recuperados não executam ações nem alteram a pontuação.

O teste HTTP do Core inclui variação da pontuação após abrir uma oportunidade, classificação de risco, registro de análises sucessivas e permissões entre empresas e vendedores. Consultar a execução correspondente ao commit para o resultado.

A [execução de inteligência do commit a3ee3c0](https://github.com/marllonfilipe/vantplatform/actions/runs/44657429330) passou com as análises de leads e oportunidades.

## Interface de documentos e desempenho

A navegação **Inteligência → Memória comercial** reúne cadastro, substituição e exclusão para gestores e busca semântica para membros. O teste de navegador usa Chromium, uma sessão autenticada, textos cadastrados pela interface e o modelo local.

O teste de fila aquece o modelo antes de enviar 24 inferências em seis rodadas de quatro chamadas simultâneas. O log do job informa mediana, p95 e máximo em milissegundos, incluindo o tempo de fila. A amostra mede esse runner de CI. Capacidade com documentos e tráfego de produção precisa de medição no host correspondente.

O [teste de navegador e carga do commit d9e24e7](https://github.com/marllonfilipe/vantplatform/actions/runs/44657698205) passou. No cenário de 24 consultas curtas em quatro chamadas concorrentes, esse runner registrou mediana de 8 ms, p95 de 14 ms e máximo de 15 ms após o aquecimento.

Gestores consultam o volume de análises de leads e oportunidades por revisão de modelo, a mediana e o p95 de latência de inferência na página de memória. O endpoint `GET /api/v1/core/metrics?days=30` aceita janelas de 7, 30 e 90 dias. Os dados vêm das análises concluídas da empresa. Consultas avulsas de busca, falhas e tempo total da requisição não entram nesse indicador. A suíte HTTP verifica contagens, ordenação dos percentis, papel de acesso e isolamento entre empresas.

O commit `355fb29` passou nas suítes de [inteligência](https://github.com/marllonfilipe/vantplatform/actions/runs/44657966564) e [regressão SaaS](https://github.com/marllonfilipe/vantplatform/actions/runs/44657966520).

## Qualificação a partir de informações declaradas

A ficha de lead conserva necessidade, intenção de compra, orçamento, janela de compra e objeção. A edição segue as permissões e o histórico do CRM. Na migration 007, registros existentes recebem o estado “Não informado” para as opções de escolha. A análise usa os dados disponíveis no momento da solicitação, junto com o cargo e o indicador de decisor do contato vinculado. O histórico mantém cada avaliação e a versão de regras correspondente.

O núcleo prioriza o tratamento de uma objeção registrada. Uma solicitação de proposta com orçamento confirmado gera a recomendação de preparar a proposta. Na recuperação semântica, a necessidade e a objeção precedem o segmento e as notas. A pontuação de atividade conserva a fórmula documentada. O teste via HTTP confirma rejeição de opções inválidas, nova análise após alteração pelo CRM e preservação da avaliação anterior.

A [validação do Core de cb9ab17](https://github.com/marllonfilipe/vantplatform/actions/runs/44658276180) exercitou alteração via CRM, inferência com esses dados e preservação do histórico.

## Catálogo e referências

Ao cadastrar um documento, o gestor pode selecionar a categoria **Oferta do catálogo**. Documentos antigos são referências por padrão. Uma análise de lead com necessidade declarada compara seu contexto com o catálogo daquela empresa usando o modelo local. A oferta candidata aparece para revisão humana quando a similaridade do cosseno alcança 0,65. Esse corte inicial é configurado no código e precisa de avaliação com dados comerciais representativos. A sugestão não envia proposta nem altera preços.

Cada substituição de documento incrementa sua revisão. As novas análises registram documento, revisão e índice do trecho usado. A recomendação registra também a identificação e o título da oferta vigente na consulta. Registros anteriores à migration 008 mantêm os dados disponíveis na época. O teste de integração cobre ausência de oferta no tenant, inclusão em catálogo próprio, mudança de revisão e referência da análise à versão consultada.

O [teste de integração da revisão 4db4bcf](https://github.com/marllonfilipe/vantplatform/actions/runs/44658530049) confirmou catálogo isolado por empresa e referências versionadas.

## Tarefas, histórico e falhas do runtime

Cada análise registra até cinco atividades pendentes por prazo e as cinco últimas concluídas do lead ou da oportunidade, com responsável e datas. O Core consulta as atividades da própria agenda do CRM. A interface exibe o estado na data da análise. Concluir uma atividade no CRM muda o resultado da análise seguinte e preserva a anterior. A migration 009 cria índices para essas consultas por empresa e registro.

O processo local de inferência recebe somente as variáveis de runtime necessárias. Falhas geram eventos com código, revisão do modelo e tamanho da fila. O log de falhas do Core não recebe textos, vetores ou parâmetros de conexão. O teste interrompe o worker, usa um executável ausente e verifica recuperação com o modelo real. Outro teste excede a capacidade da fila e verifica que os pedidos aceitos terminam.

A próxima atividade independente é aproveitar as análises para propostas de ação interna do agente de qualificação, com aprovação humana, histórico e controle de duplicidade na agenda. Ficam pendentes a avaliação comercial das regras e da seleção de ofertas, capacidade no host de implantação e as memórias de conversa vinculadas ao canal. A homologação da missão 05 segue o procedimento existente. O aceite integral da 06 permanece em aberto.
