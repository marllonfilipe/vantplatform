# Google Calendar · consulta por empresa

Em **Operação → Central de integrações → Google Calendar**, proprietários e gestores podem consultar a agenda compartilhada de sua empresa. A janela abrange os próximos sete dias a partir do instante da consulta, inclusive eventos em andamento. A prévia traz até 50 ocorrências ordenadas pelo início. Se houver outra página, o painel avisa. Os eventos com horário são apresentados no fuso de Brasília. Eventos de dia inteiro conservam as datas civis, inclusive quando abrangem vários dias. Eventos privados ou confidenciais aparecem como **Reservado**.

## Preparar uma agenda

Habilite a API Google Calendar no projeto da conta de serviço, use uma agenda de homologação e compartilhe essa agenda com permissão para ver os eventos. A identidade de serviço e a agenda devem pertencer à configuração autorizada daquela empresa.

Na instalação, configure `VANT_GOOGLE_CALENDAR_DIR` com o caminho absoluto de um diretório privado montado para leitura pela API. O arquivo `<UUID-da-empresa>.json` contém `calendar_id` (o identificador completo em formato de e-mail), `client_email` e `private_key` da conta de serviço. O diretório do Calendar é independente do diretório do Sheets. Substitua o arquivo de forma atômica para trocar a agenda ou a credencial e consulte novamente. Para revogar o acesso, remova o compartilhamento no Google e a configuração local.

O endpoint `POST /api/v1/integrations/google-calendar/read` aceita um objeto JSON vazio. A sessão define a empresa. A API usa o escopo `calendar.events.readonly` e solicita apenas os campos necessários para a prévia. A resposta apresenta título e período. A auditoria registra início e resultado por requisição. O painel exibe a última leitura confirmada e até dez registros recentes. Nomes de eventos, participantes, descrições, locais, identificadores de agenda e tokens ficam fora da auditoria. A consulta não grava compromissos no CRM nem na agenda.

## Homologar

Cadastre o objeto privado no segredo `VANT_CALENDAR_CHECK` do ambiente protegido `google-calendar-homologacao`. Execute **Actions → Homologar leitura do Google Calendar → Run workflow** na `main`. O script exige uma resposta válida da API e publica somente a quantidade de eventos retornados. Para validar a instalação da empresa, consulte a mesma agenda pela Central. O fluxo manual valida o acesso ao provedor com as credenciais do ambiente de homologação.

A suíte técnica exercita a seleção por empresa, escopo, limites, permissões e tela no Chromium. Os casos de datas civis, eventos privados e indicação de resultados adicionais exercitam a transformação local dos dados. A homologação externa exige a leitura autenticada acima.

[Referência da API de eventos](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
