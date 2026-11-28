import {withTenant} from './db.mjs';
import {reject} from './http.mjs';
import {isUuid} from './security.mjs';
import {tenantSmtp,sendSmtpDiagnostic} from './smtp.mjs';

// A lost worker cannot safely distinguish a lost receipt from a lost message.
const fields=`id,created_at,CASE WHEN outcome='pending' AND created_at<now()-interval '1 minute'
  THEN 'unknown' ELSE outcome END AS outcome`;

export async function latestSmtpDiagnostic(db,tenant){
  const result=await db.query(`SELECT ${fields} FROM vant.smtp_diagnostics
    WHERE tenant_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`,[tenant]);
  return result.rows[0]??null;
}

export async function smtpDiagnostic({db,pool,tenant,member,body,method,url}){
  if(method!=='POST')reject(405,'method','Use POST para solicitar um diagnóstico.');
  if(url.search || Object.keys(body).length!==1 || !isUuid(body.id))reject(400,'parameters','Informe apenas a referência UUID.');
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,6011))',[tenant]);
  const previous=await db.query(`SELECT ${fields} FROM vant.smtp_diagnostics WHERE tenant_id=$1 AND id=$2`,[tenant,body.id]);
  if(previous.rowCount)return [200,previous.rows[0]];
  const config=await tenantSmtp(tenant);
  if(!config?.test_to)reject(409,'configuration','Configure remetente e destino privados para o teste.');
  const recent=await db.query("SELECT 1 FROM vant.smtp_diagnostics WHERE tenant_id=$1 AND created_at>clock_timestamp()-interval '1 minute' LIMIT 1",[tenant]);
  if(recent.rowCount)reject(429,'diagnostic_limit','Aguarde um minuto antes de solicitar outro teste.');
  await db.query('INSERT INTO vant.smtp_diagnostics(tenant_id,id,actor_id) VALUES($1,$2,$3)',[tenant,body.id,member.id]);
  return async()=>{
    const outcome=await sendSmtpDiagnostic(config,body.id);
    const saved=await withTenant(pool,tenant,client=>client.query(
      `UPDATE vant.smtp_diagnostics SET outcome=$3 WHERE tenant_id=$1 AND id=$2 RETURNING ${fields}`,
      [tenant,body.id,outcome]));
    return [201,saved.rows[0]];
  };
}
