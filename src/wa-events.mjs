import {isUuid} from './security.mjs';
import {withTenant} from './db.mjs';
import {reject,readJson,respond} from './http.mjs';
import {authentic,instanceName} from './evolution.mjs';
const ranks={PENDING:0,SERVER_ACK:1,DELIVERY_ACK:2,READ:3,PLAYED:4};
const states=['pending','sent','delivered','read','played'];
export async function ingest(db,tenant,instance,event,data){
 if(!data||typeof data!=='object')reject(400,'event','Evento inválido.');
 if(event==='connection.update'){
  const state=data.state??data.status;if(['open','close','connecting'].includes(state))await db.query('UPDATE vant.wa_instances SET state=$1 WHERE id=$2',[state,instance.id]);return;
 }
 const items=Array.isArray(data)?data:[data];
 if(items.length>500)reject(413,'events','Lote excede o limite.');
 for(const item of items){
  if(!item||typeof item!=='object')continue;
  const key=item.key??{},id=key.id??item.keyId;
  if(typeof id!=='string'||!id.length||id.length>200)continue;
  if(event==='messages.update'){
   const raw=item.update?.status??item.status;const rank=typeof raw==='number'?raw-1:ranks[String(raw).toUpperCase()];
   if(!Number.isInteger(rank)||rank<0||rank>4)continue;
   const r=await db.query(`INSERT INTO vant.wa_receipts(tenant_id,instance_id,provider_id,status_rank) VALUES($1,$2,$3,$4)
    ON CONFLICT(tenant_id,instance_id,provider_id) DO UPDATE SET status_rank=greatest(vant.wa_receipts.status_rank,excluded.status_rank) RETURNING status_rank`,[tenant,instance.id,id,rank]);
   await db.query('UPDATE vant.wa_messages SET state=$1 WHERE instance_id=$2 AND provider_id=$3 AND from_me',[states[r.rows[0].status_rank],instance.id,id]);continue;
  }
  if(!['messages.upsert','send.message'].includes(event))continue;
  const jid=key.remoteJid;if(typeof jid!=='string'||!/^\d{5,20}@(s\.whatsapp\.net|lid)$/.test(jid))continue;
  const msg=item.message?.ephemeralMessage?.message??item.message??{};
  const typed=[['image','imageMessage'],['video','videoMessage'],['audio','audioMessage'],['document','documentMessage']].find(([,k])=>msg[k]);
  const kind=typed?.[0]??(typeof msg.conversation==='string'||msg.extendedTextMessage?'text':'other');
  const media=typed?msg[typed[1]]:{};
  const text=String(msg.conversation??msg.extendedTextMessage?.text??media.caption??'').slice(0,32000);
  const phone=jid.endsWith('@lid')?null:jid.split('@')[0],label=String(!key.fromMe&&item.pushName||phone||jid).slice(0,200);
  const conv=await db.query(`INSERT INTO vant.conversations(tenant_id,channel,name,phone,owner_id,instance_id,remote_jid)
   VALUES($1,'whatsapp',$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,instance_id,remote_jid) DO UPDATE SET remote_jid=excluded.remote_jid RETURNING id`,[tenant,label,phone,instance.owner_id,instance.id,jid]);
  const receipt=await db.query('SELECT status_rank FROM vant.wa_receipts WHERE instance_id=$1 AND provider_id=$2',[instance.id,id]);
  const stamp=Number(item.messageTimestamp);const at=Number.isFinite(stamp)&&stamp>0&&stamp<10000000000?new Date(stamp*1000):new Date();
  const inserted=await db.query(`INSERT INTO vant.wa_messages(tenant_id,conversation_id,instance_id,provider_id,from_me,kind,body,filename,mime,state,provider_key,created_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(tenant_id,instance_id,provider_id) DO NOTHING`,[tenant,conv.rows[0].id,instance.id,id,key.fromMe===true,kind,text,media.fileName??null,media.mimetype??null,key.fromMe?states[receipt.rows[0]?.status_rank??1]:'received',JSON.stringify({id,remoteJid:jid,fromMe:key.fromMe===true}),at]);
  if(inserted.rowCount)await db.query('UPDATE vant.conversations SET updated_at=greatest(updated_at,$1) WHERE id=$2',[at,conv.rows[0].id]);
 }
}
export async function evolutionWebhook(req,res,path,pool){
 if(!path.startsWith('/hooks/evolution/'))return false;
 const [, , ,tenant,id,...rest]=path.split('/');
 if(req.method!=='POST'||rest.length||!isUuid(tenant)||!isUuid(id))reject(404,'hook','Webhook desconhecido.');
 if(!authentic(tenant,id,req.headers.authorization))reject(401,'hook','Credencial de webhook inválida.');
 const packet=await readJson(req,4000000);if(packet.instance!==instanceName(id))reject(403,'instance','Instância inválida.');
 await withTenant(pool,tenant,async db=>{
  const {rows}=await db.query('SELECT id,owner_id FROM vant.wa_instances WHERE id=$1 AND disabled_at IS NULL FOR UPDATE',[id]);
  if(!rows.length)reject(404,'hook','Webhook desativado.');
  await ingest(db,tenant,rows[0],String(packet.event).toLowerCase().replaceAll('_','.'),packet.data);
 });respond(res,200,{received:true});return true;
}
