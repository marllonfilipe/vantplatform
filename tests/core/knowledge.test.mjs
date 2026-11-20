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
    const {rows:[member]} = await admin.query("SELECT id FROM vant.members WHERE tenant_id=$1 AND role='owner'",[tenants[0]]);
    const {rows:[lead]} = await admin.query("INSERT INTO vant.leads(tenant_id,owner_id,name,segment,phone) VALUES($1,$2,'Compras','Varejo','0000') RETURNING id",[tenants[0],member.id]);
    const leadPath='core/leads/'+lead.id+'/analyses';
    assert.equal((await call(leadPath,'POST',seller,{})).status,403);
    assert.equal((await call(leadPath,'POST',other,{})).status,404);
    const run=await call(leadPath,'POST',owner,{});
    assert.equal(run.status,201);
    const analysis=await run.json();
    assert.equal(analysis.result.score,20);
    assert.equal(analysis.result.sources.length,2);
    assert.equal(analysis.context.length,2);
    assert.equal((await call(leadPath,'GET',other)).status,404);
    const pipeline=(await admin.query("INSERT INTO vant.pipelines(tenant_id,name) VALUES($1,'Vendas') RETURNING id",[tenants[0]])).rows[0].id;
    const stage=(await admin.query("INSERT INTO vant.stages(tenant_id,pipeline_id,name,position) VALUES($1,$2,'Proposta',0) RETURNING id",[tenants[0],pipeline])).rows[0].id;
    const deal=(await admin.query(`INSERT INTO vant.deals(tenant_id,owner_id,lead_id,pipeline_id,stage_id,name,amount_cents,probability,close_on)
      VALUES($1,$2,$3,$4,$5,'Proposta',10000,40,current_date-1) RETURNING id`,[tenants[0],member.id,lead.id,pipeline,stage])).rows[0].id;
    const dealRun=await call('core/deals/'+deal+'/analyses','POST',owner,{});
    assert.equal(dealRun.status,201);
    const dealResult=(await dealRun.json()).result;
    assert.equal(dealResult.probability,40);
    assert.equal(dealResult.classification,'Risco elevado');
    const newRun=await call(leadPath,'POST',owner,{});
    assert.equal((await newRun.json()).result.score,55);
    const history=await (await call(leadPath,'GET',owner)).json();
    assert.deepEqual(history.items.map(r=>r.result.score),[55,20]);
    assert.equal(history.items[0].result.qualification.interest,'Não informado');
    assert.equal((await call('crm/leads/'+lead.id,'PATCH',owner,{purchase_intent:'invalid'})).status,400);
    const offer={category:'offer',title:'Gestão de cobrança',content:'Reduzir tempo de cobrança. Varejo Compras'};
    assert.equal((await call(path,'POST',other,offer)).status,201);
    const updated=await call('crm/leads/'+lead.id,'PATCH',owner,{purchase_intent:'requested_proposal',budget_state:'confirmed',purchase_window:'month',stated_need:'Reduzir tempo de cobrança.'});
    assert.equal(updated.status,200);
    const noOffer=await (await call(leadPath,'POST',owner,{})).json();
    assert.equal(noOffer.result.offer,undefined);
    const catalogId=(await (await call(path,'POST',owner,offer)).json()).id;
    const informed=await (await call(leadPath,'POST',owner,{})).json();
    assert.equal(informed.result.qualification.budget,'Confirmado');
    assert.equal(informed.result.qualification.need,'Reduzir tempo de cobrança.');
    assert.equal(informed.result.offer.document_id,catalogId);
    assert.equal(informed.result.offer.revision,1);
    assert.equal((await call(path+'/'+catalogId,'PUT',owner,{...offer,title:'Nova oferta'})).status,200);
    assert.equal((await (await call(path,'GET',owner)).json()).items.find(r=>r.id===catalogId).revision,2);
    assert.match(informed.result.nextAction,/Preparar proposta/);
    const previous=await (await call(leadPath,'GET',owner)).json();
    assert.equal(previous.items[2].result.qualification.budget,'Não informado');
    const metrics=await call('core/metrics?days=7','GET',owner);
    assert.equal(metrics.status,200);
    const measured=(await metrics.json()).items;
    assert.deepEqual(measured.map(item=>[item.subject_kind,item.runs]),[['deal',1],['lead',4]]);
    assert.ok(measured.every(item=>item.p95_ms>=item.p50_ms && item.p50_ms>0));
    assert.equal((await call('core/metrics','GET',seller)).status,403);
    assert.equal((await call('core/metrics?days=1','GET',owner)).status,400);
    assert.deepEqual((await (await call('core/metrics','GET',other)).json()).items,[]);
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
