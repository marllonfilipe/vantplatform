import {audit} from './db.mjs';
import {pagination,reject,textField} from './http.mjs';
import {isUuid,mayManageTeams} from './security.mjs';

const base='/api/v1/prospecting/profiles';
const profileFields=['segment','region','size_band','business_activity'];

async function listAccounts(ctx,profile,selected){
 const {db,tenant,url}=ctx,limit=pagination(url.searchParams);
 const cursor=url.searchParams.get('cursor');
 if(cursor!==null&&!isUuid(cursor))reject(400,'cursor','Cursor inválido.');
 const q=(url.searchParams.get('q')??'').trim();
 if(q.length>250)reject(400,'search','Busca muito longa.');
 const result=await db.query(`SELECT a.id,a.name,a.website,a.segment,a.location,a.size_band,a.business_activity,
   t.source_reference,t.selected_at,
   (SELECT count(*)::integer FROM vant.contacts c WHERE c.tenant_id=a.tenant_id AND c.account_id=a.id AND c.decision_maker) AS decision_makers
   FROM vant.accounts a LEFT JOIN vant.prospect_targets t ON t.tenant_id=a.tenant_id AND t.account_id=a.id AND t.profile_id=$2
   WHERE a.tenant_id=$1 AND ($3::uuid IS NULL OR a.id>$3) AND strpos(lower(a.name),lower($4))>0
   AND CASE WHEN $5::boolean THEN t.account_id IS NOT NULL ELSE
    ($6::text IS NULL OR lower(a.segment)=lower($6)) AND ($7::text IS NULL OR strpos(lower(a.location),lower($7))>0)
    AND ($8::text IS NULL OR lower(a.size_band)=lower($8)) AND ($9::text IS NULL OR strpos(lower(a.business_activity),lower($9))>0) END
   ORDER BY a.id LIMIT $10`,[tenant,profile.id,cursor,q,selected,...profileFields.map(k=>profile[k]),limit+1]);
 const items=result.rows.slice(0,limit);
 return [200,{items,nextCursor:result.rowCount>limit?items.at(-1).id:null}];
}

export async function prospectingRoutes(ctx){
 const {db,tenant,member,url,method,body,requestId}=ctx;
 if(url.pathname!==base&&!url.pathname.startsWith(base+'/'))return;
 const parts=url.pathname===base?[]:url.pathname.slice(base.length+1).split('/');
 const [id,resource,accountId]=parts;
 if(parts.length>3||(parts.length&&!isUuid(id))||(parts.length===3&&!isUuid(accountId)))reject(404,'missing','Endereço de prospecção não encontrado.');
 if(parts.length===0&&method==='GET'){
  const limit=pagination(url.searchParams),cursor=url.searchParams.get('cursor');
  if(cursor!==null&&!isUuid(cursor))reject(400,'cursor','Cursor inválido.');
  const {rows}=await db.query('SELECT * FROM vant.prospect_profiles WHERE tenant_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',[tenant,cursor,limit+1]);
  const items=rows.slice(0,limit);
  return [200,{items,nextCursor:rows.length>limit?items.at(-1).id:null}];
 }
 if((parts.length===0&&method==='POST')||(parts.length===1&&method==='PUT')){
  if(!mayManageTeams(member.role))reject(403,'permission','A gestão define os perfis de cliente ideal.');
  const name=textField(body.name,120);
  const criteria=profileFields.map(k=>body[k]==null||body[k]===''?null:textField(body[k],250));
  if(criteria.every(v=>v===null))reject(400,'criteria','Informe pelo menos um critério de seleção.');
  let result;
  if(!id){
   result=await db.query('INSERT INTO vant.prospect_profiles(tenant_id,name,segment,region,size_band,business_activity) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[tenant,name,...criteria]);
  }else{
   if(!Number.isSafeInteger(body.expected_revision)||body.expected_revision<1)reject(400,'revision','Informe a revisão do perfil.');
   result=await db.query('UPDATE vant.prospect_profiles SET name=$2,segment=$3,region=$4,size_band=$5,business_activity=$6,revision=revision+1 WHERE tenant_id=$1 AND id=$7 AND revision=$8 RETURNING *',[tenant,name,...criteria,id,body.expected_revision]);
   if(!result.rowCount){
    const found=await db.query('SELECT id FROM vant.prospect_profiles WHERE tenant_id=$1 AND id=$2',[tenant,id]);
    if(!found.rowCount)reject(404,'missing','Perfil não encontrado.');
    reject(409,'revision','O perfil foi alterado. Recarregue a página.');
   }
  }
  await audit(db,tenant,member.id,id?'prospecting.profile.updated':'prospecting.profile.created',result.rows[0].id,requestId);
  return [id?200:201,result.rows[0]];
 }
 if(!id)reject(405,'method','Método inválido.');
 const profile=(await db.query('SELECT * FROM vant.prospect_profiles WHERE tenant_id=$1 AND id=$2',[tenant,id])).rows[0];
 if(!profile)reject(404,'missing','Perfil não encontrado.');
 if(parts.length===2&&method==='GET'&&['accounts','targets'].includes(resource))return listAccounts(ctx,profile,resource==='targets');
 if(parts.length!==3||resource!=='targets'||!['PUT','DELETE'].includes(method))reject(404,'missing','Operação não encontrada.');
 if(member.role==='viewer')reject(403,'permission','Esta conta permite apenas consulta.');
 if(method==='DELETE'){
  const removed=await db.query('DELETE FROM vant.prospect_targets WHERE tenant_id=$1 AND profile_id=$2 AND account_id=$3',[tenant,id,accountId]);
  if(removed.rowCount)await audit(db,tenant,member.id,'prospecting.target.removed',accountId,requestId);
  return [204];
 }
 const source=textField(body.source_reference,500);
 const account=await db.query('SELECT id FROM vant.accounts WHERE tenant_id=$1 AND id=$2',[tenant,accountId]);
 if(!account.rowCount)reject(404,'missing','Empresa não encontrada.');
 const saved=await db.query('INSERT INTO vant.prospect_targets(tenant_id,profile_id,account_id,source_reference,selected_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING source_reference,selected_at',[tenant,id,accountId,source,member.id]);
 if(saved.rowCount){
  await audit(db,tenant,member.id,'prospecting.target.added',accountId,requestId);
  return [201,saved.rows[0]];
 }
 const existing=(await db.query('SELECT source_reference,selected_at FROM vant.prospect_targets WHERE tenant_id=$1 AND profile_id=$2 AND account_id=$3',[tenant,id,accountId])).rows[0];
 if(existing?.source_reference!==source)reject(409,'source','A seleção foi alterada. Recarregue a lista.');
 return [200,existing];
}
