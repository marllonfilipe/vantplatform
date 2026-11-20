import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
import {createPool,checkRuntime,withTenant} from '../src/db.mjs';
import {createApp} from '../src/app.mjs';
import {featureRoutes} from '../src/routes.mjs';
import {hashPassword} from '../src/security.mjs';

test('intervalo versionado adia a primeira ação sob concorrência e preserva as etapas',async()=>{
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
  const spec={name:'Distribuição de contatos',enabled:true,task_title:'Triar contato',cooldown_minutes:60,
   steps:{match:[{kind:'followup',title:'Revisar contato',wait_minutes:10}]}};
  for(const value of [-1,1.5,43201,null]){
   assert.equal((await call('automations','POST',{...spec,cooldown_minutes:value})).status,400);
  }
  const publish=await call('automations','POST',spec);assert.equal(publish.status,201);
  const flow=(await publish.json()).id;
  const addLead=async name=>assert.equal((await call('crm/leads','POST',{name})).status,201);
  const runs=async()=>(await (await call('automations/runs')).json()).items.filter(j=>j.payload.flow===flow);
  const due=id=>admin.query("UPDATE vant.jobs SET available_at=now() WHERE tenant_id=$1 AND id=$2",[tenant,id]);
  await addLead('Primeiro contato');await addLead('Segundo contato');
  await Promise.all([worker(tenant),worker(tenant)]);
  const list=await runs();
  assert.equal(list.length,2);
  const admitted=list.find(j=>j.attempts===1),waiting=list.find(j=>j.payload.frequency_deferred);
  assert.ok(admitted&&waiting);assert.equal(admitted.history[0].outcome,'created');
  assert.equal(waiting.state,'queued');assert.equal(waiting.attempts,0);assert.deepEqual(waiting.history,[]);
  const schedule=await admin.query(`SELECT j.available_at=s.started_at+interval '60 minutes' AS exact,
   j.available_at>now() AS future FROM vant.jobs j JOIN vant.automation_starts s ON s.tenant_id=j.tenant_id
   WHERE j.tenant_id=$1 AND j.id=$2 AND s.flow_id=$3`,[tenant,waiting.id,flow]);
  assert.deepEqual(schedule.rows,[{exact:true,future:true}]);
  await withTenant(pool,other,async db=>{
   assert.equal((await db.query('SELECT flow_id FROM vant.automation_starts WHERE flow_id=$1',[flow])).rowCount,0);
  });
  await due(admitted.id);await worker(tenant);
  const finished=(await runs()).find(j=>j.id===admitted.id);
  assert.equal(finished.state,'done');assert.deepEqual(finished.history.map(h=>h.step_index),[0,1]);
  const update=await call('automations/'+flow,'PUT',{...spec,expected_version:1,cooldown_minutes:0,steps:{}});
  assert.equal(update.status,200);
  await addLead('Terceiro contato');await worker(tenant);
  const newer=(await runs()).find(j=>j.payload.version===2);assert.equal(newer.state,'done');
  await due(waiting.id);await worker(tenant);
  assert.equal((await runs()).find(j=>j.id===waiting.id).attempts,0);
  await admin.query("UPDATE vant.automation_starts SET started_at=now()-interval '2 hours' WHERE tenant_id=$1 AND flow_id=$2",[tenant,flow]);
  await due(waiting.id);await worker(tenant);
  const resumed=(await runs()).find(j=>j.id===waiting.id);
  assert.equal(resumed.attempts,1);assert.equal(resumed.payload.step,1);assert.equal(resumed.payload.frequency_deferred,undefined);
  await due(waiting.id);await worker(tenant);
  assert.ok((await runs()).every(j=>j.state==='done'));
  const activities=await admin.query('SELECT title,count(*)::int AS total FROM vant.activities WHERE tenant_id=$1 GROUP BY title ORDER BY title',[tenant]);
  assert.deepEqual(activities.rows,[{title:'Revisar contato',total:2},{title:'Triar contato',total:3}]);
 }finally{if(server.listening)await new Promise(resolve=>server.close(resolve));await pool.end();await admin.end();}
});
