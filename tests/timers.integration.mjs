import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
import {createPool,checkRuntime} from '../src/db.mjs';
import {createApp} from '../src/app.mjs';
import {featureRoutes} from '../src/routes.mjs';
import {hashPassword} from '../src/security.mjs';

test('worker captura episódios de inatividade e vencimento sem repetir efeitos',async()=>{
 assert.equal(process.env.APP_ENV,'test');
 const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
 const pool=createPool(process.env.DATABASE_URL),origin='http://localhost';
 const server=createApp({pool,origin,featureRoutes,environment:'test'});
 const tenant=randomUUID(),other=randomUUID(),actor=randomUUID(),password=randomUUID(),email='agenda@example.invalid';
 try{
  await checkRuntime(pool);
  await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Agenda'),($2,'Separada')",[tenant,other]);
  await admin.query("INSERT INTO vant.members(tenant_id,id,email,name,role,password_hash) VALUES($1,$2,$3,'Gestora','owner',$4)",[tenant,actor,email,await hashPassword(password)]);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api/v1/';
  let cookie='';
  const call=(path,method='GET',body)=>fetch(base+path,{method,headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify(body)});
  const login=await call('auth/login','POST',{tenantId:tenant,email,password});assert.equal(login.status,200);
  cookie=login.headers.get('set-cookie').split(';')[0];
  const worker=t=>promisify(execFile)(process.execPath,['src/worker.mjs','--once'],{env:{...process.env,VANT_WORKER_TENANT:t},timeout:30000});
  const specs=['lead_inactive','task_overdue'].map(trigger_event=>({name:trigger_event,trigger_event,enabled:true,task_title:trigger_event,action_kind:'task',due_minutes:0,wait_minutes:0}));
  const ids=[];
  for(const spec of specs){const res=await call('automations','POST',spec);assert.equal(res.status,201);ids.push((await res.json()).id);}
  const lead=(await (await call('crm/leads','POST',{name:'Cliente'})).json()).id;
  await admin.query("UPDATE vant.leads SET created_at=now()-interval '15 days' WHERE tenant_id=$1 AND id=$2",[tenant,lead]);
  const createTask=async title=>(await (await call('crm/activities','POST',{kind:'task',title,lead_id:lead,due_at:new Date(Date.now()-3600000).toISOString()})).json()).id;
  const first=await createTask('Pendência');
  const runs=async()=>(await (await call('automations/runs')).json()).items;
  await worker(other);assert.deepEqual(await runs(),[]);
  await Promise.all([worker(tenant),worker(tenant)]);
  await worker(tenant);await worker(tenant);
  let jobs=await runs();
  assert.deepEqual(jobs.map(j=>j.payload.event).sort(),['lead_inactive','task_overdue']);
  assert.ok(jobs.every(j=>j.state==='done'&&j.attempts===1&&j.history[0].activity_id));
  assert.equal(jobs.find(j=>j.payload.event==='task_overdue').payload.source_activity,first);
  for(const [i,spec] of specs.entries())assert.equal((await call('automations/'+ids[i],'PUT',{...spec,expected_version:1,wait_minutes:60})).status,200);
  const second=await createTask('Concluída durante espera');
  await admin.query("UPDATE vant.leads SET last_contact_at=now()-interval '14 days 1 second' WHERE tenant_id=$1 AND id=$2",[tenant,lead]);
  await worker(tenant);
  jobs=await runs();
  assert.equal(jobs.filter(j=>j.state==='queued').length,2);
  assert.equal((await call('crm/activities/'+second,'PATCH',{done_at:new Date().toISOString()})).status,200);
  assert.equal((await call('crm/activities','POST',{kind:'call',title:'Contato recente',lead_id:lead,done_at:new Date().toISOString()})).status,201);
  await admin.query("UPDATE vant.jobs SET available_at=now() WHERE tenant_id=$1 AND state='queued'",[tenant]);
  await worker(tenant);await worker(tenant);await worker(tenant);
  jobs=await runs();
  assert.equal(jobs.length,4);
  assert.deepEqual(jobs.filter(j=>j.payload.version===2).map(j=>j.history[0].outcome),['skipped','skipped']);
 }finally{if(server.listening)await new Promise(resolve=>server.close(resolve));await pool.end();await admin.end();}
});
