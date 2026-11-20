import {createCrmLead,updateContactRole} from './crm.mjs';
import {audit} from './db.mjs';
import {isUuid,mayManageTeams} from './security.mjs';
import {pagination,reject,textField} from './http.mjs';

function linkedin(value){
 if(value==null||value==='')return null;
 let url,slug;
 try{url=new URL(value);slug=decodeURIComponent(url.pathname).match(/^\/in\/([\p{L}\p{N}_-]{1,128})\/?$/u)?.[1];}catch{}
 if(!slug||url.protocol!=='https:'||url.port||url.username||url.password||!/^((www|[a-z]{2})\.)?linkedin\.com$/.test(url.hostname))
  reject(400,'profile_url','Informe um perfil profissional HTTPS do LinkedIn.');
 return 'https://www.linkedin.com/in/'+encodeURIComponent(slug.toLowerCase());
}

async function savePerson(ctx,profile,account,contactId){
 const {db,tenant,member,requestId,body}=ctx;
 const contact=(await db.query('SELECT * FROM vant.contacts WHERE tenant_id=$1 AND account_id=$2 AND id=$3 FOR UPDATE',[tenant,account,contactId])).rows[0];
 if(!contact)reject(404,'missing','Contato não encontrado na empresa-alvo.');
 const title=textField(body.title,250),source=textField(body.source_reference,500),url=linkedin(body.linkedin_url);
 if(typeof body.decision_maker!=='boolean'||!Number.isSafeInteger(body.expected_revision)||body.expected_revision<0
  ||!/^\d{4}-\d{2}-\d{2}$/.test(body.observed_on??''))reject(400,'person','Informe cargo, fonte, data e revisão.');
 const date=await db.query("SELECT $1::date <= (now() AT TIME ZONE 'America/Sao_Paulo')::date AS valid",[body.observed_on]);
 if(!date.rows[0].valid)reject(400,'date','A data da fonte deve ser de hoje ou anterior.');
 const prior=(await db.query('SELECT * FROM vant.prospect_people WHERE tenant_id=$1 AND contact_id=$2',[tenant,contactId])).rows[0];
 if(prior&&prior.source_reference===source&&prior.linkedin_url===url&&prior.observed_on===body.observed_on&&contact.title===title&&contact.decision_maker===body.decision_maker)return [200,prior];
 if((prior?.revision??0)!==body.expected_revision)reject(409,'revision','O perfil do contato mudou. Reabra a ficha.');
 if(contact.title!==title||contact.decision_maker!==body.decision_maker)await updateContactRole(ctx,contact,{title,decision_maker:body.decision_maker});
 const revision=body.expected_revision+1;
 const {rows}=await db.query(`INSERT INTO vant.prospect_people(tenant_id,contact_id,revision,linkedin_url,source_reference,observed_on,recorded_by)
   VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(tenant_id,contact_id) DO UPDATE SET revision=excluded.revision,
   linkedin_url=excluded.linkedin_url,source_reference=excluded.source_reference,observed_on=excluded.observed_on,recorded_by=excluded.recorded_by RETURNING *`,[tenant,contactId,revision,url,source,body.observed_on,member.id]);
 const snapshot={profile_id:profile.id,account_id:account,name:contact.name,title,decision_maker:body.decision_maker,source_reference:source,observed_on:body.observed_on,linkedin_url:url};
 await db.query('INSERT INTO vant.prospect_person_history(tenant_id,contact_id,revision,snapshot,recorded_by) VALUES($1,$2,$3,$4,$5)',[tenant,contactId,revision,snapshot,member.id]);
 await audit(db,tenant,member.id,'prospecting.person.recorded',contactId,requestId);
 return [prior?200:201,rows[0]];
}

async function convert(ctx,profile,account,source){
 const {db,tenant,member,body,requestId}=ctx;
 if(body.lead_id!=null&&!isUuid(body.lead_id)||body.contact_id!=null&&!isUuid(body.contact_id))reject(400,'identifier','Identificador inválido.');
 const company=(await db.query('SELECT name,segment FROM vant.accounts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',[tenant,account])).rows[0];
 const prior=(await db.query('SELECT * FROM vant.prospect_conversions WHERE tenant_id=$1 AND account_id=$2',[tenant,account])).rows[0];
 if(prior){if(body.lead_id&&prior.lead_id!==body.lead_id)reject(409,'converted','Esta empresa já tem um lead vinculado pela prospecção.');return [200,prior];}
 let leadId=body.lead_id??null;
 if(leadId){
  const lead=(await db.query('SELECT owner_id FROM vant.leads WHERE tenant_id=$1 AND account_id=$2 AND id=$3 FOR SHARE',[tenant,account,leadId])).rows[0];
  if(!lead)reject(404,'missing','Lead não encontrado na empresa.');
  if(!mayManageTeams(member.role)&&lead.owner_id!==member.id)reject(403,'permission','A vinculação exige o responsável ou um gestor.');
  if(body.contact_id)reject(400,'contact','O vínculo mantém o contato do lead existente.');
 }else{
  if((await db.query('SELECT 1 FROM vant.leads WHERE tenant_id=$1 AND account_id=$2 LIMIT 1',[tenant,account])).rowCount)reject(409,'existing','Escolha um lead existente da empresa.');
  let name=company.name;
  if(body.contact_id){
   const person=(await db.query('SELECT name FROM vant.contacts WHERE tenant_id=$1 AND account_id=$2 AND id=$3 FOR SHARE',[tenant,account,body.contact_id])).rows[0];
   if(!person)reject(404,'missing','Contato não encontrado na empresa.');
   name=person.name;
  }
  leadId=(await createCrmLead(ctx,{name,source:'Prospecção',segment:company.segment,account_id:account,contact_id:body.contact_id??null})).id;
 }
 const {rows}=await db.query('INSERT INTO vant.prospect_conversions(tenant_id,account_id,profile_id,lead_id,source_reference,created_lead,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[tenant,account,profile.id,leadId,source,!body.lead_id,member.id]);
 await audit(db,tenant,member.id,'prospecting.converted',account,requestId);
 return [201,rows[0]];
}

export async function prospectAccountAction(ctx,profile,account,parts){
 const {db,tenant,member,url,method}=ctx,[resource,contact,history]=parts;
 if(method!=='GET'&&member.role==='viewer')reject(403,'permission','Esta conta permite apenas consulta.');
 const selected=(await db.query('SELECT source_reference FROM vant.prospect_targets WHERE tenant_id=$1 AND profile_id=$2 AND account_id=$3',[tenant,profile.id,account])).rows[0];
 if(!selected)reject(404,'missing','Empresa-alvo não encontrada.');
 if(resource==='handoff'&&parts.length===1){
  if(method==='POST')return convert(ctx,profile,account,selected.source_reference);
  if(method==='GET')return [200,{conversion:(await db.query('SELECT * FROM vant.prospect_conversions WHERE tenant_id=$1 AND account_id=$2',[tenant,account])).rows[0]??null}];
 }
 if(resource==='people'&&parts.length===1&&method==='GET'){
  const limit=pagination(url.searchParams),cursor=url.searchParams.get('cursor');
  if(cursor!==null&&!isUuid(cursor))reject(400,'cursor','Cursor inválido.');
  const {rows}=await db.query(`SELECT c.id,c.name,c.title,c.decision_maker,p.source_reference,p.observed_on,p.linkedin_url,coalesce(p.revision,0) AS revision,
    coalesce($3::text IS NOT NULL AND strpos(lower(c.title),lower($3))>0,false) AS role_matches
    FROM vant.contacts c LEFT JOIN vant.prospect_people p ON (p.tenant_id,p.contact_id)=(c.tenant_id,c.id)
    WHERE c.tenant_id=$1 AND c.account_id=$2 AND ($4::uuid IS NULL OR c.id>$4) ORDER BY c.id LIMIT $5`,[tenant,account,profile.target_role,cursor,limit+1]);
  const items=rows.slice(0,limit);return [200,{items,nextCursor:rows.length>limit?items.at(-1).id:null}];
 }
 if(resource==='people'&&isUuid(contact)){
  if(parts.length===2&&method==='PUT')return savePerson(ctx,profile,account,contact);
  if(parts.length===3&&history==='history'&&method==='GET'){
   const limit=pagination(url.searchParams),cursor=url.searchParams.get('cursor');
   if(cursor!==null&&!/^[1-9]\d{0,8}$/.test(cursor))reject(400,'cursor','Cursor inválido.');
   const {rows}=await db.query(`SELECT h.revision,h.snapshot,h.recorded_at FROM vant.prospect_person_history h JOIN vant.contacts c
    ON (c.tenant_id,c.id)=(h.tenant_id,h.contact_id) WHERE h.tenant_id=$1 AND c.account_id=$2 AND c.id=$3
    AND ($4::int IS NULL OR h.revision<$4) ORDER BY h.revision DESC LIMIT $5`,[tenant,account,contact,cursor,limit+1]);
   const items=rows.slice(0,limit);return [200,{items,nextCursor:rows.length>limit?items.at(-1).revision:null}];
  }
 }
 reject(404,'missing','Operação não encontrada.');
}
