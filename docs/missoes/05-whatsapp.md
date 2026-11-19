# Missão 05 · Central de relacionamento

**Aceite em aberto.** A caixa de entrada usa conversas, contatos, leads, usuários e permissões do CRM. O adaptador em src/evolution.mjs chama a Evolution API 2.3.7. O banco persiste instâncias, mensagens, confirmações de leitura, notas internas e envios pendentes. Credenciais são fornecidas ao processo pelo ambiente. A API de administração da instância e a visualização do QR exigem papel de gestor. O navegador só recebe os campos necessários.

## Homologar o canal

1. Configure no ambiente privado do servidor EVOLUTION_URL, EVOLUTION_API_KEY, WA_WEBHOOK_KEY e WA_CALLBACK_ORIGIN. A chave do webhook deve ter pelo menos 32 bytes aleatórios. A origem deve apontar para a URL HTTPS da V4NT acessível pela Evolution. Mantenha as credenciais fora do GitHub público e dos registros de teste.
2. Em WhatsApp, cadastre a instância, configure a conexão e abra o QR. No telefone de homologação, abra Aparelhos conectados e leia o código. Consulte o estado e confira o telefone identificado.
3. De outro aparelho de teste autorizado, envie texto e mídia ao número pareado. Na Caixa de entrada, confira a conversa, baixe o anexo, vincule ou crie o lead e responda. Confira recebimento no outro aparelho e status de entrega disponibilizado pelo provedor.
4. Desconecte a instância de teste, reconecte, renove o QR se necessário e confira o histórico. Registre apenas data, versão, resultado e referência ao teste. Não publique QR, números, contatos, tokens, conteúdos pessoais ou arquivos recebidos.

## Validações reproduzíveis

O CI envia eventos de teste à rota HTTP real, usando PostgreSQL e Chromium, para verificar autenticação, repetição concorrente, isolamento, recibos fora de ordem, mídia, notas e CRM. O teste de contrato inicia um contêiner Evolution real com PostgreSQL e Redis exclusivos, configura o webhook, consulta a conexão e tenta obter o QR. A confirmação no aparelho e o tráfego externo são critérios de aceite distintos.

Uma mensagem de saída passa primeiro por reserva persistente. Após confirmação da transação a API faz a chamada externa. Uma resposta ambígua gera estado desconhecido. Uma nova tentativa com o mesmo identificador conserva esse estado para evitar duplicações. Após interrupção entre envio e confirmação, reconcile o registro pendente com o provedor antes de repetir a operação. Os eventos recebidos são tratados transacionalmente. Em falha temporária a API devolve erro para que a política de retentativa da Evolution reentregue o evento. As mensagens mantêm o identificador original para recuperação de mídia.

Arquivos principais: migrations/005_inbox.sql, src/evolution.mjs, src/wa-events.mjs, src/inbox.mjs, public/inbox.js, tests/inbox.integration.mjs e scripts/evolution-ci.sh. Pontos de integração do Core poderão consumir mensagens por tenant em missão posterior. Transcrição e interpretação de mídia ainda dependem desse núcleo.

## Comprovação ao vivo no GitHub Actions

O fluxo manual **Homologar WhatsApp pareado** usa o ambiente protegido whatsapp-homologacao. Disponibilize VANT_TEST_ORIGIN (origem HTTPS da aplicação), VANT_TEST_TENANT, VANT_TEST_EMAIL, VANT_TEST_PASSWORD, VANT_TEST_INSTANCE e VANT_TEST_PHONE (segundo aparelho autorizado). Use uma empresa e uma instância dedicadas a testes. O operador confirma o reinício e os dois envios ao iniciar o fluxo na main. O segundo aparelho deve responder com o código recebido pelo WhatsApp. O job confere a reconexão, a mensagem de retorno e o histórico de texto e documento. O resultado público contém apenas as etapas e seu desfecho. O mesmo script aceita essas variáveis em ambiente privado com Node 24. O QR é lido somente na aplicação privada.

Em [validação com PostgreSQL, Chromium, Redis e Evolution 2.3.7](https://github.com/marllonfilipe/vantplatform/actions/runs/44608068370), passaram os testes de inbox, restauração, criação e configuração da instância, consulta de estado e geração de QR real. A correção do delimitador SQL foi testada com banco novo. O teste de contrato também está preparado para percorrer as rotas autenticadas da V4NT e conferir o retorno do webhook ao servidor. O pareamento e a troca de mensagens entre aparelhos ainda exigem homologação.
