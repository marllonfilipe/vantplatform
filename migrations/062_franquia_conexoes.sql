ALTER TABLE vant.plan_assignments ADD COLUMN whatsapp_connection_limit integer CHECK(whatsapp_connection_limit>=0);
CREATE INDEX wa_instance_capacity ON vant.wa_instances(tenant_id) WHERE disabled_at IS NULL;

CREATE FUNCTION vant.check_wa_instance_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 maximum integer;
 used bigint;
BEGIN
 IF NEW.disabled_at IS NOT NULL THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.disabled_at IS NULL AND OLD.tenant_id=NEW.tenant_id THEN RETURN NEW; END IF;
 END IF;
 PERFORM vant.lock_plan_assignment(NEW.tenant_id);
 SELECT coalesce(a.whatsapp_connection_limit,p.whatsapp_connection_limit) INTO maximum
 FROM vant.plan_assignments a JOIN vant.billing_plans p ON p.code=a.plan_code
 WHERE a.tenant_id=NEW.tenant_id ORDER BY a.revision DESC LIMIT 1;
 IF maximum IS NULL THEN RETURN NEW; END IF;
 SELECT count(*) INTO used FROM vant.wa_instances WHERE tenant_id=NEW.tenant_id AND disabled_at IS NULL;
 IF used>=maximum THEN
  RAISE EXCEPTION USING ERRCODE='V4001',MESSAGE='Franquia de conexões WhatsApp atingida.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER wa_instance_plan_limit BEFORE INSERT OR UPDATE OF disabled_at,tenant_id ON vant.wa_instances
 FOR EACH ROW EXECUTE FUNCTION vant.check_wa_instance_capacity();
