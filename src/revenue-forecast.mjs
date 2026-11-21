import {reject} from './http.mjs';

export async function forecastRoutes({db,tenant,member,url,method}){
 if(method!=='GET'||url.pathname!=='/api/v1/revenue/forecast')return;
 const days=Number(url.searchParams.get('days')??30);
 if(![30,60,90].includes(days))reject(400,'days','Escolha 30, 60 ou 90 dias.');
 const owner=member.role==='seller'?member.id:null;
 const {rows}=await db.query(`WITH bounds AS (
   SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today
  ), portfolio AS (
   SELECT d.amount_cents,d.probability,p.id AS pipeline_id,p.name AS pipeline,s.name AS stage,s.id AS stage_id,
    extract(month FROM d.close_on)::integer AS close_month,
    b.today-(d.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS age_days,
    CASE WHEN d.close_on IS NULL THEN 'undated' WHEN d.close_on<b.today THEN 'overdue'
     WHEN d.close_on<b.today+$3::int THEN 'within' ELSE 'later' END AS bucket
   FROM vant.deals d JOIN vant.stages s ON (s.tenant_id,s.pipeline_id,s.id)=(d.tenant_id,d.pipeline_id,d.stage_id)
   JOIN vant.pipelines p ON (p.tenant_id,p.id)=(d.tenant_id,d.pipeline_id)
   CROSS JOIN bounds b WHERE d.tenant_id=$1 AND d.status='open' AND ($2::uuid IS NULL OR d.owner_id=$2)
  ), totals AS (
   SELECT bucket,stage_id,pipeline,stage,count(*)::int AS deals,sum(amount_cents)::text AS value_cents,
    sum(round(amount_cents*probability/100.0))::text AS weighted_cents
   FROM portfolio GROUP BY GROUPING SETS ((bucket),(bucket,stage_id,pipeline,stage))
  ), upcoming AS (
   SELECT pipeline_id,pipeline,close_month,count(*)::int AS open_count,sum(amount_cents) AS amount,
    round(avg(age_days) FILTER(WHERE age_days>=0),1) AS open_age_days
   FROM portfolio WHERE bucket='within' GROUP BY pipeline_id,pipeline,close_month
  ), history AS (
   SELECT d.pipeline_id,d.status,extract(month FROM d.closed_at AT TIME ZONE 'America/Sao_Paulo')::int AS month,
    extract(year FROM d.closed_at AT TIME ZONE 'America/Sao_Paulo')::int AS year,
    extract(epoch FROM d.closed_at-d.created_at)/86400 AS cycle_days
   FROM vant.deals d CROSS JOIN bounds b
   WHERE d.tenant_id=$1 AND ($2::uuid IS NULL OR d.owner_id=$2) AND d.status IN ('won','lost')
    AND d.closed_at>=((b.today-interval '3 years') AT TIME ZONE 'America/Sao_Paulo') AND d.closed_at<=now()
    AND d.pipeline_id IN (SELECT pipeline_id FROM upcoming)
  ), cohorts AS (
   SELECT pipeline_id,month,count(*)::int AS sample,count(*) FILTER(WHERE status='won')::int AS wins,
    count(DISTINCT year)::int AS years,round(avg(cycle_days) FILTER(WHERE status='won' AND cycle_days>=0),1) AS won_cycle_days
   FROM history GROUP BY GROUPING SETS ((pipeline_id,month),(pipeline_id))
  ), selected AS (
   SELECT u.*,coalesce(c.sample,0) AS sample,coalesce(c.wins,0) AS wins,c.won_cycle_days,
    CASE WHEN c.month IS NOT NULL THEN 'seasonal' WHEN c.sample>=10 THEN 'pipeline' ELSE 'insufficient' END AS basis
   FROM upcoming u LEFT JOIN LATERAL (
    SELECT * FROM cohorts c WHERE c.pipeline_id=u.pipeline_id
     AND (c.month IS NULL OR (c.month=u.close_month AND c.sample>=20 AND c.years>=2))
    ORDER BY c.month NULLS LAST LIMIT 1
   ) c ON true
  ), comparison AS (
   SELECT pipeline,close_month,open_count,open_age_days,sample,wins,won_cycle_days,basis,
    CASE WHEN basis<>'insufficient' THEN round(100.0*wins/sample,2) END AS observed_pct,
    CASE WHEN basis<>'insufficient' THEN round(amount*wins/sample)::text END AS scenario_cents
   FROM selected
  )
  SELECT b.today,b.today+$3::int-1 AS through,
   coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.bucket,t.pipeline,t.stage,t.stage_id) FROM totals t),'[]') AS totals,
   coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.pipeline,c.close_month) FROM comparison c),'[]') AS comparisons
   FROM bounds b`,[tenant,owner,days]);
 const result=rows[0];
 return [200,{from:result.today,to:result.through,days,comparisons:result.comparisons,
  coverage:result.totals.filter(r=>!r.stage_id),stages:result.totals.filter(r=>r.bucket==='within'&&r.stage_id)}];
}
