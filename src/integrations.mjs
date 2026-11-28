import {mayManageTeams} from './security.mjs';
import {ApiError,reject} from './http.mjs';
import {audit,withTenant} from './db.mjs';
import {tenantSheet,readSheet} from './google-sheets.mjs';

import {latestSmtpDiagnostic,smtpDiagnostic} from './smtp-diagnostic.mjs';
import {tenantSmtp,verifySmtp} from './smtp.mjs';
import {tenantKommo,readKommo} from './kommo.mjs';
import {tenantRdStation,readRdStation} from './rd-station.mjs';
import {tenantPipedrive,readPipedrive} from './pipedrive.mjs';
import {tenantHubspot,readHubspot} from './hubspot.mjs';
import {tenantCalendar,readCalendar} from './google-calendar.mjs';

const readers = new Map([
  ['/api/v1/integrations/smtp/verify',{name:'smtp',configure:tenantSmtp,read:verifySmtp}],
  ['/api/v1/integrations/kommo/read',{name:'kommo',configure:tenantKommo,read:readKommo}],
  ['/api/v1/integrations/rd-station/read',{name:'rdstation',configure:tenantRdStation,read:readRdStation}],
  ['/api/v1/integrations/pipedrive/read',{name:'pipedrive',configure:tenantPipedrive,read:readPipedrive}],
  ['/api/v1/integrations/hubspot/read',{name:'hubspot',configure:tenantHubspot,read:readHubspot}],
  ['/api/v1/integrations/google-sheets/read',{name:'sheets',configure:tenantSheet,read:async config=>({range:config.range,values:await readSheet(config)})}],
  ['/api/v1/integrations/google-calendar/read',{name:'calendar',configure:tenantCalendar,read:readCalendar}]
]);

async function readerSettings(tenant,configure) {
  try {
    const config = await configure(tenant);
    return {status:config?'configured':'unconfigured',config};
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return {status:'invalid',config:null};
  }
}

async function runReader({db,pool,tenant,member,requestId,method,body,url},reader) {
  if (method !== 'POST') reject(405,'method','Use POST para consultar este recurso.');
  if (Object.keys(body).length || url.search) reject(400,'parameters','O recurso é definido pela configuração da empresa.');
  const {config,status} = await readerSettings(tenant,reader.configure);
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

async function readerSummary(db,tenant,name,configure) {
  const {status,config}=await readerSettings(tenant,configure);
  const prefix=name+'.read.';
  const events=await db.query(`SELECT created_at,split_part(action,'.',3) AS outcome FROM vant.audit
    WHERE tenant_id=$1 AND action LIKE $2 ORDER BY created_at DESC,id DESC LIMIT 10`,[tenant,prefix+'%']);
  const last=await db.query('SELECT max(created_at) AS at FROM vant.audit WHERE tenant_id=$1 AND action=$2',[tenant,prefix+'success']);
  const summary={status,last_read:last.rows[0].at,events:events.rows};
  if(name==='smtp'){
    summary.can_test=Boolean(config?.test_to);
    summary.last_diagnostic=await latestSmtpDiagnostic(db,tenant);
  }
  if(name==='sheets')summary.range=config?.range??null;
  return summary;
}

export async function integrationRoutes(ctx){
  const {db,tenant,member,url,method}=ctx;
  const reader=readers.get(url.pathname);
  const diagnostic=url.pathname==='/api/v1/integrations/smtp/test-message';
  if(url.pathname!=='/api/v1/integrations' && !reader && !diagnostic)return;
  if(!mayManageTeams(member.role))reject(403,'permission','A central de integrações exige perfil de gestão.');
  if(diagnostic)return smtpDiagnostic(ctx);
  if(reader)return runReader(ctx,reader);
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
  const sheets=await readerSummary(db,tenant,'sheets',tenantSheet);
  const calendar=await readerSummary(db,tenant,'calendar',tenantCalendar);
  const hubspot=await readerSummary(db,tenant,'hubspot',tenantHubspot);
  const pipedrive=await readerSummary(db,tenant,'pipedrive',tenantPipedrive);
  const rd_station=await readerSummary(db,tenant,'rdstation',tenantRdStation);
  const kommo=await readerSummary(db,tenant,'kommo',tenantKommo);
  const smtp=await readerSummary(db,tenant,'smtp',tenantSmtp);
  const {rows:[whatsapp]}=await db.query(`SELECT count(*)::integer AS registered,
    count(*) FILTER (WHERE state='open')::integer AS connected,
    count(*) FILTER (WHERE state='connecting')::integer AS connecting,
    count(*) FILTER (WHERE state='close')::integer AS disconnected,
    max(last_observed_at) AS last_observed_at FROM vant.wa_instances
    WHERE tenant_id=$1 AND disabled_at IS NULL`,[tenant]);
  return [200,{whatsapp,smtp,kommo,rd_station,google_calendar:calendar,google_sheets:sheets,hubspot,pipedrive,csv:{imports:csv.rows,last_failure:failure.rows[0]??null},webhook:{last_delivery:last.rows[0].delivered_at,attempts:attempts.rows}}];
}
