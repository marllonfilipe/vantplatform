ALTER TABLE vant.plan_assignments ADD COLUMN inference_texts_per_day integer CHECK (inference_texts_per_day >= 0);
CREATE TABLE vant.inference_batches (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 usage_day date NOT NULL DEFAULT ((statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date),
 model_version text NOT NULL,
 input_count integer NOT NULL CHECK (input_count BETWEEN 1 AND 64),
 state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','completed','failed')),
 PRIMARY KEY(tenant_id,id)
);
ALTER TABLE vant.inference_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.inference_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.inference_batches
 USING (tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
CREATE INDEX inference_by_company_day ON vant.inference_batches(tenant_id,usage_day);
GRANT SELECT, INSERT ON vant.inference_batches TO vant_app;
GRANT UPDATE(state) ON vant.inference_batches TO vant_app;
