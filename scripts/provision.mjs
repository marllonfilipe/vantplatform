import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/security.mjs';

const { ADMIN_DATABASE_URL, TENANT_NAME, OWNER_EMAIL, OWNER_PASSWORD } = process.env;
if (!ADMIN_DATABASE_URL || !TENANT_NAME?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(OWNER_EMAIL??'')) throw new Error('Informe ADMIN_DATABASE_URL, TENANT_NAME, OWNER_EMAIL e OWNER_PASSWORD.');
const passwordHash = await hashPassword(OWNER_PASSWORD);
const client = new pg.Client({ connectionString: ADMIN_DATABASE_URL });
await client.connect();
try {
  const tenant = randomUUID();
  await client.query('BEGIN');
  await client.query("SELECT set_config('vant.tenant_id',$1,true)",[tenant]);
  await client.query('INSERT INTO vant.tenants(id,name) VALUES($1,$2)',[tenant,TENANT_NAME.trim()]);
  await client.query("INSERT INTO vant.members(tenant_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'owner')",[tenant,TENANT_NAME.trim(),OWNER_EMAIL.trim().toLowerCase(),passwordHash]);
  await client.query('COMMIT');
  console.log('Tenant criado:',tenant);
} catch (err) { await client.query('ROLLBACK'); throw err; } finally { await client.end(); }
