export function createSupervisionPage({api,node,panel,empty,getUser,view}){
 return async function page(){
  const {config,history}=await api('/agents/controls');
  const owner=getUser().role==='owner';
  const form=node('form',undefined,'stack'),boxes={};
  for(const [key,label] of [['paused','Pausar ações dos agentes no CRM'],['tasks_enabled','Permitir criação de tarefas aprovadas'],['sdr_enabled','Permitir registro de respostas do SDR']]){
   const wrapper=node('label',label),input=node('input');
   input.type='checkbox';input.checked=config[key];input.disabled=!owner;wrapper.prepend(input);form.append(wrapper);boxes[key]=input;
  }
  const label=node('label','Limite de ações por dia'),limit=node('input');
  limit.type='number';limit.value=config.daily_limit;limit.min=1;limit.max=10000;limit.required=true;limit.disabled=!owner;
  label.append(limit);form.append(label,node('p','Ações executadas hoje: '+config.used_today));
  if(owner){
   const save=node('button','Salvar controles','primary'),feedback=node('p');
   feedback.setAttribute('role','alert');form.append(save,feedback);
   form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{
    await api('/agents/controls','PUT',{revision:config.revision,paused:boxes.paused.checked,tasks_enabled:boxes.tasks_enabled.checked,sdr_enabled:boxes.sdr_enabled.checked,daily_limit:Number(limit.value)});
    await view('Supervisão de agentes');
   }catch(error){feedback.textContent=error.message;}finally{save.disabled=false;}};
  }
  const entries=history.map(row=>node('p','Revisão '+row.revision+' · '+(row.settings.paused?'Pausado':'Ativo')+' · limite '+row.settings.daily_limit+' · tarefas '+(row.settings.tasks_enabled?'habilitadas':'pausadas')+' · SDR '+(row.settings.sdr_enabled?'habilitado':'pausado')));
  return [panel('Ferramentas que alteram o CRM',form),panel('Histórico de controles',...(entries.length?entries:[empty('Nenhum ajuste registrado.')]))];
 };
}
