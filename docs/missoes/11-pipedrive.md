# Pipedrive · consulta de organizações

Em **Operação → Central de integrações → Pipedrive**, proprietários e gestores podem consultar a primeira página de organizações que o usuário da integração tem permissão para ver. O painel mostra ID e nome de até 50 organizações e indica quando o Pipedrive oferece outra página. O banco registra o início, o resultado e a hora da consulta. O painel exibe os dez registros mais recentes e a última leitura bem-sucedida. Os dados consultados ficam na prévia e não alteram cadastros no CRM.

## Configurar por empresa

No servidor da API, configure `VANT_PIPEDRIVE_DIR` com o caminho absoluto de um diretório privado montado para leitura. O arquivo `<UUID-da-empresa>.json` contém as propriedades `company_domain` e `api_token`. A primeira é apenas o subdomínio da conta e a segunda é o token de um usuário autorizado a consultar organizações. Use um usuário com as permissões adequadas à visibilidade desejada para a empresa. Para trocar a conta ou a credencial, substitua o arquivo privado de forma atômica e faça uma nova consulta pela Central.

O endpoint autenticado `POST /api/v1/integrations/pipedrive/read` aceita um objeto JSON vazio. A sessão define a empresa. A API faz um GET no endpoint v2 de organizações do subdomínio configurado, com o token no cabeçalho `x-api-token`. O servidor limita o tempo da chamada e o tamanho da resposta e recusa redirecionamentos. O painel distingue falha de acesso, quota e indisponibilidade. O estado **Configurado** indica uma configuração local válida. A última leitura só é atualizada quando o provedor devolve uma página válida.

## Homologar a leitura real

No ambiente protegido `pipedrive-homologacao` do GitHub, cadastre os dois campos de configuração em um único objeto JSON no segredo `VANT_PIPEDRIVE_CHECK`. Em **Actions → Homologar leitura do Pipedrive**, execute o fluxo na `main` e confira o job **leitura-autorizada**. Ele usa o conector da plataforma e publica apenas a contagem retornada, inclusive zero se a conta estiver vazia. Para validar a instalação da empresa, faça também a consulta pela Central. A suíte da fundação verifica regras locais, autorizações, seleção de configuração e navegação. A homologação requer uma leitura autenticada com a conta autorizada.

[Organizações na API v2](https://developers.pipedrive.com/docs/api/v1/Organizations) · [Autenticação](https://pipedrive.readme.io/docs/core-api-concepts-authentication) · [Paginação](https://pipedrive.readme.io/docs/core-api-concepts-pagination)
