export function createAutomationPage({api,node,button,panel,empty,modal,view,date}){
 const page='Automações';
 const events={lead_created:'Novo lead',lead_updated:'Lead atualizado',deal_created:'Nova oportunidade',deal_moved:'Mudança de etapa',deal_lost:'Oportunidade perdida',meeting_scheduled:'Reunião agendada',meeting_completed:'Reunião concluída',score_changed:'Score alterado',lead_qualified:'Lead qualificado',task_overdue:'Tarefa vencida',lead_inactive:'Lead sem interação'};
 const kinds={task:'Tarefa',reminder:'Lembrete',followup:'Follow-up'};
 function select(form,label,choices,value){
  const wrapper=node('label',label),control=node('select');
  control.setAttribute('aria-label',label);
  for(const [key,name] of choices)control.add(new Option(name,key));
  control.value=value;wrapper.append(control);form.append(wrapper);return control;
 }
 function input(form,label,type='text'){
  const wrapper=node('label',label),control=node('input');
  control.type=type;wrapper.append(control);form.append(wrapper);return control;
 }
 function stepEditor(form,label,initial=[]){
  const section=node('details'),items=node('div'),rows=[];
  section.append(node('summary',label),items);form.append(section);
  const addButton=button('Adicionar etapa',()=>add({}));
  function add(initial){
   const wrapper=node('fieldset');
   items.append(wrapper);
   const kind=select(wrapper,'Atividade da etapa',Object.entries(kinds),initial.kind??'task');
   const title=input(wrapper,'Título da etapa');title.value=initial.title??'';title.required=true;title.maxLength=240;
   const wait=input(wrapper,'Espera antes da etapa (minutos)','number');wait.min=0;wait.max=43200;wait.value=initial.wait_minutes??0;
   const due=input(wrapper,'Prazo da etapa (minutos)','number');due.min=0;due.max=43200;due.value=initial.due_minutes??'';
   kind.onchange=()=>{due.required=kind.value==='reminder';};kind.onchange();
   const row=()=>({kind:kind.value,title:title.value,wait_minutes:Number(wait.value),due_minutes:due.value===''?null:Number(due.value)});
   rows.push(row);addButton.disabled=rows.length>=7;
   wrapper.append(button('Remover etapa',()=>{rows.splice(rows.indexOf(row),1);wrapper.remove();addButton.disabled=false;}));
  }
  for(const item of initial)add(item);
  section.append(addButton);
  return {section,values:()=>rows.map(read=>read())};
 }
 async function editor(existing){
  const [members,pipelines]=await Promise.all([api('/crm/members'),api('/crm/pipelines')]);
  const form=node('form',undefined,'stack');
  const name=input(form,'Nome do fluxo');name.required=true;name.maxLength=120;name.value=existing?.name??'';
  const trigger=select(form,'Evento no CRM',Object.entries(events),existing?.trigger_event??'lead_created');
  const condition=input(form,'Origem no CRM (opcional)');condition.maxLength=250;condition.value=existing?.source_filter??'';
  const conditions=node('details');conditions.append(node('summary','Condições comerciais'));form.append(conditions);
  const filters=existing?.conditions??{},fields={};
  for(const [key,label,max] of [['segment','Segmento',250],['tag','Tag do lead',60]]){
   fields[key]=input(conditions,label);fields[key].maxLength=max;
  }
  for(const [key,label,max] of [['min_score','Score mínimo',100],['min_quiet_days','Dias mínimos sem contato',36500],['min_cents','Valor mínimo da oportunidade (R$)',9999999999.99]]){
   const control=input(conditions,label,'number');control.min=0;control.max=max;control.step=key==='min_cents'?'0.01':'1';fields[key]=control;
  }
  const any=[['','Sem condição']];
  fields.intent=select(conditions,'Intenção de compra',[...any,['unknown','Não informada'],['exploring','Pesquisando'],['evaluating','Em avaliação'],['requested_proposal','Solicitou proposta']],'');
  fields.owner_id=select(conditions,'Responsável',[...any,...members.items.map(m=>[m.id,m.name])],'');
  fields.stage_id=select(conditions,'Etapa do funil',[...any,...pipelines.items.flatMap(p=>p.stages.map(s=>[s.id,p.name+' · '+s.name]))],'');
  for(const [key,value] of Object.entries(filters)){
   const control=fields[key];
   if(control.tagName==='SELECT'&&![...control.options].some(o=>o.value===value))control.add(new Option(value,value));
   control.value=key==='min_cents'?(value/100).toFixed(2):value;
  }
  function selectedConditions(){
   return Object.fromEntries(Object.entries(fields).filter(([,el])=>el.value.trim()!=='').map(([key,el])=>[key,key==='min_cents'?Math.round(Number(el.value)*100):key.startsWith('min_')?Number(el.value):el.value.trim()]));
  }
  const delay=input(form,'Espera em minutos','number');delay.min=0;delay.max=43200;delay.required=true;delay.value=existing?.wait_minutes??0;
  const kind=select(form,'Ação principal',Object.entries(kinds),existing?.action_kind??'task');
  const title=input(form,'Título da atividade principal');title.required=true;title.maxLength=240;title.value=existing?.task_title??'';
  const alternate=select(form,'Se as condições não forem atendidas',[['','Encerrar fluxo'],...Object.entries(kinds)],existing?.else_kind??'');
  const alternateTitle=input(form,'Título da atividade alternativa');alternateTitle.maxLength=240;alternateTitle.value=existing?.else_title??'';
  const due=input(form,'Prazo após a execução (minutos)','number');due.min=0;due.max=43200;due.value=existing?.due_minutes??'';
  const mainSteps=stepEditor(form,'Etapas após a ação principal',existing?.steps?.match);
  const otherSteps=stepEditor(form,'Etapas após a ação alternativa',existing?.steps?.otherwise);
  function refresh(){
   alternate.disabled=!condition.value.trim()&&!Object.keys(selectedConditions()).length;if(alternate.disabled)alternate.value='';
   otherSteps.section.hidden=!alternate.value;
   for(const field of otherSteps.section.querySelectorAll('fieldset'))field.disabled=!alternate.value;
   alternateTitle.disabled=!alternate.value;alternateTitle.required=Boolean(alternate.value);
   due.required=[kind.value,alternate.value].includes('reminder');
  }
  conditions.addEventListener('input',refresh);conditions.addEventListener('change',refresh);condition.oninput=refresh;kind.onchange=refresh;alternate.onchange=refresh;refresh();
  const enabled=input(form,'Ativar fluxo','checkbox');enabled.checked=existing?.enabled??false;
  const save=node('button','Publicar versão','primary'),feedback=node('p');feedback.setAttribute('role','alert');form.append(save,feedback);
  form.onsubmit=async e=>{
   e.preventDefault();save.disabled=true;
   try{
    const data={steps:{match:mainSteps.values(),otherwise:alternate.value?otherSteps.values():[]},conditions:selectedConditions(),trigger_event:trigger.value,name:name.value,source_filter:condition.value.trim()||null,wait_minutes:Number(delay.value),task_title:title.value,action_kind:kind.value,else_kind:alternate.value||null,else_title:alternate.value?alternateTitle.value:null,due_minutes:due.value===''?null:Number(due.value),enabled:enabled.checked};
    if(existing)data.expected_version=existing.version;
    await api(existing?'/automations/'+existing.id:'/automations',existing?'PUT':'POST',data);
    document.getElementById('dialog').close();await view(page);
   }catch(error){feedback.textContent=error.message;}finally{save.disabled=false;}
  };
  modal(existing?'Editar fluxo':'Novo fluxo',form);
 }
 return async function render(){
  const [flows,runs]=await Promise.all([api('/automations'),api('/automations/runs')]);
  const names=new Map(flows.items.map(f=>[f.id,f.name]));
  const config=flows.items.map(f=>panel(f.name,node('p','Versão '+f.version+' · '+(f.enabled?'Ativo':'Pausado')),
    node('p',events[f.trigger_event]+' · '+(f.source_filter??'Todas as origens')+' · espera de '+f.wait_minutes+' min'),node('p',kinds[f.action_kind]+': '+f.task_title),...(f.else_kind?[node('p','Caminho alternativo · '+kinds[f.else_kind]+': '+f.else_title)]:[]),
    button('Editar fluxo',()=>editor(f))));
  const states={queued:'Na fila',done:'Concluído',running:'Em execução',failed:'Falhou'};
  const outcomes={created:'Tarefa criada',skipped:'Ignorado',retry:'Nova tentativa agendada',failed:'Falha final'};
  const history=runs.items.map(r=>{
   const details=node('details'),summary=node('summary',(names.get(r.payload.flow)??'Fluxo')+' · v'+r.payload.version+' · '+states[r.state]);
   details.append(summary,node('p',events[r.payload.event??'lead_created']),node('p',r.payload.source_activity?'Tarefa: '+r.payload.source_activity:r.payload.meeting?'Reunião: '+r.payload.meeting:r.payload.deal?'Oportunidade: '+r.payload.deal:'Lead: '+r.payload.lead),node('p','Disponível em '+date(r.available_at)));
   for(const attempt of r.history)details.append(node('p','Tentativa '+attempt.attempt+' · '+(attempt.outcome==='created'?({task:'Tarefa criada',reminder:'Lembrete criado',followup:'Follow-up criado'}[attempt.action_kind]??outcomes.created):outcomes[attempt.outcome])+' · etapa '+((attempt.step_index??0)+1)+(attempt.branch==='otherwise'?' · caminho alternativo':'')+(attempt.activity_id?' · atividade '+attempt.activity_id:'')));
   return details;
  });
  return [button('Criar fluxo',()=>editor()),...(config.length?config:[empty('Nenhum fluxo publicado.')]),panel('Execuções recentes',...(history.length?history:[empty('Nenhuma execução registrada.')]))];
 };
}
