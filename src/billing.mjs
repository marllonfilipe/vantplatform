import {mayManageTeams} from './security.mjs';
import {reject} from './http.mjs';

export async function billingRoutes({db,member,url,method}){
 if(url.pathname!=='/api/v1/billing/plans')return;
 if(!mayManageTeams(member.role))reject(403,'permission','A consulta de planos exige gestão.');
 if(method!=='GET')reject(405,'method','A consulta de planos aceita GET.');
 const {rows}=await db.query(`SELECT code,name,monthly_cents,custom_terms,user_limit,active_lead_limit,pipeline_limit,
  whatsapp_connection_limit,features FROM vant.billing_plans ORDER BY display_order,code`);
 return [200,{currency:'BRL',interval:'month',items:rows}];
}
