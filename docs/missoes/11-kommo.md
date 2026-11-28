# Kommo · consulta de empresas

Em **Operação → Central de integrações → Kommo**, proprietários e gestores consultam a primeira página de empresas visíveis à conta autorizada. A prévia traz nome e identificador de até 50 empresas e indica se existe outra página. A consulta não grava esses cadastros no CRM da V4NT.

## Configurar a empresa

Configure `VANT_KOMMO_DIR` como diretório absoluto e privado. No arquivo `<UUID-da-empresa>.json`, informe o subdomínio da conta em `subdomain` e o token autorizado em `access_token`. A troca das credenciais consiste em substituir esse arquivo no servidor de modo atômico. O endpoint `POST /api/v1/integrations/kommo/read` recebe um objeto vazio. A sessão autenticada define a empresa. O leitor usa apenas o endereço HTTPS do subdomínio configurado e registra início e resultado, sem salvar o token nem a resposta na auditoria.

## Verificar em conta autorizada

Cadastre o JSON com os dois campos no segredo `VANT_KOMMO_CHECK` do ambiente protegido `kommo-homologacao`. Execute **Homologar leitura do Kommo** na branch principal e confira o job **leitura-autorizada**. A evidência pública contém apenas a contagem obtida. Confirme a consulta da instalação também pela Central usando uma conta com permissão de gestão.

[API de empresas do Kommo](https://developers.kommo.com/reference/companies-list) · [Autorização por conta](https://developers.kommo.com/docs/long-lived-token)
