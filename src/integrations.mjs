import {mayManageTeams} from './security.mjs';
import {reject} from './http.mjs';

export async function integrationRoutes({db,tenant,member,url,method}){
  if(url.pathname!=='/api/v1/integrations')return;
  if(!mayManageTeams(member.role))reject(403,'permission','A central de integrações exige perfil de gestão.');
  if(method!=='GET')reject(405,'method','A consulta da central aceita GET.');
  const csv=await db.query(`SELECT created_at,
    CASE action WHEN 'crm.leads.import' THEN 'crm' ELSE 'prospecting' END AS source
    FROM vant.audit WHERE tenant_id=$1 AND action IN ('crm.leads.import','prospecting.import')
    ORDER BY created_at DESC,id DESC LIMIT 10`,[tenant]);
  const attempts=await db.query(`SELECT created_at,outcome,reason,(webhook->>'status')::integer AS http_status
    FROM vant.automation_attempts WHERE tenant_id=$1 AND action_kind='webhook'
    ORDER BY created_at DESC,job_id DESC,attempt DESC LIMIT 10`,[tenant]);
  const last=await db.query(`SELECT max(created_at) AS delivered_at FROM vant.automation_attempts
    WHERE tenant_id=$1 AND action_kind='webhook' AND outcome='delivered'`,[tenant]);
  return [200,{csv:{imports:csv.rows},webhook:{last_delivery:last.rows[0].delivered_at,attempts:attempts.rows}}];
}
