import {pagination,reject} from './http.mjs';

export async function notifyOwner(db,tenant,recipient,job,step,title){
 const result=await db.query(`INSERT INTO vant.notifications(tenant_id,recipient_id,job_id,step_index,title)
   SELECT $1,m.id,$3,$4,$5 FROM vant.members m WHERE m.tenant_id=$1 AND m.id=$2 AND m.active
   RETURNING id`,[tenant,recipient,job,step,title]);
 if(!result.rowCount)throw Object.assign(new Error('owner_unavailable'),{code:'owner_unavailable'});
}

export async function notificationRoutes({db,tenant,member,url,method}){
 const base='/api/v1/notifications';
 if(method==='GET'&&url.pathname===base){
  const cursor=url.searchParams.get('cursor'),limit=pagination(url.searchParams);
  if(cursor!==null&&!/^[1-9]\d{0,17}$/.test(cursor))reject(400,'cursor','Cursor inválido.');
  const result=await db.query(`SELECT id,title,created_at,read_at FROM vant.notifications
    WHERE tenant_id=$1 AND recipient_id=$2 AND ($3::bigint IS NULL OR id<$3)
    ORDER BY id DESC LIMIT $4`,[tenant,member.id,cursor,limit+1]);
  const items=result.rows.slice(0,limit);
  return [200,{items,nextCursor:result.rowCount>limit?items.at(-1).id:null}];
 }
 if(method!=='POST')return;
 const match=/^\/api\/v1\/notifications\/([1-9]\d{0,17})\/read$/.exec(url.pathname);
 if(!match)return;
 const result=await db.query(`UPDATE vant.notifications SET read_at=coalesce(read_at,now())
   WHERE tenant_id=$1 AND recipient_id=$2 AND id=$3 RETURNING read_at`,[tenant,member.id,match[1]]);
 if(!result.rowCount)reject(404,'missing','Notificação não encontrada.');
 return [200,result.rows[0]];
}
