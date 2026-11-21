export function createForecastPage({api,node,panel,pair,empty,money}){
 return async function render(){
  const root=node('div',undefined,'stack'),label=node('label','Horizonte da projeção'),select=node('select'),output=node('div'),status=node('p');
  select.setAttribute('aria-label','Horizonte da projeção');
  for(const days of [30,60,90])select.add(new Option(days+' dias',String(days)));
  label.append(select);status.setAttribute('role','status');root.append(label,status,output);
  async function refresh(){
   const result=await api('/revenue/forecast?days='+select.value);
   const within=result.coverage.find(row=>row.bucket==='within');
   output.replaceChildren(panel('Projeção pela probabilidade do CRM',
    node('p','Fechamentos previstos de '+result.from+' até '+result.to+' · Datas de São Paulo.'),
    pair('Valor ponderado estimado',money(within?.weighted_cents??0)),
    pair('Valor aberto no horizonte',money(within?.value_cents??0)),
    pair('Negócios considerados',within?.deals??0),
    node('p','Cada oportunidade contribui com o valor multiplicado pela probabilidade cadastrada. O resultado depende da atualização do CRM.')));
   const rows=result.stages.map(row=>pair(row.pipeline+' · '+row.stage,row.deals+' negócios · estimativa '+money(row.weighted_cents)));
   output.append(panel('Estimativa por etapa',...(rows.length?rows:[empty('Sem negócios com fechamento previsto no horizonte.')])));
   const labels={overdue:'Com previsão vencida',undated:'Sem data prevista',later:'Após o horizonte'};
   const excluded=Object.entries(labels).map(([bucket,name])=>{
    const row=result.coverage.find(item=>item.bucket===bucket);
    return pair(name,(row?.deals??0)+' negócios · '+money(row?.value_cents??0));
   });
   output.append(panel('Carteira fora da projeção',...excluded));
   for(const group of result.comparisons){
    const month=new Intl.DateTimeFormat('pt-BR',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2000,group.close_month-1,1)));
    const basis={seasonal:'Mesmo mês, em ao menos dois anos',pipeline:'Histórico do pipeline',insufficient:'Amostra insuficiente'};
    output.append(panel(group.pipeline+' · '+month,
     pair('Base de comparação',basis[group.basis]),
     pair('Fechamentos observados',group.wins+' ganhos em '+group.sample+' fechamentos'),
     pair('Conversão histórica',group.observed_pct===null?'Sem base':Number(group.observed_pct).toLocaleString('pt-BR')+'%'),
     pair('Cenário pela conversão histórica',group.scenario_cents===null?'Sem base':money(group.scenario_cents)),
     pair('Idade média das negociações abertas',group.open_age_days===null?'Sem base':group.open_age_days+' dias'),
     pair('Ciclo médio dos ganhos anteriores',group.won_cycle_days===null?'Sem ganhos com duração válida':group.won_cycle_days+' dias')));
   }
  }
  select.onchange=async()=>{
   select.disabled=true;
   try{await refresh();status.textContent='';}catch(error){output.replaceChildren();status.textContent=error.message;}
   finally{select.disabled=false;}
  };
  await refresh();return [root];
 };
}
