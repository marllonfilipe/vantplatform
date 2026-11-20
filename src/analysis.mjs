import {prepareSdr} from './sdr-questions.mjs';
import {contactReference,maySuggestFollowup} from './followup.mjs';
import { lastDealTouch } from './deal-context.mjs';
import { options } from '../public/crm-schema.js';
import { audit } from './db.mjs';
import { reject } from './http.mjs';
import { isUuid, mayManageTeams } from './security.mjs';
import { retrieveKnowledge } from './knowledge.mjs';

const leadQuery = `SELECT l.*, ${maySuggestFollowup} AS followup_due,
  floor(extract(epoch FROM now()-(${contactReference}))/86400)::integer AS quiet_days, a.name AS account_name, ct.title AS contact_title, ct.decision_maker,
  EXISTS(SELECT FROM vant.deals d WHERE d.tenant_id=l.tenant_id AND d.lead_id=l.id AND d.status='open') AS open_deal,
  EXISTS(SELECT FROM vant.activities t WHERE t.tenant_id=l.tenant_id AND t.lead_id=l.id AND t.kind IN ('meeting','call') AND t.done_at BETWEEN now()-interval '30 days' AND now()) AS recent_interaction,
  (l.last_contact_at BETWEEN now()-interval '30 days' AND now()) AS recent_contact
  FROM vant.leads l LEFT JOIN vant.accounts a ON (a.tenant_id,a.id)=(l.tenant_id,l.account_id)
  LEFT JOIN vant.contacts ct ON (ct.tenant_id,ct.id)=(l.tenant_id,l.contact_id)
  WHERE l.tenant_id=$1 AND l.id=$2`;
const dealQuery = `SELECT d.*, current_date-d.updated_at::date AS days_unchanged,
  current_date-(${lastDealTouch})::date AS days_since_touch,
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
    qualification: {
      need:lead.stated_need, objection:lead.stated_objection, role:lead.contact_title,
      decisionMaker:lead.decision_maker, interest:options.purchase_intent[lead.purchase_intent],
      budget:options.budget_state[lead.budget_state], timing:options.purchase_window[lead.purchase_window]
    },
    evidence, nextAction: lead.stated_objection ? 'Tratar a objeção registrada e documentar a resposta do cliente.'
      : lead.budget_state==='unavailable' ? 'Confirmar quando o orçamento poderá ser reavaliado.'
      : lead.purchase_intent==='requested_proposal' && lead.budget_state==='confirmed' ? 'Preparar proposta conforme a necessidade e o prazo informados.'
      : !lead.email && !lead.phone ? 'Obter um canal de contato.'
      : !lead.recent_interaction && !lead.recent_contact ? 'Registrar contato e confirmar a necessidade.'
      : !lead.open_deal ? 'Verificar orçamento e prazo antes de abrir oportunidade.' : 'Revisar o próximo marco da oportunidade.' };
}

function assess(deal) {
  const evidence = [];
  if (deal.status === 'lost') {
    const nextAction='Verificar se as condições da perda mudaram antes de propor retomada.';
    return {classification:'Perdida',probability:deal.probability,evidence:deal.loss_reason?[{detail:deal.loss_reason}]:[],nextAction,
      recovery:{status:'lost',reason:deal.loss_reason??null,daysSinceTouch:deal.days_since_touch,
      questions:['O motivo registrado para a perda ainda se aplica?','Há uma condição nova que justifique reavaliar a oportunidade?']}};
  }
  if (deal.status !== 'open') {
    return {classification:deal.status === 'won' ? 'Ganha' : 'Perdida', probability:deal.probability,
      evidence: deal.loss_reason ? [{detail:deal.loss_reason}] : [], nextAction:'Revisar o resultado registrado no CRM.'};
  }
  if (deal.late_close) evidence.push({detail:'Data prevista de fechamento vencida'});
  if (deal.days_unchanged >= 14) evidence.push({detail:'Pelo menos 14 dias sem atualização da oportunidade'});
  if (!deal.has_next_step) evidence.push({detail:'Nenhuma atividade pendente vinculada'});
  const recovery=evidence.length ? {status:'open',daysSinceTouch:deal.days_since_touch,
    reason:deal.late_close?'Fechamento previsto vencido':deal.days_since_touch>=14?'Sem atualização ou contato recente':'Revisão do acompanhamento',
    questions:[deal.late_close?'Qual é a nova previsão de decisão?':'Que impedimento está atrasando a decisão?',
      deal.has_next_step?'A atividade planejada resolve o impedimento?':'Quem assumirá a próxima atividade e em qual data?']} : null;
  return { recovery, classification:evidence.length >= 2 ? 'Risco elevado' : evidence.length ? 'Requer atenção' : 'Em acompanhamento',
    probability:deal.probability, daysUnchanged:deal.days_unchanged, evidence,
    nextAction: deal.late_close ? 'Confirmar e atualizar a previsão de fechamento.'
      : !deal.has_next_step ? 'Agendar a próxima atividade com o responsável.' : 'Revisar a atividade pendente.' };
}

export async function analysisRoutes({db, tenant, member, requestId, url, method}) {
  if (url.pathname === '/api/v1/core/metrics' && method === 'GET') {
    if (!mayManageTeams(member.role)) reject(403,'permission','Apenas gestores consultam o consumo da empresa.');
    const days = Number(url.searchParams.get('days') ?? 30);
    if (![7,30,90].includes(days)) reject(400,'period','Use 7, 30 ou 90 dias.');
    const {rows} = await db.query(
      `SELECT subject_kind, model_version, count(*)::int AS runs,
              percentile_disc(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_ms,
              percentile_disc(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms,
              max(created_at) AS last_run
         FROM vant.core_runs
        WHERE tenant_id=$1 AND created_at >= now() - make_interval(days => $2::integer)
        GROUP BY subject_kind, model_version ORDER BY subject_kind, model_version`,
      [tenant,days]);
    return [200,{days,items:rows}];
  }
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
  if(lead)result.sdrQuestions=prepareSdr(row);
  if(lead && row.followup_due){
    const prompt=row.stated_need ? 'A necessidade registrada continua sendo uma prioridade?'
      : 'Qual é a sua prioridade comercial neste momento?';
    result.followup={days:row.quiet_days,reason:'Sem contato concluído há pelo menos 14 dias e sem follow-up pendente.',
      draft:'Olá! '+prompt+' Podemos combinar um horário para conversar?'};
    result.nextAction='Revisar o contexto do lead e preparar um follow-up.';
  }
  const subjectColumn = lead ? 'lead_id' : 'deal_id';
  const taskFields = 't.id,t.title,t.kind,t.due_at,t.done_at,t.owner_id,m.name AS owner_name';
  const taskQuery = 'SELECT '+taskFields+' FROM vant.activities t JOIN vant.members m ON (m.tenant_id,m.id)=(t.tenant_id,t.owner_id) WHERE t.tenant_id=$1 AND t.'+subjectColumn+'=$2 ';
  const pending = await db.query(taskQuery+'AND t.done_at IS NULL ORDER BY t.due_at NULLS LAST,t.created_at,t.id LIMIT 5',[tenant,id]);
  const completed = await db.query(taskQuery+'AND t.done_at<=now() ORDER BY t.done_at DESC,t.id LIMIT 5',[tenant,id]);
  result.activities = {pending:pending.rows,completed:completed.rows};
  const query = (lead ? [row.stated_need,row.stated_objection,row.segment,row.notes,row.account_name,row.name] : [row.products,row.loss_reason,row.name]).filter(Boolean).join(' ').slice(0,320) || subject;
  const memory = await retrieveKnowledge(db,tenant,query,3,Boolean(lead && row.stated_need));
  result.ruleset = 'crm-v2';
  result.sources = memory.items.map(({document_id,revision,chunk_index,similarity})=>({document_id,revision,chunk_index,similarity}));
  if (lead && memory.offer && memory.offer.similarity >= 0.65) {
    const {document_id,revision,chunk_index,similarity,title}=memory.offer;
    result.offer={document_id,revision,chunk_index,similarity,title};
  }
  const {rows} = await db.query(`INSERT INTO vant.core_runs(tenant_id,actor_id,subject_kind,subject_id,model_version,latency_ms,result)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,result,model_version,latency_ms,created_at`,
    [tenant,member.id,subject,id,memory.model,memory.latencyMs,result]);
  await audit(db,tenant,member.id,'core.'+subject+'.analyzed',id,requestId);
  return [201,{...rows[0],context:memory.items}];
}
