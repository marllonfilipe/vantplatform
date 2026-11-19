import {isUuid,mayManageTeams} from './security.mjs';
import {withTenant,audit} from './db.mjs';
import {pagination,reject,textField} from './http.mjs';
import {configureInstance,evolution,evolutionConnection,instanceName,remoteInstances,send} from './evolution.mjs';
import {ingest} from './wa-events.mjs';
function missing(){reject(404,'missing','Registro não encontrado.');}
function manage(member){if(!mayManageTeams(member.role))reject(403,'permission','Apenas gestores podem configurar instâncias.');}
function write(member,conversation){if(member.role==='viewer'||(member.role==='seller'&&conversation.owner_id&&member.id!==conversation.owner_id))reject(403,'permission','Permissão insuficiente.');}
async function instance(db,id){
 if(!isUuid(id))missing();const r=await db.query('SELECT id,label,owner_id,state,phone FROM vant.wa_instances WHERE id=$1 AND disabled_at IS NULL',[id]);if(!r.rowCount)missing();return r.rows[0];
}
async function conversation(db,id){
 if(!isUuid(id))missing();const r=await db.query("SELECT * FROM vant.conversations WHERE id=$1 AND channel='whatsapp'",[id]);if(!r.rowCount)missing();return r.rows[0];
}
async function instances(ctx,id,action){
 const {method,body,db,tenant,member,requestId}=ctx;
 if(!id&&method==='GET')return [200,{items:(await db.query('SELECT id,label,state,phone FROM vant.wa_instances WHERE disabled_at IS NULL ORDER BY label')).rows}];
 manage(member);
 if(!id&&method==='POST'){
  const row=(await db.query('INSERT INTO vant.wa_instances(tenant_id,label,owner_id) VALUES($1,$2,$3) RETURNING id,label,state',[tenant,textField(body.label,100),member.id])).rows[0];
  await audit(db,tenant,member.id,'wa.registered',row.id,requestId);return [201,row];
 }
 const inst=await instance(db,id),name=instanceName(id);
 if(method==='GET'&&action==='status'){
  const list=await remoteInstances(name);
  const remote=Array.isArray(list)?list.find(x=>(x.name??x.instance?.instanceName)===name):null;
  if(!remote)return [200,{state:'local',phone:null}];
  const status=await evolution('/instance/connectionState/'+name),state=status.instance?.state??'unknown',phone=remote.ownerJid?.split('@')[0]??null;
  await db.query('UPDATE vant.wa_instances SET state=$1,phone=$2 WHERE id=$3',[state,phone,id]);return [200,{state,phone}];
 }
 if(method!=='POST')missing();
 if(action==='activate'){await configureInstance(tenant,id);await db.query("UPDATE vant.wa_instances SET state='configured' WHERE id=$1",[id]);}
 else if(action==='qr'){
  const q=await evolution('/instance/connect/'+name);const qr=q.base64??q.qrcode?.base64;
  return [200,{qr:typeof qr==='string'&&/^data:image\/png;base64,/.test(qr)?qr:null,state:q.instance?.state??q.instance?.status??inst.state}];
 }else if(action==='restart'){await evolution('/instance/restart/'+name,'POST',{});}
 else if(action==='disconnect'){await evolution('/instance/logout/'+name,'DELETE');await db.query("UPDATE vant.wa_instances SET state='close' WHERE id=$1",[id]);}
 else if(action==='remove'){
  if(inst.state!=='local'){await evolution('/instance/delete/'+name,'DELETE');}
  await db.query("UPDATE vant.wa_instances SET disabled_at=now(),state='removed' WHERE id=$1",[id]);
 }else missing();
 await audit(db,tenant,member.id,'wa.'+action,id,requestId);return [200,{ok:true}];
}
const publicMessage='id,provider_id,from_me,kind,body,filename,mime,state,created_at';
async function messages(ctx,conv,sub,msgId){
 const {db,tenant,body,member,method,url,pool}=ctx;
 if(method==='GET'&&!msgId){
  const limit=pagination(url.searchParams),cursor=url.searchParams.get('before');
  let at=null,mid=null;if(cursor){const [t,i]=cursor.split('|');if(!isUuid(i)||!Number.isFinite(Date.parse(t)))reject(400,'cursor','Cursor inválido.');at=t;mid=i;}
  const {rows}=await db.query('SELECT '+publicMessage+' FROM vant.wa_messages WHERE conversation_id=$1 AND ($2::timestamptz IS NULL OR (created_at,id)<($2,$3::uuid)) ORDER BY created_at DESC,id DESC LIMIT $4',[conv.id,at,mid,limit+1]);
  const last=rows[limit-1];return [200,{items:rows.slice(0,limit),before:rows.length>limit?last.created_at.toISOString()+'|'+last.id:null,outbox:(await db.query("SELECT id,kind,body,state,created_at FROM vant.wa_outbox WHERE conversation_id=$1 AND state<>'sent' ORDER BY created_at DESC LIMIT 30",[conv.id])).rows}];
 }
 if(method==='GET'&&isUuid(msgId)){
  const r=await db.query('SELECT m.*,o.media AS sent_media FROM vant.wa_messages m LEFT JOIN vant.wa_outbox o ON o.conversation_id=m.conversation_id AND o.provider_id=m.provider_id WHERE m.conversation_id=$1 AND m.id=$2',[conv.id,msgId]);
  if(!r.rowCount||!['image','document','audio','video'].includes(r.rows[0].kind))missing();const m=r.rows[0];
  const media=m.sent_media?{base64:m.sent_media.toString('base64')}:
   await evolution('/chat/getBase64FromMediaMessage/'+instanceName(m.instance_id),'POST',{message:{key:m.provider_key},convertToMp4:false});
  if(typeof media.base64!=='string')reject(502,'media','Mídia indisponível.');
  return [200,{filename:m.filename??media.fileName??m.kind,base64:media.base64.replace(/^data:[^,]+,/,''),mime:m.mime??'application/octet-stream'}];
 }
 write(member,conv);if(method!=='POST')missing();const inst=await instance(db,conv.instance_id);
 if(!msgId){
  if(!isUuid(body.clientId)||!['text','image','video','audio','document'].includes(body.kind))reject(400,'message','Tipo ou identificador inválido.');
  let media=null;const caption=body.kind==='text'?textField(body.text,16000):String(body.text??'').slice(0,4000);
  if(body.kind!=='text'){if(typeof body.base64!=='string'||body.base64.length>5592408||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64))reject(400,'media','Mídia inválida.');
   media=Buffer.from(body.base64,'base64');if(!media.length||media.length>4194304||media.toString('base64')!==body.base64)reject(400,'media','Mídia inválida.');}
  const values=[tenant,body.clientId,conv.id,body.kind,caption,media,media?textField(body.filename,180):null,media?textField(body.mime||'application/octet-stream',100):null];
  await db.query('INSERT INTO vant.wa_outbox(tenant_id,id,conversation_id,kind,body,media,filename,mime) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tenant_id,id) DO NOTHING',values);
  const saved=await db.query('SELECT id,state FROM vant.wa_outbox WHERE id=$1 AND conversation_id=$2',[body.clientId,conv.id]);if(!saved.rowCount)reject(409,'id','Identificador já utilizado.');return [200,saved.rows[0]];
 }
 if(!isUuid(msgId))missing();
 if(!conv.remote_jid.endsWith('@s.whatsapp.net'))reject(409,'address','Para enviar, abra a conversa com o número de telefone confirmado.');
 const claimed=await db.query("UPDATE vant.wa_outbox SET state='sending' WHERE id=$1 AND conversation_id=$2 AND state='queued' RETURNING *",[msgId,conv.id]);
 if(!claimed.rowCount){const r=await db.query('SELECT id,state FROM vant.wa_outbox WHERE id=$1 AND conversation_id=$2',[msgId,conv.id]);if(!r.rowCount)missing();return [200,r.rows[0]];}
 // Uma falha de configuração reverte a reserva na mesma transação.
 const connection=evolutionConnection();
 // A transação confirma a reserva antes de qualquer envio externo.
 return async()=>{
  const draft=claimed.rows[0];let response;
  try{response=await send(inst.id,conv.remote_jid,draft,connection);if(!response?.key?.id)throw Error('Resposta sem ID.');}
  catch{await withTenant(pool,tenant,c=>c.query("UPDATE vant.wa_outbox SET state='unknown' WHERE id=$1",[msgId]));reject(502,'uncertain','Entrega não confirmada. Verifique o aparelho antes de repetir.');}
  await withTenant(pool,tenant,async c=>{
   await c.query('SELECT id FROM vant.wa_instances WHERE id=$1 FOR UPDATE',[inst.id]);
   const key={...response.key,remoteJid:conv.remote_jid,fromMe:true};
   const fallback=draft.kind==='text'?{conversation:draft.body}:{[draft.kind+'Message']:{caption:draft.body,fileName:draft.filename,mimetype:draft.mime}};
   await ingest(c,tenant,inst,'send.message',{...response,key,message:response.message??fallback});
   await c.query("UPDATE vant.wa_outbox SET state='sent',provider_id=$1 WHERE id=$2",[key.id,msgId]);
  });return [200,{id:msgId,state:'sent'}];
 };
}
export async function inboxRoutes(ctx){
 const {db,tenant,method,body,url,member}=ctx;
 if(!url.pathname.startsWith('/api/v1/inbox/'))return;
 const [kind,id,action,extra]=url.pathname.slice('/api/v1/inbox/'.length).split('/');
 if(kind==='instances')return instances(ctx,id,action);
 if(kind!=='conversations')missing();
 if(!id&&method==='GET'){
  const q=url.searchParams.get('q')??'',priority=url.searchParams.get('priority')||null,tag=url.searchParams.get('tag')||null;
  const limit=pagination(url.searchParams),cursor=url.searchParams.get('cursor')||null;if(cursor&&!isUuid(cursor))reject(400,'cursor','Cursor inválido.');
  const r=await db.query(`SELECT id,name,phone,priority,tags,owner_id,instance_id,updated_at FROM vant.conversations WHERE channel='whatsapp'
   AND (strpos(lower(name),lower($1))>0 OR strpos(coalesce(phone,''),$1)>0) AND ($2::text IS NULL OR priority=$2)
   AND ($3::text IS NULL OR $3=ANY(tags)) AND ($4::uuid IS NULL OR id>$4) ORDER BY id LIMIT $5`,[q,priority,tag,cursor,limit+1]);
  return [200,{items:r.rows.slice(0,limit),nextCursor:r.rowCount>limit?r.rows[limit-1].id:null}];
 }
 if(!id&&method==='POST'){
  write(member,{});await instance(db,body.instanceId);const phone=String(body.phone??'');if(!/^\d{7,15}$/.test(phone))reject(400,'phone','Informe DDI, DDD e número.');
  const r=await db.query(`INSERT INTO vant.conversations(tenant_id,channel,name,phone,owner_id,instance_id,remote_jid) VALUES($1,'whatsapp',$2,$3,$4,$5,$6)
   ON CONFLICT(tenant_id,instance_id,remote_jid) DO UPDATE SET remote_jid=excluded.remote_jid RETURNING id`,[tenant,textField(body.name||phone,200),phone,member.id,body.instanceId,phone+'@s.whatsapp.net']);return [201,r.rows[0]];
 }
 const conv=await conversation(db,id);
 if(!action&&method==='GET')return [200,conv];
 if(action==='messages')return messages(ctx,conv,action,extra);
 if(action==='notes'&&method==='GET')return [200,{items:(await db.query('SELECT n.id,n.body,n.created_at,m.name AS author FROM vant.wa_notes n JOIN vant.members m ON m.id=n.actor_id WHERE n.conversation_id=$1 ORDER BY n.created_at DESC LIMIT 100',[id])).rows}];
 write(member,conv);
 if(action==='notes'&&method==='POST'){await db.query('INSERT INTO vant.wa_notes(tenant_id,conversation_id,actor_id,body) VALUES($1,$2,$3,$4)',[tenant,id,member.id,textField(body.body,4000)]);return [201,{ok:true}];}
 if(!action&&method==='PATCH'){
  const values={},refs=['lead_id','account_id','contact_id','owner_id'];
  for(const k of refs)if(Object.hasOwn(body,k)){if(body[k]!==null&&!isUuid(body[k]))reject(400,'ref','Vínculo inválido.');if(k==='owner_id'&&(!body[k]||!mayManageTeams(member.role)))reject(403,'owner','Responsável exige gestão.');values[k]=body[k];}
  if(body.tags!==undefined){if(!Array.isArray(body.tags)||body.tags.length>30)reject(400,'tags','Tags inválidas.');values.tags=body.tags.map(s=>textField(s,60));}
  if(body.priority!==undefined){if(!['normal','high','urgent'].includes(body.priority))reject(400,'priority','Prioridade inválida.');values.priority=body.priority;}
  const keys=Object.keys(values);if(!keys.length)reject(400,'fields','Informe os campos.');
  await db.query('UPDATE vant.conversations SET '+keys.map((k,i)=>k+'=$'+(i+1)).join(',')+',updated_at=now() WHERE id=$'+(keys.length+1),[...Object.values(values),id]);return [200,{ok:true}];
 }
 missing();
}
