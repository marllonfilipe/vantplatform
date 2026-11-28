import {mayManageTeams} from './security.mjs';
import {subscriptionRequests} from './subscription-requests.mjs';
import {pagination,reject} from './http.mjs';

export async function billingRoutes(ctx){
 const {db,tenant,member,url,method}=ctx;
 if(url.pathname.startsWith('/api/v1/billing/subscription-requests'))return subscriptionRequests(ctx);
 if(!['/api/v1/billing/plans','/api/v1/billing/usage','/api/v1/billing/plan-history'].includes(url.pathname))return;
 if(!mayManageTeams(member.role))reject(403,'permission','A consulta de planos exige gestão.');
 if(method!=='GET')reject(405,'method','A consulta de planos aceita GET.');
 if(url.pathname==='/api/v1/billing/plan-history'){
  const limit=pagination(url.searchParams);
  const before=url.searchParams.get('before');
  if(before!==null&&(!/^[1-9][0-9]{0,9}$/.test(before)||Number(before)>2147483647))
   reject(400,'revision','Revisão inválida.');
  const {rows}=await db.query(`SELECT a.revision,a.assigned_at,a.plan_code,p.name,
    a.user_limit,a.active_lead_limit,a.pipeline_limit,a.whatsapp_connection_limit,a.storage_limit_bytes::text,
    a.agent_actions_per_day,a.active_flow_limit,a.flow_starts_per_day,a.inference_texts_per_day,a.outbound_messages_per_day
    FROM vant.plan_assignments a JOIN vant.billing_plans p ON p.code=a.plan_code
    WHERE a.tenant_id=$1 AND ($2::integer IS NULL OR a.revision<$2)
    ORDER BY a.revision DESC LIMIT $3`,[tenant,before,limit+1]);
  return [200,{items:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1].revision:null}];
 }
 if(url.pathname==='/api/v1/billing/usage'){
  const {rows}=await db.query(`SELECT
   (SELECT (to_jsonb(a) - 'tenant_id') || jsonb_build_object('storage_limit_bytes', a.storage_limit_bytes::text,
      'whatsapp_connection_limit',coalesce(a.whatsapp_connection_limit,p.whatsapp_connection_limit))
    FROM vant.plan_assignments a JOIN vant.billing_plans p ON p.code=a.plan_code WHERE a.tenant_id=$1 ORDER BY a.revision DESC LIMIT 1) AS assignment,
   (SELECT jsonb_build_object(
      'completed',coalesce(sum(input_count) FILTER (WHERE state='completed'),0)::text,
      'reserved',coalesce(sum(input_count) FILTER (WHERE state='reserved'),0)::text,
      'failed',coalesce(sum(input_count) FILTER (WHERE state='failed'),0)::text)
    FROM vant.inference_batches WHERE tenant_id=$1
    AND usage_day=(statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date) AS inference_texts,
   (SELECT count(*)::text FROM vant.wa_outbox WHERE tenant_id=$1 AND
    admitted_on=(statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date) AS outbound_messages_today,
   (SELECT count(*)::integer FROM vant.wa_instances WHERE tenant_id=$1 AND disabled_at IS NULL) AS whatsapp_connections,
   (SELECT count(*)::integer FROM vant.members WHERE tenant_id=$1 AND active) AS users,
   (SELECT count(*)::integer FROM vant.leads WHERE tenant_id=$1) AS leads,
   (SELECT count(*)::integer FROM vant.pipelines WHERE tenant_id=$1) AS pipelines,
   (SELECT count(*)::text FROM vant.jobs WHERE tenant_id=$1
    AND flow_admitted_on=(statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date) AS flow_admissions,
   (SELECT count(*)::integer FROM vant.automation_flows WHERE tenant_id=$1 AND enabled) AS active_flows,
   (SELECT jsonb_build_object('started',r.started::text,'attempts',r.attempts::text,
      'retries',r.retries::text,'skipped',r.skipped::text)
    FROM vant.flow_execution_usage($1,(statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date) r) AS flow_executions,
   (SELECT to_jsonb(c) FROM vant.daily_agent_capacity($1) c) AS agent_actions,
   vant.stored_content_bytes($1)::text AS storage_bytes`,[tenant]);
  return [200,rows[0]];
 }
 const {rows}=await db.query(`SELECT code,name,monthly_cents,custom_terms,user_limit,active_lead_limit,pipeline_limit,
  whatsapp_connection_limit,features FROM vant.billing_plans ORDER BY display_order,code`);
 return [200,{currency:'BRL',interval:'month',items:rows}];
}
