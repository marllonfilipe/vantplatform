import {reserveAgentAction} from './supervision.mjs';
import {sdrQuestions} from './sdr-questions.mjs';
import {entities,options} from '../public/crm-schema.js';
import {leadCsv} from './csv.mjs';
import {pagination,reject,textField} from './http.mjs';
import {isUuid,mayManageTeams} from './security.mjs';
import {audit} from './db.mjs';
import {runCsvImport} from './csv-import-result.mjs';

function invalid(key){reject(400,'field','Campo inválido: '+key);}
function writable(user,row){
 if(user.role==='viewer'||(user.role==='seller'&&row?.owner_id&&row.owner_id!==user.id))reject(403,'permission','Permissão insuficiente.');
}
function value(key,v){
 if(key==='tags'){if(!Array.isArray(v)||v.length>30)invalid(key);return [...new Set(v.map(t=>textField(t,60)))];}
 if(key==='decision_maker'){if(typeof v!=='boolean')invalid(key);return v;}
 if(options[key]&&!Object.hasOwn(options[key],v))invalid(key);
 if(v===''||v===null)return key==='notes'?'':null;
 if(key.endsWith('_id')){if(!isUuid(v))invalid(key);return v;}
 if(key==='amount_cents'||key==='probability'){if(!Number.isSafeInteger(v)||v<0||v>(key==='probability'?100:999999999999))invalid(key);return v;}
 if(key==='email'){if(typeof v!=='string'||v.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(v))invalid(key);return v.toLowerCase();}
 if(key==='close_on'&&!/^\d{4}-\d{2}-\d{2}$/.test(v))invalid(key);
 if(['done_at','due_at'].includes(key)&&(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v))))invalid(key);
 return textField(v,['notes','products','loss_reason'].includes(key)?4000:250);
}
async function record(db,kind,id,lock=false){
 if(!isUuid(id))reject(404,'missing','Registro não encontrado.');
 const {rows}=await db.query('SELECT * FROM vant.'+kind+' WHERE id=$1'+(lock?' FOR UPDATE':''),[id]);
 if(!rows.length)reject(404,'missing','Registro não encontrado.');return rows[0];
}
async function log(ctx,kind,id,action,changes){
 const {db,tenant,member,requestId}=ctx;
 await db.query('INSERT INTO vant.crm_history(tenant_id,actor_id,kind,record_id,action,changes) VALUES($1,$2,$3,$4,$5,$6)',[tenant,member.id,kind,id,action,JSON.stringify(changes)]);
 await audit(db,tenant,member.id,'crm.'+kind+'.'+action,id,requestId);
}
async function save(ctx,kind,body,old){
 const {db,member,tenant}=ctx;writable(member,old);
 const columns=entities[kind].fields.split(' '),data={};
 for(const k of columns)if(Object.hasOwn(body,k))data[k]=value(k,body[k]);
 if(!old && columns.includes('owner_id'))data.owner_id??=member.id;
 if(member.role==='seller'&&data.owner_id&&data.owner_id!==member.id)reject(403,'owner','Reatribuição exige gestão.');
 if(!old&&kind==='leads')data.source||='Cadastro manual';
 if(old&&!Object.keys(data).length)invalid('registro');
 const merged={...old,...data};
 const required=[kind==='activities'?'title':'name'];
 if(columns.includes('owner_id'))required.push('owner_id');
 if(kind==='activities')required.push('kind');
 if(kind==='deals')required.push('amount_cents','probability','pipeline_id','stage_id');
 if(kind==='leads')required.push('source');
 for(const k of required)if(merged[k]===null||merged[k]===undefined)invalid(k);
 if(kind==='deals'){
  const state=merged.status??'open';if(state==='lost'&&!merged.loss_reason)invalid('loss_reason');
  if(state!=='lost')data.loss_reason=null;
  if(!old||state!==old.status)data.closed_at=state==='open'?null:new Date().toISOString();
  data.updated_at=new Date().toISOString();
 }
 const keys=Object.keys(data),args=Object.values(data),markers=keys.map((k,i)=>'$'+(i+1));
 args.push(old?old.id:tenant);
 const sql=old?'UPDATE vant.'+kind+' SET '+keys.map((k,i)=>k+'='+markers[i]).join(',')+' WHERE id=$'+args.length:
  'INSERT INTO vant.'+kind+'('+keys.join(',')+',tenant_id) VALUES('+markers.join(',')+',$'+args.length+')';
 const row=(await db.query(sql+' RETURNING *',args)).rows[0];
 const changes=Object.fromEntries(keys.map(k=>[k,{from:old?.[k]??null,to:row[k]}]));await log(ctx,kind,row.id,old?'updated':'created',changes);
 if(kind==='activities'&&row.lead_id&&row.done_at&&['call','meeting','followup'].includes(row.kind))
  await db.query('UPDATE vant.leads SET last_contact_at=greatest(last_contact_at,$1) WHERE id=$2',[row.done_at,row.lead_id]);
 return row;
}
export async function recordSdrAnswers(ctx,runId,answers){
 if(!answers || typeof answers!=='object' || Array.isArray(answers) || !Object.keys(answers).length)reject(400,'answers','Informe pelo menos uma resposta.');
 const run=(await ctx.db.query("SELECT subject_id,result FROM vant.core_runs WHERE tenant_id=$1 AND id=$2 AND subject_kind='lead'",[ctx.tenant,runId])).rows[0];
 if(!run)reject(404,'missing','Análise não encontrada.');
 const lead=await record(ctx.db,'leads',run.subject_id,true);
 writable(ctx.member,lead);
 const changes={};
 for(const [field,answer] of Object.entries(answers)){
  const prompt=run.result.sdrQuestions?.find(item=>item.field===field);
  if(!Object.hasOwn(sdrQuestions,field)||!prompt)reject(400,'field','Campo ausente no roteiro.');
  if(typeof answer!=='string'||!answer.trim()||answer==='unknown')reject(400,'answer','Informe uma resposta confirmada.');
  const normalized=value(field,answer);
  if(lead[field]===normalized)continue;
  if((lead[field]??null)!==prompt.previous)reject(409,'outdated','O CRM já recebeu outra resposta. Gere um novo roteiro.');
  changes[field]=normalized;
 }
 if(Object.keys(changes).length){
  await reserveAgentAction(ctx.db,ctx.tenant,'sdr_enabled');
  await save(ctx,'leads',changes,lead);
  await audit(ctx.db,ctx.tenant,ctx.member.id,'agent.sdr.answered',runId,ctx.requestId);
 }
 return [200,{lead_id:lead.id}];
}
export async function assignCrmOwner(ctx,target,ownerId){
 const {db,tenant,member}=ctx;
 if(!mayManageTeams(member.role))reject(403,'permission','Reatribuição exige gestão.');
 const available=await db.query('SELECT id FROM vant.members WHERE tenant_id=$1 AND id=$2 AND active',[tenant,ownerId]);
 if(!available.rowCount)throw Object.assign(new Error('owner_unavailable'),{code:'owner_unavailable'});
 const kind=target.deal_id?'deals':'leads',id=target.deal_id??target.lead_id;
 const current=await record(db,kind,id,true);
 if(current.owner_id!==ownerId)await save(ctx,kind,{owner_id:ownerId},current);
 return {kind,record_id:id,previous_owner_id:current.owner_id,owner_id:ownerId};
}
export async function updateCrmFromFlow(ctx,target,changes){
 if(!mayManageTeams(ctx.member.role))reject(403,'permission','Atualização pelo fluxo exige gestão.');
 const kind=target.deal_id?'deals':'leads',id=target.deal_id??target.lead_id;
 const current=await record(ctx.db,kind,id,true),patch={};
 if(kind==='deals'){
  if(changes.probability!==current.probability)patch.probability=changes.probability;
 }else{
  if(changes.segment!==undefined&&changes.segment!==current.segment)patch.segment=changes.segment;
  if(changes.add_tag&&!current.tags.includes(changes.add_tag))patch.tags=[...current.tags,changes.add_tag];
 }
 const fields=Object.keys(patch);
 if(fields.length)await save(ctx,kind,patch,current);
 return {kind,record_id:id,fields};
}
export async function recordFlowComment(ctx,target,title,execution){
 const activity=await save(ctx,'activities',{kind:'comment',title,...target,done_at:new Date().toISOString()});
 const changes={title,activity_id:activity.id,flow_id:execution.flow,job_id:execution.job,step:execution.step+1};
 if(target.lead_id)await log(ctx,'leads',target.lead_id,'activity_recorded',changes);
 if(target.deal_id)await log(ctx,'deals',target.deal_id,'activity_recorded',changes);
 return activity.id;
}
export function createCrmLead(ctx,values){return save(ctx,'leads',values);}
export function updateContactRole(ctx,old,values){return save(ctx,'contacts',values,old);}
export function updateProspectAccount(ctx,current,fields){return save(ctx,'accounts',fields,current);}
export function createCrmAccount(ctx,values){return save(ctx,'accounts',values);}
export function createCrmActivity(ctx,task){return save(ctx,'activities',task);}
async function list(ctx,kind){
 const {db,url}=ctx,fields=entities[kind].fields.split(' '),where=[],params=[];
 const add=(clause,v)=>{params.push(v);where.push(clause.replace('?', '$'+params.length));};
 for(const k of ['source','segment','owner_id','team_id','account_id','lead_id','contact_id','pipeline_id','stage_id','status','kind']){
  const v=url.searchParams.get(k);if(v&&fields.includes(k))add(k+'=?',value(k,v));
 }
 const search=url.searchParams.get('q');if(search)add('strpos(lower('+(kind==='activities'?'title':'name')+'),lower(?))>0',textField(search,120));
 if(kind==='leads'&&url.searchParams.get('tag'))add('?=ANY(tags)',textField(url.searchParams.get('tag'),60));
 const cursor=url.searchParams.get('cursor');if(cursor){if(!isUuid(cursor))invalid('cursor');add('id>?',cursor);}
 const limit=pagination(url.searchParams);params.push(limit+1);
 const {rows}=await db.query('SELECT * FROM vant.'+kind+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY id LIMIT $'+params.length,params);
 return {items:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1].id:null};
}
async function pipeline(ctx,id){
 const {method,db,body,tenant,member}=ctx;
 if(method==='GET')return [200,{items:(await db.query(`SELECT p.id,p.name,coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) ORDER BY s.position) FILTER (WHERE s.id IS NOT NULL),'[]') AS stages FROM vant.pipelines p LEFT JOIN vant.stages s ON s.pipeline_id=p.id GROUP BY p.id,p.name ORDER BY p.name`)).rows}];
 if(!mayManageTeams(member.role))reject(403,'permission','Apenas gestores configuram o funil.');
 if(method!==(id?'PATCH':'POST'))reject(405,'method','Método inválido.');
 const name=textField(body.name,120);
 if(!Array.isArray(body.stages)||!body.stages.length||body.stages.length>30)invalid('stages');
 const stages=body.stages.map(s=>({id:s?.id??null,name:textField(s?.name??s,100)}));
 if(new Set(stages.map(s=>s.name.toLowerCase())).size!==stages.length)invalid('stages');
 if(id){
  await record(db,'pipelines',id,true);
  const old=(await db.query('SELECT id FROM vant.stages WHERE pipeline_id=$1',[id])).rows;
  const kept=stages.filter(s=>s.id);if(kept.length!==old.length||old.some(s=>!kept.some(v=>s.id===v.id)))invalid('etapas existentes');
  await db.query('UPDATE vant.pipelines SET name=$1 WHERE id=$2',[name,id]);await db.query('UPDATE vant.stages SET position=-position-1 WHERE pipeline_id=$1',[id]);
 }else{
  if(stages.some(s=>s.id))invalid('stages');id=(await db.query('INSERT INTO vant.pipelines(tenant_id,name) VALUES($1,$2) RETURNING id',[tenant,name])).rows[0].id;
 }
 for(const [i,s] of stages.entries()){
  if(s.id)await db.query('UPDATE vant.stages SET name=$1,position=$2 WHERE id=$3 AND pipeline_id=$4',[s.name,i,s.id,id]);
  else await db.query('INSERT INTO vant.stages(tenant_id,pipeline_id,name,position) VALUES($1,$2,$3,$4)',[tenant,id,s.name,i]);
 }
 await log(ctx,'pipelines',id,method==='POST'?'created':'updated',{name,stages});return [method==='POST'?201:200,{id}];
}
export async function crmRoutes(ctx){
 const {db,tenant,member,method,body,url}=ctx;if(!url.pathname.startsWith('/api/v1/crm/'))return;
 const [kind,id,action,fileId]=url.pathname.slice(12).split('/');
 if(kind==='members'&&method==='GET')return [200,{items:(await db.query('SELECT id,name FROM vant.members WHERE active ORDER BY name,id')).rows}];
 if(kind==='pipelines')return pipeline(ctx,id);
 if(!Object.hasOwn(entities,kind))reject(404,'module','Módulo não encontrado.');
 if(kind==='leads'&&id==='import'&&method==='POST'){
  writable(member);
  return runCsvImport(ctx,'crm',async()=>{
   const rows=leadCsv(body.csv);
   for(const row of rows)await save(ctx,kind,row);
   await audit(db,tenant,member.id,'crm.leads.import',null,ctx.requestId);
   return [201,{imported:rows.length}];
  });
 }
 if(!id&&method==='GET')return [200,await list(ctx,kind)];
 if(!id&&method==='POST')return [201,await save(ctx,kind,body)];
 const row=await record(db,kind,id,method!=='GET');
 if(!action&&method==='GET')return [200,row];
 if(!action&&method==='PATCH')return [200,await save(ctx,kind,body,row)];
 if(!action&&method==='DELETE'&&kind==='leads'){
  if(!mayManageTeams(member.role))reject(403,'permission','Exclusão exige gestão.');
  const linked=await db.query('SELECT 1 FROM vant.activities WHERE lead_id=$1 UNION ALL SELECT 1 FROM vant.deals WHERE lead_id=$1 UNION ALL SELECT 1 FROM vant.conversations WHERE lead_id=$1 LIMIT 1',[id]);
  if(linked.rowCount)reject(409,'linked','Lead com vínculos ativos.');
  await log(ctx,kind,id,'deleted',{name:row.name});await db.query('DELETE FROM vant.leads WHERE id=$1',[id]);return [204];
 }
 if(action==='history'&&method==='GET'){
  const limit=pagination(url.searchParams),cursor=url.searchParams.get('cursor');if(cursor&&!/^\d{1,18}$/.test(cursor))invalid('cursor');
  const {rows}=await db.query('SELECT h.id,h.action,h.changes,h.created_at,m.name AS actor FROM vant.crm_history h JOIN vant.members m ON h.actor_id=m.id WHERE h.kind=$1 AND h.record_id=$2 AND ($3::bigint IS NULL OR h.id<$3) ORDER BY h.id DESC LIMIT $4',[kind,id,cursor,limit+1]);
  return [200,{items:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1].id:null}];
 }
 if(kind==='conversations'&&action==='lead'&&method==='POST'){
  writable(member,row);if(row.lead_id)return [200,await record(db,'leads',row.lead_id)];
  const lead=await save(ctx,'leads',{name:row.name,phone:row.phone,owner_id:row.owner_id,account_id:row.account_id,contact_id:row.contact_id,source:row.channel==='manual'?'Conversa':'WhatsApp'});
  await db.query('UPDATE vant.conversations SET lead_id=$1 WHERE id=$2',[lead.id,id]);await log(ctx,kind,id,'linked',{lead_id:lead.id});return [201,lead];
 }
 if(kind==='leads'&&action==='files'){
  if(method==='GET'&&!fileId)return [200,{items:(await db.query('SELECT id,filename FROM vant.lead_files WHERE lead_id=$1 ORDER BY filename,id',[id])).rows}];
  if(method==='GET'&&isUuid(fileId)){const r=await db.query('SELECT filename,contents FROM vant.lead_files WHERE id=$1 AND lead_id=$2',[fileId,id]);if(!r.rowCount)reject(404,'file','Arquivo não encontrado.');return [200,{filename:r.rows[0].filename,base64:r.rows[0].contents.toString('base64')}];}
  if(method==='POST'&&!fileId){writable(member,row);const name=textField(body.filename,180);
   if(typeof body.base64!=='string'||body.base64.length>2796204||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64))invalid('arquivo');
   const bytes=Buffer.from(body.base64,'base64');if(!bytes.length||bytes.length>2097152||bytes.toString('base64')!==body.base64)invalid('arquivo');
   const r=await db.query('INSERT INTO vant.lead_files(tenant_id,lead_id,filename,contents) VALUES($1,$2,$3,$4) RETURNING id,filename',[tenant,id,name,bytes]);await log(ctx,kind,id,'attached',{filename:name});return [201,r.rows[0]];
  }
 }
 reject(404,'route','Ação não encontrada.');
}
