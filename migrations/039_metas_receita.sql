CREATE TABLE vant.revenue_goals (
 tenant_id uuid NOT NULL, owner_id uuid NOT NULL, month_start date NOT NULL CHECK (extract(day FROM month_start)=1),
 amount_cents bigint NOT NULL CHECK (amount_cents BETWEEN 1 AND 999999999999),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 updated_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,month_start,owner_id),
 FOREIGN KEY (tenant_id,owner_id) REFERENCES vant.members(tenant_id,id),
 FOREIGN KEY (tenant_id,updated_by) REFERENCES vant.members(tenant_id,id)
);
ALTER TABLE vant.revenue_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.revenue_goals FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.revenue_goals USING (tenant_id=vant.current_tenant()) WITH CHECK (tenant_id=vant.current_tenant());
GRANT SELECT,INSERT,UPDATE ON vant.revenue_goals TO vant_app;
