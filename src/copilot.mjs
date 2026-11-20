import {contactReference,maySuggestFollowup} from './followup.mjs';
import {lastDealTouch} from './deal-context.mjs';
import {questions} from '../public/copilot-questions.js';
import {audit} from './db.mjs';
import {reject,textField} from './http.mjs';
import {embed,modelVersion} from './inference.mjs';

const labels=Object.entries(questions).flatMap(([intent,phrases])=>phrases.map(phrase=>({intent,phrase})));
let templates;
async function classify(question){
  if(!templates)templates=embed(labels.map(label=>label.phrase)).then(result=>result.vectors).catch(error=>{templates=undefined;throw error;});
  const [references,encoded]=await Promise.all([templates,embed([question])]);
  const scores=new Map();
  for(const [index,vector] of references.entries()){
    const score=vector.reduce((sum,value,dimension)=>sum+value*encoded.vectors[0][dimension],0);
    const intent=labels[index].intent;
    scores.set(intent,Math.max(scores.get(intent)??-1,score));
  }
  const ordered=[...scores].sort((a,b)=>b[1]-a[1]);
  const [[intent,score],[,second]]=ordered;
  return score>=0.60 && score-second>=0.04 ? intent : null;
}

// O painel usa o início do dia em São Paulo e inclui o dia atual no período.
const periodStart = "((now() AT TIME ZONE 'America/Sao_Paulo')::date-29)::timestamp AT TIME ZONE 'America/Sao_Paulo'";
const reads={
 inactive_leads:`SELECT l.id,l.name,${contactReference} AS reference_at,
   floor(extract(epoch FROM now()-(${contactReference}))/86400)::integer AS quiet_days
   FROM vant.leads l WHERE l.tenant_id=$1 AND ($2::uuid IS NULL OR l.owner_id=$2)
   AND ${maySuggestFollowup} ORDER BY reference_at,l.id LIMIT 10`,
 conversion:`SELECT m.id,m.name,count(*)::int AS closed_count,count(*) FILTER (WHERE d.status='won')::int AS won_count,
     round(100.0*count(*) FILTER(WHERE d.status='won')/count(*),1) AS conversion
   FROM vant.deals d JOIN vant.members m ON (m.tenant_id,m.id)=(d.tenant_id,d.owner_id)
   WHERE d.tenant_id=$1 AND ($2::uuid IS NULL OR d.owner_id=$2) AND d.status IN ('won','lost') AND d.closed_at>=${periodStart}
   GROUP BY m.id,m.name ORDER BY count(*) FILTER (WHERE d.status='won')::numeric/count(*),count(*) DESC,m.name,m.id LIMIT 10`,
 executive:`SELECT count(*) FILTER (WHERE status='open')::int AS open_count,
     coalesce(sum(amount_cents) FILTER (WHERE status='open'),0)::text AS pipeline_cents,
     coalesce(round(sum(amount_cents*probability/100.0) FILTER (WHERE status='open')),0)::text AS weighted_cents,
     coalesce(sum(amount_cents) FILTER (WHERE status='won' AND closed_at>=${periodStart}),0)::text AS won_cents,
     count(*) FILTER (WHERE status IN ('won','lost') AND closed_at>=${periodStart})::int AS closed_count,
     round(100.0*count(*) FILTER (WHERE status='won' AND closed_at>=${periodStart})/
       nullif(count(*) FILTER (WHERE status IN ('won','lost') AND closed_at>=${periodStart}),0),1) AS conversion
   FROM vant.deals WHERE tenant_id=$1 AND ($2::uuid IS NULL OR owner_id=$2)`,
 leads:`SELECT l.id,l.name,r.created_at AS analyzed_at,(r.result->>'score')::integer AS score,r.result->>'nextAction' AS detail
   FROM vant.leads l JOIN LATERAL (
     SELECT result,created_at FROM vant.core_runs WHERE tenant_id=l.tenant_id AND subject_kind='lead' AND subject_id=l.id ORDER BY created_at DESC,id DESC LIMIT 1
   ) r ON true WHERE l.tenant_id=$1 AND ($2::uuid IS NULL OR l.owner_id=$2)
   ORDER BY score DESC,r.created_at DESC,l.id LIMIT 10`,
 risks:`SELECT d.id,d.name,r.created_at AS analyzed_at,r.result->>'classification' AS risk,r.result->>'nextAction' AS detail
   FROM vant.deals d JOIN LATERAL (
     SELECT result,created_at FROM vant.core_runs WHERE tenant_id=d.tenant_id AND subject_kind='deal' AND subject_id=d.id ORDER BY created_at DESC,id DESC LIMIT 1
   ) r ON true WHERE d.tenant_id=$1 AND ($2::uuid IS NULL OR d.owner_id=$2) AND d.status='open'
   AND r.result->>'classification' IN ('Risco elevado','Requer atenção')
   ORDER BY (r.result->>'classification'='Risco elevado') DESC,r.created_at DESC,d.id LIMIT 10`,
 stalled:`SELECT d.id,d.name,activity.last_touch,current_date-activity.last_touch::date AS days_stalled
   FROM vant.deals d CROSS JOIN LATERAL (SELECT ${lastDealTouch} AS last_touch) activity
   WHERE d.tenant_id=$1 AND ($2::uuid IS NULL OR d.owner_id=$2) AND d.status='open'
     AND current_date-activity.last_touch::date>=14 ORDER BY activity.last_touch,d.id LIMIT 10`,
 followups:`SELECT id,title AS name,due_at FROM vant.activities WHERE tenant_id=$1 AND ($2::uuid IS NULL OR owner_id=$2)
   AND kind='followup' AND done_at IS NULL AND due_at<now() ORDER BY due_at,id LIMIT 10`
};

export async function copilotRoutes({db,tenant,member,requestId,url,method,body}){
  if(url.pathname!=='/api/v1/agents/copilot'||method!=='POST')return;
  const question=textField(body.question,320);
  let intent;
  try{intent=await classify(question);}
  catch(error){
    if(error.code==='model_busy')reject(429,'model_busy','Fila do modelo cheia.');
    reject(503,'model_unavailable','Inferência local indisponível.');
  }
  if(!intent)return [200,{intent:null,items:[],model:modelVersion}];
  const personal=member.role==='seller'||(member.role==='viewer'&&['conversion','executive'].includes(intent));
  const owner=personal?member.id:null;
  const {rows}=await db.query(reads[intent],[tenant,owner]);
  await audit(db,tenant,member.id,'copilot.query.'+intent,null,requestId);
  return [200,{intent,items:rows,model:modelVersion}];
}
