import pg from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
import { isUuid } from './security.mjs';

export const inferenceContext = new AsyncLocalStorage();
const metering = new WeakMap();

export function createPool(connectionString) {
  if (!connectionString) throw new Error('Defina DATABASE_URL.');
  // Uma coluna DATE representa um dia do calendário em qualquer fuso horário.
  const types = {
    getTypeParser(oid, format) {
      if (oid === pg.types.builtins.DATE && format !== 'binary') return text => text;
      return pg.types.getTypeParser(oid, format);
    }
  };
  const pool = new pg.Pool({ connectionString, types, max: 12, connectionTimeoutMillis: 4000, idleTimeoutMillis: 30000, statement_timeout: 10000 });
  pool.on('error', () => console.error(JSON.stringify({ event:'database.pool.error' })));
  // A medição usa transações próprias mesmo quando todas as conexões do CRM estão ocupadas.
  const meter = new pg.Pool({connectionString, max:2, connectionTimeoutMillis:4000,
    statement_timeout:10000, idleTimeoutMillis:1000, allowExitOnIdle:true});
  meter.on('error', () => console.error(JSON.stringify({event:'inference.meter.pool.error'})));
  metering.set(pool,meter);
  return pool;
}
export async function checkRuntime(pool) {
  const result = await pool.query(`SELECT
    pg_has_role(current_user,'vant_app','USAGE') AS member,
    EXISTS (SELECT FROM pg_roles r WHERE (r.rolsuper OR r.rolbypassrls)
      AND pg_has_role(current_user,r.oid,'MEMBER')) AS privileged,
    EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
      WHERE n.nspname='vant' AND pg_has_role(current_user,c.relowner,'MEMBER')) AS owner,
    has_schema_privilege(current_user,'vant','CREATE') AS ddl`);
  const r = result.rows[0];
  if (!r.member || r.privileged || r.owner || r.ddl) throw new Error('A API exige papel de aplicação restrito.');
}
export async function withTenant(pool, tenantId, callback) {
  if (!isUuid(tenantId)) throw new Error('Tenant inválido.');
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('vant.tenant_id',$1,true)",[tenantId]);
    const result = await inferenceContext.run({tenant:tenantId, meter:metering.get(pool)}, callback, client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw err;
  } finally { client.release(discard); }
}
export function audit(db,tenant,actor,action,objectId,requestId) {
  return db.query('INSERT INTO vant.audit(tenant_id,actor_id,action,object_id,request_id) VALUES ($1,$2,$3,$4,$5)',[tenant,actor,action,objectId,requestId]);
}
