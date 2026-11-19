import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { chromium } from 'playwright-core';
import { createApp } from '../src/app.mjs';
import { createPool,checkRuntime } from '../src/db.mjs';
import { dashboardRoutes } from '../src/dashboard.mjs';
import { servePage } from '../src/pages.mjs';
import { hashPassword } from '../src/security.mjs';

test('indicadores e navegação em Chromium com PostgreSQL',async()=>{
 if(process.env.APP_ENV!=='test')throw Error('Banco de testes obrigatório.');
 const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
 const pool=createPool(process.env.DATABASE_URL);await checkRuntime(pool);
 let server,browser;const a=randomUUID(),b=randomUUID(),owner=randomUUID(),other=randomUUID(),pw=randomUUID(),email='dashboard@vant.invalid';
 try{
  await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Empresa Azul'),($2,'Empresa B')",[a,b]);
  await admin.query("INSERT INTO vant.members(tenant_id,id,email,name,role,password_hash) VALUES($1,$2,$3,'Gestora','owner',$4),($5,$6,$3,'Outro','owner',$4)",[a,owner,email,await hashPassword(pw),b,other]);
  await admin.query("INSERT INTO vant.leads(tenant_id,name,owner_id) VALUES($1,'Conta Alfa',$2),($3,'Somente B',$4)",[a,owner,b,other]);
  await admin.query("INSERT INTO vant.activities(tenant_id,title,kind,owner_id,due_at) VALUES($1,'Ligar para a conta','call',$2,now()-interval '1 day')",[a,owner]);
  const listenOrigin=process.env.DASH_TEST_ORIGIN??'http://127.0.0.1:3189';
  server=createApp({pool,origin:listenOrigin,environment:'test',featureRoutes:dashboardRoutes,servePage});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(new URL(listenOrigin).port),'127.0.0.1',resolve);});
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/usr/bin/google-chrome',args:['--no-sandbox']});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(listenOrigin);await page.getByLabel('Identificador da empresa').fill(a);await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha').fill(pw);await page.getByRole('button',{name:'Entrar'}).click();
  await page.getByRole('heading',{name:'Funil comercial'}).waitFor();
  const overview=await page.evaluate(async()=>{const r=await fetch('/api/v1/dashboard?days=7');return r.json();});
  assert.equal(overview.totals.leads,1);assert.equal(overview.totals.pending,1);assert.equal(overview.totals.overdue,1);assert.equal(overview.trend.length,7);
  await page.getByLabel('Período',{exact:true}).selectOption('7');await page.getByRole('heading',{name:'Evolução de oportunidades'}).waitFor();
  await page.getByLabel('Busca global').fill('Conta Alfa');await page.getByRole('button',{name:'Buscar',exact:true}).click();await page.getByText('Conta Alfa',{exact:true}).waitFor();await page.getByRole('button',{name:'Fechar'}).click();
  await page.getByRole('button',{name:'Equipe',exact:true}).click();await page.getByRole('button',{name:'Criar equipe'}).click();await page.getByLabel('Nome da equipe').fill('Sul');await page.getByRole('button',{name:'Salvar'}).click();await page.getByText('Sul',{exact:true}).last().waitFor();
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Alternar navegação'}).click();await page.getByRole('button',{name:'Próximas tarefas'}).click();await page.getByText('Ligar para a conta').waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:'Meu perfil'}).click();await page.getByRole('button',{name:'Sair ou trocar de empresa'}).click();await page.getByRole('button',{name:'Entrar'}).waitFor();
 }finally{await browser?.close();if(server?.listening)await new Promise(r=>server.close(r));await pool.end();await admin.end();}
});
