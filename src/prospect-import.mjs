import {suggestMissing} from './prospect-enrichment.mjs';
import {csvRecords} from './csv.mjs';
import {createCrmAccount} from './crm.mjs';
import {audit} from './db.mjs';
import {reject,textField} from './http.mjs';

const columns={nome:'name',cnpj:'cnpj',fonte:'source_reference',site:'website',segmento:'segment',
 região:'location',regiao:'location',porte:'size_band',atividade:'business_activity'};

export async function importProspectAccounts(ctx,profile){
 const {db,tenant,member,requestId}=ctx;
 const rows=csvRecords(ctx.body.csv,columns,['name','cnpj','source_reference']).map((entry,i)=>{
  const cnpj=entry.cnpj.replace(/[\s./-]/g,'').toUpperCase();
  if(!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj))reject(400,'identifier','Confira o identificador no registro '+(i+1)+'.');
  const account={cnpj,name:textField(entry.name,250)},source=textField(entry.source_reference,500);
  for(const key of ['website','segment','location','size_band','business_activity']){
   if(entry[key])account[key]=textField(entry[key],250);
  }
  if(account.website){
   let url;try{url=new URL(account.website);}catch{}
   if(!url||!['http:','https:'].includes(url.protocol)||url.username||url.password)reject(400,'website','Confira o site no registro '+(i+1)+'.');
  }
  return {account,source};
 });
 // All imports acquire shared identifiers in the same order, including files with reversed rows.
 for(const code of [...new Set(rows.map(r=>r.account.cnpj))].sort()){
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1::text||':'||$2::text,0))",[tenant,code]);
 }
 const result={processed:rows.length,created:0,reused:0,selected:0,suggestions:0,unchanged_values:[]};
 for(const [index,{account,source}] of rows.entries()){
  const found=await db.query('SELECT * FROM vant.accounts WHERE tenant_id=$1 AND cnpj IS NOT NULL AND vant.prospect_identifier(cnpj)=$2 ORDER BY id LIMIT 2',[tenant,account.cnpj]);
  if(found.rowCount>1)reject(409,'ambiguous','Mais de uma empresa existente corresponde ao identificador no registro '+(index+1)+'.');
  let current=found.rows[0];
  if(current){
   result.reused++;
   result.suggestions+=await suggestMissing(ctx,current,account,source);
   const fields=Object.keys(account).filter(k=>k!=='cnpj'&&account[k]!==current[k]);
   if(fields.length)result.unchanged_values.push({row:index+1,fields});
  }else{current=await createCrmAccount(ctx,account);result.created++;}
  const added=await db.query('INSERT INTO vant.prospect_targets(tenant_id,profile_id,account_id,source_reference,selected_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[tenant,profile,current.id,source,member.id]);
  result.selected+=added.rowCount;
  if(added.rowCount)await audit(db,tenant,member.id,'prospecting.target.added',current.id,requestId);
  else await db.query('INSERT INTO vant.prospect_account_sources(tenant_id,account_id,source_reference,recorded_by) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[tenant,current.id,source,member.id]);
 }
 await audit(db,tenant,member.id,'prospecting.import',profile,requestId);
 return result;
}
