import {randomUUID} from 'node:crypto';
import {audit,withTenant} from './db.mjs';
import {createCrmActivity} from './crm.mjs';
import {isUuid,mayManageTeams} from './security.mjs';
import {reject,textField} from './http.mjs';

const activityKinds=new Set(['task','reminder','followup']);
function actions(body,source){
 const primary=body.action_kind===undefined?'task':body.action_kind;
 const alternative=body.else_kind??null;
 const due=body.due_minutes??null;
 if(!activityKinds.has(primary)||(alternative!==null&&(!source||!activityKinds.has(alternative))))reject(400,'flow_action','Ação ou ramificação inválida.');
 if(alternative===null&&body.else_title!=null)reject(400,'flow_action','Informe a ação do caminho alternativo.');
 if(due!==null&&(!Number.isInteger(due)||due<0||due>43200))reject(400,'flow_due','Prazo da atividade inválido.');
 if((primary==='reminder'||alternative==='reminder')&&due===null)reject(400,'flow_due','Lembretes exigem prazo.');
 return {primary,alternative,alternateTitle:alternative===null?null:textField(body.else_title,240),due};
}
export async function automationRoutes({db,tenant,member,url,method,body,requestId}){
 const base='/api/v1/automations';
 if(url.pathname!==base && !url.pathname.startsWith(base+'/'))return;
 if(!mayManageTeams(member.role))reject(403,'permission','A gestão de fluxos exige proprietário ou gestor.');
 if(url.pathname===base+'/runs'&&method==='GET'){
  const {rows}=await db.query(`SELECT j.id,j.payload,j.state,j.available_at,j.attempts,
    coalesce((SELECT jsonb_agg(to_jsonb(h)-'tenant_id' ORDER BY h.attempt) FROM vant.automation_attempts h
    WHERE h.tenant_id=j.tenant_id AND h.job_id=j.id),'[]') AS history FROM vant.jobs j
    WHERE j.tenant_id=$1 AND j.kind='flow.lead_created' ORDER BY j.available_at DESC,j.id LIMIT 100`,[tenant]);
  return [200,{items:rows}];
 }
 if(url.pathname===base&&method==='GET'){
  const {rows}=await db.query(`SELECT f.*,v.task_title,v.wait_minutes,v.source_filter,v.action_kind,v.else_kind,v.else_title,v.due_minutes FROM vant.automation_flows f
    JOIN vant.automation_versions v ON (v.tenant_id,v.flow_id,v.version)=(f.tenant_id,f.id,f.version)
    WHERE f.tenant_id=$1 ORDER BY f.name,f.id`,[tenant]);
  return [200,{items:rows}];
 }
 const create=url.pathname===base && method==='POST';
 const id=create?randomUUID():url.pathname.slice(base.length+1);
 if(!create && !(method==='PUT'&&isUuid(id)))return;
 const name=textField(body.name,120),title=textField(body.task_title,240);
 const delay=body.wait_minutes??0,source=body.source_filter==null?null:textField(body.source_filter,250);
 if(typeof body.enabled!=='boolean'||!Number.isInteger(delay)||delay<0||delay>43200)reject(400,'flow','Configuração de fluxo inválida.');
 let action,version=1;
 if(create){
  action=actions(body,source);
  await db.query('INSERT INTO vant.automation_flows(tenant_id,id,name,version,enabled) VALUES($1,$2,$3,1,$4)',[tenant,id,name,body.enabled]);
 }else{
  const existing=(await db.query(`SELECT f.version,v.action_kind,v.else_kind,v.else_title,v.due_minutes FROM vant.automation_flows f JOIN vant.automation_versions v ON (v.tenant_id,v.flow_id,v.version)=(f.tenant_id,f.id,f.version) WHERE f.tenant_id=$1 AND f.id=$2 FOR UPDATE OF f`,[tenant,id])).rows[0];
  if(!existing)reject(404,'missing','Fluxo não encontrado.');
  if(existing.version!==body.expected_version)reject(409,'version','A versão do fluxo mudou.');
  action=actions({...existing,...body},source);
  version=existing.version+1;
  await db.query('UPDATE vant.automation_flows SET version=$3,enabled=$4,name=$5 WHERE tenant_id=$1 AND id=$2',[tenant,id,version,body.enabled,name]);
 }
 await db.query('INSERT INTO vant.automation_versions(tenant_id,flow_id,version,author_id,task_title,wait_minutes,source_filter,action_kind,else_kind,else_title,due_minutes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[tenant,id,version,member.id,title,delay,source,action.primary,action.alternative,action.alternateTitle,action.due]);
 await audit(db,tenant,member.id,'automation.version',id,requestId);
 return [create?201:200,{id,version}];
}

export function processNext(pool,tenant){
 return withTenant(pool,tenant,async db=>{
  const job=(await db.query(`SELECT j.id,j.payload,j.attempts,v.task_title,v.source_filter,v.author_id,v.action_kind,v.else_kind,v.else_title,v.due_minutes
    FROM vant.jobs j JOIN vant.automation_flows f ON f.tenant_id=j.tenant_id AND f.id=(j.payload->>'flow')::uuid
    JOIN vant.automation_versions v ON (v.tenant_id,v.flow_id,v.version)=(f.tenant_id,f.id,(j.payload->>'version')::int)
    WHERE j.tenant_id=$1 AND j.kind='flow.lead_created' AND j.state='queued' AND j.available_at<=now() AND f.enabled
    ORDER BY j.available_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED FOR SHARE OF f`,[tenant])).rows[0];
  if(!job)return false;
  let outcome='skipped',reason=null,activity=null;
  const match=!job.source_filter || job.source_filter===job.payload.source;
  const branch=match?'match':'otherwise';
  const kind=match?job.action_kind:job.else_kind;
  const title=match?job.task_title:job.else_title;
  const attempt=job.attempts+1;
  await db.query('SAVEPOINT flow_effect');
  try{
   if(kind){
    const lead=(await db.query('SELECT owner_id FROM vant.leads WHERE tenant_id=$1 AND id=$2 FOR SHARE',[tenant,job.payload.lead])).rows[0];
    if(lead){
     const member=(await db.query('SELECT id,role FROM vant.members WHERE tenant_id=$1 AND id=$2 AND active',[tenant,job.author_id])).rows[0];
     if(!member||!mayManageTeams(member.role))throw Object.assign(new Error('author_unavailable'),{code:'author_unavailable'});
     const task={kind,title,lead_id:job.payload.lead,owner_id:lead.owner_id};
     if(job.due_minutes!==null)task.due_at=new Date(Date.now()+job.due_minutes*60000).toISOString();
     activity=(await createCrmActivity({db,tenant,member,requestId:randomUUID()},task)).id;
     outcome='created';
    }
   }
  }catch(error){
   reason=error.code==='author_unavailable'?'author_unavailable':'action_failed';
   await db.query('ROLLBACK TO SAVEPOINT flow_effect');
   activity=null;outcome=attempt>=3?'failed':'retry';
  }
  const state=outcome==='retry'?'queued':outcome==='failed'?'failed':'done';
  await db.query(`UPDATE vant.jobs SET state=$3,attempts=$4,available_at=CASE WHEN $3='queued' THEN now()+make_interval(secs=>$4::int*30) ELSE available_at END
    WHERE tenant_id=$1 AND id=$2`,[tenant,job.id,state,attempt]);
  await db.query('INSERT INTO vant.automation_attempts(tenant_id,job_id,attempt,outcome,activity_id,reason,branch,action_kind) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[tenant,job.id,attempt,outcome,activity,reason,branch,kind]);
  return true;
 });
}
