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

test('perfil de cliente ideal seleciona empresas do CRM com fonte, permissões e isolamento',async()=>{
 assert.equal(process.env.APP_ENV,'test');
 const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
 const pool=createPool(process.env.DATABASE_URL),origin='http://127.0.0.1:3205';
 const server=createApp({pool,origin,featureRoutes,servePage,environment:'test'});
 let browser;
 const tenant=randomUUID(),other=randomUUID(),actor=randomUUID(),password=randomUUID(),email='gestor@example.invalid';
 try{
  await checkRuntime(pool);
  await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Fluxos'),($2,'Isolada')",[tenant,other]);
  await admin.query("INSERT INTO vant.members(tenant_id,id,email,name,role,password_hash) VALUES($1,$2,$3,'Gestor','owner',$4)",[tenant,actor,email,await hashPassword(password)]);
  await new Promise(resolve=>server.listen(3205,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port+'/api/v1/';
  let cookie='';
  const call=(path,method='GET',data)=>fetch(base+path,{method,headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify(data)});
  const login=await call('auth/login','POST',{tenantId:tenant,email,password});assert.equal(login.status,200);
  cookie=login.headers.get('set-cookie').split(';')[0];
  const hash=await hashPassword(password);
  for(const [tenantId,role] of [[tenant,'viewer'],[tenant,'seller'],[other,'owner']]){
   await admin.query('INSERT INTO vant.members(tenant_id,email,name,role,password_hash) VALUES($1,$2,$3,$3,$4)',[tenantId,role+'@example.invalid',role,hash]);
  }
  const session=async(tenantId,role)=>{
   const login=await call('auth/login','POST',{tenantId,email:role+'@example.invalid',password});assert.equal(login.status,200);
   const credential=login.headers.get('set-cookie').split(';')[0];
   return (path,method='GET',data)=>fetch(base+path,{method,headers:{origin,cookie:credential,'content-type':'application/json'},body:JSON.stringify(data)});
  };
  const viewer=await session(tenant,'viewer'),seller=await session(tenant,'seller'),foreign=await session(other,'owner');
  const accountData={name:'Cerâmica do Vale',segment:'Indústria',location:'Campinas, SP',size_band:'Médio',business_activity:'Produtos cerâmicos'};
  const create=async(fn,data)=>{const res=await fn('crm/accounts','POST',data);assert.equal(res.status,201);return (await res.json()).id;};
  const account=await create(call,accountData);
  await create(call,{...accountData,name:'Cerâmica Central'});
  await create(call,{...accountData,name:'Conta fora da região',location:'Recife'});
  const separate=await create(foreign,accountData);
  assert.equal((await call('crm/contacts','POST',{name:'Diretora',title:'Compras',decision_maker:true,account_id:account})).status,201);
  const profiles='prospecting/profiles',spec={name:'Cerâmicas da região',segment:'indústria',region:'campinas',size_band:'Médio',business_activity:'cerâmicos'};
  assert.equal((await call(profiles,'POST',{name:'Vazio'})).status,400);
  assert.equal((await seller(profiles,'POST',spec)).status,403);
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/usr/bin/google-chrome',args:['--no-sandbox']});
  const page=await browser.newPage();await page.goto(origin);
  await page.getByLabel('Identificador da empresa').fill(tenant);await page.getByLabel('E-mail',{exact:true}).fill(email);
  await page.getByLabel('Senha').fill(password);await page.getByRole('button',{name:'Entrar'}).click();
  await page.getByRole('button',{name:'Prospecção',exact:true}).click();await page.getByRole('button',{name:'Criar perfil',exact:true}).click();
  const dialog=page.getByRole('dialog');
  for(const [label,value] of [['Nome do perfil',spec.name],['Segmento',spec.segment],['Região',spec.region],['Porte',spec.size_band],['Atividade econômica',spec.business_activity]]){
   await dialog.getByLabel(label,{exact:true}).fill(value);
  }
  await dialog.getByRole('button',{name:'Salvar perfil'}).click();
  const card=page.locator('section.panel').filter({has:page.getByRole('heading',{name:accountData.name,exact:true})});
  await card.getByText('Decisores registrados: 1').waitFor();await card.getByRole('button',{name:'Selecionar empresa'}).click();
  const source='Catálogo comercial fornecido pela empresa';await dialog.getByLabel('Fonte da seleção').fill(source);
  await dialog.getByRole('button',{name:'Salvar empresa-alvo'}).click();
  await page.getByLabel('Lista de prospecção').selectOption('targets');
  await card.getByText('Fonte da seleção: '+source,{exact:true}).waitFor();
  await card.getByRole('button',{name:'Abrir empresa no CRM'}).click();
  await dialog.getByText('Produtos cerâmicos',{exact:true}).waitFor();
  const [profile]=(await (await call(profiles)).json()).items,path=profiles+'/'+profile.id;
  const first=await (await viewer(path+'/accounts?limit=1')).json();
  assert.equal(first.items.length,1);assert.ok(first.nextCursor);
  const second=await (await viewer(path+'/accounts?limit=1&cursor='+first.nextCursor)).json();
  assert.equal(second.items.length,1);assert.equal(second.nextCursor,null);assert.notEqual(second.items[0].id,first.items[0].id);
  assert.deepEqual((await (await viewer(path+'/accounts?q=Central')).json()).items.map(r=>r.name),['Cerâmica Central']);
  assert.equal((await foreign(path+'/accounts')).status,404);
  assert.equal((await seller(path+'/targets/'+separate,'PUT',{source_reference:source})).status,404);
  const chosen=path+'/targets/'+account;
  assert.equal((await viewer(chosen,'DELETE')).status,403);
  assert.equal((await seller(chosen,'PUT',{source_reference:source})).status,200);
  assert.equal((await seller(chosen,'PUT',{source_reference:'Outra referência'})).status,409);
  assert.equal((await call(path,'PUT',{...spec,region:'Recife',expected_revision:1})).status,200);
  assert.equal((await call(path,'PUT',{...spec,region:'São Paulo',expected_revision:1})).status,409);
  assert.deepEqual((await (await call(path+'/accounts')).json()).items.map(a=>a.name),['Conta fora da região']);
  assert.deepEqual((await (await call(path+'/targets')).json()).items.map(a=>a.id),[account]);
  assert.equal((await seller(chosen,'DELETE')).status,204);assert.equal((await seller(chosen,'DELETE')).status,204);
  assert.equal((await call('crm/accounts/'+account)).status,200);
  const audit=await admin.query("SELECT action FROM vant.audit WHERE tenant_id=$1 AND action LIKE 'prospecting.%' ORDER BY action",[tenant]);
  assert.deepEqual(audit.rows.map(a=>a.action),['prospecting.profile.created','prospecting.profile.updated','prospecting.target.added','prospecting.target.removed']);
 }finally{
  await browser?.close();
  if(server.listening)await new Promise(resolve=>server.close(resolve));
  await pool.end();await admin.end();
 }
});
