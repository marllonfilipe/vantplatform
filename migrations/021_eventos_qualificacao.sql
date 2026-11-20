ALTER TABLE vant.automation_versions DROP CONSTRAINT automation_versions_trigger_event_check;
ALTER TABLE vant.automation_versions ADD CONSTRAINT automation_versions_trigger_event_check
 CHECK(trigger_event IN ('lead_created','lead_updated','deal_created','deal_moved','deal_lost','meeting_scheduled','meeting_completed','score_changed','lead_qualified'));

CREATE TABLE vant.lead_score_state (
 tenant_id uuid NOT NULL,lead_id uuid NOT NULL,run_id uuid NOT NULL,
 score smallint NOT NULL CHECK(score BETWEEN 0 AND 100),qualified boolean NOT NULL,
 previous_score smallint,previous_qualified boolean,
 PRIMARY KEY(tenant_id,lead_id),
 FOREIGN KEY(tenant_id,lead_id) REFERENCES vant.leads(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,run_id) REFERENCES vant.core_runs(tenant_id,id)
);
INSERT INTO vant.lead_score_state(tenant_id,lead_id,run_id,score,qualified)
 SELECT DISTINCT ON(r.tenant_id,r.subject_id) r.tenant_id,r.subject_id,r.id,(r.result->>'score')::smallint,
  coalesce(r.result->>'classification'='Prioridade alta',false)
 FROM vant.core_runs r JOIN vant.leads l ON (l.tenant_id,l.id)=(r.tenant_id,r.subject_id)
 WHERE r.subject_kind='lead' AND r.result->>'score' ~ '^(100|[0-9]{1,2})$'
 ORDER BY r.tenant_id,r.subject_id,r.created_at DESC,r.id DESC;
ALTER TABLE vant.lead_score_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.lead_score_state FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.lead_score_state USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT,UPDATE ON vant.lead_score_state TO vant_app;

CREATE FUNCTION vant.capture_score_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 current_state vant.lead_score_state%ROWTYPE;
 origin text;
 events text[] := '{}';
 event_name text;
BEGIN
 SELECT source INTO origin FROM vant.leads WHERE tenant_id=NEW.tenant_id AND id=NEW.subject_id FOR KEY SHARE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 INSERT INTO vant.lead_score_state AS prior(tenant_id,lead_id,run_id,score,qualified)
 VALUES(NEW.tenant_id,NEW.subject_id,NEW.id,(NEW.result->>'score')::smallint,coalesce(NEW.result->>'classification'='Prioridade alta',false))
 ON CONFLICT(tenant_id,lead_id) DO UPDATE SET previous_score=prior.score,previous_qualified=prior.qualified,
  score=EXCLUDED.score,qualified=EXCLUDED.qualified,run_id=EXCLUDED.run_id
 RETURNING * INTO current_state;
 IF current_state.previous_score IS NOT NULL AND current_state.previous_score<>current_state.score THEN
  events:=array_append(events,'score_changed');
 END IF;
 IF current_state.qualified AND NOT coalesce(current_state.previous_qualified,false) THEN
  events:=array_append(events,'lead_qualified');
 END IF;
 FOREACH event_name IN ARRAY events LOOP
  INSERT INTO vant.jobs(tenant_id,kind,dedup_key,payload,available_at)
  SELECT NEW.tenant_id,'flow.'||event_name,f.id::text||':'||NEW.id::text,
   jsonb_build_object('event',event_name,'occurrence',NEW.id,'flow',f.id,'version',f.version,'lead',NEW.subject_id,'source',origin,
    'previous_score',current_state.previous_score,'score',current_state.score),
   now()+make_interval(mins=>v.wait_minutes)
  FROM vant.automation_flows f JOIN vant.automation_versions v ON (v.tenant_id,v.flow_id,v.version)=(f.tenant_id,f.id,f.version)
  WHERE f.tenant_id=NEW.tenant_id AND f.enabled AND v.trigger_event=event_name
  ON CONFLICT(tenant_id,kind,dedup_key) DO NOTHING;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER automation_after_lead_analysis AFTER INSERT ON vant.core_runs FOR EACH ROW
 WHEN(NEW.subject_kind='lead' AND NEW.result->>'score' ~ '^(100|[0-9]{1,2})$') EXECUTE FUNCTION vant.capture_score_event();

CREATE OR REPLACE FUNCTION vant.snapshot_flow_conditions() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 wanted jsonb;
 facts jsonb;
 deal vant.deals%ROWTYPE;
 lead vant.leads%ROWTYPE;
 meeting_owner uuid;
 score_value integer;
BEGIN
 SELECT v.conditions INTO wanted FROM vant.automation_versions v
 WHERE v.tenant_id=NEW.tenant_id AND v.flow_id=(NEW.payload->>'flow')::uuid AND v.version=(NEW.payload->>'version')::int;
 IF wanted IS NULL OR wanted='{}'::jsonb THEN RETURN NEW; END IF;
 IF NEW.payload->>'deal' IS NOT NULL THEN
  SELECT * INTO deal FROM vant.deals WHERE tenant_id=NEW.tenant_id AND id=(NEW.payload->>'deal')::uuid;
 END IF;
 SELECT * INTO lead FROM vant.leads WHERE tenant_id=NEW.tenant_id AND id=coalesce((NEW.payload->>'lead')::uuid,deal.lead_id);
 IF NEW.payload->>'meeting' IS NOT NULL THEN
  SELECT owner_id INTO meeting_owner FROM vant.activities WHERE tenant_id=NEW.tenant_id AND id=(NEW.payload->>'meeting')::uuid;
 END IF;
 IF NEW.kind IN ('flow.score_changed','flow.lead_qualified') THEN
  score_value:=(NEW.payload->>'score')::integer;
 ELSIF wanted ? 'min_score' AND lead.id IS NOT NULL THEN
  SELECT (result->>'score')::integer INTO score_value FROM vant.core_runs WHERE tenant_id=NEW.tenant_id AND subject_kind='lead' AND subject_id=lead.id
  ORDER BY created_at DESC,id DESC LIMIT 1;
 END IF;
 facts:=jsonb_build_object('segment',lead.segment,'tag',lead.tags,'intent',lead.purchase_intent,
  'min_score',coalesce(score_value,lead.score),'min_cents',deal.amount_cents,'stage_id',deal.stage_id,
  'owner_id',coalesce(meeting_owner,deal.owner_id,lead.owner_id),
  'min_quiet_days',CASE WHEN lead.id IS NOT NULL THEN floor(extract(epoch FROM now()-greatest(lead.created_at,
    CASE WHEN lead.last_contact_at<=now() THEN lead.last_contact_at END))/86400)::integer END);
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO facts FROM jsonb_each(facts) WHERE wanted ? key;
 NEW.payload:=NEW.payload||jsonb_build_object('facts',facts);
 RETURN NEW;
END $$;
CREATE TRIGGER automation_score_conditions BEFORE INSERT ON vant.jobs FOR EACH ROW
 WHEN(NEW.kind IN ('flow.score_changed','flow.lead_qualified')) EXECUTE FUNCTION vant.snapshot_flow_conditions();
