import {createHash} from 'node:crypto';
import {similarity,prospectVectors} from './prospect-model.mjs';
import {modelVersion} from './inference.mjs';
import {audit} from './db.mjs';
import {pagination,reject} from './http.mjs';
import {isUuid} from './security.mjs';

const ruleset='icp-v1';
const engine=ruleset+'@'+modelVersion;
const fields={segment:'segmento',region:'região',size_band:'porte',business_activity:'atividade econômica'};
const accountFacts="jsonb_build_object('segment',a.segment,'region',a.location,'size_band',a.size_band,'business_activity',a.business_activity)";

export async function assessProspect(ctx,profile,account){
 const {db,tenant,member,requestId}=ctx;
 if(member.role==='viewer')reject(403,'permission','A classificação exige acesso de escrita.');
 await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))",['fit:'+tenant+':'+profile.id+':'+account]);
 const row=(await db.query(`SELECT ${accountFacts} AS facts FROM vant.accounts a JOIN vant.prospect_targets t
   ON t.tenant_id=a.tenant_id AND t.account_id=a.id WHERE t.tenant_id=$1 AND t.profile_id=$2 AND a.id=$3`,[tenant,profile.id,account])).rows[0];
 if(!row)reject(404,'missing','Empresa-alvo não encontrada.');
 const criteria=Object.keys(fields).filter(k=>profile[k]).map(key=>({key,wanted:profile[key],observed:row.facts[key]}));
 const inputHash=createHash('sha256').update(JSON.stringify([engine,profile.revision,row.facts,criteria])).digest('hex');
 const existing=(await db.query('SELECT id,score,result,model_version,created_at FROM vant.prospect_fits WHERE tenant_id=$1 AND profile_id=$2 AND account_id=$3 AND input_hash=$4',[tenant,profile.id,account,inputHash])).rows[0];
 if(existing)return [200,existing];
 const semantic=criteria.filter(c=>c.observed&&['segment','business_activity'].includes(c.key));
 if(semantic.length){
  const vectors=await prospectVectors(semantic.flatMap(c=>[c.wanted,c.observed]));
  semantic.forEach((c,i)=>{c.similarity=similarity(vectors[2*i],vectors[2*i+1]);});
 }
 for(const criterion of criteria){
  const observed=criterion.observed?.trim().toLocaleLowerCase('pt-BR'),wanted=criterion.wanted.toLocaleLowerCase('pt-BR');
  const contains=['region','business_activity'].includes(criterion.key);
  const matches=observed&&(contains?observed.includes(wanted):observed===wanted);
  criterion.method=!observed?'missing':matches?'match':criterion.similarity!==undefined?'semantic':'different';
  criterion.points=matches?100:Math.round(100*(criterion.similarity??0));
 }
 const score=Math.round(criteria.reduce((sum,c)=>sum+c.points,0)/criteria.length);
 const classification=score>=80?'Alta aderência':score>=50?'Aderência parcial':'Baixa aderência';
 const missing=criteria.filter(c=>c.method==='missing').map(c=>fields[c.key]);
 const approach=missing.length?'Confirmar '+missing.join(', ')+' com uma fonte antes de abordar a conta.':score>=80
  ?'Validar a necessidade comercial com um decisor registrado antes de propor uma reunião.'
  :'Revisar os critérios de menor aderência antes de priorizar a abordagem.';
 const result={criteria,classification,approach,ruleset};
 const saved=(await db.query(`INSERT INTO vant.prospect_fits(tenant_id,profile_id,account_id,profile_revision,account_facts,input_hash,engine_version,model_version,score,result,actor_id)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,score,result,model_version,created_at`,[tenant,profile.id,account,profile.revision,row.facts,inputHash,engine,semantic.length?modelVersion:null,score,result,member.id])).rows[0];
 await audit(db,tenant,member.id,'prospecting.fit.created',account,requestId);
 return [201,saved];
}

export async function priorities(ctx,profile){
 const {db,tenant,url}=ctx,limit=pagination(url.searchParams);
 const cursor=url.searchParams.get('cursor'),q=(url.searchParams.get('q')??'').trim();
 if(q.length>250)reject(400,'search','Busca muito longa.');
 let score=null,id=null;
 if(cursor!==null){
  const parts=cursor.split(':');
  if(parts.length!==2||!/^(-1|[0-9]|[1-9][0-9]|100)$/.test(parts[0])||!isUuid(parts[1]))reject(400,'cursor','Cursor inválido.');
  score=Number(parts[0]);id=parts[1];
 }
 const {rows}=await db.query(`SELECT a.id,a.name,t.source_reference,f.score,f.result,f.created_at,f.model_version
  FROM vant.prospect_targets t JOIN vant.accounts a ON (a.tenant_id,a.id)=(t.tenant_id,t.account_id)
  LEFT JOIN LATERAL (SELECT score,result,created_at,model_version FROM vant.prospect_fits
   WHERE tenant_id=t.tenant_id AND profile_id=t.profile_id AND account_id=t.account_id AND profile_revision=$3
    AND engine_version=$4 AND account_facts=${accountFacts} ORDER BY created_at DESC,id DESC LIMIT 1) f ON true
  WHERE t.tenant_id=$1 AND t.profile_id=$2 AND strpos(lower(a.name),lower($5))>0
   AND ($6::integer IS NULL OR coalesce(f.score,-1)<$6 OR (coalesce(f.score,-1)=$6 AND a.id>$7::uuid))
  ORDER BY coalesce(f.score,-1) DESC,a.id LIMIT $8`,[tenant,profile.id,profile.revision,engine,q,score,id,limit+1]);
 const items=rows.slice(0,limit),last=items.at(-1);
 return [200,{items,nextCursor:rows.length>limit?(last.score??-1)+':'+last.id:null}];
}
