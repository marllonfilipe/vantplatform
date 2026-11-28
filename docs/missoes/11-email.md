# E-mail da empresa

## Conexão do relay SMTP

Em **Operação → Central de integrações → E-mail · SMTP**, um gestor pode verificar se a aplicação negocia TLS, valida o certificado e autentica no servidor da empresa. O painel mostra o resultado da última autenticação e o histórico das verificações. Uma confirmação vale para a conexão. Entrega de mensagem e recebimento na caixa postal são etapas distintas.

Na API, configure `VANT_SMTP_DIR` como diretório privado absoluto, com um arquivo JSON `<UUID-da-empresa>.json`. Os campos são `host`, `port`, `mode`, `username` e `password`. Use `tls` para TLS desde a abertura da conexão ou `starttls` para exigir a negociação antes de autenticar. Confira com o administrador o modo, a porta e se o relay aceita autenticação com senha de aplicação. O processo usa Python 3 e a biblioteca padrão. `VANT_PYTHON` seleciona o executável quando necessário. Em instalações com autoridade certificadora privada, disponibilize seu certificado pelo arquivo de confiança do sistema ou em `SSL_CERT_FILE`.

O endpoint `POST /api/v1/integrations/smtp/verify` recebe um objeto vazio. A sessão seleciona a configuração da empresa. O cliente testa o canal com NOOP e encerra a conexão. O histórico público da aplicação omite dados da caixa postal e credenciais.

Para homologar, configure o relay autorizado no ambiente da empresa, use **Verificar conexão SMTP** e confira a data da autenticação no painel. A suíte local exercita SMTP sobre sockets de loopback com certificado temporário, STARTTLS obrigatório, certificado sem confiança e recusa de senha.

## Mensagem de diagnóstico

Para habilitar o envio, o operador configura também `test_from` e `test_to` no arquivo privado da empresa. Ambos devem ser endereços individuais. Em **Central de integrações → E-mail · SMTP**, o gestor escolhe **Enviar mensagem de teste ao destino configurado**. O destinatário confere a caixa postal e a referência do teste para homologar o recebimento.

O endpoint `POST /api/v1/integrations/smtp/test-message` aceita somente `{"id":"<UUID>"}`. A mesma referência consulta a tentativa registrada. Novos testes da empresa têm um intervalo mínimo de um minuto. A reserva é persistida antes de abrir a conexão. Se houver interrupção após a reserva, consulte a última tentativa na Central. Após um minuto sem resultado, ela aparece como sem confirmação. Confira o relay ou a caixa antes de solicitar outro envio. Uma resposta positiva do relay registra **Aceita pelo relay**. O recebimento requer evidência da caixa de destino.

A suíte de protocolo usa destinatários locais de teste e cobre aceitação, recusa e desconexão após DATA nos dois modos de TLS. A suíte de CRM verifica concorrência, repetição da referência, permissões, isolamento e limitação de frequência.
