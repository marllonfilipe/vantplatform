export function createGoalsPage({api,node,panel,pair,money,getUser}){
 return async function render(){
  const root=node('div',undefined,'stack'),month=node('input'),period=node('label','Mês de referência'),feedback=node('p'),list=node('div');
  month.type='month';period.append(month);feedback.setAttribute('role','status');root.append(period,feedback,list);
  const manager=['owner','manager'].includes(getUser().role);
  async function refresh(){
   const report=await api('/revenue/goals'+(month.value?'?month='+encodeURIComponent(month.value):''));
   month.value=report.month;list.replaceChildren();
   for(const row of report.items){
    const card=panel(row.name,pair('Receita ganha',money(row.won_cents)),pair('Meta mensal',row.amount_cents===null?'Sem meta definida':money(row.amount_cents)),
     pair('Atingimento',row.attainment_pct===null?'Sem base':Number(row.attainment_pct).toLocaleString('pt-BR')+'%'));
    if(manager&&row.can_edit){
     const form=node('form',undefined,'toolbar'),label=node('label','Meta em reais'),input=node('input'),submit=node('button','Salvar meta'),notice=node('p');
     input.type='number';input.min='0.01';input.max='9999999999.99';input.step='0.01';input.required=true;
     if(row.amount_cents!==null)input.value=(Number(row.amount_cents)/100).toFixed(2);
     notice.setAttribute('role','status');label.append(input);form.append(label,submit,notice);card.append(form);
     form.onsubmit=async event=>{
      event.preventDefault();if(month.disabled)return;submit.disabled=true;month.disabled=true;
      try{await api('/revenue/goals','PUT',{owner_id:row.id,month:report.month,amount_cents:Math.round(input.valueAsNumber*100),expected_revision:row.revision});await refresh();feedback.textContent='Meta salva.';}
      catch(error){notice.textContent=error.message;}finally{submit.disabled=false;month.disabled=false;}
     };
    }
    list.append(card);
   }
   if(!report.items.length)list.append(node('p','Sem responsáveis comerciais no período.'));
  }
  month.onchange=async()=>{month.disabled=true;list.replaceChildren();
   try{await refresh();feedback.textContent='';}catch(error){feedback.textContent=error.message;}finally{month.disabled=false;}
  };
  await refresh();return [root];
 };
}
