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

Próximos incrementos da 06 abrangem memória operacional e histórica, critérios comerciais de qualificação (necessidade, intenção, oferta e objeções com evidências) e monitoramento. O aceite integral continua pendente. A integração de conversas reais segue a dependência da missão 05.
