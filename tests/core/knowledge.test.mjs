import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createApp } from '../../src/app.mjs';
import { createPool, checkRuntime } from '../../src/db.mjs';
import { featureRoutes } from '../../src/routes.mjs';
import { stopInference } from '../../src/inference.mjs';
import { hashPassword } from '../../src/security.mjs';

test('memória comercial via HTTP com inferência local, PostgreSQL e duas empresas', async () => {
  assert.equal(process.env.APP_ENV, 'test');
  const admin = new pg.Client({connectionString: process.env.ADMIN_DATABASE_URL});
  await admin.connect();
  const pool = createPool(process.env.DATABASE_URL);
  const origin = 'http://localhost';
  const server = createApp({pool, origin, environment: 'test', featureRoutes});
  try {
    await checkRuntime(pool);
    const tenants = [randomUUID(), randomUUID()];
    const password = randomUUID();
    const hash = await hashPassword(password);
    await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Azul'),($2,'Verde')", tenants);
    for (const [tenant, role] of [[tenants[0],'owner'], [tenants[0],'seller'], [tenants[1],'owner']]) {
      await admin.query('INSERT INTO vant.members(tenant_id,email,name,role,password_hash) VALUES($1,$2,$3,$3,$4)', [tenant, role+'@example.invalid', role, hash]);
    }
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port + '/api/v1/';
    const call = (path, method, cookie, data) => fetch(base + path, {
      method, headers: {origin, cookie, 'content-type':'application/json'}, body: JSON.stringify(data)
    });
    async function login(tenantId, role) {
      const res = await call('auth/login','POST','',{tenantId,email:role+'@example.invalid',password});
      assert.equal(res.status, 200);
      return res.headers.get('set-cookie').split(';')[0];
    }
    const owner = await login(tenants[0], 'owner');
    const seller = await login(tenants[0], 'seller');
    const other = await login(tenants[1], 'owner');
    const path = 'core/documents';
    const invoice = 'O prazo para pagamento da fatura é de trinta dias.';
    const data = {title:'Faturamento', content: invoice};
    assert.equal((await call(path,'POST','',data)).status,401);
    assert.equal((await call(path,'POST',seller,data)).status,403);
    const inserted = await call(path,'POST',owner,data);
    assert.equal(inserted.status,201);
    const {id} = await inserted.json();
    assert.equal((await call(path,'POST',owner,{title:'Floresta',content:'Árvores e plantas da floresta tropical.'})).status,201);
    const search = async cookie => {
      const res = await call('core/search','POST',cookie,{query:invoice});
      assert.equal(res.status,200);
      return (await res.json()).items;
    };
    assert.equal((await search(seller))[0].document_id,id);
    assert.deepEqual(await search(other),[]);
    assert.equal((await call(path+'/'+id,'PUT',other,data)).status,404);
    assert.equal((await call(path+'/'+id,'DELETE',other)).status,404);
    assert.equal((await call(path+'/'+id,'PUT',owner,{...data,content:'Novo prazo de sessenta dias.'})).status,200);
    assert.equal((await search(owner)).find(row=>row.document_id===id).content,'Novo prazo de sessenta dias.');
    assert.equal((await call(path+'/'+id,'DELETE',owner)).status,204);
    assert.ok((await search(owner)).every(row=>row.document_id!==id));
    assert.equal((await admin.query('SELECT count(*)::int AS n FROM vant.document_chunks WHERE document_id=$1',[id])).rows[0].n,0);
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM vant.audit WHERE tenant_id=$1 AND action LIKE 'core.document.%' AND object_id=$2",[tenants[0],id])).rows[0].n,3);
  } finally {
    stopInference();
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await pool.end();
    await admin.end();
  }
});
