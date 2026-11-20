import {notifyOwner} from './notifications.mjs';
import {timerTarget} from './timers.mjs';
import {randomUUID} from 'node:crypto';
import {audit,withTenant} from './db.mjs';
import {createCrmActivity,assignCrmOwner,recordFlowComment} from './crm.mjs';
import {isUuid,mayManageTeams} from './security.mjs';
import {reject,textField} from './http.mjs';

const events=['lead_created','lead_updated','deal_created','deal_moved','deal_lost','meeting_scheduled','meeting_completed','score_changed','lead_qualified','task_overdue','lead_inactive'];
const jobKinds=events.map(event=>'flow.'+event);
const actionKinds=new Set(['task','reminder','followup','assign_owner','notify_owner','comment']);
const assignmentEvents=new Set(['lead_created','score_changed','lead_qualified','deal_created','deal_moved','deal_lost']);

function assignmentOwner(kind,id,event){
 if(kind!=='assign_owner')return null;
 if(!assignmentEvents.has(event))reject(400,'flow_owner','Escolha um gatilho de novo lead, qualificação, score ou oportunidade para atribuir responsável.');
 if(!isUuid(id))reject(400,'flow_owner','Escolha um responsável ativo da empresa.');
 return id.toLowerCase();
}
function parseConditions(value={}){
 if(!value || typeof value!=='object' || Array.isArray(value))reject(400,'conditions','Condições inválidas.');
 const result={};
 for(const [key,v] of Object.entries(value)){
  if(key==='segment'||key==='tag'){result[key]=textField(v,key==='tag'?60:250);continue;}
  if(key==='stage_id'||key==='owner_id'){if(!isUuid(v))reject(400,'conditions','Identificador inválido.');result[key]=v.toLowerCase();continue;}
  if(key==='intent'&&['unknown','exploring','evaluating','requested_proposal'].includes(v)){result[key]=v;continue;}
  const max={min_score:100,min_cents:999999999999,min_quiet_days:36500};
  if(!Object.hasOwn(max,key)||!Number.isSafeInteger(v)||v<0||v>max[key])reject(400,'conditions','Condição comercial inválida.');
  result[key]=v;
 }
 return result;
}
function matchesConditions(filters,facts={}){
 return Object.entries(filters).every(([key,expected])=>{
  const actual=facts[key];
  if(actual==null)return false;
  if(key==='tag')return Array.isArray(actual)&&actual.includes(expected);
  if(key.startsWith('min_'))return typeof actual==='number'&&actual>=expected;
  return actual===expected;
 });
}
function parseSteps(value={},hasAlternative,event){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['match','otherwise'].includes(k)))reject(400,'flow_steps','Etapas inválidas.');
 const steps={};
 for(const [branch,items] of Object.entries(value)){
  if(!Array.isArray(items)||items.length>7||(branch==='otherwise'&&!hasAlternative&&items.length))reject(400,'flow_steps','Use até oito ações por caminho, incluindo a primeira.');
  steps[branch]=items.map(item=>{
   if(!item||!actionKinds.has(item.kind))reject(400,'flow_steps','Tipo de atividade inválido.');
   const wait=item.wait_minutes??0,due=item.due_minutes??null;
   if(!Number.isInteger(wait)||wait<0||wait>43200||(due!==null&&(!Number.isInteger(due)||due<0||due>43200))||(item.kind==='reminder'&&due===null))reject(400,'flow_steps','Espera ou prazo inválido.');
   if(item.kind==='assign_owner')return {kind:item.kind,owner_id:assignmentOwner(item.kind,item.owner_id,event),wait_minutes:wait};
   return {kind:item.kind,title:textField(item.title,240),wait_minutes:wait,due_minutes:due};
  });
 }
 return steps;
}
function actions(body,source){
 const cooldown=body.cooldown_minutes===undefined?0:body.cooldown_minutes;
 if(!Number.isInteger(cooldown)||cooldown<0||cooldown>43200)reject(400,'flow_frequency','Intervalo entre execuções inválido.');
 const conditions=parseConditions(body.conditions);
 const event=body.trigger_event===undefined?'lead_created':body.trigger_event;
 if(!events.includes(event))reject(400,'flow_event','Gatilho inválido.');
 const primary=body.action_kind===undefined?'task':body.action_kind;
 const alternative=body.else_kind??null;
 const due=body.due_minutes??null;
 if(!actionKinds.has(primary)||(alternative!==null&&((!source&&!Object.keys(conditions).length)||!actionKinds.has(alternative))))reject(400,'flow_action','Ação ou ramificação inválida.');
 if(alternative===null&&body.else_title!=null)reject(400,'flow_action','Informe a ação do caminho alternativo.');
 if(due!==null&&(!Number.isInteger(due)||due<0||due>43200))reject(400,'flow_due','Prazo da atividade inválido.');
 if((primary==='reminder'||alternative==='reminder')&&due===null)reject(400,'flow_due','Lembretes exigem prazo.');
 const primaryOwner=assignmentOwner(primary,body.action_owner_id,event);
 const alternativeOwner=assignmentOwner(alternative,body.else_owner_id,event);
 return {cooldown,primaryOwner,alternativeOwner,steps:parseSteps(body.steps,alternative!==null,event),conditions,event,primary,alternative,alternateTitle:alternative===null?null:alternative==='assign_owner'?'Atribuir responsável':textField(body.else_title,240),due};
}
export async function automationRoutes({db,tenant,member,url,method,body,requestId}){
 const base='/api/v1/automations';
 if(url.pathname!==base && !url.pathname.startsWith(base+'/'))return;
 if(!mayManageTeams(member.role))reject(403,'permission','A gestão de fluxos exige proprietário ou gestor.');
 if(url.pathname===base+'/runs'&&method==='GET'){
  const {rows}=await db.query(`SELECT j.id,j.payload,j.state,j.available_at,j.attempts,
    coalesce((SELECT jsonb_agg(to_jsonb(h)-'tenant_id' ORDER BY h.attempt) FROM vant.automation_attempts h
    WHERE h.tenant_id=j.tenant_id AND h.job_id=j.id),'[]') AS history FROM vant.jobs j
    WHERE j.tenant_id=$1 AND j.kind=ANY($2::text[]) ORDER BY j.available_at DESC,j.id LIMIT 100`,[tenant,jobKinds]);
  return [200,{items:rows}];
 }
 if(url.pathname===base&&method==='GET'){
  const {rows}=await db.query(`SELECT f.*,v.action_owner_id,v.else_owner_id,v.cooldown_minutes,v.steps,v.conditions,v.trigger_event,v.task_title,v.wait_minutes,v.source_filter,v.action_kind,v.else_kind,v.else_title,v.due_minutes FROM vant.automation_flows f
    JOIN vant.automation_versions v ON (v.tenant_id,v.flow_id,v.version)=(f.tenant_id,f.id,f.version)
    WHERE f.tenant_id=$1 ORDER BY f.name,f.id`,[tenant]);
  return [200,{items:rows}];
 }
 const create=url.pathname===base && method==='POST';
 const id=create?randomUUID():url.pathname.slice(base.length+1);
 if(!create && !(method==='PUT'&&isUuid(id)))return;
 const name=textField(body.name,120);
 const delay=body.wait_minutes??0,source=body.source_filter==null?null:textField(body.source_filter,250);
 if(typeof body.enabled!=='boolean'||!Number.isInteger(delay)||delay<0||delay>43200)reject(400,'flow','Configuração de fluxo inválida.');
 let action,version=1;
 if(create){
  action=actions(body,source);
  await db.query('INSERT INTO vant.automation_flows(tenant_id,id,name,version,enabled) VALUES($1,$2,$3,1,$4)',[tenant,id,name,body.enabled]);
 }else{
  const existing=(await db.query(`SELECT f.version,v.action_owner_id,v.else_owner_id,v.cooldown_minutes,v.steps,v.conditions,v.trigger_event,v.action_kind,v.else_kind,v.else_title,v.due_minutes FROM vant.automation_flows f JOIN vant.automation_versions v ON (v.tenant_id,v.flow_id,v.version)=(f.tenant_id,f.id,f.version) WHERE f.tenant_id=$1 AND f.id=$2 FOR UPDATE OF f`,[tenant,id])).rows[0];
  if(!existing)reject(404,'missing','Fluxo não encontrado.');
  if(existing.version!==body.expected_version)reject(409,'version','A versão do fluxo mudou.');
  action=actions({...existing,...body},source);
  version=existing.version+1;
  await db.query('UPDATE vant.automation_flows SET version=$3,enabled=$4,name=$5 WHERE tenant_id=$1 AND id=$2',[tenant,id,version,body.enabled,name]);
 }
 const title=action.primary==='assign_owner'?'Atribuir responsável':textField(body.task_title,240);
 const owners=new Set([action.primaryOwner,action.alternativeOwner,...Object.values(action.steps).flat().map(step=>step.owner_id)].filter(Boolean));
 if(owners.size){
  const active=await db.query('SELECT id FROM vant.members WHERE tenant_id=$1 AND id=ANY($2::uuid[]) AND active',[tenant,[...owners]]);
  if(active.rowCount!==owners.size)reject(400,'flow_owner','Escolha um responsável ativo da empresa.');
 }
 await db.query('INSERT INTO vant.automation_versions(tenant_id,flow_id,version,author_id,task_title,wait_minutes,source_filter,action_kind,else_kind,else_title,due_minutes,trigger_event,conditions,steps,cooldown_minutes,action_owner_id,else_owner_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)',[tenant,id,version,member.id,title,delay,source,action.primary,action.alternative,action.alternateTitle,action.due,action.event,action.conditions,action.steps,action.cooldown,action.primaryOwner,action.alternativeOwner]);
 await audit(db,tenant,member.id,'automation.version',id,requestId);
 return [create?201:200,{id,version}];
}

async function activityTarget(db,tenant,payload,assigning){
 if(payload.event==='lead_inactive'||payload.event==='task_overdue')return timerTarget(db,tenant,payload);
 if(payload.meeting){
  return (await db.query("SELECT owner_id,lead_id,deal_id FROM vant.activities WHERE tenant_id=$1 AND id=$2 AND kind='meeting' FOR SHARE",[tenant,payload.meeting])).rows[0];
 }
 const deal=Boolean(payload.deal),subjectId=deal?payload.deal:payload.lead;
 const table=deal?'deals':'leads';
 const row=(await db.query('SELECT owner_id FROM vant.'+table+' WHERE tenant_id=$1 AND id=$2 '+(assigning?'FOR UPDATE':'FOR SHARE'),[tenant,subjectId])).rows[0];
 if(row)return {...row,[deal?'deal_id':'lead_id']:subjectId};
}

async function admitStart(db,tenant,job){
 const values=[tenant,job.payload.flow,job.cooldown_minutes];
 const start=await db.query(`INSERT INTO vant.automation_starts AS previous(tenant_id,flow_id,started_at)
   VALUES($1,$2,clock_timestamp())
   ON CONFLICT(tenant_id,flow_id) DO UPDATE SET started_at=clock_timestamp()
   WHERE previous.started_at+make_interval(mins=>$3)<=clock_timestamp()
   RETURNING started_at`,values);
 if(start.rowCount)return true;
 await db.query(`UPDATE vant.jobs j SET available_at=s.started_at+make_interval(mins=>$3),
   payload=j.payload||jsonb_build_object('frequency_deferred',true)
   FROM vant.automation_starts s WHERE s.tenant_id=$1 AND s.flow_id=$2 AND j.tenant_id=$1 AND j.id=$4`,[...values,job.id]);
 return false;
}

export function processNext(pool,tenant){
 return withTenant(pool,tenant,async db=>{
  const job=(await db.query(`SELECT j.id,j.payload,j.attempts,v.action_owner_id,v.else_owner_id,v.cooldown_minutes,v.steps,v.conditions,v.task_title,v.source_filter,v.author_id,v.action_kind,v.else_kind,v.else_title,v.due_minutes
    FROM vant.jobs j JOIN vant.automation_flows f ON f.tenant_id=j.tenant_id AND f.id=(j.payload->>'flow')::uuid
    JOIN vant.automation_versions v ON (v.tenant_id,v.flow_id,v.version)=(f.tenant_id,f.id,(j.payload->>'version')::int)
    WHERE j.tenant_id=$1 AND j.kind=ANY($2::text[]) AND j.state='queued' AND j.available_at<=now() AND f.enabled
    ORDER BY j.available_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED FOR SHARE OF f`,[tenant,jobKinds])).rows[0];
  if(!job)return false;
  let outcome='skipped',reason=null,activity=null,assignment=null;
  const match=(!job.source_filter || job.source_filter===job.payload.source)&&matchesConditions(job.conditions,job.payload.facts);
  const branch=match?'match':'otherwise';
  const step=job.payload.step??0;
  const following=job.steps[branch]??[];
  const current=step===0?{kind:match?job.action_kind:job.else_kind,title:match?job.task_title:job.else_title,due_minutes:job.due_minutes,owner_id:match?job.action_owner_id:job.else_owner_id}:following[step-1];
  const {kind,title}=current;
  const stepAttempt=(job.payload.step_attempts??(step===0?job.attempts:0))+1;
  const attempt=job.attempts+1;
  await db.query('SAVEPOINT flow_effect');
  try{
   if(kind){
    const record=await activityTarget(db,tenant,job.payload,kind==='assign_owner');
    if(record){
     const member=(await db.query('SELECT id,role FROM vant.members WHERE tenant_id=$1 AND id=$2 AND active',[tenant,job.author_id])).rows[0];
     if(!member||!mayManageTeams(member.role))throw Object.assign(new Error('author_unavailable'),{code:'author_unavailable'});
     if(step===0&&!await admitStart(db,tenant,job))return true;
     const ctx={db,tenant,member,requestId:randomUUID()};
     if(kind==='assign_owner'){
      assignment=await assignCrmOwner(ctx,record,current.owner_id);
      outcome=assignment.previous_owner_id===assignment.owner_id?'unchanged':'assigned';
     }else if(kind==='comment'){
      activity=await recordFlowComment(ctx,record,title,{flow:job.payload.flow,job:job.id,step});
      outcome='created';
     }else if(kind==='notify_owner'){
      await notifyOwner(db,tenant,record.owner_id,job.id,step,title);
      outcome='notified';
     }else{
      const task={kind,title,...record};
      if(current.due_minutes!==null)task.due_at=new Date(Date.now()+current.due_minutes*60000).toISOString();
      activity=(await createCrmActivity(ctx,task)).id;
      outcome='created';
     }
    }
   }
  }catch(error){
   reason=['author_unavailable','owner_unavailable'].includes(error.code)?error.code:'action_failed';
   await db.query('ROLLBACK TO SAVEPOINT flow_effect');
   activity=null;assignment=null;outcome=stepAttempt>=3?'failed':'retry';
  }
  const next=['created','assigned','unchanged','notified'].includes(outcome)?following[step]:null;
  const state=outcome==='retry'||next?'queued':outcome==='failed'?'failed':'done';
  const delay=next?next.wait_minutes*60:stepAttempt*30;
  const progress={step:next?step+1:step,step_attempts:next?0:stepAttempt};
  await db.query(`UPDATE vant.jobs SET state=$3,attempts=$4,payload=(payload-\'frequency_deferred\')||$6::jsonb,available_at=CASE WHEN $3='queued' THEN now()+make_interval(secs=>$5::integer) ELSE available_at END
    WHERE tenant_id=$1 AND id=$2`,[tenant,job.id,state,attempt,delay,progress]);
  await db.query('INSERT INTO vant.automation_attempts(tenant_id,job_id,attempt,outcome,activity_id,reason,branch,action_kind,step_index,assignment) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[tenant,job.id,attempt,outcome,activity,reason,branch,kind,step,assignment]);
  return true;
 });
}
