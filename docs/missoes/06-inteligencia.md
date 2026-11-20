# Missão 06 · Intelligence Core

Em desenvolvimento. A primeira entrega (`b42095e`) instalou o modelo de pesos abertos com revisão fixa, a inferência local em CPU e as tabelas do núcleo. O [teste real de inferência](https://github.com/marllonfilipe/vantplatform/actions/runs/44621350559) passou nessa revisão.

## Memória comercial por empresa

Um proprietário ou gestor cadastra texto comercial por `POST /api/v1/core/documents`, informando `title` e `content`. O limite é de 12.000 caracteres de conteúdo. A API fragmenta o texto e persiste os trechos com o identificador do modelo e os embeddings no PostgreSQL. A atualização por `PUT /api/v1/core/documents/{id}` substitui o índice dentro da transação. A exclusão por `DELETE` remove também os trechos. As três operações registram o ator e o documento na auditoria.

Membros autenticados podem listar os 100 documentos mais recentes por `GET /api/v1/core/documents` e consultar `POST /api/v1/core/search` com `query` e, opcionalmente, `limit` de 1 a 20. A consulta ordena pela distância do cosseno e retorna título, identificador, trecho e similaridade dos documentos da empresa. A resposta inclui revisão do modelo e tempo de inferência. Estes documentos são compartilhados com todos os membros da empresa.

## Verificação e retomada

O workflow **Validar inteligência local** executa `tests/core/knowledge.test.mjs` com chamadas HTTP à aplicação, banco pgvector, papel restrito e pesos locais. Exercita permissões, classificação dos trechos, isolamento entre duas empresas, reindexação, exclusão em cascata e auditoria. O resultado de cada revisão está em [GitHub Actions](https://github.com/marllonfilipe/vantplatform/actions/workflows/inteligencia.yml).

Próxima atividade após validar a API de documentos: qualificação de leads e análise de oportunidades com fatos do CRM e histórico de decisões. Continuam pendentes a interface de memória, a avaliação de desempenho com carga, as demais camadas de memória e o aceite integral da missão. A integração de conversas reais depende da homologação da missão 05.
