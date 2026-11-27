import {inferenceContext, withTenant} from './db.mjs';
import {reject} from './http.mjs';

export async function reserveInference(count,modelVersion){
  const scope=inferenceContext.getStore();
  if(!scope)return;
  const {meter,tenant}=scope;
  if(!meter)throw new Error('Medição de inferência indisponível.');
  return withTenant(meter,tenant,async db=>{
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,48011))',[tenant]);
    const result=await db.query(`INSERT INTO vant.inference_batches(tenant_id,model_version,input_count)
      SELECT $1,$2,$3::integer WHERE NOT EXISTS (
        SELECT FROM (SELECT inference_texts_per_day AS maximum FROM vant.plan_assignments
                     WHERE tenant_id=$1 ORDER BY revision DESC LIMIT 1) contract
        WHERE maximum IS NOT NULL AND maximum < $3::integer + (
          SELECT coalesce(sum(input_count),0) FROM vant.inference_batches
          WHERE tenant_id=$1 AND usage_day=(statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date
          AND state IN ('completed','reserved')
        )
      ) RETURNING id`,[tenant,modelVersion,count]);
    if(!result.rowCount)reject(429,'inference_daily_limit','Franquia diária de inferências atingida.');
    return {meter,tenant,id:result.rows[0].id};
  });
}

export async function settleInference(batch,state){
  if(!batch)return;
  await withTenant(batch.meter,batch.tenant,async db=>{
    const result=await db.query(`UPDATE vant.inference_batches SET state=$3
      WHERE tenant_id=$1 AND id=$2 AND state='reserved'`,[batch.tenant,batch.id,state]);
    if(result.rowCount!==1)throw new Error('Reserva de inferência indisponível.');
  });
}
