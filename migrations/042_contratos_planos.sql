-- O último registro é o vínculo comercial vigente. A cobrança tem ciclo próprio.
CREATE TABLE vant.plan_assignments (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id),
 revision integer NOT NULL CHECK (revision > 0),
 plan_code text NOT NULL REFERENCES vant.billing_plans(code),
 user_limit integer NOT NULL CHECK (user_limit > 0),
 active_lead_limit integer NOT NULL CHECK (active_lead_limit >= 0),
 pipeline_limit integer NOT NULL CHECK (pipeline_limit >= 0),
 assigned_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, revision)
);
ALTER TABLE vant.plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.plan_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.plan_assignments
 USING (tenant_id=vant.current_tenant()) WITH CHECK (tenant_id=vant.current_tenant());
GRANT SELECT ON vant.plan_assignments TO vant_app;

CREATE FUNCTION vant.lock_plan_assignment(company uuid) RETURNS void LANGUAGE sql VOLATILE AS $$
 SELECT pg_advisory_xact_lock(hashtextextended(company::text, 42011))
$$;

CREATE FUNCTION vant.check_plan_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 assigned vant.plan_assignments%ROWTYPE;
 maximum integer;
 used bigint;
BEGIN
 IF TG_TABLE_NAME='members' THEN
  IF NOT NEW.active THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
   IF OLD.active AND NEW.tenant_id=OLD.tenant_id THEN RETURN NEW; END IF;
  END IF;
 END IF;
 PERFORM vant.lock_plan_assignment(NEW.tenant_id);
 SELECT * INTO assigned FROM vant.plan_assignments
 WHERE tenant_id=NEW.tenant_id ORDER BY revision DESC LIMIT 1;
 IF NOT FOUND THEN RETURN NEW; END IF;
 CASE TG_TABLE_NAME
  WHEN 'members' THEN
   maximum := assigned.user_limit;
   SELECT count(*) INTO used FROM vant.members WHERE tenant_id=NEW.tenant_id AND active;
  WHEN 'leads' THEN
   maximum := assigned.active_lead_limit;
   SELECT count(*) INTO used FROM vant.leads WHERE tenant_id=NEW.tenant_id;
  WHEN 'pipelines' THEN
   maximum := assigned.pipeline_limit;
   SELECT count(*) INTO used FROM vant.pipelines WHERE tenant_id=NEW.tenant_id;
 END CASE;
 IF used >= maximum THEN
  RAISE EXCEPTION USING ERRCODE='V4001', MESSAGE='Limite contratado atingido.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER member_plan_limit BEFORE INSERT OR UPDATE OF active,tenant_id ON vant.members
 FOR EACH ROW EXECUTE FUNCTION vant.check_plan_capacity();
CREATE TRIGGER lead_plan_limit BEFORE INSERT ON vant.leads
 FOR EACH ROW EXECUTE FUNCTION vant.check_plan_capacity();
CREATE TRIGGER pipeline_plan_limit BEFORE INSERT ON vant.pipelines
 FOR EACH ROW EXECUTE FUNCTION vant.check_plan_capacity();
