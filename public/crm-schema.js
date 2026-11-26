export const entities={
 leads:{label:'Leads',fields:'name email phone source segment owner_id team_id account_id contact_id tags notes stated_need purchase_intent budget_state purchase_window stated_objection'},
 accounts:{label:'Empresas',fields:'name segment website size_band location cnpj business_activity'},
 contacts:{label:'Contatos',fields:'name email phone title account_id decision_maker'},
 deals:{label:'Oportunidades',fields:'name pipeline_id stage_id amount_cents probability close_on owner_id team_id account_id contact_id lead_id source sales_channel products status loss_reason'},
 activities:{label:'Agenda comercial',fields:'title kind owner_id lead_id deal_id due_at done_at'},
 conversations:{label:'Conversas',fields:'name phone owner_id account_id contact_id'}
};
export const labels={sales_channel:'Canal comercial',business_activity:'Atividade econômica',stated_need:'Necessidade declarada',purchase_intent:'Intenção de compra',budget_state:'Orçamento',purchase_window:'Prazo de compra',stated_objection:'Objeção registrada',name:'Nome',email:'E-mail',phone:'Telefone',source:'Origem',segment:'Segmento',owner_id:'Responsável',team_id:'Equipe',account_id:'Empresa',contact_id:'Contato',tags:'Tags',notes:'Observações',website:'Site',size_band:'Porte',location:'Localização',cnpj:'CNPJ',title:'Título ou cargo',decision_maker:'Decisor',pipeline_id:'Funil',stage_id:'Etapa',amount_cents:'Valor em reais',probability:'Probabilidade (%)',close_on:'Previsão de fechamento',lead_id:'Lead',products:'Produtos ou serviços',status:'Situação',loss_reason:'Motivo da perda',kind:'Tipo',deal_id:'Oportunidade',due_at:'Prazo',done_at:'Conclusão'};
export const options={
 sales_channel:{unknown:'Canal não informado',phone:'Telefone',email:'E-mail',website:'Site',in_person:'Presencial',social:'Rede social',messaging:'Mensageria',other:'Outro canal'},
 purchase_intent:{unknown:'Não informado',exploring:'Pesquisando alternativas',evaluating:'Avaliando a solução',requested_proposal:'Solicitou proposta'},
 budget_state:{unknown:'Não informado',unconfirmed:'A confirmar',confirmed:'Confirmado',unavailable:'Indisponível'},
 purchase_window:{unknown:'Não informado',month:'Até 30 dias',quarter:'Entre 31 e 90 dias',later:'Após 90 dias'},
 kind:{task:'Tarefa',call:'Ligação',meeting:'Reunião',comment:'Comentário',reminder:'Lembrete',followup:'Follow-up'},status:{open:'Aberta',won:'Ganha',lost:'Perdida'}};
export const related={owner_id:'members',team_id:'teams',account_id:'accounts',contact_id:'contacts',lead_id:'leads',deal_id:'deals',pipeline_id:'pipelines'};
