import {withTenant} from './db.mjs';
import {contactReference} from './followup.mjs';

const overdue=`SELECT a.id,a.due_at AS reference_at,jsonb_build_object('source_activity',a.id,'lead',a.lead_id,'deal',a.deal_id,'source',coalesce(d.source,l.source)) AS subject
 FROM vant.activities a LEFT JOIN vant.leads l ON (l.tenant_id,l.id)=(a.tenant_id,a.lead_id)
 LEFT JOIN vant.deals d ON (d.tenant_id,d.id)=(a.tenant_id,a.deal_id)
 WHERE a.tenant_id=$1 AND a.kind='task' AND a.done_at IS NULL AND a.due_at<=now()
 AND NOT EXISTS(SELECT FROM vant.automation_attempts h WHERE h.tenant_id=a.tenant_id AND h.activity_id=a.id)`;
const inactive=`SELECT l.id,${contactReference} AS reference_at,jsonb_build_object('lead',l.id,'source',l.source) AS subject
 FROM vant.leads l WHERE l.tenant_id=$1 AND ${contactReference}<=now()-make_interval(days=>$6::integer)`;

export function enqueueTimers(pool,tenant){
 return withTenant(pool,tenant,async db=>{
  const {rows:flows}=await db.query(`SELECT f.id,f.version,v.trigger_event,v.wait_minutes,v.conditions
    FROM vant.automation_flows f JOIN vant.automation_versions v ON (v.tenant_id,v.flow_id,v.version)=(f.tenant_id,f.id,f.version)
    WHERE f.tenant_id=$1 AND f.enabled AND v.trigger_event IN ('task_overdue','lead_inactive') ORDER BY f.id FOR SHARE OF f`,[tenant]);
  for(const flow of flows){
   const args=[tenant,flow.id,flow.version,flow.trigger_event,flow.wait_minutes];
   if(flow.trigger_event==='lead_inactive')args.push(Math.max(1,flow.conditions.min_quiet_days??14));
   const subjects=flow.trigger_event==='task_overdue'?overdue:inactive;
   await db.query(`WITH subjects AS (${subjects}), candidates AS (
    SELECT *, $2::text||':'||id::text||':'||extract(epoch FROM reference_at)::text AS event_key FROM subjects
   ) INSERT INTO vant.jobs(tenant_id,kind,dedup_key,payload,available_at)
    SELECT $1,'flow.'||$4::text,c.event_key,c.subject||jsonb_build_object('event',$4::text,'flow',$2::text,'version',$3::integer,'reference_at',c.reference_at,'occurrence',c.event_key),
      now()+make_interval(mins=>$5::integer)
    FROM candidates c WHERE NOT EXISTS(SELECT FROM vant.jobs j WHERE j.tenant_id=$1 AND j.kind='flow.'||$4::text AND j.dedup_key=c.event_key)
    ORDER BY c.reference_at,c.id LIMIT 50 ON CONFLICT(tenant_id,kind,dedup_key) DO NOTHING`,args);
  }
 });
}

export async function timerTarget(db,tenant,payload){
 if(payload.event==='task_overdue'){
  return (await db.query(`SELECT owner_id,lead_id,deal_id FROM vant.activities WHERE tenant_id=$1 AND id=$2
    AND kind='task' AND done_at IS NULL AND due_at=$3 AND due_at<=now() FOR SHARE`,[tenant,payload.source_activity,payload.reference_at])).rows[0];
 }
 return (await db.query(`SELECT l.id AS lead_id,l.owner_id FROM vant.leads l WHERE l.tenant_id=$1 AND l.id=$2
   AND ${contactReference}=$3::timestamptz FOR SHARE OF l`,[tenant,payload.lead,payload.reference_at])).rows[0];
}
