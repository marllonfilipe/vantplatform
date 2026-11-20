import {createHash} from 'node:crypto';
import {assessProspect} from './prospect-fit.mjs';
import {prospectVectors,similarity} from './prospect-model.mjs';
import {modelVersion} from './inference.mjs';
import {audit} from './db.mjs';
import {reject} from './http.mjs';

export async function prospectBriefs(ctx,profile,account){
 const {tenant,db,member,method,requestId}=ctx;
 const target=(await db.query('SELECT source_reference FROM vant.prospect_targets WHERE tenant_id=$1 AND profile_id=$2 AND account_id=$3',[tenant,profile.id,account])).rows[0];
 if(!target)reject(404,'missing','Empresa-alvo não encontrada.');
 if(method==='GET'){
  const {rows}=await db.query('SELECT id,result,model_version,created_at FROM vant.prospect_briefs WHERE tenant_id=$1 AND profile_id=$2 AND account_id=$3 ORDER BY created_at DESC,id DESC LIMIT 10',[tenant,profile.id,account]);
  return [200,{items:rows}];
 }
 if(method!=='POST')reject(405,'method','Método inválido.');
 const [,fit]=await assessProspect(ctx,profile,account);
 const {rows:people}=await db.query(`SELECT c.id,c.name,c.title,c.decision_maker,p.source_reference,p.observed_on,
   count(*) OVER()::integer AS total FROM vant.contacts c LEFT JOIN vant.prospect_people p ON (p.tenant_id,p.contact_id)=(c.tenant_id,c.id)
   WHERE c.tenant_id=$1 AND c.account_id=$2 ORDER BY c.decision_maker DESC,
   coalesce($3::text IS NOT NULL AND strpos(lower(c.title),lower($3))>0,false) DESC,p.observed_on DESC NULLS LAST,c.id LIMIT 30`,[tenant,account,profile.target_role]);
 const pipeline=(await db.query(`SELECT count(*) FILTER(WHERE status='open')::int AS open,count(*) FILTER(WHERE status='won')::int AS won,
   count(*) FILTER(WHERE status='lost')::int AS lost FROM vant.deals WHERE tenant_id=$1 AND account_id=$2`,[tenant,account])).rows[0];
 const hash=createHash('sha256').update(JSON.stringify(['brief-v1',modelVersion,fit.id,target.source_reference,people,pipeline])).digest('hex');
 const existing=(await db.query('SELECT id,result,model_version,created_at FROM vant.prospect_briefs WHERE tenant_id=$1 AND profile_id=$2 AND account_id=$3 AND input_hash=$4',[tenant,profile.id,account,hash])).rows[0];
 if(existing)return [200,existing];
 const titles=[...new Set(people.map(p=>p.title).filter(Boolean))],matches=new Map();
 if(profile.target_role&&titles.length){
  const [role,...vectors]=await prospectVectors([profile.target_role,...titles]);
  titles.forEach((title,i)=>matches.set(title,similarity(role,vectors[i])));
 }
 const candidates=people.map(({total,...p})=>({...p,similarity:matches.get(p.title)??null}))
  .filter(p=>p.decision_maker||(p.similarity??0)>=0.65)
  .sort((a,b)=>Number(b.decision_maker)-Number(a.decision_maker)||(b.similarity??-1)-(a.similarity??-1)||a.id.localeCompare(b.id)).slice(0,3);
 let signal,approach;
 if(pipeline.open){signal='Oportunidade em andamento';approach='Consultar o responsável pela oportunidade aberta antes de iniciar nova abordagem.';}
 else if(fit.score>=80&&candidates.length){
  signal=pipeline.lost?'Possível retomada':'Oportunidade potencial a validar';
  const first=candidates[0];
  approach=first.decision_maker?'Validar a necessidade com '+first.name+' e confirmar o próximo passo comercial.':'Confirmar se '+first.name+' participa da decisão antes de propor uma conversa.';
 }else{signal='Pesquisa complementar';approach=candidates.length?fit.result.approach:'Identificar e confirmar um contato relevante para a decisão.';}
 const result={signal,approach,pipeline,fit_score:fit.score,fit_id:fit.id,target_role:profile.target_role,
  source_reference:target.source_reference,candidates,reviewed:people.length,total_contacts:people[0]?.total??0};
 const saved=(await db.query(`INSERT INTO vant.prospect_briefs(tenant_id,profile_id,account_id,fit_id,input_hash,model_version,result,actor_id)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,result,model_version,created_at`,[tenant,profile.id,account,fit.id,hash,matches.size?modelVersion:null,result,member.id])).rows[0];
 await audit(db,tenant,member.id,'prospecting.brief.created',account,requestId);
 return [201,saved];
}
