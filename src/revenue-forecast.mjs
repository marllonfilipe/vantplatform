import {reject} from './http.mjs';

export async function forecastRoutes({db,tenant,member,url,method}){
 if(method!=='GET'||url.pathname!=='/api/v1/revenue/forecast')return;
 const days=Number(url.searchParams.get('days')??30);
 if(![30,60,90].includes(days))reject(400,'days','Escolha 30, 60 ou 90 dias.');
 const owner=member.role==='seller'?member.id:null;
 const {rows}=await db.query(`WITH bounds AS (
   SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today
  ), portfolio AS (
   SELECT d.amount_cents,d.probability,p.name AS pipeline,s.name AS stage,s.id AS stage_id,
    CASE WHEN d.close_on IS NULL THEN 'undated' WHEN d.close_on<b.today THEN 'overdue'
     WHEN d.close_on<b.today+$3::int THEN 'within' ELSE 'later' END AS bucket
   FROM vant.deals d JOIN vant.stages s ON (s.tenant_id,s.pipeline_id,s.id)=(d.tenant_id,d.pipeline_id,d.stage_id)
   JOIN vant.pipelines p ON (p.tenant_id,p.id)=(d.tenant_id,d.pipeline_id)
   CROSS JOIN bounds b WHERE d.tenant_id=$1 AND d.status='open' AND ($2::uuid IS NULL OR d.owner_id=$2)
  ), totals AS (
   SELECT bucket,stage_id,pipeline,stage,count(*)::int AS deals,sum(amount_cents)::text AS value_cents,
    sum(round(amount_cents*probability/100.0))::text AS weighted_cents
   FROM portfolio GROUP BY GROUPING SETS ((bucket),(bucket,stage_id,pipeline,stage))
  )
  SELECT b.today,b.today+$3::int-1 AS through,t.* FROM bounds b LEFT JOIN totals t ON true
  ORDER BY t.bucket,t.pipeline NULLS FIRST,t.stage,t.stage_id`,[tenant,owner,days]);
 return [200,{from:rows[0].today,to:rows[0].through,days,
  coverage:rows.filter(r=>r.bucket&&!r.stage_id),stages:rows.filter(r=>r.bucket==='within'&&r.stage_id)}];
}
