CREATE TABLE vant.smtp_diagnostics (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id),
 id uuid NOT NULL,
 actor_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 outcome text NOT NULL DEFAULT 'pending' CHECK(outcome IN ('pending','accepted','failed','unknown')),
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES vant.members(tenant_id,id)
);
CREATE INDEX smtp_diagnostics_recent ON vant.smtp_diagnostics(tenant_id,created_at DESC,id DESC);
ALTER TABLE vant.smtp_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.smtp_diagnostics FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.smtp_diagnostics
 USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT ON vant.smtp_diagnostics TO vant_app;
GRANT UPDATE(outcome) ON vant.smtp_diagnostics TO vant_app;
