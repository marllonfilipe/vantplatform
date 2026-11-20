import { audit } from './db.mjs';
import { reject } from './http.mjs';
import { isUuid, mayManageTeams } from './security.mjs';
import { retrieveKnowledge } from './knowledge.mjs';

const leadQuery = `SELECT l.*, a.name AS account_name,
  EXISTS(SELECT FROM vant.deals d WHERE d.tenant_id=l.tenant_id AND d.lead_id=l.id AND d.status='open') AS open_deal,
  EXISTS(SELECT FROM vant.activities t WHERE t.tenant_id=l.tenant_id AND t.lead_id=l.id AND t.kind IN ('meeting','call') AND t.done_at BETWEEN now()-interval '30 days' AND now()) AS recent_interaction,
  (l.last_contact_at BETWEEN now()-interval '30 days' AND now()) AS recent_contact
  FROM vant.leads l LEFT JOIN vant.accounts a ON (a.tenant_id,a.id)=(l.tenant_id,l.account_id)
  WHERE l.tenant_id=$1 AND l.id=$2`;
const dealQuery = `SELECT d.*, current_date-d.updated_at::date AS days_unchanged,
  d.close_on < current_date AS late_close,
  EXISTS(SELECT FROM vant.activities t WHERE t.tenant_id=d.tenant_id AND t.deal_id=d.id AND t.done_at IS NULL) AS has_next_step
  FROM vant.deals d WHERE d.tenant_id=$1 AND d.id=$2`;

function qualify(lead) {
  const rules = [
    [lead.email || lead.phone, 10, 'Canal de contato cadastrado'],
    [lead.account_id, 10, 'Empresa vinculada'],
    [lead.segment, 10, 'Segmento registrado'],
    [lead.contact_id, 10, 'Pessoa de contato vinculada'],
    [lead.recent_interaction || lead.recent_contact, 25, 'Contato registrado nos últimos 30 dias'],
    [lead.open_deal, 35, 'Oportunidade aberta vinculada']
  ];
  const evidence = rules.filter(([present]) => present).map(([,points,detail])=>({points,detail}));
  const score = evidence.reduce((total,item)=>total+item.points,0);
  return { score, classification: score >= 70 ? 'Prioridade alta' : score >= 35 ? 'Prioridade média' : 'Prioridade baixa',
    evidence, nextAction: !lead.email && !lead.phone ? 'Obter um canal de contato.'
      : !lead.recent_interaction && !lead.recent_contact ? 'Registrar contato e confirmar a necessidade.'
      : !lead.open_deal ? 'Verificar orçamento e prazo antes de abrir oportunidade.' : 'Revisar o próximo marco da oportunidade.' };
}

function assess(deal) {
  const evidence = [];
  if (deal.status !== 'open') {
    return {classification:deal.status === 'won' ? 'Ganha' : 'Perdida', probability:deal.probability,
      evidence: deal.loss_reason ? [{detail:deal.loss_reason}] : [], nextAction:'Revisar o resultado registrado no CRM.'};
  }
  if (deal.late_close) evidence.push({detail:'Data prevista de fechamento vencida'});
  if (deal.days_unchanged >= 14) evidence.push({detail:'Pelo menos 14 dias sem atualização da oportunidade'});
  if (!deal.has_next_step) evidence.push({detail:'Nenhuma atividade pendente vinculada'});
  return { classification:evidence.length >= 2 ? 'Risco elevado' : evidence.length ? 'Requer atenção' : 'Em acompanhamento',
    probability:deal.probability, daysUnchanged:deal.days_unchanged, evidence,
    nextAction: deal.late_close ? 'Confirmar e atualizar a previsão de fechamento.'
      : !deal.has_next_step ? 'Agendar a próxima atividade com o responsável.' : 'Revisar a atividade pendente.' };
}

export async function analysisRoutes({db, tenant, member, requestId, url, method}) {
  const match = /^\/api\/v1\/core\/(leads|deals)\/([^/]+)\/analyses$/.exec(url.pathname);
  if (!match || !['GET','POST'].includes(method) || !isUuid(match[2])) return;
  const [, collection, id] = match;
  const lead = collection === 'leads';
  const subject = lead ? 'lead' : 'deal';
  const row = (await db.query(lead ? leadQuery : dealQuery,[tenant,id])).rows[0];
  if (!row) reject(404,'missing','Registro não encontrado.');
  if (method === 'GET') {
    const {rows} = await db.query(`SELECT id, result, model_version, latency_ms, created_at FROM vant.core_runs
      WHERE tenant_id=$1 AND subject_kind=$2 AND subject_id=$3 ORDER BY created_at DESC,id DESC LIMIT 20`,[tenant,subject,id]);
    return [200,{items:rows}];
  }
  if (!mayManageTeams(member.role) && !(member.role==='seller' && row.owner_id===member.id)) {
    reject(403,'permission','A análise exige gestão ou responsabilidade pelo registro.');
  }
  const result = lead ? qualify(row) : assess(row);
  const query = (lead ? [row.segment,row.notes,row.account_name,row.name] : [row.products,row.loss_reason,row.name]).filter(Boolean).join(' ').slice(0,320) || subject;
  const memory = await retrieveKnowledge(db,tenant,query,3);
  result.ruleset = 'crm-v1';
  result.sources = memory.items.map(({document_id,chunk_index,similarity})=>({document_id,chunk_index,similarity}));
  const {rows} = await db.query(`INSERT INTO vant.core_runs(tenant_id,actor_id,subject_kind,subject_id,model_version,latency_ms,result)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,result,model_version,latency_ms,created_at`,
    [tenant,member.id,subject,id,memory.model,memory.latencyMs,result]);
  await audit(db,tenant,member.id,'core.'+subject+'.analyzed',id,requestId);
  return [201,{...rows[0],context:memory.items}];
}
