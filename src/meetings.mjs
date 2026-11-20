import {audit} from './db.mjs';
import {reject} from './http.mjs';
import {isUuid} from './security.mjs';
import {retrieveKnowledge} from './knowledge.mjs';

export async function meetingRoutes({db,tenant,member,requestId,url,method}){
 const match=/^\/api\/v1\/agents\/meetings\/([^/]+)\/briefs$/.exec(url.pathname);
 if(!match || !isUuid(match[1]) || !['POST','GET'].includes(method))return;
 const id=match[1];
 const owner=member.role==='seller'?member.id:null;
 const meeting=(await db.query(`SELECT id,title,lead_id,deal_id,due_at,done_at,owner_id FROM vant.activities
   WHERE tenant_id=$1 AND id=$2 AND kind='meeting' AND ($3::uuid IS NULL OR owner_id=$3)`,[tenant,id,owner])).rows[0];
 if(!meeting)reject(404,'missing','Reunião não encontrada.');
 if(method==='GET'){
   const {rows}=await db.query(`SELECT id,created_at,model_version,inference_ms,result FROM vant.meeting_briefs
     WHERE tenant_id=$1 AND activity_id=$2 AND ($3::uuid IS NULL OR actor_id=$3)
     ORDER BY created_at DESC,id DESC LIMIT 10`,[tenant,id,owner]);
   return [200,{items:rows}];
 }
 if(member.role==='viewer')reject(403,'permission','Perfil de leitura.');
 const lead=(await db.query(`SELECT id,name,stated_need,stated_objection,budget_state,purchase_window,purchase_intent
   FROM vant.leads WHERE tenant_id=$1 AND id=$2 AND ($3::uuid IS NULL OR owner_id=$3)`,[tenant,meeting.lead_id,owner])).rows[0];
 const deal=(await db.query(`SELECT id,name,products,amount_cents,probability,close_on,status FROM vant.deals
   WHERE tenant_id=$1 AND id=$2 AND ($3::uuid IS NULL OR owner_id=$3)`,[tenant,meeting.deal_id,owner])).rows[0];
 const {rows:history}=await db.query(`SELECT id,title,kind,done_at FROM vant.activities
   WHERE tenant_id=$1 AND id<>$2 AND (lead_id=$3 OR deal_id=$4) AND done_at<=now() AND ($5::uuid IS NULL OR owner_id=$5)
   ORDER BY done_at DESC,id LIMIT 5`,[tenant,id,lead?.id??null,deal?.id??null,owner]);
 const questions=[];
 if(!lead?.stated_need)questions.push('Qual problema precisa ser resolvido e como medir o resultado?');
 if(!lead || lead.budget_state==='unknown' || lead.budget_state==='unconfirmed')questions.push('Quem pode confirmar o orçamento disponível?');
 if(!lead || lead.purchase_window==='unknown')questions.push('Qual é o prazo esperado para tomar a decisão?');
 if(lead?.stated_objection)questions.push('O que seria necessário para resolver a objeção registrada?');
 if(!questions.length)questions.push('Qual próximo passo e quem ficará responsável?');
 const query=[lead?.stated_need,deal?.products,meeting.title].filter(Boolean).join(' ').slice(0,320);
 const memory=await retrieveKnowledge(db,tenant,query,3);
 const sources=memory.items.map(({document_id,title,revision,chunk_index,similarity})=>({document_id,title,revision,chunk_index,similarity}));
 const result={meeting:{id,title:meeting.title,due_at:meeting.due_at},lead:lead??null,deal:deal??null,history,questions,sources};
 const {rows}=await db.query(`INSERT INTO vant.meeting_briefs(tenant_id,activity_id,actor_id,model_version,inference_ms,result)
   VALUES($1,$2,$3,$4,$5,$6) RETURNING id,created_at,model_version,inference_ms,result`,[tenant,id,member.id,memory.model,memory.latencyMs,result]);
 await audit(db,tenant,member.id,'agent.meeting.prepared',id,requestId);
 return [201,rows[0]];
}
