import {createHash,createHmac} from 'node:crypto';

function deliveryError(code,status=null,permanent=false){
 return Object.assign(new Error(code),{code,status,permanent});
}

export function webhookDestination(tenant){
 const key=process.env.VANT_FLOW_WEBHOOK_KEY;
 if(tenant!==process.env.VANT_FLOW_WEBHOOK_TENANT||!key||Buffer.byteLength(key)<32)
  throw deliveryError('webhook_config');
 let url;
 try{url=new URL(process.env.VANT_FLOW_WEBHOOK_URL);}catch{throw deliveryError('webhook_config');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)
  throw deliveryError('webhook_config');
 return {url,key,fingerprint:createHash('sha256').update(url.href).digest('hex')};
}

export function prepareWebhook(tenant,job,step,destination){
 const {flow,version,event,lead,deal,meeting,source_activity}=job.payload;
 const id=job.id+'.'+step;
 const body=JSON.stringify({id,tenant,flow,version,event:event??'lead_created',step:step+1,lead,deal,meeting,source_activity});
 return {id,body,fingerprint:destination.fingerprint};
}

export async function sendFlowWebhook(prepared,destination){
 if(destination.fingerprint!==prepared.fingerprint)throw deliveryError('webhook_destination_changed',null,true);
 const timestamp=String(Math.floor(Date.now()/1000));
 const signature=createHmac('sha256',destination.key).update(timestamp+'.'+prepared.body).digest('hex');
 let response;
 try{
  response=await fetch(destination.url,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(5000),
   headers:{'content-type':'application/json','idempotency-key':prepared.id,'x-v4nt-timestamp':timestamp,'x-v4nt-signature':'sha256='+signature},body:prepared.body});
 }catch{throw deliveryError('webhook_network');}
 // Headers are sufficient for acknowledgment. Never store the receiver's response body.
 await response.body?.cancel().catch(()=>{});
 if(!response.ok){
  const retryable=response.status===408||response.status===429||response.status>=500;
  throw deliveryError('webhook_http',response.status,!retryable);
 }
 return {id:prepared.id,status:response.status};
}
