import {isUuid} from './security.mjs';

const limitKeys = ['user_limit', 'active_lead_limit', 'pipeline_limit'];
const optionalQuotas = [
  {key: 'storage_limit_bytes', max: Number.MAX_SAFE_INTEGER, error: 'Franquia de armazenamento inválida.'},
  {key: 'agent_actions_per_day', max: 10000, error: 'Franquia diária de ações inválida.'},
  {key: 'active_flow_limit', max: 2147483647, error: 'Franquia de automações inválida.'},
  {key: 'flow_starts_per_day', max: 2147483647, error: 'Franquia de execuções inválida.'}
];
const supportedLimits = new Set([...limitKeys, ...optionalQuotas.map(quota => quota.key)]);

// The caller supplies a privileged client inside an open transaction.
export async function assignPlan(db, tenant, code, expectedRevision, overrides = {}) {
  if (!isUuid(tenant) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new Error('Empresa ou revisão inválida.');
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides) ||
      Object.keys(overrides).some(key => !supportedLimits.has(key)))
    throw new Error('Campos de limite inválidos.');
  await db.query("SELECT set_config('vant.tenant_id',$1,true)", [tenant]);
  await db.query('SELECT vant.lock_plan_assignment($1)', [tenant]);
  const plan = (await db.query('SELECT * FROM vant.billing_plans WHERE code=$1', [code])).rows[0];
  if (!plan) throw new Error('Plano desconhecido.');
  const limits = limitKeys.map(key => Object.hasOwn(overrides, key) ? overrides[key] : plan[key]);
  if (limits.some(value => !Number.isInteger(value) || value < 0 || value > 2147483647) || limits[0] === 0)
    throw new Error('Informe os três limites contratados válidos.');
  const previous = (await db.query('SELECT * FROM vant.plan_assignments WHERE tenant_id=$1 ORDER BY revision DESC LIMIT 1', [tenant])).rows[0];
  const previousQuotas = optionalQuotas.map(({key}) => previous?.[key] == null ? null : Number(previous[key]));
  const quotas = optionalQuotas.map(({key, max, error}, i) => {
    const value = Object.hasOwn(overrides, key) ? overrides[key] : previousQuotas[i];
    if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > max)) throw new Error(error);
    return value;
  });
  if (previous?.plan_code === code && quotas.every((value, i) => value === previousQuotas[i]) &&
      limitKeys.every((key, i) => previous[key] === limits[i])) return previous;
  if ((previous?.revision ?? 0) !== expectedRevision)
    throw new Error('O vínculo mudou. Confira a revisão atual.');
  return (await db.query(`INSERT INTO vant.plan_assignments
    (tenant_id,revision,plan_code,user_limit,active_lead_limit,pipeline_limit,storage_limit_bytes,agent_actions_per_day,active_flow_limit,flow_starts_per_day)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [tenant, expectedRevision + 1, code, ...limits, ...quotas])).rows[0];
}
