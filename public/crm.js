import {createGoalsPage} from './revenue-goals.js';
import {createForecastPage} from './revenue-forecast.js';
import {createRevenuePage} from './revenue.js';
import {createProspectingPage} from './prospecting.js';
import {createAutomationPage} from './automations.js';
import {createSupervisionPage} from './supervision.js';
import {createCopilotPage} from './copilot.js';
import {createMemoryPage} from './memory.js';
import {createInbox} from './inbox.js';
import {entities,labels,options,related} from './crm-schema.js';
export function createCrm({api,node,button,pair,panel,empty,modal,money,date,view,getUser}){
 const goalsPage=createGoalsPage({api,node,panel,pair,money,getUser});
 const forecastPage=createForecastPage({api,node,panel,pair,empty,money});
 const revenuePage=createRevenuePage({api,node,panel,pair,empty,money,getUser});
 const prospectingPage=createProspectingPage({api,node,button,panel,empty,modal,date,view,getUser,openAccount:async id=>detail('accounts',await api('/crm/accounts/'+id)),openLead:async id=>detail('leads',await api('/crm/leads/'+id)),createContact:id=>edit('contacts',{account_id:id})});
 const copilotPage=createCopilotPage({api,node,button,panel,empty,date});
 const automationPage=createAutomationPage({api,node,button,panel,empty,modal,view,date});
 const supervisionPage=createSupervisionPage({api,node,panel,empty,getUser,view});
 const memoryPage=createMemoryPage({api,node,button,panel,empty,modal,view,getUser});
 const inbox=createInbox({api,node,button,pair,panel,empty,modal,date,view,getUser});
 const groups={Inteligência:['Receita comercial','Previsão de receita','Metas comerciais','Memória comercial','Copiloto comercial'],Comercial:['Prospecção','Leads','Empresas','Contatos','Oportunidades','Funil de vendas'],Relacionamento:['Caixa de entrada','WhatsApp','Conversas'],Operação:['Agenda comercial']};
 let active='',criteria={},cursor='',previous=[];
 const path=(kind,id)=>'/crm/'+kind+(id?'/'+id:'');
 const manager=()=>['owner','manager'].includes(getUser().role);
 const canWrite=row=>getUser().role!=='viewer'&&(manager()||!row?.owner_id||row.owner_id===getUser().id);
 async function all(url){const items=[];let c='';do{const r=await api(url+(url.includes('?')?'&':'?')+'limit=100'+(c?'&cursor='+c:''));items.push(...r.items);c=r.nextCursor;}while(c);return items;}
 const choices=k=>all(k==='teams'?'/teams':path(k));
 const select=(items,v,blank=true)=>{const n=node('select');if(blank)n.add(new Option('Selecione',''));for(const [id,name] of items)n.add(new Option(name,id));if(v!=null)n.value=v;return n;};
 function field(f,label,n){const l=node('label',label);l.append(n);f.append(l);return n;}
 function submit(f,action){const b=node('button','Salvar','primary'),note=node('p');note.setAttribute('role','alert');f.append(b,note);f.onsubmit=async e=>{e.preventDefault();b.disabled=true;try{await action();document.getElementById('dialog').close();await view(active);}catch(err){note.textContent=err.message;}finally{b.disabled=false;}};}
 async function edit(kind,row={}){
  const keys=entities[kind].fields.split(' '),controls={},lists={};
  await Promise.all([...new Set(keys.map(k=>related[k]).filter(Boolean))].map(async k=>{lists[k]=await choices(k);}));
  const f=node('form',undefined,'stack');
  for(const k of keys){
   let c;
   if(related[k])c=select(lists[related[k]].map(r=>[r.id,r.name??r.title]),row[k]??(k==='owner_id'?getUser().id:null));
   else if(k==='stage_id')c=node('select');
   else if(options[k])c=select(Object.entries(options[k]),row[k],false);
   else if(k==='decision_maker'){c=node('input');c.type='checkbox';c.checked=!!row[k];}
   else if(['notes','products','loss_reason'].includes(k)){c=node('textarea');c.value=row[k]??'';}
   else{c=node('input');c.type=({email:'email',website:'url',close_on:'date',due_at:'datetime-local',done_at:'datetime-local',amount_cents:'number',probability:'number'})[k]??'text';
    if(c.type==='number'){c.min='0';c.step=k==='amount_cents'?'0.01':'1';if(k==='probability')c.max='100';}
    let v=row[k]??'';if(k==='amount_cents'&&v!=='')v=Number(v)/100;if(k==='tags')v=(row.tags??[]).join(', ');
    if(c.type==='datetime-local'&&v){const d=new Date(v);v=new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
    c.value=v;
   }
   c.required=k==='name'||(k==='title'&&kind==='activities')||['pipeline_id','stage_id','amount_cents','probability','owner_id'].includes(k);
   controls[k]=field(f,labels[k],c);
  }
  if(kind==='deals'){function stages(id){const s=lists.pipelines.find(p=>p.id===controls.pipeline_id.value)?.stages??[];controls.stage_id.replaceChildren(new Option('Selecione',''),...s.map(r=>new Option(r.name,r.id)));if(id)controls.stage_id.value=id;}
   controls.pipeline_id.onchange=()=>stages();stages(row.stage_id);if(!lists.pipelines.length)f.prepend(empty('Crie um funil antes de cadastrar oportunidades.'));}
  submit(f,async()=>{const data={};for(const [k,c] of Object.entries(controls)){let v=c.type==='checkbox'?c.checked:c.value;
   if(!row.id&&v==='')continue;if(k==='tags')v=v.split(',').map(t=>t.trim()).filter(Boolean);if(c.type==='number')v=k==='amount_cents'?Math.round(Number(v)*100):Number(v);
   if(c.type==='datetime-local'&&v)v=new Date(v).toISOString();data[k]=v;
  }await api(path(kind,row.id),row.id?'PATCH':'POST',data);});
  modal(row.id?'Editar registro':'Cadastrar registro',f);
 }
 function csv(){const f=node('form',undefined,'stack');f.append(empty('Até 500 linhas. Colunas: nome, email, telefone, origem, segmento, tags e observações. Apenas nome é obrigatória.'));
  const c=field(f,'Arquivo CSV',node('input'));c.type='file';c.accept='.csv';c.required=true;submit(f,async()=>api(path('leads','import'),'POST',{csv:await c.files[0].text()}));modal('Importar leads',f);}
 function sdrForm(run){
  const form=node('form',undefined,'stack'),controls={};
  for(const item of run.result.sdrQuestions){
   const choices=options[item.field];
   const input=choices ? select(Object.entries(choices).filter(([key])=>key!=='unknown'),null) : node('textarea');
   if(!choices)input.maxLength=250;
   controls[item.field]=field(form,item.question,input);
  }
  const save=node('button','Salvar respostas','primary'),feedback=node('p');
  feedback.setAttribute('role','alert');form.append(save,feedback);
  form.onsubmit=async event=>{
   event.preventDefault();save.disabled=true;
   try{
    const answers=Object.fromEntries(Object.entries(controls).map(([key,input])=>[key,input.value.trim()]).filter(([,value])=>value));
    const updated=await api('/agents/sdr/'+run.id+'/answers','POST',{answers});
    modal('Respostas registradas',button('Atualizar análise',async()=>showAnalysis(await api('/core/leads/'+updated.lead_id+'/analyses','POST',{}))));
   }catch(error){feedback.textContent=error.message;}finally{save.disabled=false;}
  };
  modal('Roteiro de qualificação SDR',form);
 }
 async function showAnalysis(run){
  const result=run.result,parts=[pair('Classificação',result.classification)];
  if(result.score!=null)parts.push(pair('Pontuação de qualificação',result.score+' / 100'));
  if(result.probability!=null)parts.push(pair('Probabilidade registrada no CRM',result.probability+'%'));
  if(result.qualification){
   const q=result.qualification;
   for(const [label,value] of [['Necessidade declarada',q.need],['Cargo do contato',q.role],['Intenção de compra',q.interest],['Orçamento',q.budget],['Prazo de compra',q.timing],['Objeção registrada',q.objection]]){
    if(value)parts.push(pair(label,value));
   }
  }
  if(result.activities){
   for(const [title,activities] of [['Atividades pendentes na análise',result.activities.pending],['Últimas atividades concluídas',result.activities.completed]]){
    if(activities.length)parts.push(panel(title,...activities.map(task=>pair(task.title,task.owner_name+' · '+date(task.done_at??task.due_at)))));
   }
  }
  if(result.followup)parts.push(panel('Preparação do follow-up',pair('Dias sem contato',result.followup.days),node('p',result.followup.reason),pair('Texto para revisão',result.followup.draft)));
  if(result.recovery){
   const recovery=result.recovery,items=[pair('Dias desde atualização ou contato',recovery.daysSinceTouch)];
   if(recovery.reason)items.push(pair('Motivo',recovery.reason));
   items.push(...recovery.questions.map(question=>node('p',question)));
   parts.push(panel('Preparar recuperação',...items));
  }
  if(result.offer)parts.push(pair('Oferta para revisão',result.offer.title+' · revisão '+result.offer.revision));
  for(const item of result.evidence)parts.push(node('p',item.detail+(item.points?' (+'+item.points+')':'')));
  parts.push(pair('Próxima ação',result.nextAction));
  for(const source of run.context??[])parts.push(panel(source.title,node('p',source.content)));
  parts.push(pair('Inferência local',run.latency_ms+' ms'),pair('Regra',result.ruleset));
  const endpoint='/agents/proposals/'+run.id;
  const {proposal,canDecide}=await api(endpoint);
  if(result.sdrQuestions?.length){
   parts.push(panel('Perguntas de qualificação',...result.sdrQuestions.map(item=>node('p',item.question))));
   if(canDecide)parts.push(button('Registrar respostas do SDR',()=>sdrForm(run)));
  }
  if(proposal)parts.push(pair('Proposta de tarefa',{pending:'Aguardando decisão',approved:'Aprovada',cancelled:'Cancelada'}[proposal.status]));
  if(canDecide && !proposal)parts.push(button('Preparar tarefa sugerida',async()=>{
    await api(endpoint,'POST',{});await showAnalysis(run);
  }));
  if(canDecide && proposal?.status==='pending'){
   parts.push(button('Aprovar e criar tarefa',async()=>{await api(endpoint+'/approve','POST',{});await showAnalysis(run);}));
   parts.push(button('Cancelar proposta',async()=>{await api(endpoint+'/cancel','POST',{});await showAnalysis(run);}));
  }
  modal('Análise comercial',...parts);
 }
 async function minutes(row) {
  const path='/agents/meetings/'+row.id+'/minutes';
  const {items}=await api(path);
  const parts=items.map((item,index)=>{
   const record=node('details');
   record.open=index===0;
   record.append(node('summary','Revisão '+item.revision+' · '+date(item.created_at)),...item.excerpts.map(line=>node('p',line.text)),node('h3','Notas originais'),node('p',item.notes));
   return record;
  });
  if(!parts.length)parts.push(empty('Nenhum resultado registrado.'));
  if(canWrite(row))parts.push(button('Registrar notas',()=>{
   const form=node('form',undefined,'stack'),input=field(form,'Notas da reunião',node('textarea')),feedback=node('p'),save=node('button','Salvar resultado','primary');
   input.required=true;input.maxLength=4000;input.rows=8;input.value=items[0]?.notes??'';
   feedback.setAttribute('role','alert');form.append(save,feedback);
   form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await api(path,'POST',{notes:input.value,expectedRevision:items[0]?.revision??0});await minutes(row);}catch(error){feedback.textContent=error.message;}finally{save.disabled=false;}};
   modal('Registrar notas da reunião',form);
  }));
  modal('Resultado da reunião',...parts);
 }
 function showBrief(brief){
  const data=brief.result,parts=[pair('Reunião',data.meeting.title),pair('Data prevista',date(data.meeting.due_at))];
  if(data.lead)parts.push(pair('Lead',data.lead.name));
  if(data.lead?.stated_need)parts.push(pair('Necessidade declarada',data.lead.stated_need));
  if(data.lead?.stated_objection)parts.push(pair('Objeção registrada',data.lead.stated_objection));
  if(data.deal)parts.push(pair('Oportunidade',data.deal.name),pair('Valor',money(data.deal.amount_cents)));
  if(data.history.length)parts.push(panel('Interações registradas',...data.history.map(item=>pair(item.title,date(item.done_at)))));
  parts.push(panel('Perguntas para a reunião',...data.questions.map(question=>node('p',question))));
  if(data.sources.length)parts.push(panel('Referências comerciais',...data.sources.map(source=>pair(source.title,'Revisão '+source.revision))));
  modal('Preparação da reunião',...parts);
 }
 async function detail(kind,row){
  const parts=[],keys=entities[kind].fields.split(' ');
  for(const key of keys){let v=row[key];if(v==null||v===''||Array.isArray(v)&&!v.length)continue;
   if(related[key])v=(await choices(related[key])).find(r=>r.id===v)?.name??'—';
   else if(key==='stage_id')v=(await choices('pipelines')).flatMap(p=>p.stages).find(s=>s.id===v)?.name;
   else if(key==='amount_cents')v=money(v);else if(options[key])v=options[key][v];else if(typeof v==='boolean')v=v?'Sim':'Não';else if(Array.isArray(v))v=v.join(', ');
   parts.push(pair(labels[key],v));
  }
  if(canWrite(row))parts.unshift(button('Editar',()=>edit(kind,row)));
  if(kind==='leads'||kind==='deals'){
   const analyses='/core/'+kind+'/'+row.id+'/analyses';
   parts.push(button('Histórico de análises',async()=>{
    const history=await api(analyses);
    modal('Histórico de análises',...(history.items.length?history.items.map(run=>button(date(run.created_at)+' · '+run.result.classification,()=>showAnalysis(run))):[empty('Nenhuma análise registrada.')]));
   }));
   if(canWrite(row))parts.push(button('Analisar no Intelligence Core',async()=>showAnalysis(await api(analyses,'POST',{}))));
  }
  if(kind==='conversations'&&canWrite(row))parts.push(button(row.lead_id?'Abrir lead':'Criar lead da conversa',async()=>detail('leads',await api(path(kind,row.id)+'/lead','POST',{}))));
  if(kind==='activities'&&row.kind==='meeting'&&(getUser().role!=='seller'||row.owner_id===getUser().id)){
   const briefs='/agents/meetings/'+row.id+'/briefs';
   if(row.done_at)parts.push(button('Resultado da reunião',()=>minutes(row)));
   parts.push(button('Histórico de preparação',async()=>{
    const versions=(await api(briefs)).items;
    modal('Histórico de preparação',...(versions.length?versions.map(b=>button(date(b.created_at),()=>showBrief(b))):[empty('Nenhuma preparação registrada.')]));
   }));
   if(canWrite(row))parts.push(button('Preparar reunião',async()=>showBrief(await api(briefs,'POST',{}))));
  }
  if(kind==='activities'&&!row.done_at&&canWrite(row))parts.push(button('Concluir atividade',async()=>detail(kind,await api(path(kind,row.id),'PATCH',{done_at:new Date().toISOString()}))));
  if(kind==='leads'){
   const url=path(kind,row.id)+'/files',files=await api(url);parts.push(node('h3','Anexos'));
   for(const file of files.items)parts.push(button(file.filename,async()=>{const item=await api(url+'/'+file.id);const link=document.createElement('a');link.download=item.filename;link.href=URL.createObjectURL(new Blob([Uint8Array.from(atob(item.base64),c=>c.charCodeAt(0))]));link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}));
   if(canWrite(row)){const file=node('input'),note=node('p');file.type='file';file.setAttribute('aria-label','Anexar documento');file.onchange=async()=>{try{const data=file.files[0];if(!data)return;if(data.size>2097152)throw Error('Limite de 2 MB.');
    const base64=await new Promise((ok,fail)=>{const r=new FileReader();r.onload=()=>ok(r.result.split(',')[1]);r.onerror=fail;r.readAsDataURL(data);});await api(url,'POST',{filename:data.name,base64});await detail(kind,row);}catch(e){note.textContent=e.message;}};parts.push(file,note);}
   if(manager())parts.push(button('Excluir lead',()=>{const f=node('form',undefined,'stack');f.append(empty('A exclusão remove os anexos. Leads com atividades, conversas ou oportunidades vinculadas são preservados.'));submit(f,()=>api(path(kind,row.id),'DELETE'));modal('Confirmar exclusão',f);}));
  }
  if(kind==='accounts'||kind==='contacts'){
   for(const k of kind==='accounts'?['contacts','deals']:['deals']){const links=await all(path(k)+'?'+(kind==='accounts'?'account_id':'contact_id')+'='+row.id);if(links.length)parts.push(node('h3',entities[k].label),...links.map(r=>button(r.name,()=>detail(k,r))));}
  }
  const hist=await all(path(kind,row.id)+'/history');parts.push(node('h3','Histórico'));
  for(const h of hist){const details=node('details'),sum=node('summary',date(h.created_at)+' · '+h.actor+' · '+({created:'Cadastro',updated:'Alteração',linked:'Vínculo',attached:'Anexo',activity_recorded:'Comentário do fluxo'}[h.action]??h.action));details.append(sum);for(const [k,v] of Object.entries(h.changes))details.append(pair((h.action==='activity_recorded'?{title:'Comentário',activity_id:'Atividade',flow_id:'Fluxo',job_id:'Execução',step:'Etapa'}[k]:null)??labels[k]??k,typeof v==='object'&&v!==null&&'to'in v?String(v.from??'—')+' → '+String(v.to??'—'):String(v)));parts.push(details);}
  modal(row.name??row.title,...parts);
 }
 function pipeline(p={}){
  const f=node('form',undefined,'stack'),name=field(f,'Nome do funil',node('input')),stages=node('div');f.append(stages);name.value=p.name??'';name.required=true;
  function add(s={}){const div=node('div',undefined,'row'),input=node('input');input.required=true;input.setAttribute('aria-label','Nome da etapa');input.value=s.name??'';input.dataset.id=s.id??'';
   div.append(input,button('Subir',()=>{if(div.previousElementSibling)stages.insertBefore(div,div.previousElementSibling);}),button('Descer',()=>{if(div.nextElementSibling)stages.insertBefore(div.nextElementSibling,div);}));if(!s.id)div.append(button('Remover',()=>div.remove()));stages.append(div);}
  (p.stages??[{}]).forEach(add);f.append(button('Adicionar etapa',()=>add()));
  submit(f,()=>api(path('pipelines',p.id),p.id?'PATCH':'POST',{name:name.value,stages:[...stages.querySelectorAll('input')].map(n=>({name:n.value,id:n.dataset.id||null}))}));modal(p.id?'Editar funil':'Criar funil',f);
 }
 async function board(){
  const pipes=await choices('pipelines'),bar=node('div',undefined,'toolbar'),board=node('div',undefined,'board');if(manager())bar.append(button('Criar funil',()=>pipeline()));
  if(!pipes.length)return [bar,empty('Cadastre o primeiro funil.')];
  const p=pipes.find(x=>x.id===criteria.pipeline_id)??pipes[0],sel=select(pipes.map(v=>[v.id,v.name]),p.id,false);sel.setAttribute('aria-label','Funil');sel.onchange=()=>{criteria.pipeline_id=sel.value;view(active);};bar.append(sel);
  if(manager())bar.append(button('Editar funil',()=>pipeline(p)));if(canWrite())bar.append(button('Cadastrar oportunidade',()=>edit('deals',{pipeline_id:p.id})));
  const deals=await all(path('deals')+'?pipeline_id='+p.id);
  for(const s of p.stages){const lane=node('section',undefined,'panel lane');lane.append(node('h2',s.name));for(const d of deals.filter(v=>v.stage_id===s.id)){const card=node('article');card.append(button(d.name,()=>detail('deals',d)),pair('Valor',money(d.amount_cents)));if(canWrite(d)){
    const stage=select(p.stages.map(v=>[v.id,v.name]),s.id,false);stage.setAttribute('aria-label','Mover '+d.name);stage.onchange=async()=>{try{await api(path('deals',d.id),'PATCH',{stage_id:stage.value});if(active==='Funil de vendas')await view(active);}catch(e){stage.value=s.id;modal('Movimentação',empty(e.message));}};card.append(stage);}lane.append(card);}board.append(lane);}return [bar,board];
 }
 async function integrationsPage(){
  const result=await api('/integrations');
  const timestamp=value=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium',timeZone:'America/Sao_Paulo'}).format(new Date(value));
  const csv=panel('Importação CSV',pair('Acesso','Cadastro de leads ou prospecção'));
  if(!result.csv.imports.length)csv.append(empty('Sem importação registrada.'));
  for(const entry of result.csv.imports)csv.append(pair(timestamp(entry.created_at),entry.source==='crm'?'Leads do CRM':'Contas de prospecção'));
  csv.append(button('Abrir leads',()=>view('Leads')),button('Abrir prospecção',()=>view('Prospecção')));
  const hook=panel('Webhook de saída',pair('Configuração','Destino HTTPS e chave no worker'),
   pair('Última entrega confirmada',result.webhook.last_delivery?timestamp(result.webhook.last_delivery):'Sem entrega confirmada'));
  const outcomes={delivered:'Entregue',retry:'Nova tentativa prevista',failed:'Falhou',skipped:'Sem envio'};
  const reasons={webhook_config:'Configuração indisponível',webhook_network:'Falha de conexão',
   webhook_destination_changed:'Destino alterado',webhook_http:'Resposta HTTP',author_unavailable:'Autor indisponível',action_failed:'Falha na ação'};
  if(!result.webhook.attempts.length)hook.append(empty('Sem tentativa registrada.'));
  for(const entry of result.webhook.attempts){
   const details=[outcomes[entry.outcome]??entry.outcome,reasons[entry.reason],entry.http_status==null?null:'HTTP '+entry.http_status];
   hook.append(pair(timestamp(entry.created_at),details.filter(Boolean).join(' · ')));
  }
  hook.append(button('Abrir automações',()=>view('Automações')));
  return [csv,hook];
 }
 async function subscriptionPage(){
  const path='/billing/subscription-requests';
  const {latest}=await api(path);
  const {items}=await api('/billing/plans');
  const name=code=>items.find(plan=>plan.code===code)?.name??code;
  const card=latest?panel('Última solicitação',pair('Plano solicitado',name(latest.plan_code)),
   pair('Mensalidade de referência',latest.monthly_cents===null?'Sob consulta':money(latest.monthly_cents)),
   pair('Situação',latest.cancelled_at?'Cancelada':'Pendente'),pair('Solicitada em',date(latest.created_at))):
   empty('Nenhuma solicitação de assinatura registrada.');
  if(getUser().role!=='owner')return [card];
  const form=node('form',undefined,'stack'),note=node('p');
  note.setAttribute('role','status');
  const pending=latest&&!latest.cancelled_at;
  let plan;
  if(!pending){
   plan=select(items.map(item=>[item.code,item.name]));plan.required=true;
   field(form,'Plano solicitado',plan);
  }
  const submit=node('button',pending?'Cancelar solicitação':'Solicitar assinatura');
  form.append(node('p','A solicitação registra o interesse comercial. A cobrança depende da contratação no gateway.'),submit,note);
  const id=crypto.randomUUID();
  form.onsubmit=async event=>{
   event.preventDefault();submit.disabled=true;
   try{
    if(pending)await api(path+'/'+latest.id,'DELETE');
    else await api(path,'POST',{id,plan_code:plan.value});
    if(active==='Solicitação de assinatura')await view(active);
   }catch(error){note.textContent=error.message;}
   finally{submit.disabled=false;}
  };
  return [card,form];
 }
 async function planHistory(){
  const container=node('div');
  async function render(cursor,previous){
   const result=await api('/billing/plan-history?limit=10'+(cursor?'&before='+cursor:''));
   const cards=result.items.map(row=>{
    const format=value=>value==null?'Sem teto contratual':BigInt(value).toLocaleString('pt-BR');
    const when=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(row.assigned_at));
    return panel(row.name+' · Revisão '+row.revision,pair('Registrado em Brasília',when),
     pair('Usuários',format(row.user_limit)),pair('Leads ativos',format(row.active_lead_limit)),
     pair('Pipelines',format(row.pipeline_limit)),pair('Armazenamento em bytes',format(row.storage_limit_bytes)),
     pair('Ações de agentes por dia',format(row.agent_actions_per_day)),pair('Automações ativas',format(row.active_flow_limit)),
     pair('Execuções por dia',format(row.flow_starts_per_day)),pair('Textos para inferência por dia',format(row.inference_texts_per_day)));
   });
   const bar=node('div',undefined,'toolbar');
   function navigate(label,next,trail){
    bar.append(button(label,async()=>{
     for(const control of bar.querySelectorAll('button'))control.disabled=true;
     try{await render(next,trail);}
     catch(error){modal('Histórico de planos',empty(error.message));}
     finally{for(const control of bar.querySelectorAll('button'))control.disabled=false;}
    }));
   }
   if(previous.length)navigate('Mais recentes',previous.at(-1),previous.slice(0,-1));
   if(result.nextCursor!==null)navigate('Mais antigas',result.nextCursor,[...previous,cursor]);
   container.replaceChildren(...(cards.length?cards:[empty('Nenhum plano vinculado à empresa.')]),bar);
  }
  await render(null,[]);
  return [container];
 }
 async function page(name){
  if(name==='Central de integrações'){active=name;return integrationsPage();}
  if(name==='Solicitação de assinatura'){active=name;return subscriptionPage();}
  if(name==='Histórico de planos'){active=name;return planHistory();}
  if(name==='Planos comerciais'){
   active=name;
   const [catalog,usage]=await Promise.all([api('/billing/plans'),api('/billing/usage')]);
   const number=value=>value===null?'Sob consulta':value.toLocaleString('pt-BR');
   const assigned=usage.assignment;
   const display=(used,limit)=>assigned?number(used)+' de '+number(limit):number(used);
   const current=panel('Consumo da empresa',pair('Plano vinculado',assigned?catalog.items.find(p=>p.code===assigned.plan_code).name:'Sem vínculo'),
    pair('Usuários ativos',display(usage.users,assigned?.user_limit)),pair('Leads cadastrados',display(usage.leads,assigned?.active_lead_limit)),
    pair('Pipelines cadastrados',display(usage.pipelines,assigned?.pipeline_limit)));
   const actions=usage.agent_actions;
   current.append(pair('Ações de agentes hoje',number(actions.used_today)+' de '+number(actions.effective_limit)));
   const flowLimit=assigned?.active_flow_limit;
   current.append(pair('Automações ativas',flowLimit==null?number(usage.active_flows):display(usage.active_flows,flowLimit)));
   const runs=usage.flow_executions;
   const count=value=>BigInt(value).toLocaleString('pt-BR');
   const inferred=usage.inference_texts, dailyTexts=assigned?.inference_texts_per_day;
   const occupied=BigInt(inferred.completed)+BigInt(inferred.reserved);
   const inference=panel('Inferências de hoje',pair('Textos processados',count(inferred.completed)),
    pair('Textos aguardando confirmação',count(inferred.reserved)),pair('Textos sem vetor por falha',count(inferred.failed)),
    pair('Franquia ocupada',dailyTexts==null?count(occupied):count(occupied)+' de '+number(dailyTexts)));
   const executions=panel('Execução de automações hoje',pair('Execuções iniciadas',count(runs.started)),
    pair('Tentativas de ação',count(runs.attempts)),pair('Tentativas que exigiram repetição',count(runs.retries)),
    pair('Avaliações sem ação',count(runs.skipped)));
   const admitted=BigInt(usage.flow_admissions),dailyFlows=assigned?.flow_starts_per_day;
   current.append(pair('Vagas de execução usadas hoje',dailyFlows==null?count(admitted):count(admitted)+' de '+number(dailyFlows)));
   const usedBytes=BigInt(usage.storage_bytes);
   const limitBytes=assigned?.storage_limit_bytes==null?null:BigInt(assigned.storage_limit_bytes);
   const bytes=value=>value.toLocaleString('pt-BR')+' bytes';
   current.append(pair('Conteúdo armazenado',limitBytes===null?bytes(usedBytes):bytes(usedBytes)+' de '+bytes(limitBytes)));
   for(const [label,used,limit] of [
    ['Usuários ativos',usage.users,assigned?.user_limit],['Leads cadastrados',usage.leads,assigned?.active_lead_limit],
    ['Pipelines cadastrados',usage.pipelines,assigned?.pipeline_limit],['Armazenamento',usedBytes,limitBytes],
    ['Ações de agentes hoje',actions.used_today,actions.effective_limit],['Automações ativas',usage.active_flows,flowLimit],['Vagas de execução',admitted,dailyFlows],['Textos para inferência',occupied,dailyTexts]
   ]){
    if(limit!=null&&used>=limit)current.append(pair(label+' · alerta',used>limit?'Franquia excedida':'Limite atingido'));
   }
   return [current,executions,inference,...catalog.items.map(plan=>panel(plan.name,
    pair('Mensalidade',plan.custom_terms?'Sob consulta':money(plan.monthly_cents)+' / mês'),
    pair('Usuários',number(plan.user_limit)),pair('Leads ativos',number(plan.active_lead_limit)),
    pair('Pipelines',number(plan.pipeline_limit)),pair('Conexões WhatsApp previstas',number(plan.whatsapp_connection_limit)),
    pair('Recursos previstos no plano',plan.features.join(' · '))))];
  }
  if(name==='Metas comerciais'){active=name;return goalsPage();}
  if(name==='Previsão de receita'){active=name;return forecastPage();}
  if(name==='Receita comercial'){active=name;return revenuePage();}
  if(name==='Prospecção'){active=name;return prospectingPage();}
  if(name==='Automações'){active=name;return automationPage();}
  if(name==='Supervisão de agentes'){active=name;return supervisionPage();}
  if(name==='Copiloto comercial'){active=name;return copilotPage();}
  if(name==='Memória comercial'){active=name;return memoryPage();}
  if(active!==name){active=name;criteria={};cursor='';previous=[];}if(name==='Funil de vendas')return board();if(['Caixa de entrada','WhatsApp'].includes(name))return inbox.page(name);
  const kind=Object.keys(entities).find(k=>entities[k].label===name),bar=node('div',undefined,'toolbar');
  if(canWrite())bar.append(button('Cadastrar registro',()=>edit(kind)));if(kind==='leads'&&canWrite())bar.append(button('Importar CSV',csv));
  const filter=node('form',undefined,'toolbar');for(const key of kind==='leads'?['q','source','segment','tag','owner_id','team_id']:['q']){
   const c=related[key]?select((await choices(related[key])).map(v=>[v.id,v.name]),criteria[key]):node('input'),label=labels[key]??(key==='tag'?'Tag':'Pesquisar');
   c.name=key;if(c.tagName==='INPUT'){c.placeholder=label;c.value=criteria[key]??'';}else c.options[0].text=label;c.setAttribute('aria-label',label);filter.append(c);}
  filter.append(node('button','Filtrar'));filter.onsubmit=e=>{e.preventDefault();criteria=Object.fromEntries([...new FormData(filter)].filter(([,v])=>v));cursor='';previous=[];view(active);};
  const query=new URLSearchParams({...criteria,limit:25});if(cursor)query.set('cursor',cursor);const result=await api(path(kind)+'?'+query),wrap=node('div',undefined,'tablewrap'),table=node('table');
  const headers=kind==='deals'?['Oportunidade','Valor','Probabilidade','Situação']:['Registro','Detalhes'];const h=node('tr'),head=node('thead'),body=node('tbody');for(const title of headers){const th=node('th',title);th.scope='col';h.append(th);}head.append(h);table.append(head,body);
  for(const row of result.items){const tr=node('tr'),td=node('td');td.append(button(row.name??row.title,()=>detail(kind,row)));tr.append(td);for(const val of kind==='deals'?[money(row.amount_cents),row.probability+'%',options.status[row.status]]:[row.email??row.phone??row.segment??(row.due_at?date(row.due_at):'—')])tr.append(node('td',val));body.append(tr);}
  wrap.append(result.items.length?table:empty('Nenhum registro nos filtros atuais.'));const pager=node('div',undefined,'toolbar');
  if(previous.length)pager.append(button('Página anterior',()=>{cursor=previous.pop();return view(active);}));if(result.nextCursor)pager.append(button('Próxima página',()=>{previous.push(cursor);cursor=result.nextCursor;return view(active);}));
  return [bar,filter,wrap,pager];
 }
 return {get groups(){return manager()?{...groups,Financeiro:['Planos comerciais','Histórico de planos','Solicitação de assinatura'],Operação:[...groups.Operação,'Automações','Central de integrações'],Inteligência:[...groups.Inteligência,'Supervisão de agentes']}:groups;},page};
}
