ALTER TABLE vant.accounts ADD COLUMN updated_at timestamptz;
UPDATE vant.accounts a SET updated_at=coalesce((SELECT max(h.created_at) FROM vant.crm_history h
 WHERE h.tenant_id=a.tenant_id AND h.kind='accounts' AND h.record_id=a.id AND h.action IN ('created','updated')),a.created_at);
ALTER TABLE vant.accounts ALTER COLUMN updated_at SET DEFAULT now(),ALTER COLUMN updated_at SET NOT NULL;
CREATE FUNCTION vant.account_update_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN NEW.updated_at:=clock_timestamp();
 ELSE NEW.updated_at:=OLD.updated_at;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prospect_account_modified BEFORE UPDATE ON vant.accounts FOR EACH ROW EXECUTE FUNCTION vant.account_update_time();

CREATE TABLE vant.prospect_enrichments (
 tenant_id uuid NOT NULL,account_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),fingerprint text NOT NULL,
 field text NOT NULL CHECK(field IN ('segment','location','size_band','business_activity','website')),
 proposed_value text NOT NULL,source_reference text NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','applied','already_present','obsolete','dismissed')),
 decided_by uuid,decided_at timestamptz,PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,account_id,fingerprint),
 FOREIGN KEY(tenant_id,account_id) REFERENCES vant.accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES vant.members(tenant_id,id),
 FOREIGN KEY(tenant_id,decided_by) REFERENCES vant.members(tenant_id,id)
);
CREATE INDEX prospect_enrichments_account ON vant.prospect_enrichments(tenant_id,account_id,id);
ALTER TABLE vant.prospect_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.prospect_enrichments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.prospect_enrichments USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT,UPDATE(state,decided_by,decided_at) ON vant.prospect_enrichments TO vant_app;
