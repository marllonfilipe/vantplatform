CREATE TABLE vant.billing_plans (
 code text PRIMARY KEY,
 name text NOT NULL,
 display_order integer NOT NULL UNIQUE,
 monthly_cents bigint CHECK(monthly_cents>0),
 custom_terms boolean NOT NULL,
 user_limit integer CHECK(user_limit>0),
 active_lead_limit integer CHECK(active_lead_limit>=0),
 pipeline_limit integer CHECK(pipeline_limit>=0),
 whatsapp_connection_limit integer CHECK(whatsapp_connection_limit>=0),
 features text[] NOT NULL CHECK(cardinality(features)>0),
 CHECK(custom_terms OR (monthly_cents IS NOT NULL AND user_limit IS NOT NULL AND active_lead_limit IS NOT NULL AND pipeline_limit IS NOT NULL AND whatsapp_connection_limit IS NOT NULL)),
 CHECK(NOT custom_terms OR monthly_cents IS NULL)
);
INSERT INTO vant.billing_plans VALUES
 ('start','Start',1,19700,false,1,500,1,0,ARRAY['CRM essencial','Qualificação básica']),
 ('growth','Growth',2,39700,false,3,2000,3,1,ARRAY['CRM','Inbox','SDR','Copiloto','Automações básicas']),
 ('scale','Scale',3,59700,false,10,10000,10,3,ARRAY['Agentes avançados','Prospecção','Revenue Intelligence','Automações avançadas']),
 ('enterprise','Enterprise',4,NULL,true,NULL,NULL,NULL,NULL,ARRAY['Estrutura multiunidade','Governança','Integrações corporativas','Serviços dedicados']);
GRANT SELECT ON vant.billing_plans TO vant_app;
