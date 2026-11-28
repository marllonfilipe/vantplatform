# RD Station CRM · consulta de empresas

Na Central de integrações, um proprietário ou gestor pode consultar a primeira página de empresas da conta RD Station CRM vinculada ao seu tenant. A prévia mostra o ID e o nome de até 50 empresas e indica se há outra página. A consulta não importa dados para o CRM. O histórico registra o início e o resultado sem armazenar o conteúdo da resposta.

## Configuração e uso

Configure `VANT_RD_STATION_DIR` como diretório absoluto privado, montado para leitura pelo processo da API. No arquivo `<UUID-da-empresa>.json`, guarde o campo `access_token` com um token OAuth2 válido da conta autorizada. A renovação do token nesta entrega é operacional. Substitua o arquivo privado de forma atômica quando necessário. Prossiga em **Operação → Central de integrações → RD Station CRM → Consultar empresas do RD Station CRM**.

O endpoint da V4NT é `POST /api/v1/integrations/rd-station/read`, com corpo JSON vazio. A sessão determina a empresa. A chamada externa usa a API v2, tempo e tamanho de resposta limitados e destino fixo. O painel distingue problemas de acesso, limite de chamadas e falhas do serviço.

## Verificação em conta autorizada

No ambiente protegido `rd-station-homologacao`, guarde a configuração JSON no segredo `VANT_RD_STATION_CHECK`. Execute **Homologar leitura do RD Station CRM** na branch principal e confira o job **leitura-autorizada**. Ele publica somente a contagem de empresas devolvidas. Valide também o acesso da empresa pela Central. A aprovação dos testes locais e de CI cobre regras da aplicação. A leitura externa continua pendente até a execução com uma conta autorizada.

[Endpoint de empresas](https://developers.rdstation.com/reference/crm-v2-list-organizations) · [Autenticação no CRM v2](https://developers.rdstation.com/reference/crm-v2-authentication)
