import {audit} from './db.mjs';
import {reject} from './http.mjs';
import {mayManageTeams} from './security.mjs';

const defaults={revision:0,paused:false,tasks_enabled:true,sdr_enabled:true,daily_limit:100,used_today:0};
const day="(statement_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date";
const read=`SELECT revision,paused,tasks_enabled,sdr_enabled,daily_limit,
  CASE WHEN usage_day=${day} THEN used ELSE 0 END AS used_today
  FROM vant.agent_controls WHERE tenant_id=$1`;

async function lock(db,tenant){
 await db.query('INSERT INTO vant.agent_controls(tenant_id) VALUES($1) ON CONFLICT DO NOTHING',[tenant]);
 return (await db.query(read+' FOR UPDATE',[tenant])).rows[0];
}

export async function reserveAgentAction(db,tenant,tool){
 const config=await lock(db,tenant);
 if(config.paused||!config[tool])reject(409,'agent_paused','A supervisão da empresa pausou esta ferramenta.');
 const usage=await db.query(`UPDATE vant.agent_controls SET usage_day=${day},
   used=CASE WHEN usage_day=${day} THEN used+1 ELSE 1 END
   WHERE tenant_id=$1 AND (usage_day IS DISTINCT FROM ${day} OR used<daily_limit) RETURNING used`,[tenant]);
 if(!usage.rowCount)reject(429,'agent_daily_limit','Limite diário de ações dos agentes atingido.');
}

export async function supervisionRoutes({db,tenant,member,requestId,url,method,body}){
 if(url.pathname!=='/api/v1/agents/controls'||!['GET','PUT'].includes(method))return;
 if(!mayManageTeams(member.role))reject(403,'permission','A supervisão exige perfil de gestão.');
 if(method==='GET'){
  const config=(await db.query(read,[tenant])).rows[0]??defaults;
  const {rows:history}=await db.query('SELECT revision,actor_id,settings,created_at FROM vant.agent_control_history WHERE tenant_id=$1 ORDER BY revision DESC LIMIT 10',[tenant]);
  return [200,{config,history}];
 }
 if(member.role!=='owner')reject(403,'permission','A alteração exige o proprietário da empresa.');
 const {revision,paused,tasks_enabled,sdr_enabled,daily_limit}=body;
 if(!Number.isSafeInteger(revision)||revision<0||[paused,tasks_enabled,sdr_enabled].some(v=>typeof v!=='boolean')
    ||!Number.isInteger(daily_limit)||daily_limit<1||daily_limit>10000)reject(400,'controls','Configuração inválida.');
 const current=await lock(db,tenant);
 const settings={paused,tasks_enabled,sdr_enabled,daily_limit};
 if(Object.entries(settings).every(([k,v])=>current[k]===v))return [200,current];
 if(current.revision!==revision)reject(409,'revision','Configuração atualizada por outra pessoa. Recarregue a página.');
 const {rows:[next]}=await db.query(`UPDATE vant.agent_controls SET revision=revision+1,paused=$2,tasks_enabled=$3,sdr_enabled=$4,daily_limit=$5
   WHERE tenant_id=$1 RETURNING revision`,[tenant,paused,tasks_enabled,sdr_enabled,daily_limit]);
 await db.query('INSERT INTO vant.agent_control_history(tenant_id,revision,actor_id,settings) VALUES($1,$2,$3,$4)',[tenant,next.revision,member.id,settings]);
 await audit(db,tenant,member.id,'agent.controls.updated',null,requestId);
 return [200,{...current,...settings,...next}];
}
