const activityNames={task:'Tarefa',call:'Ligação',meeting:'Reunião',comment:'Comentário',reminder:'Lembrete',followup:'Follow-up'};
const groupNames={total:'Total',source:'Origem',seller:'Vendedor',stage:'Etapa',team:'Equipe',pipeline:'Pipeline',segment:'Segmento',loss:'Motivo da perda'};

function csvCell(value){
 const raw=String(value??'');
 const safe=/^\s*[=+@-]|^[\t\r\n]/.test(raw)?"'"+raw:raw;
 return '"'+safe.replaceAll('"','""')+'"';
}

function transitionPercent(count,entered){
 return Number((100*count/entered).toFixed(2));
}

function downloadReport(report,filters){
 const rows=[['Início','Fim','Filtro de origem','Carteira','Equipe','Pipeline','Segmento','Grupo','Descrição','Fechados','Ganhos','Perdidos','Receita (centavos)','Ticket médio (centavos)','Ciclo médio (dias)','Amostra do ciclo','Conversão (%)','Negócios que entraram','Saídas observadas','Destino','Negócios por destino','Conversão ao destino (%)','Atividades concluídas','Com vencimento','Concluídas no prazo','Pendentes no corte','Pontualidade (%)']];
 for(const row of [report.total,...report.groups]){
  rows.push([report.period.from,report.period.to,...filters,groupNames[row.kind??'total'],row.label??'Total',row.closed,row.won,row.lost,row.revenue_cents,row.average_ticket_cents,row.average_cycle_days,row.cycle_sample,row.conversion_pct,'','','','','']);
 }
 for(const stage of report.transitions){
  const prefix=[report.period.from,report.period.to,...filters,'Passagem entre etapas',stage.label,'','','','','','','','',stage.entered,stage.moved];
  if(!stage.destinations.length)rows.push([...prefix,'','','']);
  for(const dest of stage.destinations)rows.push([...prefix,dest.label,dest.deals,transitionPercent(dest.deals,stage.entered)]);
 }
 for(const row of [report.activities.total,...report.activities.groups]){
  const kind={owner:'Atividades por responsável',kind:'Atividades por tipo',total:'Atividades comerciais'}[row.kind??'total'];
  const label=row.kind==='kind'?activityNames[row.id]:row.label??'Total';
  rows.push([report.period.from,report.period.to,...filters,kind,label,...Array(13).fill(''),row.completed,row.due,row.on_time,row.pending,row.on_time_pct]);
 }
 const width=rows[0].length;
 for(const row of rows)while(row.length<width)row.push('');
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
  for(const [key,label,type] of [['from','Fechamentos a partir de','date'],['to','Fechamentos até','date'],['source','Origem','text'],['segment','Segmento','text']]){
   const wrapper=node('label',label),field=node('input');field.type=type;field.value=saved[key]??'';wrapper.append(field);form.append(wrapper);inputs[key]=field;
  }
  function selectFilter(key,label,items){
   const wrapper=node('label',label),select=node('select');
   select.setAttribute('aria-label',label);
   select.add(new Option('Todos',''));
   for(const item of items)select.add(new Option(item.name,item.id));
   select.value=saved[key]??'';if(select.selectedIndex<0)select.selectedIndex=0;wrapper.append(select);form.append(wrapper);inputs[key]=select;
  }
  const teams=[];let cursor='';
  do{
   const page=await api('/teams?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
   teams.push(...page.items);cursor=page.nextCursor;
  }while(cursor);
  selectFilter('team','Equipe do negócio',teams);
  selectFilter('pipeline','Pipeline',(await api('/crm/pipelines')).items);
  if(getUser().role!=='seller')selectFilter('seller','Vendedor',(await api('/crm/members')).items);
  const submit=node('button','Aplicar filtros');form.append(submit);
  async function refresh(){
   const query=new URLSearchParams();for(const [key,field] of Object.entries(inputs))if(field.value)query.set(key,field.value);
   const seller=inputs.seller?.selectedOptions[0]?.text??getUser().name;
   const team=inputs.team.selectedOptions[0].text,pipeline=inputs.pipeline.selectedOptions[0].text;
   const report=await api('/revenue/closed?'+query),t=report.total;
   inputs.from.value=report.period.from;inputs.to.value=report.period.to;
   saved=Object.fromEntries(query);
   const percent=v=>v===null?'Sem base':Number(v).toLocaleString('pt-BR')+'%';
   const totals=panel('Resultados do período',pair('Receita ganha',money(t.revenue_cents)),pair('Ganhas / perdidas',t.won+' / '+t.lost),
    pair('Conversão dos fechamentos',percent(t.conversion_pct)),pair('Ticket médio ganho',t.average_ticket_cents===null?'Sem ganhos':money(t.average_ticket_cents)),
    pair('Ciclo médio dos ganhos',t.average_cycle_days===null?'Sem base':Number(t.average_cycle_days).toLocaleString('pt-BR')+' dias · '+t.cycle_sample+' ganhos'));
   const source=query.get('source')||'Todas';
   const segment=query.get('segment')||'Todos';
   const filters=[source,seller,team,pipeline,segment];
   const context=node('p','Fechamentos de '+report.period.from+' até '+report.period.to+' · Origem: '+source+' · Carteira: '+seller+' · Equipe: '+team+' · Pipeline: '+pipeline+' · Segmento: '+segment);
   const actions=node('div',undefined,'toolbar revenue-actions');
   const csv=node('button','Exportar CSV'),print=node('button','Imprimir ou salvar PDF');
   csv.onclick=()=>downloadReport(report,filters);
   print.onclick=()=>window.print();
   actions.append(csv,print);
   output.replaceChildren(context,actions,totals);
   for(const [kind,title] of [['source','Por origem'],['seller','Por vendedor'],['team','Por equipe'],['segment','Por segmento'],['pipeline','Por pipeline'],['stage','Etapa de fechamento'],['loss','Motivos de perda']]){
    const rows=report.groups.filter(r=>r.kind===kind);
    const entries=rows.map(r=>pair(r.label,kind==='loss'?r.lost+' perdas':r.won+' de '+r.closed+' ganhos · '+percent(r.conversion_pct)+' · '+money(r.revenue_cents)));
    output.append(panel(title,...(entries.length?entries:[empty('Sem fechamentos no período.')])));
   }
   const transitions=panel('Conversão entre etapas',node('p','Cada negócio entra uma vez por etapa no período. A primeira saída observada indica o destino, inclusive em retornos e transferências.'));
   for(const stage of report.transitions){
    transitions.append(node('h3',stage.label),pair('Com saída registrada',stage.moved+' de '+stage.entered+' · '+percent(transitionPercent(stage.moved,stage.entered))));
    for(const dest of stage.destinations)transitions.append(pair(dest.label,dest.deals+' negócios · '+percent(transitionPercent(dest.deals,stage.entered))));
   }
   if(!report.transitions.length)transitions.append(empty('Sem entradas de etapa registradas no período.'));
   output.append(transitions);
   const activities=report.activities.total;
   const productivity=panel('Atividades comerciais',
    pair('Concluídas no período',activities.completed),pair('Com vencimento no período',activities.due),
    pair('Concluídas no prazo',activities.on_time),pair('Pontualidade',percent(activities.on_time_pct)),
    pair('Vencidas no período e pendentes no corte',activities.pending));
   for(const kind of ['owner','kind']){
    productivity.append(node('h3',kind==='owner'?'Por responsável':'Por tipo de atividade'));
    const groups=report.activities.groups.filter(row=>row.kind===kind);
    if(!groups.length)productivity.append(empty('Sem atividades no período.'));
    for(const row of groups)productivity.append(pair(kind==='owner'?row.label:activityNames[row.id],
     row.completed+' concluídas · '+row.on_time+' de '+row.due+' no prazo · '+row.pending+' pendentes no corte'));
   }
   output.append(productivity);
  }
  form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{await refresh();feedback.textContent='';}catch(error){feedback.textContent=error.message;}finally{submit.disabled=false;}};
  await refresh();return [root];
 };
}
