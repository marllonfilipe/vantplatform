CREATE TABLE vant.agent_controls (
 tenant_id uuid PRIMARY KEY REFERENCES vant.tenants(id), revision integer NOT NULL DEFAULT 0,
 paused boolean NOT NULL DEFAULT false, tasks_enabled boolean NOT NULL DEFAULT true, sdr_enabled boolean NOT NULL DEFAULT true,
 daily_limit integer NOT NULL DEFAULT 100 CHECK(daily_limit BETWEEN 1 AND 10000),
 usage_day date, used integer NOT NULL DEFAULT 0 CHECK(used>=0)
);
CREATE TABLE vant.agent_control_history (
 tenant_id uuid NOT NULL, revision integer NOT NULL, actor_id uuid NOT NULL, settings jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,revision), FOREIGN KEY(tenant_id) REFERENCES vant.tenants(id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES vant.members(tenant_id,id)
);
ALTER TABLE vant.agent_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.agent_controls FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.agent_controls USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
ALTER TABLE vant.agent_control_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.agent_control_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.agent_control_history USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT,UPDATE ON vant.agent_controls TO vant_app;
GRANT SELECT,INSERT ON vant.agent_control_history TO vant_app;
