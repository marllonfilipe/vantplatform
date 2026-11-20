CREATE OR REPLACE FUNCTION vant.snapshot_flow_conditions() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 wanted jsonb;
 facts jsonb;
 deal vant.deals%ROWTYPE;
 lead vant.leads%ROWTYPE;
 meeting_owner uuid;
 score_value integer;
 last_interaction text;
BEGIN
 SELECT v.conditions INTO wanted FROM vant.automation_versions v
 WHERE v.tenant_id=NEW.tenant_id AND v.flow_id=(NEW.payload->>'flow')::uuid AND v.version=(NEW.payload->>'version')::int;
 IF wanted IS NULL OR wanted='{}'::jsonb THEN RETURN NEW; END IF;
 IF NEW.payload->>'deal' IS NOT NULL THEN
  SELECT * INTO deal FROM vant.deals WHERE tenant_id=NEW.tenant_id AND id=(NEW.payload->>'deal')::uuid;
 END IF;
 SELECT * INTO lead FROM vant.leads WHERE tenant_id=NEW.tenant_id AND id=coalesce((NEW.payload->>'lead')::uuid,deal.lead_id);
 IF coalesce(NEW.payload->>'meeting',NEW.payload->>'source_activity') IS NOT NULL THEN
  SELECT owner_id INTO meeting_owner FROM vant.activities WHERE tenant_id=NEW.tenant_id AND id=coalesce(NEW.payload->>'meeting',NEW.payload->>'source_activity')::uuid;
 END IF;
 IF NEW.kind IN ('flow.score_changed','flow.lead_qualified') THEN
  score_value:=(NEW.payload->>'score')::integer;
 ELSIF wanted ? 'min_score' AND lead.id IS NOT NULL THEN
  SELECT (result->>'score')::integer INTO score_value FROM vant.core_runs WHERE tenant_id=NEW.tenant_id AND subject_kind='lead' AND subject_id=lead.id
  ORDER BY created_at DESC,id DESC LIMIT 1;
 END IF;
 IF wanted ? 'last_interaction_30d' AND (deal.id IS NOT NULL OR lead.id IS NOT NULL) THEN
  SELECT a.kind INTO last_interaction FROM vant.activities a
  WHERE a.tenant_id=NEW.tenant_id AND a.kind IN ('call','meeting','followup')
    AND a.done_at BETWEEN statement_timestamp()-interval '30 days' AND statement_timestamp()
    AND ((deal.id IS NOT NULL AND a.deal_id=deal.id) OR (deal.id IS NULL AND a.lead_id=lead.id))
  ORDER BY a.done_at DESC,a.id DESC LIMIT 1;
  last_interaction:=coalesce(last_interaction,'none');
 END IF;
 facts:=jsonb_build_object('last_interaction_30d',last_interaction,'segment',lead.segment,'tag',lead.tags,'intent',lead.purchase_intent,
  'min_score',coalesce(score_value,lead.score),'min_cents',deal.amount_cents,'stage_id',deal.stage_id,
  'owner_id',coalesce(meeting_owner,deal.owner_id,lead.owner_id),
  'min_quiet_days',CASE WHEN NEW.kind='flow.lead_inactive' THEN floor(extract(epoch FROM now()-(NEW.payload->>'reference_at')::timestamptz)/86400)::integer
   WHEN lead.id IS NOT NULL THEN floor(extract(epoch FROM now()-greatest(lead.created_at,
    CASE WHEN lead.last_contact_at<=now() THEN lead.last_contact_at END))/86400)::integer END);
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO facts FROM jsonb_each(facts) WHERE wanted ? key;
 NEW.payload:=NEW.payload||jsonb_build_object('facts',facts);
 RETURN NEW;
END $$;
