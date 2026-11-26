import {activityReport} from './revenue-activities.mjs';
import {reject,textField} from './http.mjs';
import {isUuid} from './security.mjs';

function calendarDate(value){
 if(value===null)return null;
 if(value.startsWith('0000-')||!/^\d{4}-\d{2}-\d{2}$/.test(value))reject(400,'period','Data inválida.');
 const date=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value)reject(400,'period','Data inválida.');
 return value;
}
export async function revenueRoutes({db,tenant,member,url,method}){
 if(url.pathname!=='/api/v1/revenue/closed'||method!=='GET')return;
 const from=calendarDate(url.searchParams.get('from')),to=calendarDate(url.searchParams.get('to'));
 if((from===null)!==(to===null)||from&&from>to)reject(400,'period','Informe um intervalo de datas válido.');
 const seller=url.searchParams.get('seller'),origin=url.searchParams.get('source');
 if(seller!==null&&!isUuid(seller))reject(400,'seller','Vendedor inválido.');
 if(member.role==='seller'&&seller&&seller!==member.id)reject(403,'permission','O vendedor consulta sua própria carteira.');
 const team=url.searchParams.get('team'),pipeline=url.searchParams.get('pipeline'),segment=url.searchParams.get('segment');
 if((team!==null&&!isUuid(team))||(pipeline!==null&&!isUuid(pipeline)))reject(400,'filter','Equipe ou pipeline inválido.');
 const period=(await db.query(`SELECT coalesce($1::date,(now() AT TIME ZONE 'America/Sao_Paulo')::date-29) AS "from",
   coalesce($2::date,(now() AT TIME ZONE 'America/Sao_Paulo')::date) AS "to"`,[from,to])).rows[0];
 const filters=[tenant,period.from,period.to,member.role==='seller'?member.id:seller,origin===null?null:textField(origin,250),team,pipeline,segment===null?null:textField(segment,250)];
 const {rows:[report]}=await db.query(`WITH scoped AS NOT MATERIALIZED (
   SELECT d.*,coalesce(a.segment,l.segment) AS segment
   FROM vant.deals d
   LEFT JOIN vant.leads l ON (l.tenant_id,l.id)=(d.tenant_id,d.lead_id)
   LEFT JOIN vant.accounts a ON (a.tenant_id,a.id)=(d.tenant_id,coalesce(d.account_id,l.account_id))
   WHERE d.tenant_id=$1 AND ($4::uuid IS NULL OR d.owner_id=$4)
    AND ($5::text IS NULL OR lower(d.source)=lower($5))
    AND ($6::uuid IS NULL OR d.team_id=$6)
    AND ($8::text IS NULL OR lower(coalesce(a.segment,l.segment))=lower($8))
  ), cohort AS (
   SELECT d.id,d.status,d.amount_cents,d.owner_id,m.name AS seller,d.source,d.loss_reason,s.id AS stage_id,
    p.id AS pipeline_id,p.name AS pipeline,d.team_id,t.name AS team,
    d.segment,p.name||' · '||s.name AS stage,extract(epoch FROM (d.closed_at-d.created_at))/86400 AS cycle
   FROM scoped d JOIN vant.members m ON (m.tenant_id,m.id)=(d.tenant_id,d.owner_id)
   JOIN vant.stages s ON (s.tenant_id,s.pipeline_id,s.id)=(d.tenant_id,d.pipeline_id,d.stage_id)
   JOIN vant.pipelines p ON (p.tenant_id,p.id)=(d.tenant_id,d.pipeline_id)
   LEFT JOIN vant.teams t ON (t.tenant_id,t.id)=(d.tenant_id,d.team_id)
   WHERE d.status IN ('won','lost') AND d.closed_at<=now()
    AND d.closed_at>=($2::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND d.closed_at<(($3::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND ($7::uuid IS NULL OR d.pipeline_id=$7)
  ), metrics AS (
  SELECT dim.kind,dim.id,dim.label,count(*)::integer AS closed,
   count(*) FILTER(WHERE status='won')::integer AS won,count(*) FILTER(WHERE status='lost')::integer AS lost,
   coalesce(sum(amount_cents) FILTER(WHERE status='won'),0)::text AS revenue_cents,
   round(avg(amount_cents) FILTER(WHERE status='won'))::text AS average_ticket_cents,
   round(avg(cycle) FILTER(WHERE status='won' AND cycle>=0),2)::text AS average_cycle_days,
   count(*) FILTER(WHERE status='won' AND cycle>=0)::integer AS cycle_sample,
   round(100.0*count(*) FILTER(WHERE status='won')/count(*),2)::text AS conversion_pct
  FROM cohort c CROSS JOIN LATERAL (VALUES
   ('total',null::text,'Total'),('seller',c.owner_id::text,c.seller),
   ('source',c.source,coalesce(c.source,'Sem origem informada')),('stage',c.stage_id::text,c.stage),
   ('pipeline',c.pipeline_id::text,c.pipeline),('team',c.team_id::text,coalesce(c.team,'Sem equipe atribuída')),
   ('segment',c.segment,coalesce(c.segment,'Sem segmento informado')),('loss',c.loss_reason,coalesce(c.loss_reason,'Sem motivo informado'))) dim(kind,id,label)
  WHERE dim.kind<>'loss' OR c.status='lost' GROUP BY dim.kind,dim.id,dim.label
  ), changes AS (
   SELECT h.record_id,h.id,h.created_at,h.changes->'stage_id'->>'to' AS stage,
    h.changes->'stage_id'->>'from' AS previous
   FROM vant.crm_history h JOIN scoped d ON d.id=h.record_id AND d.tenant_id=h.tenant_id
   WHERE h.kind='deals' AND h.action IN ('created','updated')
    AND h.created_at>=($2::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND h.created_at<(($3::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo') AND h.created_at<=now()
    AND h.changes->'stage_id'->>'to' IS NOT NULL
    AND (h.changes->'stage_id'->>'from') IS DISTINCT FROM (h.changes->'stage_id'->>'to')
  ), visits AS (
   SELECT stage,lead(stage) OVER sequence AS next_stage,lead(previous) OVER sequence AS next_from,
    row_number() OVER (PARTITION BY record_id,stage ORDER BY created_at,id) AS visit
   FROM changes WINDOW sequence AS (PARTITION BY record_id ORDER BY created_at,id)
  ), paths AS (
   SELECT s.id AS stage_id,p.name||' · '||s.name AS label,dest.id AS destination_id,
    dp.name||' · '||dest.name AS destination,count(*)::int AS deals
   FROM visits v JOIN vant.stages s ON s.tenant_id=$1 AND s.id::text=v.stage
   JOIN vant.pipelines p ON (p.tenant_id,p.id)=(s.tenant_id,s.pipeline_id)
   LEFT JOIN vant.stages dest ON dest.tenant_id=$1 AND dest.id::text=v.next_stage AND v.next_from=v.stage
   LEFT JOIN vant.pipelines dp ON (dp.tenant_id,dp.id)=(dest.tenant_id,dest.pipeline_id)
   WHERE v.visit=1 AND ($7::uuid IS NULL OR s.pipeline_id=$7)
   GROUP BY s.id,p.name,s.name,dest.id,dp.name,dest.name
  ), transitions AS (
   SELECT stage_id,label,sum(deals)::int AS entered,
    coalesce(sum(deals) FILTER (WHERE destination_id IS NOT NULL),0)::int AS moved,
    coalesce(jsonb_agg(jsonb_build_object('id',destination_id,'label',destination,'deals',deals)
     ORDER BY destination,destination_id) FILTER (WHERE destination_id IS NOT NULL),'[]') AS destinations
   FROM paths GROUP BY stage_id,label
  )
  SELECT coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.kind,m.label,m.id) FROM metrics m),'[]') AS metrics,
   coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.label,t.stage_id) FROM transitions t),'[]') AS transitions`,
  filters);
 const empty={closed:0,won:0,lost:0,revenue_cents:'0',average_ticket_cents:null,average_cycle_days:null,cycle_sample:0,conversion_pct:null};
 return [200,{period,total:report.metrics.find(r=>r.kind==='total')??empty,groups:report.metrics.filter(r=>r.kind!=='total'),transitions:report.transitions,activities:await activityReport(db,filters)}];
}
