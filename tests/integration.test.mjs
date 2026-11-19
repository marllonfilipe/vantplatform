import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../src/app.mjs';
import { createPool,checkRuntime,withTenant } from '../src/db.mjs';
import { hashPassword } from '../src/security.mjs';

test('API e PostgreSQL multiempresa',async t=>{
  if (process.env.APP_ENV!=='test' || !process.env.ADMIN_DATABASE_URL) throw Error('Use banco exclusivo e APP_ENV=test.');
  const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});
  await admin.connect();
  const pool=createPool(process.env.DATABASE_URL);
  const origin='http://127.0.0.1:3000';
  const server=createApp({pool,origin,environment:'test'});
  const a=randomUUID(), b=randomUUID(), owner=randomUUID(), viewer=randomUUID(), other=randomUUID();
  const email='qa@vant.invalid', password='Senha aleatória '+randomUUID();
  try {
    await checkRuntime(pool);
    await assert.rejects(checkRuntime(admin));
    const hash=await hashPassword(password);
    await admin.query("INSERT INTO vant.tenants(id,name) VALUES ($1,'Tenant A'),($2,'Tenant B')",[a,b]);
    await admin.query(`INSERT INTO vant.members(tenant_id,id,name,email,role,password_hash)
      VALUES($1,$2,'Owner',$3,'owner',$4),($1,$5,'Viewer','viewer@vant.invalid','viewer',$4),($6,$7,'Owner B',$3,'owner',$4)`,
      [a,owner,email,hash,viewer,b,other]);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const root='http://127.0.0.1:'+server.address().port;
    async function request(path,method='GET',body,cookie,extra={}) {
      return fetch(root+path,{method,headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body)});
    }
    async function login(tenantId,address=email) {
      const res=await request('/api/v1/auth/login','POST',{tenantId,email:address,password});
      assert.equal(res.status,200);
      const header=res.headers.get('set-cookie');
      assert.match(header,/HttpOnly/);
      return header.split(';')[0];
    }
    const ca=await login(a), cb=await login(b), cv=await login(a,'viewer@vant.invalid');
    let team;
    await t.test('saúde, autenticação, origem e validade da sessão', async()=>{
      assert.equal((await request('/health/ready')).status,200);
      assert.equal((await request('/api/v1/auth/me')).status,401);
      assert.equal((await (await request('/api/v1/auth/me','GET',undefined,ca)).json()).id,owner);
      assert.equal((await request('/api/v1/auth/login','POST',{tenantId:a,email,password:'errada'})).status,401);
      assert.equal((await request('/api/v1/teams','POST',{name:'negada'},ca,{origin:'https://other.invalid'})).status,403);
      assert.equal((await request('/api/v1/auth/me','GET',undefined,ca.replace(a,b))).status,401);
    });
    await t.test('equipe persiste e a API aplica permissões por empresa',async()=>{
      const r=await request('/api/v1/teams','POST',{name:'Comercial'},ca);
      assert.equal(r.status,201); team=(await r.json()).id;
      assert.equal((await request('/api/v1/teams','POST',{name:'restrita'},cv)).status,403);
      assert.equal((await request('/api/v1/teams','POST',{name:'Comercial'},ca)).status,409);
      assert.deepEqual((await (await request('/api/v1/teams','GET',undefined,cb)).json()).items,[]);
      assert.equal((await (await request('/api/v1/teams','GET',undefined,ca)).json()).items[0].id,team);
    });
    await t.test('RLS, relações compostas e eventos de auditoria',async()=>{
      assert.equal((await pool.query('SELECT id FROM vant.teams')).rowCount,0);
      await withTenant(pool,b,async db=>assert.equal((await db.query('SELECT id FROM vant.teams WHERE id=$1',[team])).rowCount,0));
      await assert.rejects(withTenant(pool,b,db=>db.query('INSERT INTO vant.teams(tenant_id,name) VALUES($1,$2)',[a,'outra'])),{code:'42501'});
      await assert.rejects(admin.query('INSERT INTO vant.team_members(tenant_id,team_id,member_id) VALUES($1,$2,$3)',[a,team,other]),{code:'23503'});
      assert.equal((await admin.query("SELECT id FROM vant.audit WHERE tenant_id=$1 AND action='team.created'",[a])).rowCount,1);
      await assert.rejects(withTenant(pool,a,db=>db.query('DELETE FROM vant.audit')),{code:'42501'});
    });
    await t.test('logout revoga a sessão e o prazo é aplicado pelo banco',async()=>{
      assert.equal((await request('/api/v1/auth/logout','POST',undefined,ca)).status,204);
      assert.equal((await request('/api/v1/auth/me','GET',undefined,ca)).status,401);
      await admin.query("UPDATE vant.sessions SET expires_at=now()-interval '1 minute' WHERE tenant_id=$1",[b]);
      assert.equal((await request('/api/v1/auth/me','GET',undefined,cb)).status,401);
    });
  } finally {
    if (server.listening) await new Promise(resolve=>server.close(resolve));
    await pool.end(); await admin.end();
  }
});
