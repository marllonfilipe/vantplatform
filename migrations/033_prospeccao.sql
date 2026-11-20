ALTER TABLE vant.accounts ADD COLUMN business_activity text;

CREATE TABLE vant.prospect_profiles (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 name text NOT NULL,segment text,region text,size_band text,business_activity text,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 PRIMARY KEY(tenant_id,id),
 CHECK(num_nonnulls(segment,region,size_band,business_activity)>0)
);
CREATE TABLE vant.prospect_targets (
 tenant_id uuid NOT NULL,profile_id uuid NOT NULL,account_id uuid NOT NULL,
 source_reference text NOT NULL CHECK(length(trim(source_reference)) BETWEEN 1 AND 500),
 selected_by uuid NOT NULL,selected_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,profile_id,account_id),
 FOREIGN KEY(tenant_id,profile_id) REFERENCES vant.prospect_profiles(tenant_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES vant.accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,selected_by) REFERENCES vant.members(tenant_id,id)
);
ALTER TABLE vant.prospect_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.prospect_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.prospect_profiles USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
ALTER TABLE vant.prospect_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.prospect_targets FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.prospect_targets USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT,UPDATE ON vant.prospect_profiles TO vant_app;
GRANT SELECT,INSERT,DELETE ON vant.prospect_targets TO vant_app;
