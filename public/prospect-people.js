export function createProspectPeople({api,node,button,panel,empty,modal,date,getUser,openLead,createContact}){
 async function all(path){
  const items=[];let cursor='';
  do{
   const query=(path.includes('?')?'&':'?')+'limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):'');
   const page=await api(path+query);items.push(...page.items);cursor=page.nextCursor;
  }while(cursor);
  return items;
 }
 function input(form,label,type,value,required){
  const wrap=node('label',label),control=node('input');control.type=type;
  if(type==='checkbox')control.checked=Boolean(value);else control.value=value??'';
  control.required=required;wrap.append(control);form.append(wrap);return control;
 }
 function formAction(form,label,action){
  const save=node('button',label,'primary'),feedback=node('p');feedback.setAttribute('role','alert');form.append(save,feedback);
  form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{await action();}catch(error){feedback.textContent=error.message;}finally{save.disabled=false;}};
 }
 return async function show(profilePath,profile,account){
  const base=profilePath+'/targets/'+account.id,write=getUser().role!=='viewer';
  const [people,handoff,leads,briefs]=await Promise.all([all(base+'/people'),api(base+'/handoff'),all('/crm/leads?account_id='+account.id),api(base+'/briefs')]);
  people.sort((a,b)=>Number(b.decision_maker)-Number(a.decision_maker)||Number(b.role_matches)-Number(a.role_matches)||a.name.localeCompare(b.name,'pt-BR'));
  const parts=[],back=()=>show(profilePath,profile,account);
  function edit(person){
   const form=node('form',undefined,'stack');
   const title=input(form,'Cargo informado','text',person.title,true);title.maxLength=250;
   const maker=input(form,'Decisor confirmado pela fonte','checkbox',person.decision_maker,false);
   const link=input(form,'Perfil profissional no LinkedIn (opcional)','url',person.linkedin_url,false);
   const source=input(form,'Fonte das informações','text',person.source_reference,true);source.maxLength=500;
   const verified=input(form,'Data da informação','date',person.observed_on,true);
   const paste=node('details'),pasteLabel=node('label','Texto fornecido pela fonte'),raw=node('textarea'),notice=node('p');
   notice.setAttribute('role','status');pasteLabel.append(raw);
   paste.append(node('summary','Preencher a partir de texto autorizado'),node('p','Cole linhas com Cargo, Perfil, Fonte ou Data, seguidas de dois-pontos. Revise os campos antes de registrar.'),pasteLabel);
   const controls={cargo:title,perfil:link,fonte:source,data:verified};
   paste.append(button('Preencher campos para revisão',()=>{
    let count=0;
    for(const line of raw.value.split(/\r?\n/)){
     const split=line.indexOf(':');if(split<1)continue;
     const key=line.slice(0,split).trim().toLocaleLowerCase('pt-BR'),value=line.slice(split+1).trim();
     if(!Object.hasOwn(controls,key)||!value)continue;
     if(key==='data'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))continue;
     controls[key].value=value;count++;
    }
    notice.textContent=count?'Campos preenchidos para revisão: '+count+'.':'Nenhum campo reconhecido.';
   }),notice);
   form.append(paste);
   formAction(form,'Registrar informações',async()=>{
    await api(base+'/people/'+person.id,'PUT',{expected_revision:person.revision,title:title.value,decision_maker:maker.checked,linkedin_url:link.value,source_reference:source.value,observed_on:verified.value});
    await back();
   });
   modal(person.name,form);
  }
  const guidance=node('div',undefined,'stack');
  if(write){
   const generate=button('Analisar abordagem',async()=>{
    generate.disabled=true;
    try{await api(base+'/briefs','POST',{});await back();}finally{generate.disabled=false;}
   });guidance.append(generate);
  }
  for(const [index,brief] of briefs.items.entries()){
   const d=node('details');d.open=index===0;const r=brief.result;
   d.append(node('summary',r.signal+' · '+date(brief.created_at)),node('p',r.approach),node('p','Aderência: '+r.fit_score+'/100 · Oportunidades abertas: '+r.pipeline.open),node('p','Fonte da conta: '+r.source_reference));
   for(const p of r.candidates)d.append(node('p',p.name+' · '+(p.title??'cargo não informado')+' · '+(p.decision_maker?'decisor registrado':'cargo a validar')+(p.source_reference?' · '+p.source_reference:'')));
   d.append(node('p','Contatos avaliados: '+r.reviewed+' de '+r.total_contacts));guidance.append(d);
  }
  if(write||briefs.items.length)parts.push(panel('Sugestão de abordagem',guidance));
  for(const person of people){
   const info=[node('p',person.title??'Cargo não informado')];
   if(person.decision_maker)info.push(node('p','Decisor registrado no CRM'));
   else if(person.role_matches)info.push(node('p','Cargo compatível com o perfil · confirmar participação na decisão'));
   if(person.source_reference)info.push(node('p',person.source_reference+' · '+person.observed_on));
   if(person.linkedin_url){const link=node('a','Abrir perfil no LinkedIn');link.href=person.linkedin_url;link.target='_blank';link.rel='noopener noreferrer';info.push(link);}
   if(write)info.push(button('Registrar fonte e perfil',()=>edit(person)));
   if(person.revision)info.push(button('Histórico do contato',async()=>{
    const versions=await all(base+'/people/'+person.id+'/history');
    modal(person.name,...versions.map(h=>panel('Revisão '+h.revision,node('p',h.snapshot.title+' · '+h.snapshot.source_reference),node('p','Data da fonte: '+h.snapshot.observed_on+' · registro: '+date(h.recorded_at)),node('p',h.snapshot.decision_maker?'Decisor confirmado':'Decisão não confirmada'))),button('Voltar à conta',back));
   }));
   parts.push(panel(person.name,...info));
  }
  if(!people.length)parts.push(empty('Nenhum contato vinculado à empresa no CRM.'));
  if(profile.target_role)parts.unshift(node('p','Cargo procurado: '+profile.target_role));
  if(write)parts.push(button('Cadastrar contato no CRM',()=>createContact(account.id)));
  if(handoff.conversion)parts.push(button('Abrir lead vinculado',()=>openLead(handoff.conversion.lead_id)));
  else if(write){
   const form=node('form',undefined,'stack'),wrap=node('label'),choice=node('select');
   if(leads.length){
    wrap.append('Lead da empresa',choice);
    const allowed=leads.filter(l=>getUser().role!=='seller'||l.owner_id===getUser().id);
    for(const lead of allowed)choice.add(new Option(lead.name,lead.id));
    if(!allowed.length){parts.push(node('p','O vínculo requer o responsável pelo lead ou um gestor.'));modal(account.name,...parts);return;}
   }else{
    wrap.append('Contato para o novo lead',choice);choice.add(new Option('Usar nome da empresa',''));
    for(const person of people)choice.add(new Option(person.name,person.id));
   }
   form.append(wrap);formAction(form,leads.length?'Vincular lead existente':'Criar lead no CRM',async()=>{
    await api(base+'/handoff','POST',leads.length?{lead_id:choice.value}:{contact_id:choice.value||null});await back();
   });
   parts.push(panel('Passagem para o CRM',form));
  }
  modal(account.name,...parts);
 };
}
