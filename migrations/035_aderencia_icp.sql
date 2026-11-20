CREATE TABLE vant.prospect_fits (
 tenant_id uuid NOT NULL,profile_id uuid NOT NULL,account_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),
 profile_revision integer NOT NULL,account_facts jsonb NOT NULL,input_hash text NOT NULL,engine_version text NOT NULL,
 model_version text,score smallint NOT NULL CHECK(score BETWEEN 0 AND 100),result jsonb NOT NULL,
 actor_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,profile_id,account_id,input_hash),
 FOREIGN KEY(tenant_id,profile_id) REFERENCES vant.prospect_profiles(tenant_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES vant.accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES vant.members(tenant_id,id)
);
CREATE INDEX prospect_fit_by_account ON vant.prospect_fits(tenant_id,profile_id,account_id,profile_revision,created_at DESC,id DESC);
ALTER TABLE vant.prospect_fits ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.prospect_fits FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.prospect_fits USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT ON vant.prospect_fits TO vant_app;
