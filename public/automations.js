export function createAutomationPage({api,node,button,panel,empty,modal,view,date}){
 const page='Automações';
 const events={lead_created:'Novo lead',lead_updated:'Lead atualizado',deal_created:'Nova oportunidade',deal_moved:'Mudança de etapa',deal_lost:'Oportunidade perdida',meeting_scheduled:'Reunião agendada',meeting_completed:'Reunião concluída',score_changed:'Score alterado',lead_qualified:'Lead qualificado',task_overdue:'Tarefa vencida',lead_inactive:'Lead sem interação'};
 const kinds={task:'Tarefa',reminder:'Lembrete',followup:'Follow-up',assign_owner:'Atribuir responsável',notify_owner:'Notificar responsável',comment:'Registrar comentário no CRM',update_record:'Atualizar registro do CRM',summarize:'Gerar resumo comercial',run_agent:'Analisar e propor tarefa',webhook:'Enviar webhook'};
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
 function ownerPicker(form,label,choices,initial){
  const field=select(form,label,[['','Selecione uma pessoa'],...choices],initial??'');
  return {field,show(visible){field.parentElement.hidden=!visible;field.disabled=!visible;field.required=visible;}};
 }
 function changeEditor(form,label,kind,trigger,initial={}){
  const group=node('fieldset');group.append(node('legend',label));form.append(group);
  const segment=input(group,'Definir segmento'),tag=input(group,'Adicionar tag'),probability=input(group,'Definir probabilidade (%)','number');
  segment.maxLength=250;tag.maxLength=60;probability.min=0;probability.max=100;probability.step=1;
  segment.value=initial?.segment??'';tag.value=initial?.add_tag??'';probability.value=initial?.probability??'';
  const guarded=[...kind.options].filter(o=>['assign_owner','update_record'].includes(o.value));
  function refresh(){
   const supported=['lead_created','score_changed','lead_qualified','deal_created','deal_moved','deal_lost'].includes(trigger.value);
   for(const option of guarded)option.disabled=!supported;
   const agentOption=[...kind.options].find(option=>option.value==='run_agent');
   agentOption.disabled=!['lead_created','lead_updated','deal_created','deal_moved','deal_lost'].includes(trigger.value);
   kind.setCustomValidity([agentOption,...guarded].some(o=>o.selected&&o.disabled)?'Escolha uma ação disponível para este evento.':'');
   const updating=kind.value==='update_record',deal=trigger.value.startsWith('deal_');
   group.hidden=!updating;
   for(const field of [segment,tag,probability]){
    field.disabled=!updating||(field===probability?!deal:deal);
    field.parentElement.hidden=field.disabled;
   }
   probability.required=updating&&deal;
   segment.setCustomValidity(updating&&!deal&&!tag.value.trim()&&!segment.value.trim()?'Informe um segmento ou uma tag.':'');
  }
  group.addEventListener('input',refresh);kind.addEventListener('change',refresh);trigger.addEventListener('change',refresh);refresh();
  return ()=>{
   if(kind.value!=='update_record')return null;
   if(trigger.value.startsWith('deal_'))return {probability:Number(probability.value)};
   return {...(segment.value.trim()?{segment:segment.value.trim()}:{}),...(tag.value.trim()?{add_tag:tag.value.trim()}:{})};
  };
 }
 function stepEditor(form,label,initial=[],choices,trigger){
  const section=node('details'),items=node('div'),rows=[];
  section.append(node('summary',label),items);form.append(section);
  const addButton=button('Adicionar etapa',()=>add({}));
  function sync(){
   rows.forEach((item,index)=>{item.up.disabled=index===0;item.down.disabled=index===rows.length-1;});
   addButton.disabled=rows.length>=7;
   form.dispatchEvent(new Event('input'));
  }
  function move(item,offset){
   const index=rows.indexOf(item),next=index+offset,neighbor=rows[next];
   if(!neighbor)return;
   rows.splice(index,1);rows.splice(next,0,item);
   if(offset<0)items.insertBefore(item.wrapper,neighbor.wrapper);else items.insertBefore(neighbor.wrapper,item.wrapper);
   sync();(offset<0?item.down:item.up).focus();
  }
  function add(initial){
   const wrapper=node('fieldset');
   items.append(wrapper);
   const kind=select(wrapper,'Atividade da etapa',Object.entries(kinds),initial.kind??'task');
   const changes=changeEditor(wrapper,'Alterações da etapa',kind,trigger,initial.changes);
   const title=input(wrapper,'Título da etapa');title.value=initial.title??'';title.required=true;title.maxLength=240;
   const wait=input(wrapper,'Espera antes da etapa (minutos)','number');wait.min=0;wait.max=43200;wait.value=initial.wait_minutes??0;
   const due=input(wrapper,'Prazo da etapa (minutos)','number');due.min=0;due.max=43200;due.value=initial.due_minutes??'';
   const owner=ownerPicker(wrapper,'Novo responsável da etapa',choices,initial.owner_id);
   kind.onchange=()=>{
    const assigning=kind.value==='assign_owner';
    owner.show(assigning);title.disabled=assigning||['update_record','summarize','run_agent','webhook'].includes(kind.value);title.parentElement.hidden=title.disabled;
    due.disabled=['assign_owner','notify_owner','comment','update_record','summarize','run_agent','webhook'].includes(kind.value);due.parentElement.hidden=due.disabled;due.required=kind.value==='reminder';
   };kind.onchange();
   const row=()=>kind.value==='assign_owner'
    ?{kind:kind.value,owner_id:owner.field.value,wait_minutes:Number(wait.value)}
    :kind.value==='update_record'?{kind:kind.value,changes:changes(),wait_minutes:Number(wait.value)}
    :{kind:kind.value,title:title.value,wait_minutes:Number(wait.value),due_minutes:due.disabled||due.value===''?null:Number(due.value)};
   const item={wrapper,read:row};
   item.up=button('Mover para cima',()=>move(item,-1));
   item.down=button('Mover para baixo',()=>move(item,1));
   rows.push(item);
   const controls=node('div',undefined,'step-controls');
   controls.append(item.up,item.down,button('Remover etapa',()=>{rows.splice(rows.indexOf(item),1);wrapper.remove();sync();addButton.focus();}));
   wrapper.append(controls);sync();
  }
  for(const item of initial)add(item);
  section.append(addButton);
  return {section,values:()=>rows.map(item=>item.read())};
 }
 async function editor(existing){
  const [members,pipelines]=await Promise.all([api('/crm/members'),api('/crm/pipelines')]);
  const choices=members.items.map(m=>[m.id,m.name]);
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
  fields.last_interaction_30d=select(conditions,'Última interação concluída nos últimos 30 dias',[...any,['call','Ligação'],['meeting','Reunião'],['followup','Follow-up'],['none','Nenhuma interação concluída']],'');
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
  const cooldown=input(form,'Intervalo mínimo entre execuções (minutos)','number');
  cooldown.min=0;cooldown.max=43200;cooldown.required=true;cooldown.value=existing?.cooldown_minutes??0;
  const kind=select(form,'Ação principal',Object.entries(kinds),existing?.action_kind??'task');
  const title=input(form,'Título da atividade principal');title.required=true;title.maxLength=240;title.value=existing?.task_title??'';
  const primaryOwner=ownerPicker(form,'Novo responsável principal',choices,existing?.action_owner_id);
  const alternate=select(form,'Se as condições não forem atendidas',[['','Encerrar fluxo'],...Object.entries(kinds)],existing?.else_kind??'');
  const mainChanges=changeEditor(form,'Alterações da ação principal',kind,trigger,existing?.action_changes);
  const otherChanges=changeEditor(form,'Alterações da ação alternativa',alternate,trigger,existing?.else_changes);
  const alternateTitle=input(form,'Título da atividade alternativa');alternateTitle.maxLength=240;alternateTitle.value=existing?.else_title??'';
  const alternateOwner=ownerPicker(form,'Novo responsável alternativo',choices,existing?.else_owner_id);
  const due=input(form,'Prazo após a execução (minutos)','number');due.min=0;due.max=43200;due.value=existing?.due_minutes??'';
  const mainSteps=stepEditor(form,'Etapas após a ação principal',existing?.steps?.match,choices,trigger);
  const otherSteps=stepEditor(form,'Etapas após a ação alternativa',existing?.steps?.otherwise,choices,trigger);
  function refresh(){
   alternate.disabled=!condition.value.trim()&&!Object.keys(selectedConditions()).length;if(alternate.disabled&&alternate.value){alternate.value='';alternate.dispatchEvent(new Event('change'));}
   otherSteps.section.hidden=!alternate.value;
   for(const field of otherSteps.section.querySelectorAll('fieldset'))field.disabled=!alternate.value;
   const assigning=kind.value==='assign_owner',otherAssigning=alternate.value==='assign_owner';
   primaryOwner.show(assigning);alternateOwner.show(otherAssigning);
   title.disabled=assigning||['update_record','summarize','run_agent','webhook'].includes(kind.value);title.parentElement.hidden=title.disabled;
   alternateTitle.disabled=!alternate.value||otherAssigning||['update_record','summarize','run_agent','webhook'].includes(alternate.value);alternateTitle.parentElement.hidden=otherAssigning||['update_record','summarize','run_agent','webhook'].includes(alternate.value);alternateTitle.required=!alternateTitle.disabled;
   const branches=[kind.value,alternate.value];
   due.disabled=!branches.some(action=>['task','reminder','followup'].includes(action));
   due.parentElement.hidden=due.disabled;due.required=branches.includes('reminder');
  }
  conditions.addEventListener('input',refresh);conditions.addEventListener('change',refresh);condition.oninput=refresh;kind.onchange=refresh;alternate.onchange=refresh;refresh();
  const diagram=node('section',undefined,'flow-diagram');diagram.setAttribute('aria-label','Mapa do fluxo');
  form.insertBefore(diagram,trigger.parentElement);
  function draw(){
   const start=node('div',events[trigger.value],'flow-trigger');
   if(Number(delay.value)>0)start.append(node('small','Aguardar '+delay.value+' min'));
   if(Number(cooldown.value)>0)start.append(node('small','Intervalo entre execuções: '+cooldown.value+' min'));
   const filters=[];
   if(condition.value.trim())filters.push('Origem: '+condition.value.trim());
   for(const field of Object.values(fields)){
    if(field.value!=='')filters.push(field.parentElement.firstChild.textContent+' · '+(field.selectedOptions?.[0]?.text??field.value));
   }
   const branches=node('div',undefined,'flow-paths');
   function addPath(label,actions){
    const path=node('section',undefined,'flow-path');path.setAttribute('aria-label',label);path.append(node('h4',label));
    const sequence=node('ol');
    for(const action of actions){
     const item=node('li');
     if(action.wait_minutes>0)item.append(node('small','Aguardar '+action.wait_minutes+' min'));
     item.append(node('strong',kinds[action.kind]));
     if(action.title&&!['assign_owner','update_record','summarize','run_agent','webhook'].includes(action.kind))item.append(node('span',action.title));
     sequence.append(item);
    }
    if(actions.length)path.append(sequence);
    path.append(node('span','Encerrar','flow-end'));branches.append(path);
   }
   addPath(filters.length?'Condições atendidas':'Ações',[{kind:kind.value,title:title.value},...mainSteps.values()]);
   if(filters.length)addPath('Caminho alternativo',alternate.value?[{kind:alternate.value,title:alternateTitle.value},...otherSteps.values()]:[]);
   diagram.replaceChildren(node('h3','Mapa do fluxo'),start);
   if(filters.length)diagram.append(node('p',filters.join(' · '),'flow-filters'));
   diagram.append(branches);
  }
  form.addEventListener('input',draw);form.addEventListener('change',draw);draw();
  const enabled=input(form,'Ativar fluxo','checkbox');enabled.checked=existing?.enabled??false;
  const save=node('button','Publicar versão','primary'),feedback=node('p');feedback.setAttribute('role','alert');form.append(save,feedback);
  form.onsubmit=async e=>{
   e.preventDefault();save.disabled=true;
   try{
    const data={steps:{match:mainSteps.values(),otherwise:alternate.value?otherSteps.values():[]},conditions:selectedConditions(),trigger_event:trigger.value,name:name.value,source_filter:condition.value.trim()||null,wait_minutes:Number(delay.value),cooldown_minutes:Number(cooldown.value),task_title:title.value,action_changes:mainChanges(),else_changes:otherChanges(),action_owner_id:primaryOwner.field.value||null,else_owner_id:alternateOwner.field.value||null,action_kind:kind.value,else_kind:alternate.value||null,else_title:alternate.value?alternateTitle.value:null,due_minutes:due.disabled||due.value===''?null:Number(due.value),enabled:enabled.checked};
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
    node('p',events[f.trigger_event]+' · '+(f.source_filter??'Todas as origens')+' · espera de '+f.wait_minutes+' min'+(f.cooldown_minutes?' · intervalo mínimo de '+f.cooldown_minutes+' min':'')),node('p',['assign_owner','update_record','summarize','run_agent','webhook'].includes(f.action_kind)?kinds[f.action_kind]:kinds[f.action_kind]+': '+f.task_title),...(f.else_kind?[node('p','Caminho alternativo · '+kinds[f.else_kind]+(['assign_owner','update_record','summarize','run_agent','webhook'].includes(f.else_kind)?'':': '+f.else_title))]:[]),
    button('Editar fluxo',()=>editor(f))));
  const states={queued:'Na fila',done:'Concluído',running:'Em execução',failed:'Falhou'};
  const outcomes={created:'Tarefa criada',skipped:'Ignorado',retry:'Nova tentativa agendada',failed:'Falha final',assigned:'Responsável atribuído',delivered:'Webhook aceito pelo destino',proposed:'Proposta de tarefa registrada',summarized:'Resumo comercial gerado',updated:'Registro atualizado',notified:'Notificação interna criada',unchanged:'Responsável já atribuído'};
  const history=runs.items.map(r=>{
   const details=node('details'),summary=node('summary',(names.get(r.payload.flow)??'Fluxo')+' · v'+r.payload.version+' · '+states[r.state]);
   details.append(summary,node('p',events[r.payload.event??'lead_created']),node('p',r.payload.source_activity?'Tarefa: '+r.payload.source_activity:r.payload.meeting?'Reunião: '+r.payload.meeting:r.payload.deal?'Oportunidade: '+r.payload.deal:'Lead: '+r.payload.lead),node('p','Disponível em '+date(r.available_at)));
   if(r.payload.agent_wait)details.append(node('p',r.payload.agent_wait==='agent_daily_limit'?'Limite diário de ações atingido.':'Aguardando liberação na supervisão de agentes.'));
   if(r.payload.billing_wait)details.append(node('p','Aguardando franquia diária de execuções.'));
   if(r.payload.frequency_deferred)details.append(node('p','Aguardando o intervalo mínimo deste fluxo.'));
   for(const attempt of r.history){
    details.append(node('p','Tentativa '+attempt.attempt+' · '+(attempt.outcome==='created'?({task:'Tarefa criada',reminder:'Lembrete criado',followup:'Follow-up criado',comment:'Comentário registrado'}[attempt.action_kind]??outcomes.created):attempt.action_kind==='update_record'&&attempt.outcome==='unchanged'?'Registro já atualizado':outcomes[attempt.outcome])+' · etapa '+((attempt.step_index??0)+1)+(attempt.branch==='otherwise'?' · caminho alternativo':'')+(attempt.assignment?' · responsável '+attempt.assignment.owner_id:'')+(attempt.reason==='owner_unavailable'?' · responsável indisponível':'')+(attempt.activity_id?' · atividade '+attempt.activity_id:'')));
    if(attempt.webhook){
     const reasons={webhook_config:'Configuração indisponível',webhook_destination_changed:'Destino alterado',webhook_network:'Falha de conexão',webhook_http:'Resposta do destino'};
     details.append(node('p',[reasons[attempt.reason],attempt.webhook.status?'HTTP '+attempt.webhook.status:null,'Entrega '+attempt.webhook.id].filter(Boolean).join(' · ')));
    }
    if(attempt.agent_run_id)details.append(node('p','Análise '+attempt.agent_run_id+' · consulte a proposta no histórico de análises do CRM.'));
    for(const item of attempt.summary??[]){
     const summary=node('section'),f=item.facts;
     summary.append(node('h3',(item.kind==='deal'?'Oportunidade · ':'Lead · ')+item.name),node('p','Responsável: '+item.owner));
     if(item.kind==='deal'){
      const value=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(f.amount_cents)/100);
      summary.append(node('p',f.stage+' · '+f.probability+'% · '+value));
     }else summary.append(node('p',[f.segment,f.source].filter(Boolean).join(' · ')));
     summary.append(node('p',item.pending_title?'Próxima atividade: '+item.pending_title+(item.pending_due_at?' · '+date(item.pending_due_at):''):'Sem atividade pendente.'));
     const analysis=item.analysis;
     summary.append(node('p',analysis?'Análise de '+date(analysis.created_at)+' · '+analysis.classification:'Sem análise registrada no Core.'));
     if(analysis?.next_action)summary.append(node('p',analysis.next_action));
     details.append(summary);
    }
   }
   return details;
  });
  return [button('Criar fluxo',()=>editor()),...(config.length?config:[empty('Nenhum fluxo publicado.')]),panel('Execuções recentes',...(history.length?history:[empty('Nenhuma execução registrada.')]))];
 };
}
