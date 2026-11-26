import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {chromium} from 'playwright-core';
import {servePage} from '../src/pages.mjs';
import {createApp} from '../src/app.mjs';
import {createPool,checkRuntime} from '../src/db.mjs';
import {featureRoutes} from '../src/routes.mjs';
import {hashPassword} from '../src/security.mjs';

test('receita concilia fechamentos, ticket, ciclo, vendedor e origem no intervalo de São Paulo',async()=>{
 assert.equal(process.env.APP_ENV,'test');
 const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
 const pool=createPool(process.env.DATABASE_URL),origin='http://127.0.0.1:3207';
 const server=createApp({pool,origin,featureRoutes,servePage,environment:'test'});
 let browser;
 const tenant=randomUUID(),other=randomUUID(),actor=randomUUID(),password=randomUUID(),email='gestor@example.invalid';
 try{
  await checkRuntime(pool);
  await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Fluxos'),($2,'Isolada')",[tenant,other]);
  await admin.query("INSERT INTO vant.members(tenant_id,id,email,name,role,password_hash) VALUES($1,$2,$3,'Gestor','owner',$4)",[tenant,actor,email,await hashPassword(password)]);
  await new Promise(resolve=>server.listen(3207,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api/v1/';
  let cookie='';
  const call=(path,method='GET',data)=>fetch(base+path,{method,headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify(data)});
  const login=await call('auth/login','POST',{tenantId:tenant,email,password});assert.equal(login.status,200);
  cookie=login.headers.get('set-cookie').split(';')[0];
  const seller=randomUUID(),hash=await hashPassword(password);
  await admin.query("INSERT INTO vant.members(tenant_id,id,email,name,role,password_hash) VALUES($1,$2,'seller@example.invalid','Consultora','seller',$3),($4,$5,$6,'Isolada','owner',$3)",[tenant,seller,hash,other,randomUUID(),email]);
  const setup=await call('crm/pipelines','POST',{name:'Vendas',stages:['Fechamento']});assert.equal(setup.status,201);
  const pipeline=(await setup.json()).id,stage=(await (await call('crm/pipelines')).json()).items.find(p=>p.id===pipeline).stages[0].id;
  const team=await call('teams','POST',{name:'Sul'});assert.equal(team.status,201);
  const teamId=(await team.json()).id;
  const account=await call('crm/accounts','POST',{name:'Conta industrial',segment:'Indústria'});assert.equal(account.status,201);
  const accountId=(await account.json()).id;
  async function deal(name,status,amount,owner,source,created,closed){
   const response=await call('crm/deals','POST',{name,status,amount_cents:amount,owner_id:owner,source,probability:50,pipeline_id:pipeline,stage_id:stage,...(owner===seller?{team_id:teamId,account_id:accountId}:{}),...(status==='lost'?{loss_reason:'Prazo'}:{})});
   assert.equal(response.status,201);
   const id=(await response.json()).id;
   await admin.query('UPDATE vant.deals SET created_at=$2,closed_at=$3 WHERE tenant_id=$4 AND id=$1',[id,created,closed,tenant]);
   return id;
  }
  await deal('Ganho inicial','won',10000,actor,'Feira','2025-02-01T03:00:00Z','2025-03-01T03:00:00Z');
  const wonBySeller=await deal('Ganho final','won',30000,seller,'=Feira; "Sul"','2025-03-02T02:59:59Z','2025-04-01T02:59:59Z');
  await deal('Perda confirmada','lost',20000,actor,'Feira','2025-01-02T12:00:00Z','2025-03-20T12:00:00Z');
  await deal('Fora do período','won',90000,actor,'Feira','2025-02-01T02:00:00Z','2025-03-01T02:59:59Z');
  await deal('Período seguinte','won',90000,actor,'Feira','2025-03-01T02:00:00Z','2025-04-01T03:00:00Z');
  await deal('Ainda aberta','open',100000,seller,'Indicação','2025-03-01T02:00:00Z',null);
  async function activity(title,kind,owner,due,done,dealId){
   const response=await call('crm/activities','POST',{title,kind,owner_id:owner,due_at:due,done_at:done,deal_id:dealId});
   assert.equal(response.status,201);
  }
  await activity('Ligação no prazo','call',seller,'2025-03-01T03:00:00Z','2025-03-01T03:00:00Z',wonBySeller);
  await activity('Reunião após o prazo','meeting',actor,'2025-03-05T12:00:00Z','2025-03-06T12:00:00Z',null);
  await activity('Concluída somente em abril','task',actor,'2025-04-01T02:59:59Z','2025-04-01T03:00:00Z',null);
  await activity('Contato sem prazo','followup',seller,null,'2025-03-07T12:00:00Z',wonBySeller);
  await activity('Prazo futuro','reminder',seller,'2025-04-01T03:00:00Z',null,wonBySeller);
  const path='revenue/closed?from=2025-03-01&to=2025-03-31',all=await (await call(path)).json();
  assert.deepEqual(all.period,{from:'2025-03-01',to:'2025-03-31'});
  const agenda=all.activities.total;
  assert.deepEqual([agenda.completed,agenda.due,agenda.on_time,agenda.pending,agenda.on_time_pct],[3,3,1,1,'33.33']);
  for(const kind of ['owner','kind'])assert.equal(all.activities.groups.filter(row=>row.kind===kind).reduce((sum,row)=>sum+row.completed,0),3);
  assert.equal(all.total.closed,3);assert.equal(all.total.won,2);assert.equal(all.total.lost,1);
  assert.equal(all.total.revenue_cents,'40000');assert.equal(all.total.average_ticket_cents,'20000');
  assert.equal(Number(all.total.average_cycle_days),29);assert.equal(Number(all.total.conversion_pct),66.67);
  for(const kind of ['source','seller','stage','team','segment','pipeline'])assert.equal(all.groups.filter(r=>r.kind===kind).reduce((n,r)=>n+Number(r.revenue_cents),0),40000);
  for(const [kind,label] of [['team','Sul'],['segment','Indústria']]){
   const groups=all.groups.filter(r=>r.kind===kind);
   assert.equal(groups.length,2);
   assert.equal(groups.find(r=>r.label===label).revenue_cents,'30000');
   assert.equal(groups.find(r=>r.id===null).revenue_cents,'10000');
  }
  assert.equal(all.groups.find(r=>r.kind==='pipeline').label,'Vendas');
  const cut=await (await call(path+'&pipeline='+pipeline+'&team='+teamId+'&segment='+encodeURIComponent('indústria'))).json();
  assert.equal(cut.total.revenue_cents,'30000');
  assert.equal(cut.activities.total.completed,2);
  assert.equal((await (await call(path+'&team='+randomUUID())).json()).total.closed,0);
  assert.equal((await call(path+'&pipeline=invalido')).status,400);
  assert.deepEqual(all.groups.filter(r=>r.kind==='loss').map(r=>[r.label,r.lost]),[['Prazo',1]]);
  assert.equal((await (await call(path+'&source=feira')).json()).total.revenue_cents,'10000');
  assert.equal((await call('revenue/closed?from=2025-02-31&to=2025-03-01')).status,400);
  assert.equal((await call('revenue/closed?from=0000-01-01&to=2025-03-01')).status,400);
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/usr/bin/google-chrome',args:['--no-sandbox']});
  const page=await browser.newPage();await page.goto(origin);
  await page.getByLabel('Identificador da empresa').fill(tenant);await page.getByLabel('E-mail',{exact:true}).fill(email);
  await page.getByLabel('Senha').fill(password);await page.getByRole('button',{name:'Entrar'}).click();
  await page.getByRole('button',{name:'Receita comercial',exact:true}).click();
  await page.getByLabel('Fechamentos a partir de').fill('2025-03-01');await page.getByLabel('Fechamentos até').fill('2025-03-31');
  await page.getByRole('button',{name:'Aplicar filtros'}).click();await page.getByText('2 / 1',{exact:true}).waitFor();
  await page.getByRole('heading',{name:'Atividades comerciais',exact:true}).waitFor();
  await page.getByText('2 concluídas · 1 de 1 no prazo · 0 pendentes no corte').first().waitFor();
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportar CSV'}).click();
  const file=await download;assert.equal(file.suggestedFilename(),'receita-2025-03-01-2025-03-31.csv');
  const chunks=[];for await(const chunk of await file.createReadStream())chunks.push(chunk);
  const csv=Buffer.concat(chunks).toString('utf8');
  assert.ok(csv.includes('"Atividades comerciais";"Total"'));
  assert.ok(csv.includes('"3";"3";"1";"1";"33.33"'));
  assert.ok(csv.includes(`"Origem";"'=Feira; ""Sul"""`));
  assert.match(csv,/"Total";"Total";"3";"2";"1";"40000";"20000";/);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.getByRole('button',{name:'Exportar CSV'}).isVisible(),false);
  assert.equal(await page.getByText('2 / 1',{exact:true}).isVisible(),true);
  assert.equal((await page.pdf({format:'A4'})).subarray(0,5).toString(),'%PDF-');
  await page.emulateMedia({media:'screen'});
  await page.getByLabel('Equipe do negócio').selectOption(teamId);
  await page.getByLabel('Segmento',{exact:true}).fill('indústria');
  await page.getByLabel('Pipeline',{exact:true}).selectOption(pipeline);
  await page.getByRole('button',{name:'Aplicar filtros'}).click();
  await page.getByText('1 / 0',{exact:true}).waitFor();
  for(const [name,offset,amount,owner] of [['Hoje',0,10001,actor],['Último dia',29,30001,seller],['Depois',30,70000,actor],['Vencida',-1,80000,actor]]){
   const id=await deal(name,'open',amount,owner,'Cadastro','2025-01-01T12:00:00Z',null);
   await admin.query("UPDATE vant.deals SET close_on=(now() AT TIME ZONE 'America/Sao_Paulo')::date+$3::int WHERE id=$1 AND tenant_id=$2",[id,tenant,offset]);
  }
  const forecast=await (await call('revenue/forecast?days=30')).json();
  const bucket=key=>forecast.coverage.find(row=>row.bucket===key);
  assert.equal(bucket('within').deals,2);assert.equal(bucket('within').weighted_cents,'20002');
  assert.equal(bucket('within').value_cents,'40002');
  assert.equal(forecast.stages[0].weighted_cents,'20002');
  assert.equal(bucket('overdue').deals,1);assert.equal(bucket('undated').deals,1);assert.equal(bucket('later').deals,1);
  assert.equal((await call('revenue/forecast?days=0')).status,400);
  const sixty=await (await call('revenue/forecast?days=60')).json();
  assert.equal(sixty.coverage.find(row=>row.bucket==='within').deals,3);
  await page.getByRole('button',{name:'Previsão de receita',exact:true}).click();
  await page.getByRole('heading',{name:'Projeção pela probabilidade do CRM'}).waitFor();
  await page.getByLabel('Horizonte da projeção').selectOption('60');
  await page.getByText(/3 negócios · estimativa/).waitFor();
  const historical=await call('crm/pipelines','POST',{name:'Histórico controlado',stages:['Fechamento']});
  assert.equal(historical.status,201);
  const historicalId=(await historical.json()).id;
  const historicalStage=(await (await call('crm/pipelines')).json()).items.find(item=>item.id===historicalId).stages[0].id;
  const historyArgs=[tenant,actor,historicalId,historicalStage];
  await admin.query(`INSERT INTO vant.deals(tenant_id,owner_id,pipeline_id,stage_id,name,amount_cents,probability,status,close_on)
   VALUES($1,$2,$3,$4,'Previsão',10000,40,'open',(now() AT TIME ZONE 'America/Sao_Paulo')::date)`,historyArgs);
  async function historyCohort(){
   const data=await (await call('revenue/forecast')).json();
   return data.comparisons.find(item=>item.pipeline==='Histórico controlado');
  }
  assert.equal((await historyCohort()).scenario_cents,null);
  for(const years of [1,2]){
   await admin.query(`INSERT INTO vant.deals(tenant_id,owner_id,pipeline_id,stage_id,name,amount_cents,probability,status,created_at,closed_at)
    SELECT $1,$2,$3,$4,'Histórico '||i,10000,40,CASE WHEN i<=6 THEN 'won' ELSE 'lost' END,
     day-interval '20 days',day FROM generate_series(1,10) AS i
     CROSS JOIN (SELECT (date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')+interval '1 day'-make_interval(years=>$5))
      AT TIME ZONE 'America/Sao_Paulo' AS day) d`,[...historyArgs,years]);
   const compared=await historyCohort();
   assert.equal(compared.sample,10*years);assert.equal(compared.basis,years===1?'pipeline':'seasonal');
   assert.equal(Number(compared.observed_pct),60);assert.equal(compared.scenario_cents,'6000');
   assert.equal(Number(compared.won_cycle_days),20);
  }
  await page.getByLabel('Horizonte da projeção').selectOption('30');
  await page.getByText('Mesmo mês, em ao menos dois anos',{exact:true}).waitFor();
  const funnel=await call('crm/pipelines','POST',{name:'Fluxo observado',stages:['Entrada','Proposta','Revisão']});
  assert.equal(funnel.status,201);
  const funnelId=(await funnel.json()).id;
  const steps=(await (await call('crm/pipelines')).json()).items.find(item=>item.id===funnelId).stages;
  const [entry,proposal,review]=steps.map(item=>item.id);
  async function dateEvent(id,at){
   await admin.query(`UPDATE vant.crm_history SET created_at=$3 WHERE tenant_id=$1 AND id=(
    SELECT max(id) FROM vant.crm_history WHERE tenant_id=$1 AND kind='deals' AND record_id=$2)`,[tenant,id,at]);
  }
  async function enter(name,owner,at){
   const r=await call('crm/deals','POST',{name,owner_id:owner,source:'Movimento',amount_cents:10000,probability:40,pipeline_id:funnelId,stage_id:entry});
   assert.equal(r.status,201);const {id}=await r.json();await dateEvent(id,at);return id;
  }
  async function move(id,stageId,at){
   assert.equal((await call('crm/deals/'+id,'PATCH',{stage_id:stageId})).status,200);
   await dateEvent(id,at);
  }
  const first=await enter('Reentrada',seller,'2025-03-01T03:00:00Z');
  await move(first,entry,'2025-03-03T12:00:00Z');
  await move(first,proposal,'2025-03-04T12:00:00Z');
  await move(first,entry,'2025-03-05T12:00:00Z');
  await move(first,review,'2025-03-06T12:00:00Z');
  const second=await enter('Salto',actor,'2025-03-04T12:00:00Z');
  await move(second,review,'2025-04-01T02:59:59Z');
  const third=await enter('Saída em abril',actor,'2025-03-05T12:00:00Z');
  await move(third,review,'2025-04-01T03:00:00Z');
  const fourth=await enter('Entrada em fevereiro',actor,'2025-03-01T02:59:59Z');
  await move(fourth,proposal,'2025-03-10T12:00:00Z');
  const movementPath=path+'&pipeline='+funnelId+'&source=Movimento';
  const movement=await (await call(movementPath)).json();
  const stagesById=new Map(movement.transitions.map(stage=>[stage.stage_id,stage]));
  assert.equal(movement.total.closed,0);
  assert.deepEqual([stagesById.get(entry).entered,stagesById.get(entry).moved],[3,2]);
  assert.deepEqual(stagesById.get(entry).destinations.map(d=>[d.id,d.deals]),[[proposal,1],[review,1]]);
  assert.deepEqual([stagesById.get(proposal).entered,stagesById.get(proposal).moved],[2,1]);
  assert.equal(stagesById.get(proposal).destinations[0].id,entry);
  assert.deepEqual([stagesById.get(review).entered,stagesById.get(review).moved],[2,0]);
  await page.getByRole('button',{name:'Receita comercial',exact:true}).click();
  await page.getByLabel('Equipe do negócio').selectOption('');
  await page.getByLabel('Segmento',{exact:true}).fill('');
  await page.getByLabel('Pipeline',{exact:true}).selectOption(funnelId);
  await page.getByRole('button',{name:'Aplicar filtros'}).click();
  await page.getByText('2 de 3 · 66,67%',{exact:true}).waitFor();
  const transitionDownload=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportar CSV'}).click();
  const transitionFile=await transitionDownload,parts=[];
  for await(const part of await transitionFile.createReadStream())parts.push(part);
  assert.ok(Buffer.concat(parts).toString('utf8').includes('"3";"2";"Fluxo observado · Proposta";"1";"33.33"'));
  const sellerLogin=await call('auth/login','POST',{tenantId:tenant,email:'seller@example.invalid',password});
  cookie=sellerLogin.headers.get('set-cookie').split(';')[0];assert.equal((await (await call(path)).json()).total.won,1);
  assert.equal((await call(path+'&seller='+actor)).status,403);
  assert.equal((await (await call(path)).json()).activities.total.completed,2);
  const ownTransitions=(await (await call(movementPath)).json()).transitions;
  assert.equal(ownTransitions.find(r=>r.stage_id===entry).entered,1);
  const ownForecast=await (await call('revenue/forecast')).json();
  assert.ok(ownForecast.comparisons.every(item=>item.pipeline!=='Histórico controlado'));
  assert.equal(ownForecast.coverage.find(row=>row.bucket==='within').value_cents,'30001');
  const isolated=await call('auth/login','POST',{tenantId:other,email,password});cookie=isolated.headers.get('set-cookie').split(';')[0];
  assert.deepEqual((await (await call('revenue/forecast')).json()).coverage,[]);
  assert.deepEqual((await (await call(movementPath)).json()).transitions,[]);
  const separateAgenda=(await (await call(path)).json()).activities.total;
  assert.equal(separateAgenda.completed,0);assert.equal(separateAgenda.on_time_pct,null);
  const empty=(await (await call(path)).json()).total;assert.equal(empty.closed,0);assert.equal(empty.conversion_pct,null);assert.equal(empty.average_ticket_cents,null);
 }finally{
  await browser?.close();
  if(server.listening)await new Promise(resolve=>server.close(resolve));
  await pool.end();await admin.end();
 }
});
