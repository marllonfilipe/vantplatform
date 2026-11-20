// Capture CRM facts and the most recent completed analysis in a single database snapshot.
export async function summarizeRecords(db,tenant,target){
 const result=await db.query(`WITH subjects AS (
   SELECT 'lead' AS kind,l.id,l.name,l.owner_id,jsonb_build_object('segment',l.segment,'source',l.source) AS facts
   FROM vant.leads l WHERE l.tenant_id=$1 AND l.id=$2
   UNION ALL
   SELECT 'deal',d.id,d.name,d.owner_id,jsonb_build_object('stage',s.name,'probability',d.probability,'amount_cents',d.amount_cents)
   FROM vant.deals d JOIN vant.stages s ON (s.tenant_id,s.id)=(d.tenant_id,d.stage_id)
   WHERE d.tenant_id=$1 AND d.id=$3
  )
  SELECT subject.kind,subject.id,subject.name,m.name AS owner,subject.facts,
   next.title AS pending_title,next.due_at AS pending_due_at,analysis.snapshot AS analysis
  FROM subjects subject JOIN vant.members m ON m.tenant_id=$1 AND m.id=subject.owner_id
  LEFT JOIN LATERAL (
   SELECT a.title,a.due_at FROM vant.activities a WHERE a.tenant_id=$1 AND a.done_at IS NULL
    AND ((subject.kind='lead' AND a.lead_id=subject.id) OR (subject.kind='deal' AND a.deal_id=subject.id))
   ORDER BY a.due_at NULLS LAST,a.created_at,a.id LIMIT 1
  ) next ON true
  LEFT JOIN LATERAL (
   SELECT jsonb_build_object('id',r.id,'created_at',r.created_at,'model',r.model_version,
    'classification',r.result->>'classification','next_action',r.result->>'nextAction') AS snapshot
   FROM vant.core_runs r WHERE r.tenant_id=$1 AND r.subject_kind=subject.kind AND r.subject_id=subject.id
   ORDER BY r.created_at DESC,r.id DESC LIMIT 1
  ) analysis ON true ORDER BY subject.kind,subject.id`,[tenant,target.lead_id??null,target.deal_id??null]);
 return result.rows;
}
