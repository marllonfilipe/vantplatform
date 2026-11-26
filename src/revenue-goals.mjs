import {audit} from './db.mjs';
import {reject} from './http.mjs';
import {isUuid,mayManageTeams} from './security.mjs';

const goalPath='/api/v1/revenue/goals';

export async function goalRoutes({db,tenant,member,url,method,body,requestId}){
 if(url.pathname!==goalPath||!['GET','PUT'].includes(method))return;
 const month=method==='GET'?url.searchParams.get('month'):body.month;
 if((method==='PUT'||month!==null)&&(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month.startsWith('0000')))reject(400,'month','Informe o mês no formato AAAA-MM.');
 const date=month?month+'-01':null;
 if(method==='GET'){
  const start=(await db.query("SELECT coalesce($1::date,date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')::date) AS day",[date])).rows[0].day;
  const {rows}=await db.query(`WITH actual AS (
    SELECT owner_id,sum(amount_cents) AS won FROM vant.deals WHERE tenant_id=$1 AND status='won'
     AND closed_at>=($2::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
     AND closed_at<(($2::date+interval '1 month') AT TIME ZONE 'America/Sao_Paulo') AND closed_at<=now()
     AND ($3::uuid IS NULL OR owner_id=$3) GROUP BY owner_id
   )
   SELECT m.id,m.name,(m.active AND m.role IN ('seller','manager','owner')) AS can_edit,g.amount_cents,coalesce(g.revision,0) AS revision,coalesce(a.won,0)::text AS won_cents,
    round(100.0*coalesce(a.won,0)/g.amount_cents,2)::text AS attainment_pct
   FROM vant.members m LEFT JOIN vant.revenue_goals g ON g.tenant_id=m.tenant_id AND g.owner_id=m.id AND g.month_start=$2
   LEFT JOIN actual a ON a.owner_id=m.id
   WHERE m.tenant_id=$1 AND ($3::uuid IS NULL OR m.id=$3)
    AND (g.owner_id IS NOT NULL OR a.owner_id IS NOT NULL OR (m.active AND m.role IN ('seller','manager','owner')))
   ORDER BY m.name,m.id`,[tenant,start,member.role==='seller'?member.id:null]);
  return [200,{month:start.slice(0,7),items:rows}];
 }
 if(!mayManageTeams(member.role))reject(403,'permission','A gestão define as metas.');
 const {owner_id:owner,amount_cents:amount,expected_revision:revision}=body;
 if(!isUuid(owner)||!Number.isSafeInteger(amount)||amount<1||amount>999999999999
    ||!Number.isSafeInteger(revision)||revision<0)reject(400,'goal','Informe responsável, valor positivo em centavos e revisão válida.');
 const found=await db.query("SELECT id FROM vant.members WHERE tenant_id=$1 AND id=$2 AND active AND role IN ('seller','manager','owner')",[tenant,owner]);
 if(!found.rowCount)reject(404,'owner','Responsável ativo não encontrado.');
 const args=[tenant,owner,date,amount,member.id];
 const result=revision===0?
  await db.query(`INSERT INTO vant.revenue_goals(tenant_id,owner_id,month_start,amount_cents,updated_by)
   VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING revision`,args):
  await db.query(`UPDATE vant.revenue_goals SET amount_cents=$4,updated_by=$5,updated_at=now(),revision=revision+1
   WHERE tenant_id=$1 AND owner_id=$2 AND month_start=$3 AND revision=$6 RETURNING revision`,[...args,revision]);
 if(!result.rowCount)reject(409,'revision','Esta meta foi alterada. Recarregue a consulta.');
 await audit(db,tenant,member.id,'revenue.goal.saved',owner,requestId);
 return [revision===0?201:200,result.rows[0]];
}
