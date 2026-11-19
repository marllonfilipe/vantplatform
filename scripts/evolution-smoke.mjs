import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import pg from 'pg';
import {createApp} from '../src/app.mjs';
import {featureRoutes} from '../src/routes.mjs';
import {createPool} from '../src/db.mjs';
import {hashPassword} from '../src/security.mjs';
import {evolution,instanceName} from '../src/evolution.mjs';
if(process.env.APP_ENV!=='test'||process.env.EVOLUTION_URL!=='http://127.0.0.1:8181'||process.env.WA_CALLBACK_ORIGIN!=='http://127.0.0.1:3192')throw Error('Exige provedor descartável local.');
const origin=process.env.WA_CALLBACK_ORIGIN;
const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
const pool=createPool(process.env.DATABASE_URL),server=createApp({pool,origin,environment:'test',featureRoutes});
let cookie,id,acceptedCallbacks=0;
server.prependListener('request',(req,res)=>{
 if(req.url.startsWith('/hooks/evolution/'))res.once('finish',()=>{if(res.statusCode===200)acceptedCallbacks++;});
});
async function api(path,method='GET',body){
 const response=await fetch(origin+'/api/v1/'+path,{method,headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok){const failure=await response.json();throw Error('Rota de homologação falhou: '+response.status+' '+failure.error?.code);}
 if(path==='auth/login')cookie=response.headers.get('set-cookie').split(';')[0];
 return response.json();
}
try{
 const tenantId=randomUUID(),password=randomUUID(),email='evolution@vant.invalid';
 await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Teste Evolution')",[tenantId]);
 await admin.query("INSERT INTO vant.members(tenant_id,name,email,role,password_hash) VALUES($1,'Gestor',$2,'owner',$3)",[tenantId,email,await hashPassword(password)]);
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(3192,'127.0.0.1',ok);});
 await api('auth/login','POST',{tenantId,email,password});id=(await api('inbox/instances','POST',{label:'Evolution descartável'})).id;
 const url='inbox/instances/'+id,name=instanceName(id);
 await api(url+'/activate','POST',{});await api(url+'/activate','POST',{});
 assert.ok((await evolution('/instance/fetchInstances?instanceName='+name)).some(i=>(i.name??i.instance?.instanceName)===name));
 const hook=await evolution('/webhook/find/'+name);assert.ok(hook.enabled && hook.url.endsWith('/'+tenantId+'/'+id));
 assert.ok(['close','connecting','open'].includes((await api(url+'/status')).state));
 console.log('V4NT → Evolution: criação, configuração idempotente, webhook e consulta de estado validados.');
 let qr=false;
 for(let n=0;n<8&&!qr;n++){
  const result=await api(url+'/qr','POST',{});qr=typeof result.qr==='string'&&result.qr.startsWith('data:image/png;base64,');if(!qr)await wait(2000);
 }
 assert.ok(qr,'O provedor não emitiu QR no prazo.');console.log('QR de vinculação recebido pela API da V4NT.');
 for(let n=0;n<10&&!acceptedCallbacks;n++)await wait(1000);
 assert.ok(acceptedCallbacks>0,'O provedor não entregou evento autenticado ao servidor V4NT.');
 console.log('Evolution → V4NT: webhook real autenticado e aceito.');
 await api(url+'/remove','POST',{});assert.ok(!(await api('inbox/instances')).items.some(r=>r.id===id));id=null;
}finally{
 if(id)await evolution('/instance/delete/'+instanceName(id),'DELETE').catch(()=>{});
 if(server.listening)await new Promise(ok=>server.close(ok));await pool.end();await admin.end();
}
