CREATE TABLE vant.prospect_briefs (
 tenant_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),profile_id uuid NOT NULL,account_id uuid NOT NULL,
 fit_id uuid NOT NULL,input_hash text NOT NULL,model_version text,result jsonb NOT NULL,actor_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,profile_id,account_id,input_hash),
 FOREIGN KEY(tenant_id,fit_id) REFERENCES vant.prospect_fits(tenant_id,id),
 FOREIGN KEY(tenant_id,profile_id) REFERENCES vant.prospect_profiles(tenant_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES vant.accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES vant.members(tenant_id,id)
);
CREATE INDEX prospect_brief_history ON vant.prospect_briefs(tenant_id,profile_id,account_id,created_at DESC,id DESC);
ALTER TABLE vant.prospect_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.prospect_briefs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.prospect_briefs USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT ON vant.prospect_briefs TO vant_app;
