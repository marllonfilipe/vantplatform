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

const reads={
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
  const owner=member.role==='seller'?member.id:null;
  const {rows}=await db.query(reads[intent],[tenant,owner]);
  await audit(db,tenant,member.id,'copilot.query.'+intent,null,requestId);
  return [200,{intent,items:rows,model:modelVersion}];
}
