CREATE FUNCTION vant.prospect_identifier(value text) RETURNS text
 LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT nullif(regexp_replace(upper(value),'[[:space:]./-]','','g'),'') $$;
CREATE INDEX prospect_account_identifier ON vant.accounts(tenant_id,vant.prospect_identifier(cnpj)) WHERE cnpj IS NOT NULL;

CREATE FUNCTION vant.guard_account_identifier() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE code text:=vant.prospect_identifier(NEW.cnpj);
BEGIN
 IF code IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND code IS NOT DISTINCT FROM vant.prospect_identifier(OLD.cnpj) THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':'||code,0));
 IF EXISTS(SELECT FROM vant.accounts WHERE tenant_id=NEW.tenant_id AND cnpj IS NOT NULL
  AND vant.prospect_identifier(cnpj)=code AND id<>NEW.id) THEN
  RAISE unique_violation USING MESSAGE='Identificador de empresa já cadastrado.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prospect_account_identity BEFORE INSERT OR UPDATE OF cnpj ON vant.accounts
 FOR EACH ROW EXECUTE FUNCTION vant.guard_account_identifier();

CREATE TABLE vant.prospect_account_sources (
 tenant_id uuid NOT NULL,account_id uuid NOT NULL,source_reference text NOT NULL,
 recorded_by uuid NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,account_id,source_reference),
 FOREIGN KEY(tenant_id,account_id) REFERENCES vant.accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,recorded_by) REFERENCES vant.members(tenant_id,id)
);
INSERT INTO vant.prospect_account_sources
 SELECT DISTINCT ON (tenant_id,account_id,source_reference) tenant_id,account_id,source_reference,selected_by,selected_at
 FROM vant.prospect_targets ORDER BY tenant_id,account_id,source_reference,selected_at,profile_id;
ALTER TABLE vant.prospect_account_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.prospect_account_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.prospect_account_sources USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT ON vant.prospect_account_sources TO vant_app;

CREATE FUNCTION vant.record_target_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO vant.prospect_account_sources(tenant_id,account_id,source_reference,recorded_by,recorded_at)
 VALUES(NEW.tenant_id,NEW.account_id,NEW.source_reference,NEW.selected_by,NEW.selected_at) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER prospect_target_source AFTER INSERT ON vant.prospect_targets
 FOR EACH ROW EXECUTE FUNCTION vant.record_target_source();
