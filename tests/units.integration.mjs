import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {chromium} from 'playwright-core';
import {createPool} from '../src/db.mjs';
import {createApp} from '../src/app.mjs';
import {featureRoutes} from '../src/routes.mjs';
import {servePage} from '../src/pages.mjs';
import {hashPassword} from '../src/security.mjs';

test('unidades: gestão, isolamento, idempotência, revisão e cadastro no navegador',async()=>{
  assert.equal(process.env.APP_ENV,'test');
  const a=randomUUID(),b=randomUUID(),pw=randomUUID(),origin='http://127.0.0.1:3281';
  const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
  const pool=createPool(process.env.DATABASE_URL),server=createApp({pool,origin,featureRoutes,servePage,environment:'test'});
  let browser;
  try{
    await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Unidades A'),($2,'Unidades B')",[a,b]);
    await admin.query(`INSERT INTO vant.members(tenant_id,email,name,role,password_hash)
      VALUES($1,'gestao@example.invalid','Gestora','manager',$3),($2,'gestao@example.invalid','Gestora B','manager',$3),
      ($1,'consulta@example.invalid','Consulta','viewer',$3)`,[a,b,await hashPassword(pw)]);
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3281,'127.0.0.1',resolve);});
    async function request(path,method='GET',body,cookie){
      return fetch(origin+'/api/v1/'+path,{method,headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},
        body:body===undefined?undefined:JSON.stringify(body)});
    }
    async function login(tenantId,email='gestao@example.invalid'){
      const response=await request('auth/login','POST',{tenantId,email,password:pw});
      assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];
    }
    const ca=await login(a),cb=await login(b),viewer=await login(a,'consulta@example.invalid');
    const path='business-units',item={id:randomUUID(),name:'Norte',kind:'branch'};
    assert.equal((await request(path)).status,401);
    assert.equal((await request(path,'POST',item,viewer)).status,403);
    const pair=await Promise.all([request(path,'POST',item,ca),request(path,'POST',item,ca)]);
    assert.deepEqual(pair.map(r=>r.status).sort(),[200,201]);
    assert.equal((await request(path,'POST',{...item,id:randomUUID(),name:'norte'},ca)).status,409);
    assert.equal((await request(path,'POST',{...item,id:randomUUID(),kind:'department'},ca)).status,201);
    const first=await (await request(path+'?limit=1','GET',undefined,ca)).json();
    const next=await (await request(path+'?limit=1&cursor='+first.nextCursor,'GET',undefined,ca)).json();
    assert.equal(first.items.length,1);assert.equal(next.items.length,1);assert.notEqual(first.items[0].id,next.items[0].id);
    assert.equal(next.nextCursor,null);
    assert.equal((await request(path,'GET',undefined,viewer)).status,403);
    assert.deepEqual((await (await request(path,'GET',undefined,cb)).json()).items,[]);
    const patch={name:'Norte 2',kind:'branch',revision:1};
    assert.equal((await request(path+'/'+item.id,'PATCH',patch,cb)).status,404);
    assert.equal((await request(path+'/'+item.id,'PATCH',patch,ca)).status,200);
    assert.equal((await request(path+'/'+item.id,'PATCH',{...patch,name:'Desatualizada'},ca)).status,409);
    assert.equal((await admin.query("SELECT 1 FROM vant.audit WHERE tenant_id=$1 AND action='business_unit.updated'",[a])).rowCount,1);
    browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/usr/bin/google-chrome',args:['--no-sandbox']});
    const context=await browser.newContext();await context.addCookies([{name:'vant_session',value:ca.slice(13),url:origin}]);
    const page=await context.newPage();await page.goto(origin);
    await page.getByRole('button',{name:'Unidades',exact:true}).click();
    await page.getByRole('button',{name:'Cadastrar unidade',exact:true}).click();
    await page.getByLabel('Nome da unidade').fill('Comercial Sul');
    await page.getByLabel('Tipo de unidade').selectOption('commercial');
    await page.getByRole('button',{name:'Salvar unidade'}).click();
    await page.getByRole('heading',{name:'Comercial Sul',exact:true}).waitFor();
  }finally{
    await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));await pool.end();await admin.end();
  }
});
