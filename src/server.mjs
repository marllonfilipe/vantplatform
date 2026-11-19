import { createPool, checkRuntime } from './db.mjs';
import { createApp } from './app.mjs';
import { featureRoutes } from './routes.mjs';
import { servePage } from './pages.mjs';
const pool=createPool(process.env.DATABASE_URL);
await checkRuntime(pool);
const server=createApp({pool,origin:process.env.APP_ORIGIN,environment:process.env.APP_ENV,featureRoutes,servePage});
server.listen(Number(process.env.PORT??3000),process.env.BIND_HOST??'127.0.0.1');
function shutdown() {
  server.close(async()=>{ await pool.end(); });
  server.closeIdleConnections();
}
process.once('SIGTERM',shutdown);
process.once('SIGINT',shutdown);
