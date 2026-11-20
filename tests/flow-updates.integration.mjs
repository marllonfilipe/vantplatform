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

test('fluxo atualiza campos do CRM preservando tags, versão, histórico e valores já aplicados',async()=>{
 assert.equal(process.env.APP_ENV,'test');
 const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
 const pool=createPool(process.env.DATABASE_URL),origin='http://127.0.0.1:3200';
 const server=createApp({pool,origin,featureRoutes,servePage,environment:'test'});
 let browser;
 const tenant=randomUUID(),other=randomUUID(),actor=randomUUID(),password=randomUUID(),email='gestor@example.invalid';
 try{
  await checkRuntime(pool);
  await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Fluxos'),($2,'Isolada')",[tenant,other]);
  await admin.query("INSERT INTO vant.members(tenant_id,id,email,name,role,password_hash) VALUES($1,$2,$3,'Gestor','owner',$4)",[tenant,actor,email,await hashPassword(password)]);
  await new Promise(resolve=>server.listen(3200,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api/v1/';
  let cookie='';
  const call=(path,method='GET',data)=>fetch(base+path,{method,headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify(data)});
  const login=await call('auth/login','POST',{tenantId:tenant,email,password});assert.equal(login.status,200);
  cookie=login.headers.get('set-cookie').split(';')[0];
  const worker=t=>promisify(execFile)(process.execPath,['src/worker.mjs','--once'],{env:{...process.env,VANT_WORKER_TENANT:t},timeout:30000});
  const spec={name:'Segmentação',enabled:true,action_kind:'update_record',action_changes:{segment:'Indústria',add_tag:'Qualificado'}};
  for(const changes of [{},{probability:50},{owner_id:actor}]){
   assert.equal((await call('automations','POST',{...spec,action_changes:changes})).status,400);
  }
  assert.equal((await call('automations','POST',{...spec,trigger_event:'lead_updated'})).status,400);
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/usr/bin/google-chrome',args:['--no-sandbox']});
  const page=await browser.newPage();
  await page.goto(origin);
  await page.getByLabel('Identificador da empresa').fill(tenant);
  await page.getByLabel('E-mail',{exact:true}).fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button',{name:'Entrar'}).click();
  await page.getByRole('button',{name:'Automações',exact:true}).click();
  await page.getByRole('button',{name:'Criar fluxo'}).click();
  await page.getByLabel('Nome do fluxo').fill(spec.name);
  await page.getByLabel('Ação principal',{exact:true}).selectOption('update_record');
  const changes=page.getByRole('group',{name:'Alterações da ação principal',exact:true});
  await changes.getByLabel('Definir segmento').fill('Indústria');await changes.getByLabel('Adicionar tag').fill('Qualificado');
  await page.getByLabel('Ativar fluxo').check();await page.getByRole('button',{name:'Publicar versão'}).click();
  await page.getByRole('heading',{name:spec.name,exact:true}).waitFor();
  const [flow]=(await (await call('automations')).json()).items;
  const leadRes=await call('crm/leads','POST',{name:'Conta',segment:'Serviços',tags:['Evento']});
  assert.equal(leadRes.status,201);const lead=(await leadRes.json()).id;
  assert.equal((await call('automations/'+flow.id,'PUT',{...spec,action_changes:{segment:'Varejo'},expected_version:1})).status,200);
  await Promise.all([worker(tenant),worker(tenant)]);
  const current=await (await call('crm/leads/'+lead)).json();assert.equal(current.segment,'Indústria');assert.deepEqual(current.tags,['Evento','Qualificado']);
  let jobs=(await (await call('automations/runs')).json()).items;
  assert.equal(jobs.length,1);assert.equal(jobs[0].payload.version,1);
  assert.equal(jobs[0].history[0].outcome,'updated');assert.deepEqual(jobs[0].history[0].record_change.fields.sort(),['segment','tags']);
  const history=(await (await call('crm/leads/'+lead+'/history')).json()).items;
  assert.equal(history.filter(h=>h.action==='updated').length,1);
  assert.deepEqual(history.find(h=>h.action==='updated').changes.tags,{from:['Evento'],to:['Evento','Qualificado']});
  const dealSpec={name:'Previsão comercial',trigger_event:'deal_created',enabled:true,source_filter:'Indicação',
   task_title:'Revisar indicação',else_kind:'update_record',else_changes:{probability:75},
   steps:{otherwise:[{kind:'update_record',changes:{probability:75}},{kind:'summarize'}]}};
  assert.equal((await call('automations','POST',{...dealSpec,else_changes:{probability:101}})).status,400);
  assert.equal((await call('automations','POST',dealSpec)).status,201);
  const setup=await call('crm/pipelines','POST',{name:'Funil',stages:['Entrada','Proposta']});
  assert.equal(setup.status,201);const pipeline=(await setup.json()).id;
  const {stages}=(await (await call('crm/pipelines')).json()).items.find(p=>p.id===pipeline);
  const created=await call('crm/deals','POST',{name:'Contrato',source:'Feira',pipeline_id:pipeline,stage_id:stages[0].id,amount_cents:50000,probability:20});
  assert.equal(created.status,201);const deal=(await created.json()).id;
  await worker(tenant);await worker(tenant);await worker(tenant);
  const updated=await (await call('crm/deals/'+deal)).json();
  assert.equal(updated.probability,75);assert.equal(updated.stage_id,stages[0].id);assert.equal(Number(updated.amount_cents),50000);
  jobs=(await (await call('automations/runs')).json()).items.filter(j=>j.payload.deal===deal);
  assert.equal(jobs.length,1);assert.deepEqual(jobs[0].history.map(h=>h.outcome),['updated','unchanged','summarized']);
  const [snapshot]=jobs[0].history[2].summary;
  assert.equal(snapshot.id,deal);assert.equal(snapshot.analysis,null);
  assert.equal(snapshot.facts.probability,75);assert.equal(snapshot.facts.stage,'Entrada');
  await page.getByRole('button',{name:'Automações',exact:true}).click();
  await page.getByText('Previsão comercial · v1 · Concluído',{exact:true}).click();
  await page.getByRole('heading',{name:'Oportunidade · Contrato'}).waitFor();
  await page.getByText('Sem análise registrada no Core.',{exact:true}).waitFor();
  const changesLog=(await (await call('crm/deals/'+deal+'/history')).json()).items.filter(h=>h.action==='updated');
  assert.equal(changesLog.length,1);assert.deepEqual(changesLog[0].changes.probability,{from:20,to:75});
 }finally{
  await browser?.close();
  if(server.listening)await new Promise(resolve=>server.close(resolve));
  await pool.end();await admin.end();
 }
});
