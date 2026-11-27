import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
import {createServer} from 'node:https';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,createHmac} from 'node:crypto';
import {servePage} from '../src/pages.mjs';
import {createApp} from '../src/app.mjs';
import {createPool,checkRuntime} from '../src/db.mjs';
import {featureRoutes} from '../src/routes.mjs';
import {hashPassword} from '../src/security.mjs';

test('worker entrega webhook assinado em HTTPS com repetição, isolamento e destino fixado',async()=>{
 assert.equal(process.env.APP_ENV,'test');
 const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
 const pool=createPool(process.env.DATABASE_URL),origin='http://127.0.0.1:3204';
 const server=createApp({pool,origin,featureRoutes,servePage,environment:'test'});
 const dir=await mkdtemp(join(tmpdir(),'vant-webhook-'));let receiver;
 const tenant=randomUUID(),other=randomUUID(),actor=randomUUID(),password=randomUUID(),email='gestor@example.invalid';
 try{
  await checkRuntime(pool);
  await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Fluxos'),($2,'Isolada')",[tenant,other]);
  await admin.query("INSERT INTO vant.members(tenant_id,id,email,name,role,password_hash) VALUES($1,$2,$3,'Gestor','owner',$4)",[tenant,actor,email,await hashPassword(password)]);
  await new Promise(resolve=>server.listen(3204,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api/v1/';
  let cookie='';
  const call=(path,method='GET',data)=>fetch(base+path,{method,headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify(data)});
  const login=await call('auth/login','POST',{tenantId:tenant,email,password});assert.equal(login.status,200);
  cookie=login.headers.get('set-cookie').split(';')[0];
  const certificate=join(dir,'receiver.pem'),privateKey=join(dir,'key.pem');
  await promisify(execFile)('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1','-keyout',privateKey,'-out',certificate]);
  const secret=randomBytes(32).toString('hex'),requests=[];
  let response=429;
  receiver=createServer({key:await readFile(privateKey),cert:await readFile(certificate)},async(req,res)=>{
   let body='';for await(const chunk of req)body+=chunk;
   const stamp=req.headers['x-v4nt-timestamp'],signature=req.headers['x-v4nt-signature'];
   const valid=signature==='sha256='+createHmac('sha256',secret).update(stamp+'.'+body).digest('hex');
   requests.push({path:req.url,id:req.headers['idempotency-key'],body,valid});
   res.writeHead(valid?response:401,response===307?{location:'/redirected'}:{});res.end();
  });
  await new Promise(resolve=>receiver.listen(0,'127.0.0.1',resolve));
  const endpoint='https://127.0.0.1:'+receiver.address().port+'/events';
  const run=(overrides={})=>promisify(execFile)(process.execPath,['src/worker.mjs','--once'],{timeout:30000,env:{...process.env,
   VANT_WORKER_TENANT:tenant,VANT_FLOW_WEBHOOK_TENANT:tenant,VANT_FLOW_WEBHOOK_URL:endpoint,VANT_FLOW_WEBHOOK_KEY:secret,NODE_EXTRA_CA_CERTS:certificate,...overrides}});
  assert.equal((await call('automations','POST',{name:'Evento interno',enabled:true,action_kind:'webhook',
   steps:{match:[{kind:'comment',title:'Entrega confirmada'}]}})).status,201);
  const add=async name=>{const res=await call('crm/leads','POST',{name});assert.equal(res.status,201);return (await res.json()).id;};
  const job=async id=>(await (await call('automations/runs')).json()).items.find(j=>j.payload.lead===id);
  const due=id=>admin.query('UPDATE vant.jobs SET available_at=now() WHERE tenant_id=$1 AND id=$2',[tenant,id]);
  const lead=await add('Nome comercial privado');
  await run();assert.equal(requests.length,0);
  await run();
  let j=await job(lead);assert.equal(j.attempts,1);assert.equal(j.history[0].reason,'webhook_http');assert.equal(j.history[0].webhook.status,429);
  const hub=async()=>(await (await call('integrations')).json()).webhook;
  const waiting=await hub();
  assert.equal(waiting.last_delivery,null);
  assert.equal(waiting.attempts[0].http_status,429);
  assert.equal(waiting.attempts[0].outcome,'retry');
  assert.equal(j.payload.step,0);await due(j.id);
  response=204;await run();await run();await run();
  j=await job(lead);assert.equal(j.state,'done');assert.deepEqual(j.history.map(h=>h.outcome),['retry','delivered','created']);
  assert.equal(j.history[1].webhook.status,204);assert.equal(j.payload.webhook_delivery,undefined);
  const confirmed=await hub();
  assert.equal(confirmed.last_delivery,confirmed.attempts[0].created_at);
  assert.deepEqual(confirmed.attempts.map(r=>[r.outcome,r.http_status]),[['delivered',204],['retry',429]]);
  assert.deepEqual(Object.keys(confirmed.attempts[0]).sort(),['created_at','http_status','outcome','reason']);
  assert.equal(requests.length,2);assert.ok(requests.every(r=>r.valid&&r.path==='/events'));
  assert.equal(requests[0].id,requests[1].id);assert.equal(requests[0].body,requests[1].body);
  const sent=JSON.parse(requests[0].body);assert.equal(sent.lead,lead);assert.equal(sent.id,j.history[1].webhook.id);
  assert.deepEqual(Object.keys(sent).sort(),['event','flow','id','lead','step','tenant','version']);
  const redirected=await add('Teste de redirecionamento');response=307;
  await run();await run();assert.equal((await job(redirected)).state,'failed');
  assert.equal(requests.length,3);assert.equal(requests[2].path,'/events');
  const changed=await add('Teste de destino');await run();await run({VANT_FLOW_WEBHOOK_URL:endpoint+'-outro'});
  assert.equal((await job(changed)).history[0].reason,'webhook_destination_changed');
  const blocked=await add('Teste de escopo');await run({VANT_FLOW_WEBHOOK_TENANT:other});
  assert.equal((await job(blocked)).history[0].reason,'webhook_config');assert.equal(requests.length,3);
 }finally{
  if(receiver?.listening)await new Promise(resolve=>receiver.close(resolve));
  if(server.listening)await new Promise(resolve=>server.close(resolve));
  await pool.end();await admin.end();await rm(dir,{recursive:true,force:true});
 }
});
