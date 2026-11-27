import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {chromium} from 'playwright-core';
import {createPool} from '../src/db.mjs';
import {hashPassword} from '../src/security.mjs';
import {createApp} from '../src/app.mjs';
import {featureRoutes} from '../src/routes.mjs';
import {servePage} from '../src/pages.mjs';
import {leadCsv} from '../src/csv.mjs';
test('CSV com BOM, aspas e linha interna',()=>{
 assert.deepEqual(leadCsv('\uFEFFnome;observações\r\n"A; B";"linha 1\nlinha ""2"""'),[{name:'A; B',notes:'linha 1\nlinha "2"',source:'Importação CSV'}]);
 assert.throws(()=>leadCsv('nome\n"abc'));
});
test('CRM, persistência e navegação',async t=>{
 if(process.env.APP_ENV!=='test')throw Error('Exige banco exclusivo de teste.');
 const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();const pool=createPool(process.env.DATABASE_URL);
 const origin='http://127.0.0.1:3190',server=createApp({pool,origin,featureRoutes,servePage,environment:'test'});
 let browser;const a=randomUUID(),b=randomUUID(),pw=randomUUID(),owner=randomUUID(),other=randomUUID(),viewer=randomUUID(),email='crm@vant.invalid';
 try{
  await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'CRM A'),($2,'CRM B')",[a,b]);
  await admin.query("INSERT INTO vant.members(tenant_id,id,email,name,role,password_hash) VALUES($1,$2,$3,'Gestão','owner',$4),($5,$6,$3,'Outro','owner',$4),($1,$7,'viewer@vant.invalid','Leitura','viewer',$4)",[a,owner,email,await hashPassword(pw),b,other,viewer]);
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(3190,'127.0.0.1',ok);});
  async function req(path,method,body,cookie){return fetch(origin+'/api/v1/'+path,{method,headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
  async function login(tenantId,address=email){const r=await req('auth/login','POST',{tenantId,email:address,password:pw});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
  const ca=await login(a),cb=await login(b),cv=await login(a,'viewer@vant.invalid');
  async function call(p,m='GET',body,expected=200,c=ca){const r=await req('crm/'+p,m,body,c);const data=r.status===204?null:await r.json();assert.equal(r.status,expected,JSON.stringify(data));return data;}
  await call('leads/import','POST',{csv:'nome,email,segmento\nLead A,a@vant.invalid,Tech'},201);
  await call('leads/import','POST',{csv:'nome,email\nDescartar,b@vant.invalid\nRepetido,a@vant.invalid'},409);
  const integrations=async cookie=>req('integrations','GET',undefined,cookie);
  assert.equal((await integrations(cv)).status,403);
  const summary=await (await integrations(ca)).json();
  assert.deepEqual(summary.csv.imports.map(r=>r.source),['crm']);
  assert.deepEqual((await (await integrations(cb)).json()).csv.imports,[]);
  assert.deepEqual((await call('leads?q=Descartar')).items,[]);const lead=(await call('leads?segment=Tech')).items[0];
  await call('leads/'+lead.id,'GET',undefined,404,cb);await call('leads','POST',{name:'Vedado'},403,cv);
  const account=await call('accounts','POST',{name:'Empresa'},201),contact=await call('contacts','POST',{name:'Decisor',account_id:account.id,decision_maker:true},201);
  await call('leads/'+lead.id,'PATCH',{contact_id:contact.id,account_id:account.id,tags:['prioridade']});
  assert.equal((await call('leads?tag=prioridade')).items.length,1);
  const base64=Buffer.from('Arquivo de teste').toString('base64'),file=await call('leads/'+lead.id+'/files','POST',{filename:'brief.txt',base64},201);
  assert.equal((await call('leads/'+lead.id+'/files/'+file.id)).base64,base64);
  const conversation=await call('conversations','POST',{name:'Conversa da feira'},201),linked=await call('conversations/'+conversation.id+'/lead','POST',{},201);
  assert.equal((await call('conversations/'+conversation.id+'/lead','POST',{})).id,linked.id);
  await call('pipelines','POST',{name:'B2B',stages:['Contato','Proposta']},201);const pipe=(await call('pipelines')).items[0];
  const deal=await call('deals','POST',{name:'Contrato anual',pipeline_id:pipe.id,stage_id:pipe.stages[0].id,amount_cents:125000,probability:40,lead_id:lead.id,close_on:'2028-02-29'},201);
  await call('deals/'+deal.id,'PATCH',{stage_id:pipe.stages[1].id});assert.equal((await call('deals/'+deal.id+'/history')).items[0].changes.stage_id.to,pipe.stages[1].id);
  await call('pipelines/'+pipe.id,'PATCH',{name:'Vendas',stages:[...pipe.stages].reverse()});
  const activity=await call('activities','POST',{title:'Reunião',kind:'meeting',lead_id:lead.id},201);await call('activities/'+activity.id,'PATCH',{done_at:new Date().toISOString()});
  assert.ok((await call('leads/'+lead.id)).last_contact_at);await call('leads/'+lead.id,'DELETE',undefined,409);
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/usr/bin/google-chrome',args:['--no-sandbox']});const ctx=await browser.newContext();await ctx.addCookies([{name:'vant_session',value:ca.slice(13),url:origin}]);
  const page=await ctx.newPage();await page.goto(origin);await page.getByRole('button',{name:'Central de integrações'}).click();
  await page.getByText('Leads do CRM',{exact:true}).waitFor();
  await page.getByText('Sem entrega confirmada',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Abrir leads'}).click();
  await page.getByRole('button',{name:'Cadastrar registro'}).click();await page.getByLabel('Nome',{exact:true}).fill('Lead pelo navegador');await page.getByRole('button',{name:'Salvar'}).click();
  await page.getByRole('button',{name:'Lead pelo navegador'}).waitFor();await page.getByRole('button',{name:'Funil de vendas',exact:true}).click();
  const updated=page.waitForResponse(r=>r.url().endsWith('/deals/'+deal.id)&&r.request().method()==='PATCH');await page.getByLabel('Mover Contrato anual').selectOption(pipe.stages[0].id);assert.equal((await updated).status(),200);await page.locator('.lane').filter({has:page.getByRole('heading',{name:'Contato',exact:true})}).getByRole('button',{name:'Contrato anual'}).waitFor();
  await page.getByRole('button',{name:'Oportunidades',exact:true}).click();try {await page.getByRole('columnheader',{name:'Probabilidade'}).waitFor({timeout:12000});} catch(error) {throw Error('Tabela do CRM: '+(await page.locator('#pageTitle').innerText())+' / '+(await page.locator('#status').innerText())+' / '+(await page.locator('#content').innerText()).slice(0,400),{cause:error});}
  await page.getByRole('button',{name:'Contrato anual',exact:true}).click();
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  await page.getByLabel('Canal comercial').selectOption('email');
  const closeDate=page.getByLabel('Previsão de fechamento',{exact:true});
  assert.equal(await closeDate.inputValue(),'2028-02-29','Preservar a data civil ao abrir a edição');
  await page.getByLabel('Nome',{exact:true}).fill('Contrato anual renovado');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  await page.getByRole('button',{name:'Contrato anual renovado',exact:true}).waitFor();
  assert.equal((await call('deals/'+deal.id)).close_on,'2028-02-29');
  assert.equal((await call('deals/'+deal.id)).sales_channel,'email');
 }finally{await browser?.close();if(server.listening)await new Promise(ok=>server.close(ok));await pool.end();await admin.end();}
});
