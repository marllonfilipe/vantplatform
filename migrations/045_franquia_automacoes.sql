ALTER TABLE vant.plan_assignments ADD COLUMN active_flow_limit integer CHECK(active_flow_limit >= 0);
CREATE INDEX active_flows_by_tenant ON vant.automation_flows(tenant_id) WHERE enabled;

CREATE FUNCTION vant.check_active_flow_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 maximum integer;
 used bigint;
BEGIN
 IF NOT NEW.enabled THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.enabled AND NEW.tenant_id=OLD.tenant_id THEN RETURN NEW; END IF;
 END IF;
 PERFORM vant.lock_plan_assignment(NEW.tenant_id);
 SELECT active_flow_limit INTO maximum FROM vant.plan_assignments
 WHERE tenant_id=NEW.tenant_id ORDER BY revision DESC LIMIT 1;
 IF maximum IS NULL THEN RETURN NEW; END IF;
 SELECT count(*) INTO used FROM vant.automation_flows WHERE tenant_id=NEW.tenant_id AND enabled;
 IF used >= maximum THEN
  RAISE EXCEPTION USING ERRCODE='V4001', MESSAGE='Franquia de automações ativas atingida.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER active_flow_plan_limit BEFORE INSERT OR UPDATE OF enabled,tenant_id ON vant.automation_flows
 FOR EACH ROW EXECUTE FUNCTION vant.check_active_flow_capacity();
