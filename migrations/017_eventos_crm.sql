ALTER TABLE vant.automation_versions ADD COLUMN trigger_event text NOT NULL DEFAULT 'lead_created'
 CHECK(trigger_event IN ('lead_created','lead_updated','deal_created','deal_moved','deal_lost'));

DROP TRIGGER automation_lead_created ON vant.leads;
DROP FUNCTION vant.enqueue_created_lead();

CREATE FUNCTION vant.capture_crm_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 events text[] := '{}';
 event_name text;
 occurrence uuid;
 subject jsonb;
BEGIN
 IF TG_TABLE_NAME='leads' THEN
  IF TG_OP='INSERT' THEN events:=ARRAY['lead_created'];
  ELSIF NEW IS DISTINCT FROM OLD THEN events:=ARRAY['lead_updated'];
  END IF;
  subject:=jsonb_build_object('lead',NEW.id,'source',NEW.source);
 ELSE
  subject:=jsonb_build_object('deal',NEW.id,'source',NEW.source,'stage',NEW.stage_id,'status',NEW.status);
  IF TG_OP='INSERT' THEN events:=ARRAY['deal_created'];
  ELSE
   IF NEW.stage_id IS DISTINCT FROM OLD.stage_id OR NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id THEN
    events:=array_append(events,'deal_moved');
   END IF;
   IF NEW.status='lost' AND OLD.status IS DISTINCT FROM NEW.status THEN events:=array_append(events,'deal_lost'); END IF;
   subject:=subject||jsonb_build_object('previous_stage',OLD.stage_id,'previous_status',OLD.status);
  END IF;
 END IF;
 FOREACH event_name IN ARRAY events LOOP
  occurrence:=gen_random_uuid();
  INSERT INTO vant.jobs(tenant_id,kind,dedup_key,payload,available_at)
  SELECT NEW.tenant_id,'flow.'||event_name,f.id::text||':'||occurrence::text,
   subject||jsonb_build_object('event',event_name,'occurrence',occurrence,'flow',f.id,'version',f.version),
   now()+make_interval(mins=>v.wait_minutes)
  FROM vant.automation_flows f JOIN vant.automation_versions v ON (v.tenant_id,v.flow_id,v.version)=(f.tenant_id,f.id,f.version)
  WHERE f.tenant_id=NEW.tenant_id AND f.enabled AND v.trigger_event=event_name
  ON CONFLICT(tenant_id,kind,dedup_key) DO NOTHING;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER automation_leads AFTER INSERT OR UPDATE ON vant.leads FOR EACH ROW EXECUTE FUNCTION vant.capture_crm_event();
CREATE TRIGGER automation_deals AFTER INSERT OR UPDATE ON vant.deals FOR EACH ROW EXECUTE FUNCTION vant.capture_crm_event();
