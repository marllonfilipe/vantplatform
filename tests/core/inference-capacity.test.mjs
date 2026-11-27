import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createPool,withTenant} from '../../src/db.mjs';
import {embed,stopInference} from '../../src/inference.mjs';
import {assignPlan} from '../../src/plan-assignment.mjs';
import {billingRoutes} from '../../src/billing.mjs';

test('vetores reais em CPU consomem franquia do tenant mesmo após rollback do CRM',async()=>{
  assert.equal(process.env.APP_ENV,'test');
  const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});
  const pool=createPool(process.env.DATABASE_URL);
  const tenant=randomUUID(),other=randomUUID();
  await admin.connect();
  async function contract(revision,limit){
    await admin.query('BEGIN');
    try{
      await assignPlan(admin,tenant,'growth',revision,{inference_texts_per_day:limit});
      await admin.query('COMMIT');
    }catch(error){await admin.query('ROLLBACK');throw error;}
  }
  const consume=(company,texts)=>withTenant(pool,company,()=>embed(texts));
  const usage=company=>withTenant(pool,company,async db=>{
    const [,report]=await billingRoutes({db,tenant:company,member:{role:'owner'},method:'GET',
      url:new URL('http://localhost/api/v1/billing/usage')});
    return report.inference_texts;
  });
  try{
    await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Empresa A'),($2,'Empresa B')",[tenant,other]);
    await contract(0,2);
    await assert.rejects(consume(tenant,['um','dois','três']),{code:'inference_daily_limit'});
    const results=await Promise.allSettled([consume(tenant,['um','dois']),consume(tenant,['três','quatro'])]);
    const fulfilled=results.filter(r=>r.status==='fulfilled');
    assert.equal(fulfilled.length,1);
    assert.equal(fulfilled[0].value.vectors.length,2);
    assert.ok(fulfilled[0].value.vectors.every(vector=>vector.length>0&&vector.every(Number.isFinite)));
    assert.equal(results.find(r=>r.status==='rejected').reason.code,'inference_daily_limit');
    assert.deepEqual(await usage(tenant),{completed:'2',reserved:'0',failed:'0'});
    assert.deepEqual(await usage(other),{completed:'0',reserved:'0',failed:'0'});
    await assert.rejects(withTenant(pool,other,async()=>{
      await embed(['reunião comercial']);
      throw new Error('Operação comercial desfeita');
    }),/Operação comercial desfeita/);
    assert.equal((await usage(other)).completed,'1');
    await contract(1,0);
    await assert.rejects(consume(tenant,['hoje']),{code:'inference_daily_limit'});
    await admin.query("UPDATE vant.inference_batches SET usage_day=usage_day-1 WHERE tenant_id=$1",[tenant]);
    await contract(2,1);
    await consume(tenant,['novo período']);
    assert.equal((await usage(tenant)).completed,'1');
  }finally{
    stopInference();
    await pool.end();
    await admin.end();
  }
});
