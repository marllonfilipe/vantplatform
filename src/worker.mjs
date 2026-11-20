import {setTimeout as wait} from 'node:timers/promises';
import {createPool,checkRuntime} from './db.mjs';
import {isUuid} from './security.mjs';
import {processNext} from './automation.mjs';

const tenant=process.env.VANT_WORKER_TENANT;
if(!isUuid(tenant))throw Error('Defina VANT_WORKER_TENANT.');
const once=process.argv.includes('--once');
const pool=createPool(process.env.DATABASE_URL);
let stopping=false;
process.once('SIGTERM',()=>{stopping=true;});
process.once('SIGINT',()=>{stopping=true;});
try{
 await checkRuntime(pool);
 do{
  const processed=await processNext(pool,tenant);
  if(!processed&&!once&&!stopping)await wait(1000);
 }while(!once&&!stopping);
}finally{await pool.end();}
