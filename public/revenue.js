export function createRevenuePage({api,node,panel,pair,empty,money,getUser}){
 let saved={};
 return async function render(){
  const root=node('div',undefined,'stack'),form=node('form',undefined,'toolbar'),output=node('div',undefined,'stack'),feedback=node('p');
  feedback.setAttribute('role','status');root.append(form,feedback,output);
  const inputs={};
  for(const [key,label,type] of [['from','Fechamentos a partir de','date'],['to','Fechamentos até','date'],['source','Origem','text']]){
   const wrapper=node('label',label),field=node('input');field.type=type;field.value=saved[key]??'';wrapper.append(field);form.append(wrapper);inputs[key]=field;
  }
  if(getUser().role!=='seller'){
   const wrapper=node('label','Vendedor'),select=node('select');
   select.add(new Option('Todos',''));for(const m of (await api('/crm/members')).items)select.add(new Option(m.name,m.id));
   select.value=saved.seller??'';wrapper.append(select);form.append(wrapper);inputs.seller=select;
  }
  const submit=node('button','Aplicar filtros');form.append(submit);
  async function refresh(){
   const query=new URLSearchParams();for(const [key,field] of Object.entries(inputs))if(field.value)query.set(key,field.value);
   const report=await api('/revenue/closed?'+query),t=report.total;
   inputs.from.value=report.period.from;inputs.to.value=report.period.to;
   saved=Object.fromEntries(query);
   const percent=v=>v===null?'Sem base':Number(v).toLocaleString('pt-BR')+'%';
   const totals=panel('Resultados do período',pair('Receita ganha',money(t.revenue_cents)),pair('Ganhas / perdidas',t.won+' / '+t.lost),
    pair('Conversão dos fechamentos',percent(t.conversion_pct)),pair('Ticket médio ganho',t.average_ticket_cents===null?'Sem ganhos':money(t.average_ticket_cents)),
    pair('Ciclo médio dos ganhos',t.average_cycle_days===null?'Sem base':Number(t.average_cycle_days).toLocaleString('pt-BR')+' dias · '+t.cycle_sample+' ganhos'));
   output.replaceChildren(totals);
   for(const [kind,title] of [['source','Por origem'],['seller','Por vendedor'],['stage','Etapa de fechamento'],['loss','Motivos de perda']]){
    const rows=report.groups.filter(r=>r.kind===kind);
    const entries=rows.map(r=>pair(r.label,kind==='loss'?r.lost+' perdas':r.won+' de '+r.closed+' ganhos · '+percent(r.conversion_pct)+' · '+money(r.revenue_cents)));
    output.append(panel(title,...(entries.length?entries:[empty('Sem fechamentos no período.')])));
   }
  }
  form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{await refresh();feedback.textContent='';}catch(error){feedback.textContent=error.message;}finally{submit.disabled=false;}};
  await refresh();return [root];
 };
}
