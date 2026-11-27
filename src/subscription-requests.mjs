import {audit} from './db.mjs';
import {reject} from './http.mjs';
import {isUuid,mayManageTeams} from './security.mjs';

const path='/api/v1/billing/subscription-requests';
const fields='id,plan_code,monthly_cents,created_at,cancelled_at';

export async function subscriptionRequests({db,tenant,member,body,method,url,requestId}){
  const resource=url.pathname;
  if(resource!==path&&!resource.startsWith(path+'/'))return;
  if(!mayManageTeams(member.role))reject(403,'permission','A consulta exige perfil de gestão.');
  if(resource===path&&method==='GET'){
    const {rows}=await db.query(`SELECT ${fields} FROM vant.subscription_requests
      WHERE tenant_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`,[tenant]);
    return [200,{latest:rows[0]??null}];
  }
  if(member.role!=='owner')reject(403,'permission','Somente o proprietário gerencia solicitações de assinatura.');
  const create=resource===path&&method==='POST';
  const id=create?body.id:resource.slice(path.length+1);
  if(!create&&(method!=='DELETE'||resource===path))reject(405,'method','Método indisponível.');
  if(!isUuid(id))reject(400,'request_id','Identificador da solicitação inválido.');
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,49011))',[tenant]);
  const current=(await db.query(`SELECT ${fields} FROM vant.subscription_requests WHERE tenant_id=$1 AND id=$2`,[tenant,id])).rows[0];
  if(create){
    if(typeof body.plan_code!=='string')reject(400,'plan','Informe um plano do catálogo.');
    if(current){
      if(current.plan_code!==body.plan_code)reject(409,'request_conflict','A referência já foi usada para outro plano.');
      return [200,current];
    }
    const pending=await db.query('SELECT 1 FROM vant.subscription_requests WHERE tenant_id=$1 AND cancelled_at IS NULL',[tenant]);
    if(pending.rowCount)reject(409,'pending_request','A empresa já tem uma solicitação pendente.');
    const {rows}=await db.query(`INSERT INTO vant.subscription_requests(tenant_id,id,plan_code,monthly_cents,created_by)
      SELECT $1,$2,code,monthly_cents,$4 FROM vant.billing_plans WHERE code=$3 RETURNING ${fields}`,[tenant,id,body.plan_code,member.id]);
    if(!rows.length)reject(400,'plan','Plano desconhecido.');
    await audit(db,tenant,member.id,'billing.subscription_requested',id,requestId);
    return [201,rows[0]];
  }
  if(!current)reject(404,'request','Solicitação não encontrada.');
  if(current.cancelled_at)return [200,current];
  const {rows}=await db.query(`UPDATE vant.subscription_requests SET cancelled_at=clock_timestamp(),cancelled_by=$3
    WHERE tenant_id=$1 AND id=$2 RETURNING ${fields}`,[tenant,id,member.id]);
  await audit(db,tenant,member.id,'billing.subscription_request_cancelled',id,requestId);
  return [200,rows[0]];
}
