# Missão 11 · Gateway de assinaturas em homologação

O primeiro adaptador avaliado para implementação usa o sandbox do Asaas. O provedor publica consultas distintas de situação da conta, assinatura e cobranças associadas. Essa separação permite verificar a conexão e conciliar uma assinatura antes de habilitar operações financeiras. A escolha é técnica para o primeiro adaptador. Uma contratação comercial e as condições de produção continuam pendentes. [Consulta da conta](https://docs.asaas.com/reference/consultar-situacao-cadastral-da-conta) · [Consulta de assinatura](https://docs.asaas.com/reference/recuperar-uma-unica-assinatura)

| Provedor avaliado | Recurso relevante para a missão |
|---|---|
| Asaas | Consulta da assinatura por identificador e webhooks de atualização. A API de sandbox tem origem própria. [Referência](https://docs.asaas.com/reference/recuperar-uma-unica-assinatura) |
| Mercado Pago | Permite pausar e cancelar assinaturas. Os webhooks de assinatura têm configuração de teste e verificação de origem. [Gerenciamento](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/subscription-management) · [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks) |
| Stripe Billing | Disponibiliza ambiente de testes para verificar assinaturas e eventos do ciclo financeiro. [Testes de Billing](https://docs.stripe.com/billing/testing) |

## Conferir a conexão

O comando `node scripts/verify-asaas-sandbox.mjs --public` consulta o endpoint cadastral do sandbox sem credencial. Ele verifica HTTPS e a resposta documentada HTTP 401 para essa chamada. O resultado deixa a autenticação pendente.

Para conferir a conta de teste, disponibilize a chave somente no secret `VANT_ASAAS_SANDBOX_API_KEY` do ambiente GitHub **asaas-homologacao**. Em **Actions → Verificar conexão Asaas Sandbox → Run workflow**, selecione a branch **main**. A etapa autenticada executa uma consulta GET de situação cadastral. O script exige HTTP 200 e o campo de situação geral. Os logs públicos apresentam apenas o resultado técnico. Conserve a chave e os dados da conta no ambiente privado.

A validação financeira ainda depende do vínculo de uma assinatura real do sandbox com a empresa correta, do processamento autenticado dos eventos e da conciliação das cobranças. Uma consulta cadastral bem-sucedida comprova somente o acesso à conta. Cobranças de produção dependem da homologação prevista no plano.
