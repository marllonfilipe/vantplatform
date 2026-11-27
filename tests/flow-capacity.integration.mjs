import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createPool, withTenant} from '../src/db.mjs';
import {hashPassword} from '../src/security.mjs';
import {assignPlan} from '../src/plan-assignment.mjs';
import {automationRoutes, processNext} from '../src/automation.mjs';
import {createCrmLead} from '../src/crm.mjs';

test('dois workers disputam uma vaga diária e retomam a fila sem duplicar ações', async () => {
  assert.equal(process.env.APP_ENV, 'test');
  const tenant = randomUUID(), member = {id: randomUUID(), role: 'owner'};
  const admin = new pg.Client({connectionString: process.env.ADMIN_DATABASE_URL});
  const pool = createPool(process.env.DATABASE_URL);
  await admin.connect();
  const jobs = async () => (await admin.query(`SELECT state,attempts,flow_admitted_on IS NOT NULL AS admitted,
    payload ? 'billing_wait' AS waiting FROM vant.jobs WHERE tenant_id=$1 AND kind='flow.lead_created'`, [tenant])).rows;
  const activities = async () => (await admin.query('SELECT count(*)::integer AS n FROM vant.activities WHERE tenant_id=$1', [tenant])).rows[0].n;
  const assign = async (revision, limit) => {
    await admin.query('BEGIN');
    try {
      await assignPlan(admin, tenant, 'growth', revision, {flow_starts_per_day: limit});
      await admin.query('COMMIT');
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }
  };
  try {
    await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Franquia das execuções')", [tenant]);
    await admin.query(`INSERT INTO vant.members(tenant_id,id,email,name,role,password_hash)
      VALUES($1,$2,'operador@example.invalid','Operador','owner',$3)`, [tenant, member.id, await hashPassword(randomUUID())]);
    await assign(0, 1);
    await withTenant(pool, tenant, async db => {
      const ctx = {tenant, member, db, requestId: randomUUID()};
      const [status] = await automationRoutes({...ctx, url: new URL('http://localhost/api/v1/automations'), method: 'POST',
        body: {name: 'Atendimento', enabled: true, task_title: 'Primeiro contato', steps: {match: [{kind: 'task', title: 'Segundo contato'}]}}});
      assert.equal(status, 201);
      await createCrmLead(ctx, {name: 'Primeiro'});
      await createCrmLead(ctx, {name: 'Segundo'});
    });
    await Promise.all([processNext(pool, tenant), processNext(pool, tenant)]);
    let state = await jobs();
    assert.equal(state.filter(j => j.admitted).length, 1);
    assert.equal(state.filter(j => j.waiting && j.attempts === 0).length, 1);
    assert.equal(await activities(), 1);
    await assign(1, 0);
    await processNext(pool, tenant);
    assert.equal(await activities(), 2);
    assert.equal((await jobs()).filter(j => j.state === 'done').length, 1);
    assert.equal(await processNext(pool, tenant), false);
    await assign(2, 2);
    await admin.query("UPDATE vant.jobs SET available_at=now() WHERE tenant_id=$1 AND payload ? 'billing_wait'", [tenant]);
    await processNext(pool, tenant);
    await processNext(pool, tenant);
    state = await jobs();
    assert.ok(state.every(j => j.admitted && !j.waiting && j.state === 'done' && j.attempts === 2));
    assert.equal(await activities(), 4);
  } finally {
    await pool.end();
    await admin.end();
  }
});
