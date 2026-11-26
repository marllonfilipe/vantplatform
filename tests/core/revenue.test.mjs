import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {chromium} from 'playwright-core';
import {createPool} from '../../src/db.mjs';
import {createApp} from '../../src/app.mjs';
import {hashPassword} from '../../src/security.mjs';
import {servePage} from '../../src/pages.mjs';
import {featureRoutes} from '../../src/routes.mjs';
import {stopInference,modelVersion} from '../../src/inference.mjs';

test('análise executiva concilia períodos, prioriza sinais com o modelo local e exporta as evidências no Chromium',async()=>{
 assert.equal(process.env.APP_ENV,'test');
 const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
 const pool=createPool(process.env.DATABASE_URL),origin='http://127.0.0.1:3214';
 const server=createApp({pool,origin,environment:'test',featureRoutes,servePage});
 const tenant=randomUUID(),other=randomUUID(),owner=randomUUID(),seller=randomUUID(),password=randomUUID();
 const email='gestor@example.invalid';
 let browser,cookie;
 try{
  await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Receita'),($2,'Segunda')",[tenant,other]);
  await admin.query(`INSERT INTO vant.members(tenant_id,id,name,email,role,password_hash) VALUES
   ($1,$2,'Gestor',$3,'owner',$4),($1,$5,'Vendedor','vendedor@example.invalid','seller',$4),($6,$7,'Gestor',$3,'owner',$4)`,
   [tenant,owner,email,await hashPassword(password),seller,other,randomUUID()]);
  await new Promise(resolve=>server.listen(3214,'127.0.0.1',resolve));
  const call=(path,method='GET',data)=>fetch(origin+'/api/v1/'+path,{method,headers:{origin,cookie:cookie??'','content-type':'application/json'},body:JSON.stringify(data)});
  async function login(id,email){
   const response=await call('auth/login','POST',{tenantId:id,email,password});
   assert.equal(response.status,200);cookie=response.headers.get('set-cookie').split(';')[0];
  }
  await login(tenant,email);
  const response=await call('crm/pipelines','POST',{name:'Vendas',stages:['Proposta']});
  assert.equal(response.status,201);
  const pipeline=(await response.json()).id,stage=(await (await call('crm/pipelines')).json()).items.find(item=>item.id===pipeline).stages[0].id;
  async function deal(name,status,day,source){
   const created=await call('crm/deals','POST',{name,status,source,amount_cents:10000,probability:75,pipeline_id:pipeline,stage_id:stage,
    ...(status==='lost'?{loss_reason:'Prazo'}:{}),...(status==='open'?{close_on:'2025-03-10'}:{})});
   assert.equal(created.status,201);
   await admin.query("UPDATE vant.deals SET created_at='2024-01-01',updated_at='2025-03-01',closed_at=$2 WHERE id=$1 AND tenant_id=$3",[(await created.json()).id,day,tenant]);
  }
  await deal('Anterior','won','2025-02-20','Feira');await deal('Ganha','won','2025-03-06','Feira');
  await deal('Perdida','lost','2025-03-07','Feira');await deal('Conta em acompanhamento','open',null,'Feira');
  await deal('Fora do recorte','won','2025-03-07','Site');
  const topic='Revisar negociação aberta. Confirmar o impedimento e registrar o próximo passo com o responsável.';
  const indexed=await call('core/documents','POST',{title:'Revisão de vendas',content:topic});assert.equal(indexed.status,201);
  const path='revenue/executive?from=2025-03-01&to=2025-03-31&source=Feira';
  const generated=await call(path,'POST',{focus:topic});assert.equal(generated.status,200);
  const report=await generated.json();
  assert.equal(report.model,modelVersion);assert.equal(report.total.revenue_cents,'10000');assert.equal(report.previous.closed,1);
  assert.equal(report.change_pp,-50);assert.equal(report.at_risk,1);assert.equal(report.potential.weighted_cents,'7500');
  assert.equal(report.priorities[0].title,'Revisar negociação aberta');assert.ok(report.priorities[0].relevance>0.98);
  assert.equal(report.references[0].title,'Revisão de vendas');
  const empty=await (await call(path.replace('Feira','Inexistente'),'POST',{})).json();
  assert.equal(empty.change_pp,null);assert.deepEqual(empty.priorities,[]);
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/usr/bin/google-chrome',args:['--no-sandbox']});
  const page=await browser.newPage();await page.goto(origin);
  await page.getByLabel('Identificador da empresa').fill(tenant);await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha').fill(password);
  await page.getByRole('button',{name:'Entrar'}).click();await page.getByRole('button',{name:'Receita comercial',exact:true}).click();
  await page.getByLabel('Fechamentos a partir de').fill('2025-03-01');await page.getByLabel('Fechamentos até').fill('2025-03-31');
  await page.getByLabel('Origem',{exact:true}).fill('Feira');await page.getByRole('button',{name:'Aplicar filtros'}).click();
  await page.getByText('1 / 1',{exact:true}).waitFor();await page.getByRole('button',{name:'Gerar análise executiva'}).click();
  await page.getByText('-50 pontos percentuais',{exact:true}).waitFor();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar análise executiva em CSV'}).click();
  const parts=[];for await(const part of await (await download).createReadStream())parts.push(part);
  assert.ok(Buffer.concat(parts).toString('utf8').includes('Conta em acompanhamento'));
  await page.emulateMedia({media:'print'});assert.equal(await page.getByText('-50 pontos percentuais',{exact:true}).isVisible(),true);
  assert.equal((await page.pdf()).subarray(0,5).toString(),'%PDF-');
  await login(tenant,'vendedor@example.invalid');assert.equal((await call(path,'POST',{})).status,403);
  await login(other,email);const isolated=await (await call(path,'POST',{})).json();
  assert.equal(isolated.total.closed,0);assert.equal(isolated.at_risk,0);assert.deepEqual(isolated.references,[]);
 }finally{
  await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));
  stopInference();await pool.end();await admin.end();
 }
});
