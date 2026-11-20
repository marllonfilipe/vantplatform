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

## Decisores, perfis profissionais e conversão

No perfil de cliente ideal, o gestor pode indicar o cargo procurado. Em uma empresa já selecionada, abra **Decisores e conversão**. A ficha lista os contatos do CRM e distingue o cargo compatível do papel de decisor confirmado. Para um contato existente, **Registrar fonte e perfil** guarda cargo, indicação de decisor, fonte, data da informação e, opcionalmente, o endereço público do perfil profissional informado pelo operador. O endereço do LinkedIn é normalizado sem parâmetros de rastreamento. A captura é manual. A plataforma não visita perfis nem envia mensagens. Para um contato novo, use **Cadastrar contato no CRM** e registre a fonte na ficha da conta.

Cada revisão tem histórico de quem registrou, quando, a conta, os dados e a fonte utilizados. Repetir a mesma gravação preserva a revisão. Alterações concorrentes exigem recarregar a ficha. Uma conta pode ser convertida em lead ou vinculada a um lead existente da mesma empresa. Quando já há leads, o operador escolhe o vínculo. O vendedor só pode vincular um lead de sua responsabilidade. O registro da conversão conserva a seleção de origem e impede uma segunda conversão para a mesma conta.

Os endpoints abaixo de `.../targets/{accountId}` são `GET people`, `PUT people/{contactId}`, `GET people/{contactId}/history` e `GET/POST handoff`. O cenário de fundação verifica o histórico, a URL, permissões e separação por empresa, a criação pelo Chromium e o vínculo com lead existente. A próxima atividade é combinar a aderência pelo Core com os cargos registrados e sinais reais do funil para sugerir decisores e oportunidades potenciais.

## Sugestão de decisores, abordagem e oportunidade potencial

Na ficha **Decisores e conversão**, use **Analisar abordagem**. A análise reúne a aderência atual ao ICP, o cargo procurado, os contatos da conta, a fonte da seleção e as contagens de oportunidades abertas, ganhas e perdidas. O Core compara os cargos informados com o cargo do perfil por embeddings locais. A análise inclui até trinta contatos do CRM, priorizando decisores registrados, correspondências do cargo e fontes datadas. A interface informa o total considerado e o total disponível.

Até três contatos aparecem como decisores registrados ou candidatos cujo cargo deve ser confirmado. A similaridade mínima para sugerir um cargo não confirmado é 0,65. A sugestão preserva o papel cadastrado no CRM. Uma conta com alta aderência, contato relevante e nenhuma negociação aberta pode gerar indicação de oportunidade a validar. Negócios abertos direcionam o usuário ao responsável pela negociação existente. A recomendação não cria negócio nem envia mensagem.

O endpoint `POST .../targets/{accountId}/briefs` grava os dados e a revisão do modelo usada para selecionar os cargos. Uma análise com as mesmas entradas é reutilizada. `GET` retorna as dez revisões mais recentes. A suíte do Core verifica a sugestão em CPU, a distinção entre candidato e decisor, a mudança de recomendação ao abrir uma oportunidade real e o histórico. A próxima entrega é a revisão de enriquecimentos fornecidos por fontes autorizadas.

## Revisão de enriquecimentos e captura assistida

Para complementar uma empresa existente, importe uma fonte autorizada com seu CNPJ e os campos disponíveis. Campos vazios do CRM podem receber sugestões de site, região, segmento, porte e atividade. Cada sugestão conserva fonte, valor, autor e data. Duplicar a importação preserva a sugestão original. Abra **Revisar enriquecimento** na conta selecionada para aplicar ou descartar cada valor. Ao aplicar, o servidor relê o campo sob bloqueio. Um valor diferente registrado desde a importação é preservado, e a sugestão recebe o estado **Campo alterado no CRM**. A auditoria registra a decisão e o CRM registra a alteração. A ficha exibe a data de atualização da empresa.

No contato, **Registrar fonte e perfil → Preencher a partir de texto autorizado** reconhece linhas com Cargo, Perfil, Fonte e Data. A prévia preenche o formulário para revisão do operador. Somente **Registrar informações** grava a nova revisão. A indicação de decisor fica a cargo do usuário. As fontes de prospecção desta implementação são os registros da empresa, arquivos importados e informações profissionais fornecidas com origem. O operador responde pela autorização para utilizá-las.

| Critério original | Funcionalidade e cenário de verificação |
|---|---|
| Pesquisa e organização de empresas | Perfil de cliente ideal, quatro critérios de mercado, busca por nome, seleção e listas paginadas |
| Importação funcional | CSV com fonte, validação atômica e deduplicação de lotes concorrentes |
| Integração com CRM | Conta e contatos compartilhados, conversão ou vinculação a lead com auditoria |
| Classificação inteligente | Modelo local, evidência de aderência, lista priorizada, sugestões de decisores e sinais do funil |
| Rastreabilidade das fontes | Referências por conta, data da informação profissional, histórico de revisões e origem da conversão |
| Controle de qualidade | Papéis e isolamento por empresa, validação de revisão, preservação de valores existentes e aprovação de enriquecimentos |

A suíte de fundação exercita a revisão de fonte e aplicação de campo no navegador, além da preservação de uma alteração concorrente. A suíte de inteligência exercita a classificação e a abordagem com o modelo instalado em CPU. O aceite pelo proprietário deve ser registrado separadamente.
