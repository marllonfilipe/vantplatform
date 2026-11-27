import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {chromium} from 'playwright-core';
import {createPool} from '../src/db.mjs';
import {createApp} from '../src/app.mjs';
import {hashPassword} from '../src/security.mjs';
import {servePage} from '../src/pages.mjs';
import {featureRoutes} from '../src/routes.mjs';
import {assignPlan} from '../src/plan-assignment.mjs';

test('catálogo de planos consulta valores e limites no PostgreSQL com acesso de gestão',async()=>{
 assert.equal(process.env.APP_ENV,'test');
 const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
 const pool=createPool(process.env.DATABASE_URL),origin='http://127.0.0.1:3216';
 const server=createApp({pool,origin,environment:'test',featureRoutes,servePage});
 const tenant=randomUUID(),password=randomUUID();
 let browser,cookie='';
 try{
  await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Planos')",[tenant]);
  await admin.query(`INSERT INTO vant.members(tenant_id,email,name,role,password_hash) VALUES
   ($1,'gestor@example.invalid','Gestor','owner',$2),($1,'vendedor@example.invalid','Vendedor','seller',$2)`,[tenant,await hashPassword(password)]);
  await new Promise(resolve=>server.listen(3216,'127.0.0.1',resolve));
  const call=(path,method='GET',data)=>fetch(origin+'/api/v1/'+path,{method,headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify(data)});
  async function login(email){
   const r=await call('auth/login','POST',{tenantId:tenant,email,password});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];
  }
  assert.equal((await call('billing/plans')).status,401);
  await login('gestor@example.invalid');
  const res=await call('billing/plans');assert.equal(res.status,200);
  const catalog=await res.json();
  assert.equal(catalog.currency,'BRL');assert.equal(catalog.interval,'month');
  assert.deepEqual(catalog.items.map(p=>[p.code,p.monthly_cents,p.user_limit,p.active_lead_limit,p.pipeline_limit,p.whatsapp_connection_limit]),[
   ['start','19700',1,500,1,0],['growth','39700',3,2000,3,1],['scale','59700',10,10000,10,3],['enterprise',null,null,null,null,null]
  ]);
  assert.equal(catalog.items[3].custom_terms,true);
  assert.equal((await call('billing/plans','PUT',{monthly_cents:1})).status,405);
  assert.equal((await pool.query("SELECT has_table_privilege(current_user,'vant.billing_plans','UPDATE') AS can_write")).rows[0].can_write,false);
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/usr/bin/google-chrome',args:['--no-sandbox']});
  const page=await browser.newPage();await page.goto(origin);
  await page.getByLabel('Identificador da empresa').fill(tenant);await page.getByLabel('E-mail',{exact:true}).fill('gestor@example.invalid');await page.getByLabel('Senha').fill(password);
  await page.getByRole('button',{name:'Entrar'}).click();await page.getByRole('button',{name:'Planos comerciais'}).click();
  const scale=page.locator('.panel').filter({has:page.getByRole('heading',{name:'Scale',exact:true})});
  await scale.getByText('10.000',{exact:true}).waitFor();assert.match(await scale.innerText(),/597,00/);
  const enterprise=page.locator('.panel').filter({has:page.getByRole('heading',{name:'Enterprise',exact:true})});
  assert.match(await enterprise.innerText(),/Sob consulta/);
  const usage=async()=>{const r=await call('billing/usage');assert.equal(r.status,200);return r.json();};
  assert.deepEqual(await usage(),{assignment:null,users:2,leads:0,pipelines:0,storage_bytes:'0',
   agent_actions:{used_today:0,operational_limit:100,contract_limit:null,effective_limit:100}});
  // A empresa não pode contratar ou elevar o próprio limite pela conexão da aplicação.
  assert.equal((await pool.query("SELECT has_table_privilege(current_user,'vant.plan_assignments','INSERT') AS allowed")).rows[0].allowed,false);
  async function assign(code,revision,limits){
   await admin.query('BEGIN');
   try{
    const row=await assignPlan(admin,tenant,code,revision,limits);
    await admin.query('COMMIT');
    return row;
   }catch(error){await admin.query('ROLLBACK');throw error;}
  }
  const limits={user_limit:2,active_lead_limit:1,pipeline_limit:1,storage_limit_bytes:6};
  assert.equal((await assign('start',0,limits)).revision,1);
  assert.equal((await assign('start',0,limits)).revision,1);
  await assert.rejects(assign('growth',0,limits),/vínculo mudou/);
  await assert.rejects(assign('enterprise',1),/três limites/);
  const other=randomUUID();
  await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Outra empresa')",[other]);
  await admin.query("INSERT INTO vant.pipelines(tenant_id,name) VALUES($1,'Separado')",[other]);
  const responses=await Promise.all(['Principal','Secundário'].map(name=>call('crm/pipelines','POST',{name,stages:['Aberto']})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
  assert.equal((await responses.find(r=>r.status===409).json()).error.code,'plan_limit');
  const lead=await call('crm/leads','POST',{name:'Lead da franquia'});
  assert.equal(lead.status,201);
  const {id:leadId}=await lead.json();
  const document=(await admin.query(`INSERT INTO vant.documents(tenant_id,filename,media_type,size_bytes) VALUES($1,'Descrição','text/plain',3) RETURNING id`,[tenant])).rows[0];
  await admin.query(`INSERT INTO vant.documents(tenant_id,filename,media_type,size_bytes) VALUES($1,'Separado','text/plain',10)`,[other]);
  const addFile=filename=>call('crm/leads/'+leadId+'/files','POST',{filename,base64:Buffer.from('Olá'.normalize('NFC')).toString('base64')});
  const over=await addFile('maior.txt');
  assert.equal(over.status,409);assert.equal((await over.json()).error.code,'plan_limit');
  assert.equal((await usage()).storage_bytes,'3');
  await admin.query('UPDATE vant.documents SET size_bytes=2 WHERE tenant_id=$1 AND id=$2',[tenant,document.id]);
  const uploads=await Promise.all(['primeiro.txt','segundo.txt'].map(addFile));
  assert.deepEqual(uploads.map(r=>r.status).sort(),[201,409]);
  assert.equal((await usage()).storage_bytes,'6');
  await assert.rejects(admin.query('UPDATE vant.documents SET size_bytes=3 WHERE tenant_id=$1 AND id=$2',[tenant,document.id]),{code:'V4001'});
  assert.equal((await call('crm/leads','POST',{name:'Outro lead'})).status,409);
  await admin.query("UPDATE vant.members SET active=false WHERE tenant_id=$1 AND role='seller'",[tenant]);
  const lowered={...limits,user_limit:1,active_lead_limit:0,storage_limit_bytes:5,agent_actions_per_day:4};
  assert.equal((await assign('enterprise',1,lowered)).revision,2);
  await assert.rejects(admin.query("UPDATE vant.members SET active=true WHERE tenant_id=$1 AND role='seller'",[tenant]),{code:'V4001'});
  const report=await usage();
  assert.equal(report.assignment.revision,2);assert.equal(report.users,1);assert.equal(report.pipelines,1);assert.equal(report.leads,1);
  assert.equal(report.assignment.active_lead_limit,0);
  assert.equal((await call('crm/leads','POST',{name:'Fora da franquia'})).status,409);
  await page.getByRole('button',{name:'Planos comerciais'}).click();
  const consumption=page.locator('.panel').filter({has:page.getByRole('heading',{name:'Consumo da empresa'})});
  await consumption.getByText('1 de 0',{exact:true}).waitFor();
  await consumption.getByText('6 bytes de 5 bytes',{exact:true}).waitFor();
  await consumption.getByText('0 de 4',{exact:true}).waitFor();
  assert.equal(await consumption.getByText('Franquia excedida',{exact:true}).count(),2);
  await admin.query('DELETE FROM vant.documents WHERE tenant_id=$1 AND id=$2',[tenant,document.id]);
  assert.equal((await usage()).storage_bytes,'4');
  await assert.rejects(assign('growth',2,{storage_limit_bytes:-1}),/armazenamento inválida/);
  assert.equal((await assign('growth',2)).storage_limit_bytes,'5');
  assert.equal((await usage()).assignment.revision,3);
  assert.equal((await call('crm/leads','POST',{name:'Depois da ampliação'})).status,201);
  await admin.query("UPDATE vant.members SET active=true WHERE tenant_id=$1 AND role='seller'",[tenant]);
  const history=await admin.query('SELECT revision FROM vant.plan_assignments WHERE tenant_id=$1 ORDER BY revision',[tenant]);
  assert.deepEqual(history.rows.map(row=>row.revision),[1,2,3]);
  await login('vendedor@example.invalid');assert.equal((await call('billing/plans')).status,403);assert.equal((await call('billing/usage')).status,403);
 }finally{
  await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));await pool.end();await admin.end();
 }
});
