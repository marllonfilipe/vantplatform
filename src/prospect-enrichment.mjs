import {createHash} from 'node:crypto';
import {audit} from './db.mjs';
import {updateProspectAccount} from './crm.mjs';
import {pagination,reject} from './http.mjs';
import {isUuid} from './security.mjs';

export async function suggestMissing(ctx,account,incoming,source){
 let added=0;
 for(const field of ['segment','location','size_band','business_activity','website']){
  const value=incoming[field];
  if(!value||account[field]?.trim())continue;
  const digest=createHash('sha256').update(JSON.stringify([field,value,source])).digest('hex');
  const row=await ctx.db.query(`INSERT INTO vant.prospect_enrichments(tenant_id,account_id,fingerprint,field,proposed_value,source_reference,created_by)
   VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,account_id,fingerprint) DO NOTHING`,[ctx.tenant,account.id,digest,field,value,source,ctx.member.id]);
  added+=row.rowCount;
 }
 return added;
}

export async function enrichmentRoutes(ctx,profile,account,parts){
 const {db,tenant,member,url,method,requestId}=ctx;
 const selected=await db.query('SELECT 1 FROM vant.prospect_targets WHERE tenant_id=$1 AND profile_id=$2 AND account_id=$3',[tenant,profile.id,account]);
 if(!selected.rowCount)reject(404,'missing','Empresa-alvo não encontrada.');
 if(!parts.length&&method==='GET'){
  const limit=pagination(url.searchParams),cursor=url.searchParams.get('cursor');
  if(cursor!==null&&!isUuid(cursor))reject(400,'cursor','Cursor inválido.');
  const {rows}=await db.query('SELECT id,field,proposed_value,source_reference,created_at,state,decided_at FROM vant.prospect_enrichments WHERE tenant_id=$1 AND account_id=$2 AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4',[tenant,account,cursor,limit+1]);
  const items=rows.slice(0,limit);return [200,{items,nextCursor:rows.length>limit?items.at(-1).id:null}];
 }
 const [id,action]=parts;
 if(method!=='POST'||parts.length!==2||!isUuid(id)||!['apply','dismiss'].includes(action))reject(404,'missing','Operação não encontrada.');
 if(member.role==='viewer')reject(403,'permission','A revisão exige acesso de escrita.');
 const current=(await db.query('SELECT * FROM vant.accounts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenant,account])).rows[0];
 const candidate=(await db.query('SELECT * FROM vant.prospect_enrichments WHERE tenant_id=$1 AND account_id=$2 AND id=$3 FOR UPDATE',[tenant,account,id])).rows[0];
 if(!candidate)reject(404,'missing','Sugestão não encontrada.');
 if(candidate.state!=='pending')return [200,{state:candidate.state}];
 let state='dismissed';
 if(action==='apply'){
  const value=current[candidate.field];
  if(value===candidate.proposed_value)state='already_present';
  else if(value?.trim())state='obsolete';
  else{
   await updateProspectAccount(ctx,current,{[candidate.field]:candidate.proposed_value});state='applied';
  }
 }
 await db.query('UPDATE vant.prospect_enrichments SET state=$4,decided_at=now(),decided_by=$5 WHERE tenant_id=$1 AND account_id=$2 AND id=$3',[tenant,account,id,state,member.id]);
 await audit(db,tenant,member.id,'prospecting.enrichment.'+state,id,requestId);
 return [200,{state}];
}
