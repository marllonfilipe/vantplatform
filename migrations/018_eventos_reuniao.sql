ALTER TABLE vant.automation_versions DROP CONSTRAINT automation_versions_trigger_event_check;
ALTER TABLE vant.automation_versions ADD CONSTRAINT automation_versions_trigger_event_check
 CHECK(trigger_event IN ('lead_created','lead_updated','deal_created','deal_moved','deal_lost','meeting_scheduled','meeting_completed'));

CREATE FUNCTION vant.capture_meeting_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 event_name text;
 occurrence uuid:=gen_random_uuid();
 origin text;
BEGIN
 IF NEW.kind<>'meeting' THEN RETURN NEW; END IF;
 IF NEW.done_at IS NOT NULL THEN
  IF TG_OP='UPDATE' AND OLD.kind='meeting' AND OLD.done_at IS NOT NULL THEN RETURN NEW; END IF;
  event_name:='meeting_completed';
 ELSIF NEW.due_at IS NOT NULL THEN
  IF TG_OP='UPDATE' AND OLD.kind='meeting' AND OLD.due_at IS NOT NULL THEN RETURN NEW; END IF;
  event_name:='meeting_scheduled';
 ELSE RETURN NEW;
 END IF;
 SELECT coalesce(
  (SELECT source FROM vant.deals WHERE tenant_id=NEW.tenant_id AND id=NEW.deal_id),
  (SELECT source FROM vant.leads WHERE tenant_id=NEW.tenant_id AND id=NEW.lead_id)
 ) INTO origin;
 INSERT INTO vant.jobs(tenant_id,kind,dedup_key,payload,available_at)
 SELECT NEW.tenant_id,'flow.'||event_name,f.id::text||':'||occurrence::text,
   jsonb_build_object('event',event_name,'occurrence',occurrence,'flow',f.id,'version',f.version,
    'meeting',NEW.id,'lead',NEW.lead_id,'deal',NEW.deal_id,'source',origin,'due_at',NEW.due_at,'done_at',NEW.done_at),
   now()+make_interval(mins=>v.wait_minutes)
 FROM vant.automation_flows f JOIN vant.automation_versions v ON (v.tenant_id,v.flow_id,v.version)=(f.tenant_id,f.id,f.version)
 WHERE f.tenant_id=NEW.tenant_id AND f.enabled AND v.trigger_event=event_name
 ON CONFLICT(tenant_id,kind,dedup_key) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER automation_meetings AFTER INSERT OR UPDATE ON vant.activities FOR EACH ROW
 WHEN (NEW.kind='meeting') EXECUTE FUNCTION vant.capture_meeting_event();
