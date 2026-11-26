import pg from 'pg';
import {assignPlan} from '../src/plan-assignment.mjs';

const [tenant, code, revision, overrides = '{}'] = process.argv.slice(2);
if (!process.env.ADMIN_DATABASE_URL || !tenant || !code || !/^\d+$/.test(revision ?? ''))
  throw new Error('Informe ADMIN_DATABASE_URL e os argumentos EMPRESA PLANO REVISÃO [LIMITES_JSON].');
const db = new pg.Client({connectionString: process.env.ADMIN_DATABASE_URL});
await db.connect();
try {
  await db.query('BEGIN');
  const assignment = await assignPlan(db, tenant, code, Number(revision), JSON.parse(overrides));
  await db.query('COMMIT');
  console.log('Plano registrado:', assignment.plan_code, 'revisão', assignment.revision);
} catch (error) {
  await db.query('ROLLBACK');
  throw error;
} finally {
  await db.end();
}
