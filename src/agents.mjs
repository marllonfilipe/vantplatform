import {reserveAgentAction} from './supervision.mjs';
import {maySuggestFollowup} from './followup.mjs';
import {audit} from './db.mjs';
import {createCrmActivity,recordSdrAnswers} from './crm.mjs';
import {reject} from './http.mjs';
import {isUuid,mayManageTeams} from './security.mjs';

export async function agentRoutes(ctx) {
  const {db,tenant,member,requestId,url,method,body}=ctx;
  const sdr=/^\/api\/v1\/agents\/sdr\/([^/]+)\/answers$/.exec(url.pathname);
  if(sdr && method==='POST' && isUuid(sdr[1]))return recordSdrAnswers(ctx,sdr[1],body.answers);
  const match=/^\/api\/v1\/agents\/proposals\/([^/]+)(?:\/(approve|cancel))?$/.exec(url.pathname);
  if(!match || !isUuid(match[1]))return;
  const [,runId,decision]=match;
  if(method!=='POST' && !(method==='GET' && !decision))reject(405,'method','Método inválido.');
  const run=(await db.query('SELECT subject_kind,subject_id,result FROM vant.core_runs WHERE tenant_id=$1 AND id=$2',[tenant,runId])).rows[0];
  if(!run)reject(404,'missing','Análise não encontrada.');
  const table=run.subject_kind==='lead'?'leads':'deals';
  // Serializa decisões e reatribuições do mesmo registro no CRM.
  const fields=run.subject_kind==='deal'?'owner_id,status':'owner_id';
  const record=(await db.query('SELECT '+fields+' FROM vant.'+table+' WHERE tenant_id=$1 AND id=$2'+(method==='POST'?' FOR UPDATE':''),[tenant,run.subject_id])).rows[0];
  if(!record)reject(404,'missing','Registro não encontrado.');
  const writable=mayManageTeams(member.role)||(member.role==='seller'&&record.owner_id===member.id);
  const existing=(await db.query('SELECT * FROM vant.agent_proposals WHERE tenant_id=$1 AND run_id=$2',[tenant,runId])).rows[0];
  if(method==='GET')return [200,{proposal:existing??null,canDecide:writable}];
  if(!writable)reject(403,'permission','A decisão exige o responsável ou um gestor.');
  if(!decision){
    if(existing)return [200,existing];
    return [201,await createAgentProposal(ctx,runId)];
  }
  if(!existing)reject(404,'missing','Proposta não encontrada.');
  const status=decision==='approve'?'approved':'cancelled';
  if(existing.status===status)return [200,existing];
  if(existing.status!=='pending')reject(409,'decided','A proposta já recebeu outra decisão.');
  let activityId=null;
  if(decision==='approve'){
    if(run.result.recovery && record.status!==run.result.recovery.status)reject(409,'outdated','A situação da oportunidade mudou. Gere uma nova análise.');
    if(run.subject_kind==='lead' && run.result.followup){
      const eligible=await db.query('SELECT 1 FROM vant.leads l WHERE l.tenant_id=$1 AND l.id=$2 AND '+maySuggestFollowup,[tenant,run.subject_id]);
      if(!eligible.rowCount)reject(409,'outdated','O contexto de follow-up mudou. Consulte a agenda e atualize a análise.');
    }
    const task={kind:run.result.followup?'followup':'task',title:run.result.nextAction,owner_id:record.owner_id,[run.subject_kind+'_id']:run.subject_id};
    if(body.due_at)task.due_at=body.due_at;
    await reserveAgentAction(db,tenant,'tasks_enabled');
    activityId=(await createCrmActivity(ctx,task)).id;
  }
  const {rows}=await db.query(`UPDATE vant.agent_proposals SET status=$3,activity_id=$4,decided_by=$5,decided_at=now()
    WHERE tenant_id=$1 AND run_id=$2 RETURNING *`,[tenant,runId,status,activityId,member.id]);
  await audit(db,tenant,member.id,'agent.'+status,runId,requestId);
  return [200,rows[0]];
}

export async function createAgentProposal({db,tenant,member,requestId},runId){
 const {rows}=await db.query('INSERT INTO vant.agent_proposals(tenant_id,run_id,proposed_by) VALUES($1,$2,$3) RETURNING *',[tenant,runId,member.id]);
 await audit(db,tenant,member.id,'agent.proposed',runId,requestId);
 return rows[0];
}
