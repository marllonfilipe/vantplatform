const el=id=>document.getElementById(id);
const main=el('content'), status=el('status');
function node(tag,text,cls) { const n=document.createElement(tag); if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n; }
function button(label,action){const b=node('button',label);b.type='button';b.addEventListener('click',()=>Promise.resolve(action()).catch(error=>{status.textContent=error.message;}));return b;}
function pair(a,b){const row=node('div',undefined,'row');row.append(node('span',a),node('b',String(b??'—'),'pair'));return row;}
function panel(title,...children){const div=node('section',undefined,'panel');div.append(node('h2',title),...children);return div;}
function empty(text){return node('p',text,'empty');}
function modal(title,...children){el('dialogTitle').textContent=title;el('dialogBody').replaceChildren(...children);if(!el('dialog').open)el('dialog').showModal();}
el('closeDialog').onclick=()=>el('dialog').close();
let who, data, current='Visão geral', generation=0, extension;
const date=v=>v?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(v)):'Sem prazo';
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(Number(v??0)/100);
async function api(path,method='GET',body){
  const response=await fetch('/api/v1'+path,{method,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const value=response.status===204?null:await response.json();
  if(!response.ok){if(response.status===401 && path!=='/auth/login')showLogin();throw Error(value?.error?.message??'Falha na operação.');}
  return value;
}
function showLogin(){generation++;who=null;el('shell').hidden=true;el('login').hidden=false;if(el('dialog').open)el('dialog').close();}
const groupNames={'Visão geral':'Principal','Meu desempenho':'Principal','Próximas tarefas':'Operação','Atividades recentes':'Operação','Equipe':'Gestão'};
function nav(){
  const groups={Principal:['Visão geral','Meu desempenho'],...(extension?.groups??{}),Operação:[...(extension?.groups?.Operação??[]),'Próximas tarefas','Atividades recentes'],Gestão:['Equipe']};
  const nav=el('navigation');nav.replaceChildren();
  for(const [group,labels] of Object.entries(groups)){
    nav.append(node('small',group));
    for(const name of labels){const b=button(name,()=>view(name));if(name===current)b.setAttribute('aria-current','page');nav.append(b);}
  }
}
async function boot(){
  who=await api('/auth/me');
  el('login').hidden=true;el('shell').hidden=false;el('tenantName').textContent=who.tenant_name;
  el('team').replaceChildren(new Option('Todas as equipes',''));let cursor='';
  do{const page=await api('/teams?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));for(const t of page.items)el('team').add(new Option(t.name,t.id));cursor=page.nextCursor;}while(cursor);
  await view('Visão geral');
}
el('loginForm').onsubmit=async e=>{e.preventDefault();const form=e.target;el('loginError').textContent='Entrando…';try{await api('/auth/login','POST',Object.fromEntries(new FormData(form)));form.elements.password.value='';el('loginError').textContent='';await boot();}catch(error){el('loginError').textContent=error.message;}};
el('menu').onclick=()=>{if(matchMedia('(max-width:760px)').matches)document.body.classList.toggle('mobile-open');else document.body.classList.toggle('nav-off');};
function ranking(rows,label='Nenhum registro neste período.') {return rows.length?rows.map(r=>pair(r.label,r.count)):[empty(label)];}
function trend(points){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 600 120');svg.setAttribute('class','chart');svg.setAttribute('role','img');
  const total=points.reduce((sum,p)=>sum+p.count,0);svg.setAttribute('aria-label',total+' oportunidades criadas no período');
  const max=Math.max(1,...points.map(p=>p.count));
  const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',points.map((p,i)=>(4+i*592/Math.max(points.length-1,1))+','+(108-p.count*96/max)).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','currentColor');line.setAttribute('stroke-width','3');svg.append(line);
  return panel('Evolução de oportunidades',svg,pair(points[0]?.day??'',points.at(-1)?.day??''),empty(total+' criadas no período'));
}
function metrics(t){
 const metrics=node('div',undefined,'metrics');
 for(const [label,value] of [['Valor do pipeline',money(t.pipeline)],['Oportunidades abertas',t.open_deals],['Novos leads',t.new_leads],['Receita fechada',money(t.won)]]){const card=node('article',undefined,'metric');card.append(node('small',label),node('strong',value));metrics.append(card);}return metrics;
}
function taskRows(list,recent=false){return list.length?list.map(v=>pair(v.title,date(recent?v.created_at:v.due_at))):[empty(recent?'Nenhuma atividade registrada no período.':'Nenhuma tarefa pendente.')];}
function overview(d){
 const grid=node('div',undefined,'grid'),t=d.totals;
 grid.append(trend(d.trend),panel('Funil comercial',...ranking(d.stages.map(s=>({...s,label:s.pipeline+' · '+s.label})),'As etapas aparecem após o cadastro do primeiro funil.')),
 panel('Indicadores comerciais',pair('Leads cadastrados',t.leads),pair('Receita potencial ponderada',money(t.weighted)),pair('Taxa de conversão',t.conversion===null?'Sem fechamento':Number(t.conversion).toLocaleString('pt-BR')+'%'),pair('Reuniões agendadas',t.meetings)),
 panel('Atenção da equipe',pair('Leads sem interação',t.untouched),pair('Leads prioritários',t.priority),pair('Atividades pendentes',t.pending),pair('Atividades em atraso',t.overdue)),
 panel('Origem dos leads',...ranking(d.sources)),panel('Negócios ganhos por pessoa',...ranking(d.performance)),
 panel('Próximas tarefas',...taskRows(d.next)),panel('Atividades recentes',...taskRows(d.recent,true)),
 panel('Recomendações de inteligência',...(d.recommendations?.length?d.recommendations.map(r=>pair(r.title,r.detail)):[empty('Nenhuma recomendação registrada para este contexto.')])));return [metrics(t),grid];
}
async function view(name){
 const seq=++generation;current=name;document.body.classList.remove('mobile-open');nav();el('pageTitle').textContent=name;el('context').textContent=groupNames[name]??'Comercial';main.replaceChildren();status.textContent='Carregando…';
 const filterable=['Visão geral','Meu desempenho','Próximas tarefas','Atividades recentes'].includes(name);el('filters').hidden=!filterable;
 try{
  let content=[];
  if(filterable){
   const params=new URLSearchParams({days:el('period').value,team:el('team').value,mine:name==='Meu desempenho'?'1':'0'});
   const d=await api('/dashboard?'+params);if(seq!==generation)return;data=d;
   if(name==='Próximas tarefas')content=[panel('Pendências',...taskRows(d.next))];
   else if(name==='Atividades recentes')content=[panel('Histórico do período',...taskRows(d.recent,true))];
   else content=overview(d);
  }else if(name==='Equipe'){
   const list=[...el('team').options].filter(o=>o.value);
   const children=list.length?list.map(o=>node('p',o.textContent,'row')):[empty('Cadastre a primeira equipe da empresa.')];
   if(['owner','manager'].includes(who.role))children.push(button('Criar equipe',()=>teamForm()));
   content=[panel('Equipes cadastradas',...children)];
  }else if(extension){content=await extension.page(name);}
  if(seq===generation){main.replaceChildren(...content);status.textContent='';}
 }catch(error){if(seq===generation){status.textContent=error.message;main.replaceChildren(button('Tentar novamente',()=>view(name)));}}
}
function teamForm(){const f=node('form',undefined,'stack'),label=node('label','Nome da equipe'),input=node('input');input.required=true;input.maxLength=100;label.append(input);const note=node('p');f.append(label,node('button','Salvar','primary'),note);f.onsubmit=async e=>{e.preventDefault();try{const t=await api('/teams','POST',{name:input.value});el('team').add(new Option(t.name,t.id));el('dialog').close();await view('Equipe');}catch(err){note.textContent=err.message;}};modal('Nova equipe',f);}
el('period').onchange=el('team').onchange=()=>view(current);
el('profile').onclick=()=>modal(who.name,pair('E-mail',who.email),pair('Empresa',who.tenant_name),pair('Perfil',({owner:'Proprietário',manager:'Gerente',seller:'Vendedor',viewer:'Leitura'})[who.role]),button('Sair ou trocar de empresa',async()=>{await api('/auth/logout','POST');el('dialog').close();showLogin();}));
el('notifications').onclick=async()=>{try{const d=await api('/dashboard?days=30');modal('Alertas da operação',pair('Atividades em atraso',d.totals.overdue),...taskRows(d.next.filter(x=>x.due_at && new Date(x.due_at)<new Date())));}catch(err){status.textContent=err.message;}};
el('search').onsubmit=async e=>{e.preventDefault();try{const result=await api('/search?q='+encodeURIComponent(new FormData(e.target).get('q')));const kinds={leads:'Lead',contacts:'Contato',accounts:'Empresa',deals:'Oportunidade',activities:'Atividade'};modal('Resultados da busca',...(result.items.length?result.items.map(x=>pair(x.name,kinds[x.kind])):[empty('Nenhum registro encontrado.')]));}catch(err){status.textContent=err.message;}};
const extensions=document.querySelector('meta[name="crm-module"]');
if(extensions){const {createCrm}=await import('/crm.js');extension=createCrm({api,node,button,pair,panel,empty,modal,money,date,view,getUser:()=>who});}
try{await boot();}catch(error){showLogin();if(error.message!=='Entre para continuar.' && error.message!=='Sessão expirada ou inválida.')el('loginError').textContent=error.message;}
