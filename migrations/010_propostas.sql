CREATE TABLE vant.agent_proposals (
 tenant_id uuid NOT NULL, run_id uuid NOT NULL, proposed_by uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','cancelled')),
 decided_by uuid, activity_id uuid, created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 PRIMARY KEY(tenant_id,run_id),
 FOREIGN KEY(tenant_id,run_id) REFERENCES vant.core_runs(tenant_id,id),
 FOREIGN KEY(tenant_id,proposed_by) REFERENCES vant.members(tenant_id,id),
 FOREIGN KEY(tenant_id,decided_by) REFERENCES vant.members(tenant_id,id),
 FOREIGN KEY(tenant_id,activity_id) REFERENCES vant.activities(tenant_id,id),
 UNIQUE(tenant_id,activity_id),
 CHECK((status='pending' AND decided_by IS NULL AND decided_at IS NULL AND activity_id IS NULL)
   OR (status='cancelled' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND activity_id IS NULL)
   OR (status='approved' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND activity_id IS NOT NULL))
);
ALTER TABLE vant.agent_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.agent_proposals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.agent_proposals USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT,UPDATE ON vant.agent_proposals TO vant_app;
