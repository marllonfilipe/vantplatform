import {activityReport} from './revenue-activities.mjs';
import {retrieveKnowledge} from './knowledge.mjs';
import {lastDealTouch} from './deal-context.mjs';
import {similarity} from './prospect-model.mjs';
import {embed} from './inference.mjs';
import {reject,textField} from './http.mjs';
import {audit} from './db.mjs';

export const scopedDeals=`SELECT d.*,coalesce(a.segment,l.segment) AS segment
   FROM vant.deals d
   LEFT JOIN vant.leads l ON (l.tenant_id,l.id)=(d.tenant_id,d.lead_id)
   LEFT JOIN vant.accounts a ON (a.tenant_id,a.id)=(d.tenant_id,coalesce(d.account_id,l.account_id))
   WHERE d.tenant_id=$1 AND ($4::uuid IS NULL OR d.owner_id=$4)
    AND ($5::text IS NULL OR lower(d.source)=lower($5))
    AND ($6::uuid IS NULL OR d.team_id=$6)
    AND ($8::text IS NULL OR lower(coalesce(a.segment,l.segment))=lower($8))
    AND ($9::text IS NULL OR d.sales_channel=$9)`;

export async function executiveBrief({db,tenant,member,requestId,body},filters,report){
 const focus=textField(body.focus??'Revisar riscos, oportunidades e prioridades da gestão comercial',240);
 const {rows:[snapshot]}=await db.query(`WITH scoped AS NOT MATERIALIZED (${scopedDeals}),
  dates AS (SELECT $2::date AS first,$3::date AS last,(now() AT TIME ZONE 'America/Sao_Paulo')::date AS today),
  previous AS (
   SELECT count(*)::integer AS closed,count(*) FILTER(WHERE status='won')::integer AS won,
    coalesce(sum(amount_cents) FILTER(WHERE status='won'),0)::text AS revenue_cents
   FROM scoped d CROSS JOIN dates b WHERE d.status IN ('won','lost')
    AND ($7::uuid IS NULL OR d.pipeline_id=$7)
    AND d.closed_at>=((b.first-(b.last-b.first+1))::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND d.closed_at<(b.first::timestamp AT TIME ZONE 'America/Sao_Paulo') AND d.closed_at<=now()
  ), open_deals AS (
   SELECT d.id,d.name,d.amount_cents,d.probability,d.close_on,
    round(d.amount_cents*d.probability/100.0)::text AS weighted_cents,
    (b.today-(${lastDealTouch} AT TIME ZONE 'America/Sao_Paulo')::date) AS quiet_days,
    coalesce(d.close_on<b.today,false) AS overdue
   FROM scoped d CROSS JOIN dates b WHERE d.status='open' AND ($7::uuid IS NULL OR d.pipeline_id=$7)
  ) SELECT now() AS observed_at,b.last<b.today AS complete_period,(b.first-(b.last-b.first+1)) AS previous_from,
   b.first-1 AS previous_to,to_jsonb(p) AS previous,
   (SELECT count(*)::int FROM open_deals WHERE quiet_days>=14 OR overdue) AS at_risk,
   (SELECT to_jsonb(o) FROM open_deals o WHERE overdue OR quiet_days>=14
    ORDER BY overdue DESC,quiet_days DESC,id LIMIT 1) AS risk_example,
   (SELECT to_jsonb(o) FROM open_deals o WHERE amount_cents>0 AND probability>0
    ORDER BY round(amount_cents*probability/100.0) DESC,id LIMIT 1) AS potential
   FROM dates b CROSS JOIN previous p`,filters);
 const t=report.total,previous=snapshot.previous;
 const change=snapshot.complete_period&&t.closed&&previous.closed?
  Number((100*(t.won/t.closed-previous.won/previous.closed)).toFixed(2)):null;
 const previousActivities=snapshot.complete_period?
  (await activityReport(db,[tenant,snapshot.previous_from,snapshot.previous_to,...filters.slice(3)])).total:null;
 const pending=report.activities.total.pending;
 const priorities=[];
 if(snapshot.risk_example){
  const d=snapshot.risk_example;
  priorities.push({title:'Revisar negociação aberta',evidence:d.name+' · '+(d.overdue?'fechamento previsto vencido':d.quiet_days+' dias sem movimento'),
   action:'Confirmar o impedimento e registrar o próximo passo com o responsável.'});
 }
 if(change!==null&&change<0)priorities.push({title:'Investigar a queda de conversão',evidence:t.won+' de '+t.closed+' ganhos no período, contra '+previous.won+' de '+previous.closed+' no anterior.',
  action:'Revisar os motivos de perda e as passagens entre etapas com a equipe.'});
 if(previousActivities&&report.activities.total.completed<previousActivities.completed){
  priorities.push({title:'Revisar queda nas atividades concluídas',evidence:report.activities.total.completed+' conclusões no período e '+previousActivities.completed+' no período anterior.',
   action:'Verificar a distribuição da agenda por responsável e tipo antes de atribuir uma causa.'});
 }
 if(pending)priorities.push({title:'Revisar vencimentos',evidence:pending+' atividades vencidas no período estavam abertas no corte.',
  action:'Conferir o estado atual dessas atividades e atribuir os acompanhamentos necessários.'});
 if(snapshot.potential)priorities.push({title:'Avaliar oportunidade de maior valor ponderado',evidence:snapshot.potential.name+' · probabilidade informada de '+snapshot.potential.probability+'%.',
  action:'Validar o valor e a data da decisão com o responsável antes de atualizar a previsão.'});
 if(priorities.length){
  let encoded;
  try{encoded=await embed([focus,...priorities.map(p=>p.title+'. '+p.action)]);}
  catch(error){reject(error.code==='model_busy'?429:503,'model_unavailable','Inferência local indisponível.');}
  const [query,...signals]=encoded.vectors;
  priorities.forEach((p,i)=>{p.relevance=similarity(query,signals[i]);});
  priorities.sort((a,b)=>b.relevance-a.relevance);
 }
 const topic=priorities[0];
 const memory=await retrieveKnowledge(db,tenant,topic?focus+'. '+topic.title+'. '+topic.action:focus,3);
 await audit(db,tenant,member.id,'revenue.executive.generated',null,requestId);
 return {period:report.period,total:t,observed_at:snapshot.observed_at,previous_from:snapshot.previous_from,previous_to:snapshot.previous_to,
  focus,previous,completed_activities:report.activities.total.completed,previous_activities:previousActivities?.completed??null,complete_period:snapshot.complete_period,change_pp:change,at_risk:snapshot.at_risk,potential:snapshot.potential,
  priorities,model:memory.model,references:memory.items.filter(item=>item.similarity>=0.55)};
}
