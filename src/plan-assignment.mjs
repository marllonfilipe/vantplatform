import {isUuid} from './security.mjs';

const limitKeys = ['user_limit', 'active_lead_limit', 'pipeline_limit'];

// The caller supplies a privileged client inside an open transaction.
export async function assignPlan(db, tenant, code, expectedRevision, overrides = {}) {
  if (!isUuid(tenant) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error('Empresa ou revisão inválida.');
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides) ||
      Object.keys(overrides).some(key => key !== 'storage_limit_bytes' && !limitKeys.includes(key)))
    throw new Error('Campos de limite inválidos.');
  await db.query("SELECT set_config('vant.tenant_id',$1,true)", [tenant]);
  await db.query('SELECT vant.lock_plan_assignment($1)', [tenant]);
  const plan = (await db.query('SELECT * FROM vant.billing_plans WHERE code=$1', [code])).rows[0];
  if (!plan) throw new Error('Plano desconhecido.');
  const limits = limitKeys.map(key => Object.hasOwn(overrides, key) ? overrides[key] : plan[key]);
  if (limits.some(value => !Number.isInteger(value) || value < 0 || value > 2147483647) || limits[0] === 0)
    throw new Error('Informe os três limites contratados válidos.');
  const previous = (await db.query('SELECT * FROM vant.plan_assignments WHERE tenant_id=$1 ORDER BY revision DESC LIMIT 1', [tenant])).rows[0];
  const previousStorage = previous?.storage_limit_bytes == null ? null : Number(previous.storage_limit_bytes);
  const storageLimit = Object.hasOwn(overrides, 'storage_limit_bytes') ? overrides.storage_limit_bytes : previousStorage;
  if (storageLimit !== null && (!Number.isSafeInteger(storageLimit) || storageLimit < 0))
    throw new Error('Franquia de armazenamento inválida.');
  if (previous?.plan_code === code && previousStorage === storageLimit &&
      limitKeys.every((key, i) => previous[key] === limits[i])) return previous;
  if ((previous?.revision ?? 0) !== expectedRevision)
    throw new Error('O vínculo mudou. Confira a revisão atual.');
  return (await db.query(`INSERT INTO vant.plan_assignments
    (tenant_id,revision,plan_code,user_limit,active_lead_limit,pipeline_limit,storage_limit_bytes)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [tenant, expectedRevision + 1, code, ...limits, storageLimit])).rows[0];
}
