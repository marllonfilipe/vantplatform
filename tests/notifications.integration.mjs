import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import pg from 'pg';
import {chromium} from 'playwright-core';
import {servePage} from '../src/pages.mjs';
import {createApp} from '../src/app.mjs';
import {createPool,checkRuntime} from '../src/db.mjs';
import {featureRoutes} from '../src/routes.mjs';
import {hashPassword} from '../src/security.mjs';

test('notificações do fluxo chegam somente ao responsável e registram leitura no navegador',async()=>{
 assert.equal(process.env.APP_ENV,'test');
 const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
 const pool=createPool(process.env.DATABASE_URL),origin='http://127.0.0.1:3199';
 const server=createApp({pool,origin,featureRoutes,servePage,environment:'test'});
 let browser;
 const tenant=randomUUID(),other=randomUUID(),actor=randomUUID(),password=randomUUID(),email='gestor@example.invalid';
 try{
  await checkRuntime(pool);
  await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Fluxos'),($2,'Isolada')",[tenant,other]);
  await admin.query("INSERT INTO vant.members(tenant_id,id,email,name,role,password_hash) VALUES($1,$2,$3,'Gestor','owner',$4)",[tenant,actor,email,await hashPassword(password)]);
  await new Promise(resolve=>server.listen(3199,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api/v1/';
  let cookie='';
  const call=(path,method='GET',data)=>fetch(base+path,{method,headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify(data)});
  const login=await call('auth/login','POST',{tenantId:tenant,email,password});assert.equal(login.status,200);
  cookie=login.headers.get('set-cookie').split(';')[0];
  const worker=t=>promisify(execFile)(process.execPath,['src/worker.mjs','--once'],{env:{...process.env,VANT_WORKER_TENANT:t},timeout:30000});
  const recipient=randomUUID(),separate=randomUUID(),recipientEmail='vendas@example.invalid';
  const hash=await hashPassword(password);
  await admin.query("INSERT INTO vant.members(tenant_id,id,email,name,role,password_hash) VALUES($1,$2,$5,'Vendas','seller',$6),($3,$4,$5,'Outra empresa','owner',$6)",[tenant,recipient,other,separate,recipientEmail,hash]);
  const signedIn=async tenantId=>{
   const response=await call('auth/login','POST',{tenantId,email:recipientEmail,password});assert.equal(response.status,200);
   const session=response.headers.get('set-cookie').split(';')[0];
   return (path,method='GET')=>fetch(base+path,{method,headers:{origin,cookie:session,'content-type':'application/json'},body:method==='POST'?'{}':undefined});
  };
  const mine=await signedIn(tenant),isolated=await signedIn(other);
  const flow=await call('automations','POST',{name:'Aviso comercial',enabled:true,action_kind:'notify_owner',task_title:'Conta atribuída',
   steps:{match:[{kind:'notify_owner',title:'Revisar cadastro'}]}});
  assert.equal(flow.status,201);
  assert.equal((await call('crm/leads','POST',{name:'Cliente',owner_id:recipient})).status,201);
  await Promise.all([worker(tenant),worker(tenant)]);await worker(tenant);await worker(tenant);
  const [job]=(await (await call('automations/runs')).json()).items;
  assert.equal(job.state,'done');assert.deepEqual(job.history.map(h=>h.outcome),['notified','notified']);
  const pageOne=await (await mine('notifications?limit=1')).json();
  assert.deepEqual(pageOne.items.map(n=>n.title),['Revisar cadastro']);assert.ok(pageOne.nextCursor);
  const pageTwo=await (await mine('notifications?limit=1&cursor='+pageOne.nextCursor)).json();
  assert.deepEqual(pageTwo.items.map(n=>n.title),['Conta atribuída']);assert.equal(pageTwo.nextCursor,null);
  const id=pageOne.items[0].id;assert.equal(pageOne.items[0].read_at,null);
  assert.deepEqual((await (await call('notifications')).json()).items,[]);
  assert.deepEqual((await (await isolated('notifications')).json()).items,[]);
  assert.equal((await call('notifications/'+id+'/read','POST',{})).status,404);
  assert.equal((await isolated('notifications/'+id+'/read','POST')).status,404);
  assert.equal((await mine('notifications?cursor=bad')).status,400);
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/usr/bin/google-chrome',args:['--no-sandbox']});
  const page=await browser.newPage();
  await page.goto(origin);
  await page.getByLabel('Identificador da empresa').fill(tenant);
  await page.getByLabel('E-mail',{exact:true}).fill(recipientEmail);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button',{name:'Entrar'}).click();
  await page.locator('#notifications').click();
  const row=page.locator('.row').filter({has:page.getByText('Revisar cadastro',{exact:true})});
  await row.getByRole('button',{name:'Marcar como lida'}).click();await row.getByText('Lida',{exact:true}).waitFor();
  const [first,second]=(await (await mine('notifications')).json()).items;
  assert.ok(first.read_at);assert.equal(second.read_at,null);
  assert.equal((await (await mine('notifications/'+id+'/read','POST')).json()).read_at,first.read_at);
 }finally{
  await browser?.close();
  if(server.listening)await new Promise(resolve=>server.close(resolve));
  await pool.end();await admin.end();
 }
});
