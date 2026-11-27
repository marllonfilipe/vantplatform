CREATE TABLE vant.subscription_requests (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id),
 id uuid NOT NULL,
 plan_code text NOT NULL REFERENCES vant.billing_plans(code),
 monthly_cents bigint CHECK(monthly_cents>0),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 cancelled_by uuid,
 cancelled_at timestamptz,
 PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES vant.members(tenant_id,id),
 FOREIGN KEY(tenant_id,cancelled_by) REFERENCES vant.members(tenant_id,id),
 CHECK((cancelled_by IS NULL)=(cancelled_at IS NULL))
);
CREATE UNIQUE INDEX subscription_request_open ON vant.subscription_requests(tenant_id) WHERE cancelled_at IS NULL;
CREATE INDEX subscription_request_latest ON vant.subscription_requests(tenant_id,created_at DESC,id DESC);
ALTER TABLE vant.subscription_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.subscription_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.subscription_requests
 USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT ON vant.subscription_requests TO vant_app;
GRANT UPDATE(cancelled_at,cancelled_by) ON vant.subscription_requests TO vant_app;
