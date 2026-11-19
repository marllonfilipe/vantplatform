import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';

if (!process.env.ADMIN_DATABASE_URL) throw new Error('Defina ADMIN_DATABASE_URL.');
const admin = new pg.Client({ connectionString: process.env.ADMIN_DATABASE_URL });
await admin.connect();
try {
  await admin.query('BEGIN');
  await admin.query('SELECT pg_advisory_xact_lock(81742021)');
  await admin.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='vant_app') THEN
      CREATE ROLE vant_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
    END IF;
  END $$`);
  await admin.query(`CREATE TABLE IF NOT EXISTS public.vant_migrations
    (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  const directory = new URL('../migrations/', import.meta.url);
  const names = (await readdir(directory)).filter(n => /^\d+_.*\.sql$/.test(n)).sort();
  for (const name of names) {
    const sql = (await readFile(new URL(name, directory), 'utf8')).replaceAll('\r\n','\n');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = await admin.query('SELECT checksum FROM public.vant_migrations WHERE name=$1',[name]);
    if (existing.rowCount && existing.rows[0].checksum !== checksum) throw new Error('Migration alterada: '+name);
    if (existing.rowCount) continue;
    await admin.query(sql);
    await admin.query('INSERT INTO public.vant_migrations(name,checksum) VALUES ($1,$2)',[name,checksum]);
    console.log('Aplicada', name);
  }
  await admin.query('COMMIT');
} catch (err) {
  await admin.query('ROLLBACK');
  throw err;
} finally { await admin.end(); }
