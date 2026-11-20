import {questions} from './copilot-questions.js';
export function createCopilotPage({api,node,button,panel,empty,date}){
 return function page(){
  const form=node('form',undefined,'stack');
  const label=node('label','Pergunta sobre o CRM'),input=node('input');
  input.maxLength=320;input.required=true;label.append(input);
  const submit=node('button','Consultar','primary');
  const busy=node('p');busy.setAttribute('role','status');
  const output=node('div');output.setAttribute('aria-live','polite');
  const choices=node('div',undefined,'toolbar');
  for(const phrases of Object.values(questions))choices.append(button(phrases[0],()=>{input.value=phrases[0];form.requestSubmit();}));
  let generation=0;
  form.onsubmit=async event=>{
   event.preventDefault();
   const current=++generation;
   busy.textContent='Consultando…';output.replaceChildren();submit.disabled=true;
   try{
    const answer=await api('/agents/copilot','POST',{question:input.value});
    if(current!==generation)return;
    if(!answer.intent){output.replaceChildren(empty('Reformule a pergunta sobre prioridades, riscos, oportunidades paradas ou follow-ups.'));return;}
    const titles={stalled:'Oportunidades abertas sem movimento há pelo menos 14 dias',leads:'Prioridade dos leads analisados',risks:'Riscos nas últimas análises de oportunidades abertas',followups:'Follow-ups vencidos'};
    const items=answer.items.map(item=>{
     const details=answer.intent==='stalled'?[item.days_stalled+' dias sem movimento','Último movimento em '+date(item.last_touch)]:item.due_at?['Vencimento: '+date(item.due_at)]:[item.risk??('Pontuação: '+item.score),item.detail,'Análise de '+date(item.analyzed_at)];
     return panel(item.name,...details.map(text=>node('p',text)));
    });
    output.replaceChildren(panel(titles[answer.intent],...(items.length?items:[empty('Nenhum registro encontrado para esta consulta.')])));
   }catch(error){if(current===generation)output.replaceChildren(empty(error.message));}
   finally{if(current===generation){busy.textContent='';submit.disabled=false;}}
  };
  form.append(label,submit,busy);
  return [form,choices,output];
 };
}
