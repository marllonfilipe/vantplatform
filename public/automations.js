export function createAutomationPage({api,node,button,panel,empty,modal,view,date}){
 const page='Automações';
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
  const title=input(form,'Tarefa a criar');title.required=true;title.maxLength=240;title.value=existing?.task_title??'';
  const enabled=input(form,'Ativar fluxo','checkbox');enabled.checked=existing?.enabled??false;
  const save=node('button','Publicar versão','primary'),feedback=node('p');feedback.setAttribute('role','alert');form.append(save,feedback);
  form.onsubmit=async e=>{
   e.preventDefault();save.disabled=true;
   try{
    const data={name:name.value,source_filter:condition.value.trim()||null,wait_minutes:Number(delay.value),task_title:title.value,enabled:enabled.checked};
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
    node('p','Novo lead · '+(f.source_filter??'Todas as origens')+' · espera de '+f.wait_minutes+' min'),node('p','Tarefa: '+f.task_title),
    button('Editar fluxo',()=>editor(f))));
  const states={queued:'Na fila',done:'Concluído',running:'Em execução',failed:'Falhou'};
  const outcomes={created:'Tarefa criada',skipped:'Ignorado',retry:'Nova tentativa agendada',failed:'Falha final'};
  const history=runs.items.map(r=>{
   const details=node('details'),summary=node('summary',(names.get(r.payload.flow)??'Fluxo')+' · v'+r.payload.version+' · '+states[r.state]);
   details.append(summary,node('p','Lead: '+r.payload.lead),node('p','Disponível em '+date(r.available_at)));
   for(const attempt of r.history)details.append(node('p','Tentativa '+attempt.attempt+' · '+outcomes[attempt.outcome]+(attempt.activity_id?' · atividade '+attempt.activity_id:'')));
   return details;
  });
  return [button('Criar fluxo',()=>editor()),...(config.length?config:[empty('Nenhum fluxo publicado.')]),panel('Execuções recentes',...(history.length?history:[empty('Nenhuma execução registrada.')]))];
 };
}
