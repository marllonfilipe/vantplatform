import pg from 'pg';
const { ADMIN_DATABASE_URL,DATABASE_URL }=process.env;
if (!ADMIN_DATABASE_URL || !DATABASE_URL) throw new Error('Informe as duas URLs do banco.');
const runtime=new URL(DATABASE_URL);
const user=decodeURIComponent(runtime.username);
const password=decodeURIComponent(runtime.password);
if (!/^[a-z][a-z0-9_]{1,60}$/.test(user) || ['postgres','vant_app'].includes(user) || password.length<16) throw new Error('Use um usuário de aplicação dedicado e senha longa.');
const client=new pg.Client({connectionString:ADMIN_DATABASE_URL});
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(81742021)');
  const exists=await client.query('SELECT FROM pg_roles WHERE rolname=$1',[user]);
  if (!exists.rowCount) {
    const command=await client.query("SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', $1::text,$2::text) AS ddl",[user,password]);
    await client.query(command.rows[0].ddl);
  }
  const grant=await client.query("SELECT format('GRANT vant_app TO %I',$1::text) AS ddl",[user]);
  await client.query(grant.rows[0].ddl);
  await client.query('COMMIT');
} catch(err) { await client.query('ROLLBACK'); throw err; } finally { await client.end(); }
