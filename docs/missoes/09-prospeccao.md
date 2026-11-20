# Missão 09 · Inteligência de prospecção

**Implementação parcial.** A página **Comercial → Prospecção** utiliza as empresas e os contatos já cadastrados no CRM da empresa autenticada.

## Perfil de cliente ideal e seleção de contas

Proprietários e gestores podem criar ou revisar um perfil com pelo menos um critério entre segmento, região, porte e atividade econômica. No cadastro de empresa do CRM, o campo **Atividade econômica** registra a atividade informada. A pesquisa combina todos os critérios do perfil. Segmento e porte usam igualdade sem distinguir maiúsculas e minúsculas. Região e atividade buscam parte do texto. A busca adicional por nome restringe o resultado. O perfil indica critérios comerciais definidos pela equipe. A classificação pelo Intelligence Core é uma entrega posterior.

Cada cartão indica o número de decisores registrados na empresa e dá acesso à ficha original no CRM. Usuários com escrita podem selecionar uma conta e registrar a fonte da seleção. A lista **Empresas-alvo selecionadas** conserva fonte, data e vínculo com a empresa mesmo que o perfil seja revisado. A remoção afeta apenas a seleção. Leituras usam paginação; as operações de escrita têm auditoria.

Na API autenticada, use `GET /api/v1/prospecting/profiles`, `POST /api/v1/prospecting/profiles` e `PUT /api/v1/prospecting/profiles/{id}` (com `expected_revision`). Os recursos `accounts` e `targets` abaixo do perfil listam, respectivamente, empresas compatíveis e empresas selecionadas. Aceitam `q`, `limit` e `cursor`. A seleção recebe `source_reference` em `PUT .../targets/{accountId}`; `DELETE` remove o vínculo.

## Evidência e pendências

A suíte de fundação executa `tests/prospecting.integration.mjs` em PostgreSQL e Chromium. O cenário cadastra um perfil na interface, escolhe uma empresa com fonte, abre a ficha original, confere papéis de acesso e separação entre empresas, conflito de revisão, paginação e auditoria. O resultado pertence ao commit testado.

O próximo incremento é importar contas de uma fonte autorizada por CSV com deduplicação e rastreabilidade. Pesquisa assistida, classificação pelo Core e apoio à abordagem permanecem pendentes de implementação e validação.

## Importação CSV com origem e deduplicação

Em **Prospecção**, escolha o perfil e **Importar empresas**. Selecione um arquivo CSV ou cole seu conteúdo. São obrigatórios os cabeçalhos `nome`, `cnpj` e `fonte`. Os opcionais são `site`, `segmento`, `região`, `porte` e `atividade`. O importador aceita vírgula ou ponto e vírgula, aspas e até 500 registros em 500 KB. Cada linha representa uma empresa selecionada pela fonte, inclusive quando ela não satisfaz todos os filtros do perfil.

A correspondência usa o identificador da empresa dentro do tenant e desconsidera pontuação, espaços e caixa. A validação verifica o formato de entrada. A confirmação da situação cadastral pertence à fonte informada. Contas existentes são reutilizadas e conservam os dados do CRM. O resultado mostra os campos divergentes preservados. Uma ambiguidade em registros históricos ou uma linha inválida interrompe o lote inteiro. Importações concorrentes e o cadastro normal do CRM coordenam a gravação do identificador.

Cada referência de origem fica vinculada à conta com o usuário e o instante de registro. Uma seleção posterior pode acrescentar uma fonte. A retirada de uma lista preserva as fontes da empresa. O cartão mostra até cinco referências recentes, além da origem da seleção vigente. O endpoint `POST /api/v1/prospecting/profiles/{id}/import` recebe `csv` e devolve as contagens de registros, empresas criadas, reutilizações e novas seleções.

O teste de prospecção importa arquivos com as mesmas contas em ordens opostas, verifica a reversão de lote inválido, confirma o isolamento entre empresas e importa uma fonte complementar pelo Chromium. O próximo incremento é classificar a aderência ao ICP com o Intelligence Core e apresentar a evidência da classificação.

## Aderência ao ICP e priorização

Na lista **Prioridade das empresas-alvo**, use **Classificar aderência**. O Core considera somente critérios definidos no perfil. Cada critério tem peso igual. Dados ausentes recebem zero pontos. Região e porte usam os critérios estruturados da pesquisa. Para segmento e atividade econômica com dados, o mesmo modelo de embeddings local da plataforma calcula a similaridade entre perfil e empresa. Correspondência direta recebe cem pontos. Fora dela, os critérios semânticos usam o cosseno limitado ao intervalo de zero a um.

A nota final é a média arredondada dos pontos. As faixas são alta aderência a partir de 80, parcial a partir de 50 e baixa abaixo de 50. A nota mede aderência aos critérios selecionados. A interface mostra os valores avaliados, o método, os pontos, a revisão do modelo quando usada e uma sugestão de abordagem. A fonte da seleção permanece disponível no cartão.

A classificação fica associada à empresa, à revisão do perfil, aos dados observados e à revisão do motor. Repetir a ação com as mesmas entradas reutiliza o resultado. A prioridade usa somente avaliações compatíveis com os dados atuais. As contas sem avaliação atual aparecem no fim. Em `POST .../targets/{accountId}/assess`, membros com escrita avaliam contas selecionadas. `GET .../priority` expõe o resultado paginado aos leitores da empresa.

A suíte de inteligência executa `tests/core/prospecting.test.mjs` em CPU com PostgreSQL e Chromium. Ela verifica classificação com modelo real, falta de dados, concorrência, revisão do perfil, edição do CRM, ordenação e isolamento. O próximo incremento é associar perfis profissionais e fontes aos decisores e registrar a passagem da conta-alvo para um lead no CRM.
