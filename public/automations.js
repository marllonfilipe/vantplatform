export function createAutomationPage({api,node,button,panel,empty,modal,view,date}){
 const page='Automações';
 const kinds={task:'Tarefa',reminder:'Lembrete',followup:'Follow-up'};
 function select(form,label,choices,value){
  const wrapper=node('label',label),control=node('select');
  for(const [key,name] of choices)control.add(new Option(name,key));
  control.value=value;wrapper.append(control);form.append(wrapper);return control;
 }
 function input(form,label,type='text'){
  const wrapper=node('label',label),control=node('input');
  control.type=type;wrapper.append(control);form.append(wrapper);return control;
 }
 function editor(existing){
  const form=node('form',undefined,'stack');
  const name=input(form,'Nome do fluxo');name.required=true;name.maxLength=120;name.value=existing?.name??'';
  form.append(panel('Gatilho',node('p','Novo lead no CRM')));
  const condition=input(form,'Origem do lead (opcional)');condition.maxLength=250;condition.value=existing?.source_filter??'';
  const delay=input(form,'Espera em minutos','number');delay.min=0;delay.max=43200;delay.required=true;delay.value=existing?.wait_minutes??0;
  const kind=select(form,'Ação principal',Object.entries(kinds),existing?.action_kind??'task');
  const title=input(form,'Título da atividade principal');title.required=true;title.maxLength=240;title.value=existing?.task_title??'';
  const alternate=select(form,'Se a origem for diferente',[['','Encerrar fluxo'],...Object.entries(kinds)],existing?.else_kind??'');
  const alternateTitle=input(form,'Título da atividade alternativa');alternateTitle.maxLength=240;alternateTitle.value=existing?.else_title??'';
  const due=input(form,'Prazo após a execução (minutos)','number');due.min=0;due.max=43200;due.value=existing?.due_minutes??'';
  function refresh(){
   alternate.disabled=!condition.value.trim();if(alternate.disabled)alternate.value='';
   alternateTitle.disabled=!alternate.value;alternateTitle.required=Boolean(alternate.value);
   due.required=[kind.value,alternate.value].includes('reminder');
  }
  condition.oninput=refresh;kind.onchange=refresh;alternate.onchange=refresh;refresh();
  const enabled=input(form,'Ativar fluxo','checkbox');enabled.checked=existing?.enabled??false;
  const save=node('button','Publicar versão','primary'),feedback=node('p');feedback.setAttribute('role','alert');form.append(save,feedback);
  form.onsubmit=async e=>{
   e.preventDefault();save.disabled=true;
   try{
    const data={name:name.value,source_filter:condition.value.trim()||null,wait_minutes:Number(delay.value),task_title:title.value,action_kind:kind.value,else_kind:alternate.value||null,else_title:alternate.value?alternateTitle.value:null,due_minutes:due.value===''?null:Number(due.value),enabled:enabled.checked};
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
    node('p','Novo lead · '+(f.source_filter??'Todas as origens')+' · espera de '+f.wait_minutes+' min'),node('p',kinds[f.action_kind]+': '+f.task_title),...(f.else_kind?[node('p','Outra origem · '+kinds[f.else_kind]+': '+f.else_title)]:[]),
    button('Editar fluxo',()=>editor(f))));
  const states={queued:'Na fila',done:'Concluído',running:'Em execução',failed:'Falhou'};
  const outcomes={created:'Tarefa criada',skipped:'Ignorado',retry:'Nova tentativa agendada',failed:'Falha final'};
  const history=runs.items.map(r=>{
   const details=node('details'),summary=node('summary',(names.get(r.payload.flow)??'Fluxo')+' · v'+r.payload.version+' · '+states[r.state]);
   details.append(summary,node('p','Lead: '+r.payload.lead),node('p','Disponível em '+date(r.available_at)));
   for(const attempt of r.history)details.append(node('p','Tentativa '+attempt.attempt+' · '+(attempt.outcome==='created'?({task:'Tarefa criada',reminder:'Lembrete criado',followup:'Follow-up criado'}[attempt.action_kind]??outcomes.created):outcomes[attempt.outcome])+(attempt.branch==='otherwise'?' · caminho alternativo':'')+(attempt.activity_id?' · atividade '+attempt.activity_id:'')));
   return details;
  });
  return [button('Criar fluxo',()=>editor()),...(config.length?config:[empty('Nenhum fluxo publicado.')]),panel('Execuções recentes',...(history.length?history:[empty('Nenhuma execução registrada.')]))];
 };
}
