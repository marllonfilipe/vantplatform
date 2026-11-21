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
 const {rows}=await db.query(`WITH cohort AS (
   SELECT d.id,d.status,d.amount_cents,d.owner_id,m.name AS seller,d.source,d.loss_reason,s.id AS stage_id,
    p.id AS pipeline_id,p.name AS pipeline,d.team_id,t.name AS team,
    coalesce(a.segment,l.segment) AS segment,p.name||' · '||s.name AS stage,extract(epoch FROM (d.closed_at-d.created_at))/86400 AS cycle
   FROM vant.deals d JOIN vant.members m ON (m.tenant_id,m.id)=(d.tenant_id,d.owner_id)
   JOIN vant.stages s ON (s.tenant_id,s.pipeline_id,s.id)=(d.tenant_id,d.pipeline_id,d.stage_id)
   JOIN vant.pipelines p ON (p.tenant_id,p.id)=(d.tenant_id,d.pipeline_id)
   LEFT JOIN vant.teams t ON (t.tenant_id,t.id)=(d.tenant_id,d.team_id)
   LEFT JOIN vant.leads l ON (l.tenant_id,l.id)=(d.tenant_id,d.lead_id)
   LEFT JOIN vant.accounts a ON (a.tenant_id,a.id)=(d.tenant_id,coalesce(d.account_id,l.account_id))
   WHERE d.tenant_id=$1 AND d.status IN ('won','lost') AND d.closed_at<=now()
    AND d.closed_at>=($2::date::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND d.closed_at<(($3::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND ($4::uuid IS NULL OR d.owner_id=$4) AND ($5::text IS NULL OR lower(d.source)=lower($5))
    AND ($6::uuid IS NULL OR d.team_id=$6) AND ($7::uuid IS NULL OR d.pipeline_id=$7)
    AND ($8::text IS NULL OR lower(coalesce(a.segment,l.segment))=lower($8))
  )
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
  WHERE dim.kind<>'loss' OR c.status='lost' GROUP BY dim.kind,dim.id,dim.label ORDER BY dim.kind,dim.label,dim.id`,
  [tenant,period.from,period.to,member.role==='seller'?member.id:seller,origin===null?null:textField(origin,250),team,pipeline,segment===null?null:textField(segment,250)]);
 const empty={closed:0,won:0,lost:0,revenue_cents:'0',average_ticket_cents:null,average_cycle_days:null,cycle_sample:0,conversion_pct:null};
 return [200,{period,total:rows.find(r=>r.kind==='total')??empty,groups:rows.filter(r=>r.kind!=='total')}];
}
