# Google Sheets · leitura por empresa

Em **Operação → Central de integrações → Google Sheets**, proprietários e gestores consultam o intervalo autorizado, iniciam uma leitura e verificam a última leitura confirmada e os dez eventos mais recentes. A prévia mostra os valores formatados das células. Uma leitura de intervalo vazio também é válida. O CRM só lê a planilha. O banco mantém o resultado e o momento das tentativas, sem armazenar células, tokens ou chaves.

## Configuração

1. Habilite a API Google Sheets no projeto da conta de serviço. Use uma conta dedicada à empresa e compartilhe a planilha com ela como leitora.
2. No servidor, monte um diretório privado de segredos em modo somente leitura para o processo da API. Defina `VANT_GOOGLE_SHEETS_DIR` com o caminho absoluto. O arquivo de cada empresa tem o nome `<UUID-da-empresa>.json`. Ele contém um objeto JSON com estas propriedades.

| Campo | Conteúdo |
|---|---|
| `client_email`, `private_key` | Identidade e chave RSA da conta de serviço |
| `spreadsheet_id` | Identificador da planilha compartilhada |
| `tab` | Nome literal da aba |
| `range` | Retângulo com até 100 linhas, entre as colunas A e Z, por exemplo `B2:D20` |

3. Abra a Central com o perfil de gestão e clique em **Consultar planilha**. Para trocar a chave ou o intervalo, substitua o arquivo privado de forma atômica e repita a consulta. Para desconectar, remova o arquivo e revogue a chave no Google. O navegador recebe somente o intervalo, os resultados de consulta e os valores retornados na leitura solicitada.

O endpoint é `POST /api/v1/integrations/google-sheets/read` com um objeto JSON vazio. A empresa vem da sessão. O servidor obtém um token OAuth de escopo somente leitura para a conta configurada e lê o intervalo fixo pela API v4. A aplicação limita o tamanho da resposta e informa erros de configuração, acesso, quota, tamanho e indisponibilidade. A auditoria de cada tentativa relaciona início e resultado pelo identificador da requisição. Uma tentativa interrompida pode ter somente o início registrado.

## Homologação com o provedor

Use uma planilha de homologação com dados autorizados. No ambiente protegido `google-sheets-homologacao` do GitHub, cadastre o objeto privado como segredo `VANT_SHEETS_CHECK`. Em **Actions → Homologar leitura do Google Sheets**, execute o fluxo na `main`. A execução só passa após obter o token e ler a API oficial. O log registra apenas a quantidade de linhas. O fluxo exercita o conector com as credenciais do ambiente de homologação. Para validar a instalação da empresa, faça também a leitura pela Central com o arquivo privado montado.

A suíte da fundação exercita a assinatura RSA, o escopo, as permissões de acesso, o isolamento da configuração, a recusa de parâmetros extras e a tela no Chromium. A leitura autenticada externa aguarda evidência.

[Autorização de contas de serviço](https://developers.google.com/identity/protocols/oauth2/service-account) · [Leitura de valores](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get)
