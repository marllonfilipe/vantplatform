CREATE TABLE vant.recommendations (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL, title text NOT NULL, detail text NOT NULL, model_version text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), dismissed_at timestamptz,
 PRIMARY KEY(tenant_id,id), FOREIGN KEY (tenant_id,owner_id) REFERENCES vant.members(tenant_id,id)
);
ALTER TABLE vant.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.recommendations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.recommendations USING (tenant_id=vant.current_tenant()) WITH CHECK (tenant_id=vant.current_tenant());
GRANT SELECT ON vant.recommendations TO vant_app;
