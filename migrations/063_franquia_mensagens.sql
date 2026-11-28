ALTER TABLE vant.plan_assignments ADD COLUMN outbound_messages_per_day integer CHECK(outbound_messages_per_day>=0);
ALTER TABLE vant.wa_outbox ADD COLUMN admitted_on date;
CREATE INDEX wa_outbox_admissions ON vant.wa_outbox(tenant_id,admitted_on) WHERE admitted_on IS NOT NULL;

CREATE FUNCTION vant.admit_outbound_message() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 maximum integer;
 used bigint;
BEGIN
 IF OLD.state<>'queued' OR NEW.state<>'sending' OR OLD.admitted_on IS NOT NULL THEN RETURN NEW; END IF;
 PERFORM vant.lock_plan_assignment(NEW.tenant_id);
 NEW.admitted_on := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
 SELECT outbound_messages_per_day INTO maximum FROM vant.plan_assignments
 WHERE tenant_id=NEW.tenant_id ORDER BY revision DESC LIMIT 1;
 IF maximum IS NULL THEN RETURN NEW; END IF;
 SELECT count(*) INTO used FROM vant.wa_outbox WHERE tenant_id=NEW.tenant_id AND admitted_on=NEW.admitted_on;
 IF used>=maximum THEN
  RAISE EXCEPTION USING ERRCODE='V4001',MESSAGE='Franquia diária de mensagens de saída atingida.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER wa_outbound_admission BEFORE UPDATE OF state ON vant.wa_outbox
 FOR EACH ROW EXECUTE FUNCTION vant.admit_outbound_message();
