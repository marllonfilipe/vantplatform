ALTER TABLE vant.automation_versions ADD COLUMN conditions jsonb NOT NULL DEFAULT '{}'::jsonb
 CHECK(jsonb_typeof(conditions)='object');

CREATE FUNCTION vant.snapshot_flow_conditions() RETURNS trigger LANGUAGE plpgsql AS $$
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
 IF wanted ? 'min_score' AND lead.id IS NOT NULL THEN
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
CREATE TRIGGER automation_conditions BEFORE INSERT ON vant.jobs FOR EACH ROW
 WHEN(NEW.kind IN ('flow.lead_created','flow.lead_updated','flow.deal_created','flow.deal_moved','flow.deal_lost','flow.meeting_scheduled','flow.meeting_completed'))
 EXECUTE FUNCTION vant.snapshot_flow_conditions();
