const groupNames={total:'Total',source:'Origem',seller:'Vendedor',stage:'Etapa',loss:'Motivo da perda'};

function csvCell(value){
 const raw=String(value??'');
 const safe=/^\s*[=+@-]|^[\t\r\n]/.test(raw)?"'"+raw:raw;
 return '"'+safe.replaceAll('"','""')+'"';
}

function downloadReport(report,source,seller){
 const rows=[['Início','Fim','Filtro de origem','Carteira','Grupo','Descrição','Fechados','Ganhos','Perdidos','Receita (centavos)','Ticket médio (centavos)','Ciclo médio (dias)','Amostra do ciclo','Conversão (%)']];
 for(const row of [report.total,...report.groups]){
  rows.push([report.period.from,report.period.to,source,seller,groupNames[row.kind??'total'],row.label??'Total',row.closed,row.won,row.lost,row.revenue_cents,row.average_ticket_cents,row.average_cycle_days,row.cycle_sample,row.conversion_pct]);
 }
 const csv=rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob(['\uFEFF',csv,'\r\n'],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');
 link.href=url;link.download='receita-'+report.period.from+'-'+report.period.to+'.csv';
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function createRevenuePage({api,node,panel,pair,empty,money,getUser}){
 let saved={};
 return async function render(){
  const root=node('div',undefined,'stack revenue-report'),form=node('form',undefined,'toolbar'),output=node('div',undefined,'stack'),feedback=node('p');
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
   const seller=inputs.seller?.selectedOptions[0]?.text??getUser().name;
   const report=await api('/revenue/closed?'+query),t=report.total;
   inputs.from.value=report.period.from;inputs.to.value=report.period.to;
   saved=Object.fromEntries(query);
   const percent=v=>v===null?'Sem base':Number(v).toLocaleString('pt-BR')+'%';
   const totals=panel('Resultados do período',pair('Receita ganha',money(t.revenue_cents)),pair('Ganhas / perdidas',t.won+' / '+t.lost),
    pair('Conversão dos fechamentos',percent(t.conversion_pct)),pair('Ticket médio ganho',t.average_ticket_cents===null?'Sem ganhos':money(t.average_ticket_cents)),
    pair('Ciclo médio dos ganhos',t.average_cycle_days===null?'Sem base':Number(t.average_cycle_days).toLocaleString('pt-BR')+' dias · '+t.cycle_sample+' ganhos'));
   const source=query.get('source')||'Todas';
   const context=node('p','Fechamentos de '+report.period.from+' até '+report.period.to+' · Origem: '+source+' · Carteira: '+seller);
   const actions=node('div',undefined,'toolbar revenue-actions');
   const csv=node('button','Exportar CSV'),print=node('button','Imprimir ou salvar PDF');
   csv.onclick=()=>downloadReport(report,source,seller);
   print.onclick=()=>window.print();
   actions.append(csv,print);
   output.replaceChildren(context,actions,totals);
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
