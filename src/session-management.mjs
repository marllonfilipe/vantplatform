import {reject} from './http.mjs';
import {isUuid} from './security.mjs';

const path='/api/v1/auth/sessions';
export async function manageOwnSessions(db,tenant,memberId,tokenHash,resource,method,requestId){
  if(resource===path && method==='GET'){
    const {rows}=await db.query(`SELECT public_id AS id,created_at,expires_at,token_hash=$3 AS current
      FROM vant.sessions WHERE tenant_id=$1 AND member_id=$2 AND expires_at>now()
      ORDER BY (token_hash=$3) DESC,created_at DESC,public_id DESC LIMIT 21`,[tenant,memberId,tokenHash]);
    return [200,{items:rows.slice(0,20),has_more:rows.length>20}];
  }
  const target=resource.slice(path.length+1);
  if(method!=='DELETE')reject(405,'method','Método indisponível.');
  if(target!=='others' && !isUuid(target))reject(400,'session_id','Referência de sessão inválida.');
  // Excluir e auditar na mesma transação. A auditoria registra somente a referência pública.
  await db.query(`WITH revoked AS (
      DELETE FROM vant.sessions WHERE tenant_id=$1 AND member_id=$2 AND token_hash<>$3 AND expires_at>now()
      AND ($4::uuid IS NULL OR public_id=$4) RETURNING public_id)
    INSERT INTO vant.audit(tenant_id,actor_id,action,object_id,request_id)
      SELECT $1,$2,'session.revoked_other',public_id::text,$5 FROM revoked`,
    [tenant,memberId,tokenHash,target==='others'?null:target,requestId]);
  return [204];
}
