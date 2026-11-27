import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {createPool, withTenant} from '../src/db.mjs';
import {assignPlan} from '../src/plan-assignment.mjs';
import {reserveAgentAction} from '../src/supervision.mjs';

test('franquia diária dos agentes respeita concorrência, rollback e troca de dia', async () => {
  assert.equal(process.env.APP_ENV, 'test');
  const admin = new pg.Client({connectionString: process.env.ADMIN_DATABASE_URL});
  const pool = createPool(process.env.DATABASE_URL);
  const tenant = randomUUID(), other = randomUUID();
  await admin.connect();
  const reserve = (company = tenant) => withTenant(pool, company, db => reserveAgentAction(db, company, 'tasks_enabled'));
  const usage = company => withTenant(pool, company, async db =>
    (await db.query('SELECT * FROM vant.daily_agent_capacity($1)', [company])).rows[0]);
  const assign = async (revision, limit) => {
    await admin.query('BEGIN');
    try {
      const row = await assignPlan(admin, tenant, 'growth', revision, {agent_actions_per_day: limit});
      await admin.query('COMMIT');
      return row;
    } catch (error) {
      await admin.query('ROLLBACK');
      throw error;
    }
  };
  try {
    await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Franquia A'),($2,'Franquia B')", [tenant, other]);
    assert.equal((await assign(0, 1)).revision, 1);
    assert.equal((await assign(0, 1)).revision, 1);
    await assert.rejects(assign(1, -1), /diária de ações inválida/);
    const results = await Promise.allSettled([reserve(), reserve()]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.code, 'agent_daily_limit');
    assert.deepEqual(await usage(tenant), {used_today: 1, operational_limit: 100, contract_limit: 1, effective_limit: 1});
    await reserve(other);
    assert.equal((await usage(other)).contract_limit, null);
    await admin.query("UPDATE vant.agent_controls SET usage_day=(now() AT TIME ZONE 'America/Sao_Paulo')::date-1 WHERE tenant_id=$1", [tenant]);
    assert.equal((await usage(tenant)).used_today, 0);
    await assign(1, 0);
    await assert.rejects(reserve(), {code: 'agent_daily_limit'});
    await assign(2, 7);
    await admin.query('UPDATE vant.agent_controls SET daily_limit=1 WHERE tenant_id=$1', [tenant]);
    await assert.rejects(withTenant(pool, tenant, async db => {
      await reserveAgentAction(db, tenant, 'tasks_enabled');
      throw new Error('Cancelar ação de teste');
    }), /Cancelar ação de teste/);
    assert.equal((await usage(tenant)).used_today, 0);
    await reserve();
    await assert.rejects(reserve(), {code: 'agent_daily_limit'});
    assert.equal((await usage(tenant)).effective_limit, 1);
    await assign(3, null);
    assert.equal((await usage(tenant)).effective_limit, 1);
  } finally {
    await pool.end();
    await admin.end();
  }
});
