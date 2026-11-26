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
  await login('vendedor@example.invalid');assert.equal((await call('billing/plans')).status,403);
 }finally{
  await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));await pool.end();await admin.end();
 }
});
