# HubSpot · consulta de empresas

Em **Operação → Central de integrações → HubSpot**, proprietários e gestores podem consultar uma prévia da primeira página de empresas ativas da conta configurada. O painel exibe nome e domínio, até 50 registros, e indica se há outra página no HubSpot. Ele mostra a última leitura confirmada e até dez eventos de auditoria. Nomes de empresas, domínios e tokens ficam fora dessa auditoria. A consulta não grava nem reconcilia cadastros nos dois CRMs.

## Configuração por empresa

1. Na conta HubSpot autorizada, configure um aplicativo privado com o escopo de leitura de empresas `crm.objects.companies.read`.
2. No servidor da API, monte um diretório de segredos de acesso restrito e somente leitura. Em `VANT_HUBSPOT_DIR`, informe seu caminho absoluto. Dentro dele, o arquivo `<UUID-da-empresa>.json` contém um objeto com a propriedade `access_token`. Use o token da conta correspondente a essa empresa.
3. Na Central, clique em **Consultar empresas do HubSpot**. Para rotacionar o token, substitua o arquivo privado de forma atômica, faça nova consulta e revogue o token anterior no provedor.

A rota `POST /api/v1/integrations/hubspot/read` recebe um objeto JSON vazio. A empresa vem da sessão. Parâmetros de conta, destino ou campos enviados pelo cliente são recusados. A API acessa o endpoint oficial com limite de tempo, tamanho máximo de resposta e redirecionamento desativado. Se houver falha de acesso ou quota, o painel registra a categoria. O estado **Configurado** indica que a configuração local foi lida. A data da última leitura exige uma resposta válida do provedor.

## Homologação

O teste público solicita a página de empresas **sem credencial** e verifica a resposta HTTP 401. Ele comprova apenas a comunicação com o endpoint e a exigência de autenticação.

Para validar uma conta real, configure um token de homologação com escopo de leitura de empresas no segredo `VANT_HUBSPOT_CHECK` do ambiente protegido `hubspot-homologacao`. Execute **Actions → Verificar leitura do HubSpot → Run workflow** na `main` e confira o job **leitura-autorizada**. O job registra somente a quantidade de empresas retornadas. Uma conta vazia pode retornar zero. Para validar a instalação da empresa, faça a consulta também pela Central.

[Referência da API de empresas](https://developers.hubspot.com/docs/api-reference/latest/crm/objects/companies/get-companies)
