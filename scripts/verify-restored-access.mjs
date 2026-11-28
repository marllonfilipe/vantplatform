import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.mjs';
import { createPool, checkRuntime } from '../src/db.mjs';

const mode = process.argv[2];
if (process.env.APP_ENV !== 'test' || !['prepare', 'verify'].includes(mode)) {
  throw new Error('Use prepare ou verify em um banco de teste descartável.');
}
const connection = new URL(process.env.DATABASE_URL);
assert.equal(connection.pathname, mode === 'prepare' ? '/vant_test' : '/vant_restore');
const pool = createPool(connection.href);
let server;
try {
  await checkRuntime(pool);
  // A origem é a da aplicação de teste. O socket usa uma porta livre no loopback.
  const origin = 'http://localhost';
  server = createApp({pool, origin, environment: 'test'});
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
  const headers = {Origin: origin, 'Content-Type': 'application/json'};
  const login = await fetch(base + '/auth/login', {
    method: 'POST', headers,
    body: JSON.stringify({tenantId: process.env.RESTORE_TENANT_ID, email: process.env.OWNER_EMAIL, password: process.env.OWNER_PASSWORD})
  });
  assert.equal(login.status, 200, 'Login no banco de ' + mode);
  headers.Cookie = login.headers.get('set-cookie').split(';')[0];
  const teams = base + '/teams';
  if (mode === 'prepare') {
    const created = await fetch(teams, {method: 'POST', headers, body: JSON.stringify({name: 'Equipe de recuperação'})});
    assert.equal(created.status, 201);
  }
  const profile = await fetch(base + '/auth/me', {headers});
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).tenantId, process.env.RESTORE_TENANT_ID);
  const response = await fetch(teams, {headers});
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items.map(team => team.name), ['Equipe de recuperação']);
  const logout = await fetch(base + '/auth/logout', {method: 'POST', headers});
  assert.equal(logout.status, 204);
  console.log(mode === 'prepare' ? 'Conta de recuperação preparada.' : 'Login, leitura da equipe restaurada e logout aprovados.');
} finally {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  await pool.end();
}
