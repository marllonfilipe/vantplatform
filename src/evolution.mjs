import {createHmac,timingSafeEqual} from 'node:crypto';
import {reject} from './http.mjs';

export function webhookToken(tenant,id) {
 const key=process.env.WA_WEBHOOK_KEY;
 if(!key||Buffer.byteLength(key)<32)reject(503,'webhook_config','Configure a chave privada do webhook.');
 return createHmac('sha256',key).update('v1:'+tenant+':'+id).digest('hex');
}
export function authentic(tenant,id,header) {
 const actual=Buffer.from(header??''),expected=Buffer.from('Bearer '+webhookToken(tenant,id));
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export const instanceName=id=>'vant-'+id;
export async function evolution(route,method='GET',payload){
 const base=process.env.EVOLUTION_URL,key=process.env.EVOLUTION_API_KEY;
 if(!base||!key)reject(503,'provider_config','Configure a instância Evolution no servidor.');
 const url=new URL(base);
 if(url.username||url.password||url.search||url.hash||(!['http:','https:'].includes(url.protocol)))reject(503,'provider_config','URL de provedor inválida.');
 const response=await fetch(base.replace(/\/$/,'')+route,{method,redirect:'error',signal:AbortSignal.timeout(15000),
 headers:{apikey:key,'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)}).catch(()=>reject(503,'provider_network','O provedor não respondeu.'));
 let body;try{body=await response.json();}catch{reject(502,'provider_response','Resposta inválida do provedor.');}
 if(!response.ok||body?.error)reject(response.status===404?404:502,'provider_response','O provedor recusou a operação.');
 return body;
}
export function webhookSettings(tenant,id){
 const origin=process.env.WA_CALLBACK_ORIGIN??process.env.APP_ORIGIN;
 if(!origin)reject(503,'callback_config','Configure a origem pública da API.');
 return {enabled:true,url:new URL('/hooks/evolution/'+tenant+'/'+id,origin).href,
 headers:{Authorization:'Bearer '+webhookToken(tenant,id)},base64:false,byEvents:false,
 events:['MESSAGES_UPSERT','MESSAGES_UPDATE','CONNECTION_UPDATE','SEND_MESSAGE']};
}
export async function configureInstance(tenant,id){
 const name=instanceName(id),webhook=webhookSettings(tenant,id);
 const list=await evolution('/instance/fetchInstances?instanceName='+name);
 if(!Array.isArray(list))reject(502,'provider_response','Lista de instâncias inválida.');
 if(list.some(i=>(i.name??i.instance?.instanceName)===name)){
  await evolution('/webhook/set/'+name,'POST',{webhook});return;
 }
 await evolution('/instance/create','POST',{instanceName:name,integration:'WHATSAPP-BAILEYS',qrcode:false,groupsIgnore:true,webhook});
}
export async function send(instance,jid,message){
 const name=instanceName(instance);
 const number=jid.split('@')[0];
 if(message.kind==='text')return evolution('/message/sendText/'+name,'POST',{number,text:message.body});
 return evolution('/message/sendMedia/'+name,'POST',{number,mediatype:message.kind,mimetype:message.mime,caption:message.body,fileName:message.filename,media:message.media.toString('base64')});
}
