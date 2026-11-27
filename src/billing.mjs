import {mayManageTeams} from './security.mjs';
import {reject} from './http.mjs';

export async function billingRoutes({db,tenant,member,url,method}){
 if(!['/api/v1/billing/plans','/api/v1/billing/usage'].includes(url.pathname))return;
 if(!mayManageTeams(member.role))reject(403,'permission','A consulta de planos exige gestão.');
 if(method!=='GET')reject(405,'method','A consulta de planos aceita GET.');
 if(url.pathname==='/api/v1/billing/usage'){
  const {rows}=await db.query(`SELECT
   (SELECT (to_jsonb(a) - 'tenant_id') || jsonb_build_object('storage_limit_bytes', a.storage_limit_bytes::text) FROM vant.plan_assignments a WHERE tenant_id=$1 ORDER BY revision DESC LIMIT 1) AS assignment,
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
