ALTER TABLE vant.automation_versions ADD COLUMN cooldown_minutes integer NOT NULL DEFAULT 0
 CHECK(cooldown_minutes BETWEEN 0 AND 43200);

CREATE TABLE vant.automation_starts (
 tenant_id uuid NOT NULL,
 flow_id uuid NOT NULL,
 started_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,flow_id),
 FOREIGN KEY(tenant_id,flow_id) REFERENCES vant.automation_flows(tenant_id,id) ON DELETE CASCADE
);
ALTER TABLE vant.automation_starts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.automation_starts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.automation_starts
 USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT,UPDATE ON vant.automation_starts TO vant_app;
