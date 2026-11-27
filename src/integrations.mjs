import {mayManageTeams} from './security.mjs';
import {ApiError,reject} from './http.mjs';
import {audit,withTenant} from './db.mjs';
import {tenantSheet,readSheet} from './google-sheets.mjs';

import {tenantCalendar,readCalendar} from './google-calendar.mjs';

const googleReaders = new Map([
  ['/api/v1/integrations/google-sheets/read',{name:'sheets',configure:tenantSheet,read:async config=>({range:config.range,values:await readSheet(config)})}],
  ['/api/v1/integrations/google-calendar/read',{name:'calendar',configure:tenantCalendar,read:readCalendar}]
]);

async function googleSettings(tenant,configure) {
  try {
    const config = await configure(tenant);
    return {status:config?'configured':'unconfigured',config};
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return {status:'invalid',config:null};
  }
}

async function googleRead({db,pool,tenant,member,requestId,method,body,url},reader) {
  if (method !== 'POST') reject(405,'method','Use POST para consultar este recurso.');
  if (Object.keys(body).length || url.search) reject(400,'parameters','O recurso é definido pela configuração da empresa.');
  const {config,status} = await googleSettings(tenant,reader.configure);
  if (!config) reject(409,'configuration',status==='invalid'?'Revise a configuração privada.':'Configure a integração da empresa.');
  await audit(db,tenant,member.id,reader.name+'.read.started',null,requestId);
  // The HTTP handler releases the application transaction before the network call.
  return async () => {
    let result, failure;
    try { result = await reader.read(config); } catch (error) { failure = error; }
    const outcome = failure ? failure.code : 'success';
    await withTenant(pool,tenant,c=>audit(c,tenant,member.id,reader.name+'.read.'+outcome,null,requestId));
    if (failure) throw failure;
    return [200,result];
  };
}

export async function integrationRoutes(ctx){
  const {db,tenant,member,url,method}=ctx;
  const reader=googleReaders.get(url.pathname);
  if(url.pathname!=='/api/v1/integrations' && !reader)return;
  if(!mayManageTeams(member.role))reject(403,'permission','A central de integrações exige perfil de gestão.');
  if(reader)return googleRead(ctx,reader);
  if(method!=='GET')reject(405,'method','A consulta da central aceita GET.');
  const csv=await db.query(`SELECT created_at,
    CASE action WHEN 'crm.leads.import' THEN 'crm' ELSE 'prospecting' END AS source
    FROM vant.audit WHERE tenant_id=$1 AND action IN ('crm.leads.import','prospecting.import')
    ORDER BY created_at DESC,id DESC LIMIT 10`,[tenant]);
  const failure=await db.query(`SELECT created_at,split_part(action,'.',3) AS source,
    split_part(action,'.',4) AS category FROM vant.audit
    WHERE tenant_id=$1 AND action LIKE 'csv.failure.%'
    ORDER BY created_at DESC,id DESC LIMIT 1`,[tenant]);
  const attempts=await db.query(`SELECT created_at,outcome,reason,(webhook->>'status')::integer AS http_status
    FROM vant.automation_attempts WHERE tenant_id=$1 AND action_kind='webhook'
    ORDER BY created_at DESC,job_id DESC,attempt DESC LIMIT 10`,[tenant]);
  const last=await db.query(`SELECT max(created_at) AS delivered_at FROM vant.automation_attempts
    WHERE tenant_id=$1 AND action_kind='webhook' AND outcome='delivered'`,[tenant]);
  const sheets=await googleSettings(tenant,tenantSheet);
  const events=await db.query(`SELECT created_at,split_part(action,'.',3) AS outcome FROM vant.audit
    WHERE tenant_id=$1 AND action LIKE 'sheets.read.%' ORDER BY created_at DESC,id DESC LIMIT 10`,[tenant]);
  const sync=await db.query("SELECT max(created_at) AS at FROM vant.audit WHERE tenant_id=$1 AND action='sheets.read.success'",[tenant]);
  const calendar=await googleSettings(tenant,tenantCalendar);
  const calendarEvents=await db.query(`SELECT created_at,split_part(action,'.',3) AS outcome FROM vant.audit
    WHERE tenant_id=$1 AND action LIKE 'calendar.read.%' ORDER BY created_at DESC,id DESC LIMIT 10`,[tenant]);
  const lastCalendar=await db.query("SELECT max(created_at) AS at FROM vant.audit WHERE tenant_id=$1 AND action='calendar.read.success'",[tenant]);
  return [200,{google_calendar:{status:calendar.status,last_read:lastCalendar.rows[0].at,events:calendarEvents.rows},google_sheets:{status:sheets.status,range:sheets.config?.range??null,last_read:sync.rows[0].at,events:events.rows},csv:{imports:csv.rows,last_failure:failure.rows[0]??null},webhook:{last_delivery:last.rows[0].delivered_at,attempts:attempts.rows}}];
}
