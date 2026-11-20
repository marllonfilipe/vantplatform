# Missão 09 · Inteligência de prospecção

**Implementação parcial.** A página **Comercial → Prospecção** utiliza as empresas e os contatos já cadastrados no CRM da empresa autenticada.

## Perfil de cliente ideal e seleção de contas

Proprietários e gestores podem criar ou revisar um perfil com pelo menos um critério entre segmento, região, porte e atividade econômica. No cadastro de empresa do CRM, o campo **Atividade econômica** registra a atividade informada. A pesquisa combina todos os critérios do perfil. Segmento e porte usam igualdade sem distinguir maiúsculas e minúsculas. Região e atividade buscam parte do texto. A busca adicional por nome restringe o resultado. O perfil indica critérios comerciais definidos pela equipe. A classificação pelo Intelligence Core é uma entrega posterior.

Cada cartão indica o número de decisores registrados na empresa e dá acesso à ficha original no CRM. Usuários com escrita podem selecionar uma conta e registrar a fonte da seleção. A lista **Empresas-alvo selecionadas** conserva fonte, data e vínculo com a empresa mesmo que o perfil seja revisado. A remoção afeta apenas a seleção. Leituras usam paginação; as operações de escrita têm auditoria.

Na API autenticada, use `GET /api/v1/prospecting/profiles`, `POST /api/v1/prospecting/profiles` e `PUT /api/v1/prospecting/profiles/{id}` (com `expected_revision`). Os recursos `accounts` e `targets` abaixo do perfil listam, respectivamente, empresas compatíveis e empresas selecionadas. Aceitam `q`, `limit` e `cursor`. A seleção recebe `source_reference` em `PUT .../targets/{accountId}`; `DELETE` remove o vínculo.

## Evidência e pendências

A suíte de fundação executa `tests/prospecting.integration.mjs` em PostgreSQL e Chromium. O cenário cadastra um perfil na interface, escolhe uma empresa com fonte, abre a ficha original, confere papéis de acesso e separação entre empresas, conflito de revisão, paginação e auditoria. O resultado pertence ao commit testado.

O próximo incremento é importar contas de uma fonte autorizada por CSV com deduplicação e rastreabilidade. Pesquisa assistida, classificação pelo Core e apoio à abordagem permanecem pendentes de implementação e validação.
