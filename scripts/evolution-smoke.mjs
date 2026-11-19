import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {configureInstance,evolution,instanceName} from '../src/evolution.mjs';
if(process.env.APP_ENV!=='test'||process.env.EVOLUTION_URL!=='http://127.0.0.1:8181')throw Error('Exige provedor descartável local.');
const tenant=randomUUID(),id=randomUUID(),name=instanceName(id);
await configureInstance(tenant,id);
try{
 await configureInstance(tenant,id);
 const existing=await evolution('/instance/fetchInstances?instanceName='+name);
 assert.ok(existing.some(i=>(i.name??i.instance?.instanceName)===name));
 const hook=await evolution('/webhook/find/'+name);
 assert.ok(hook.enabled && hook.url.endsWith('/'+tenant+'/'+id));
 const state=await evolution('/instance/connectionState/'+name);
 assert.ok(['close','connecting','open'].includes(state.instance?.state));
 console.log('Evolution real: criação, configuração idempotente, webhook e consulta de estado validados.');
 let qr=false;
 for(let i=0;i<3&&!qr;i++){
  try{const result=await evolution('/instance/connect/'+name);qr=String(result.base64??result.qrcode?.base64??'').startsWith('data:image/png;base64,');}catch{}
  if(!qr)await new Promise(r=>setTimeout(r,2000));
 }
 console.log(qr?'QR de vinculação recebido da instância descartável.':'QR não emitido pelo canal externo na janela de teste.');
}finally{await evolution('/instance/delete/'+name,'DELETE');}
