import {createProspectPeople} from './prospect-people.js';
export function createProspectingPage({api,node,button,panel,empty,modal,date,view,getUser,openAccount,openLead,createContact}){
 const people=createProspectPeople({api,node,button,panel,empty,modal,date,getUser,openLead,createContact});
 const page='Prospecção',base='/prospecting/profiles';
 const labels={segment:'Segmento',region:'Região',size_band:'Porte',business_activity:'Atividade econômica'};
 let profileId='',mode='accounts',query='',cursor='',previous=[];
 function resetPages(){cursor='';previous=[];}
 function field(form,label,value,max,required=false){
  const wrap=node('label',label),input=node('input');input.value=value??'';input.maxLength=max;input.required=required;
  wrap.append(input);form.append(wrap);return input;
 }
 function submit(form,caption,save){
  const action=node('button',caption,'primary'),feedback=node('p');feedback.setAttribute('role','alert');form.append(action,feedback);
  form.onsubmit=async event=>{
   event.preventDefault();action.disabled=true;
   try{await save();document.getElementById('dialog').close();resetPages();await view(page);}
   catch(error){feedback.textContent=error.message;}finally{action.disabled=false;}
  };
 }
 function edit(profile){
  const form=node('form',undefined,'stack'),name=field(form,'Nome do perfil',profile?.name,120,true),inputs={};
  for(const [key,label] of Object.entries(labels))inputs[key]=field(form,label,profile?.[key],250);
  const role=field(form,'Cargo procurado (opcional)',profile?.target_role,250);
  submit(form,'Salvar perfil',async()=>{
   const data={name:name.value,target_role:role.value.trim()||null};for(const [key,input] of Object.entries(inputs))data[key]=input.value.trim()||null;
   if(profile)data.expected_revision=profile.revision;
   const saved=await api(profile?base+'/'+profile.id:base,profile?'PUT':'POST',data);
   profileId=saved.id;mode='accounts';query='';
  });
  modal(profile?'Editar perfil de cliente ideal':'Criar perfil de cliente ideal',form);
 }
 function selectTarget(path,account){
  const form=node('form',undefined,'stack'),source=field(form,'Fonte da seleção',null,500,true);
  submit(form,'Salvar empresa-alvo',()=>api(path+'/targets/'+account.id,'PUT',{source_reference:source.value}));
  modal('Selecionar '+account.name,form);
 }
 function csvImport(path){
  const form=node('form',undefined,'stack'),fileLabel=node('label','Arquivo CSV'),file=node('input');
  file.type='file';file.accept='.csv,text/csv';fileLabel.append(file);
  const label=node('label','Conteúdo CSV'),content=node('textarea');content.required=true;label.append(content);
  const feedback=node('p');feedback.setAttribute('role','alert');
  file.onchange=async()=>{
   try{const item=file.files[0];if(!item)return;if(item.size>512000)throw Error('Use um arquivo de até 500 KB.');content.value=await item.text();feedback.textContent='';}
   catch(error){feedback.textContent=error.message;}
  };
  const send=node('button','Importar para a lista','primary');
  form.append(node('p','Colunas obrigatórias: nome, cnpj, fonte. Opcionais: site, segmento, região, porte e atividade.'),fileLabel,label,send,feedback);
  form.onsubmit=async event=>{
   event.preventDefault();send.disabled=true;
   try{
    const r=await api(path+'/import','POST',{csv:content.value});
    mode='targets';query='';resetPages();await view(page);
    const details=[node('p',r.processed+' registros · '+r.created+' empresas criadas · '+r.reused+' reutilizações · '+r.selected+' novas seleções')];
    for(const item of r.unchanged_values)details.push(node('p','Registro '+item.row+' · campos preservados no CRM: '+item.fields.map(k=>({name:'nome',website:'site',location:'região',size_band:'porte',segment:'segmento',business_activity:'atividade'}[k]??k)).join(', ')));
    modal('Resultado da importação',...details);
   }catch(error){feedback.textContent=error.message;}finally{send.disabled=false;}
  };
  modal('Importar empresas de fonte autorizada',form);
 }
 function removeTarget(path,account){
  const form=node('form',undefined,'stack');
  submit(form,'Remover da lista',()=>api(path+'/targets/'+account.id,'DELETE'));
  modal('Remover '+account.name+' desta lista?',form);
 }
 return async function render(){
  const user=getUser(),manager=['owner','manager'].includes(user.role),profiles=[];
  let after='';
  do{
   const response=await api(base+'?limit=100'+(after?'&cursor='+after:''));
   profiles.push(...response.items);after=response.nextCursor;
  }while(after);
  const bar=node('div',undefined,'toolbar');
  if(manager)bar.append(button('Criar perfil',()=>edit()));
  if(!profiles.length)return [bar,empty('Nenhum perfil de cliente ideal cadastrado.')];
  profiles.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.id.localeCompare(b.id));
  const profile=profiles.find(p=>p.id===profileId)??profiles[0];
  if(profileId!==profile.id){profileId=profile.id;resetPages();query='';mode='accounts';}
  const picker=node('select');picker.setAttribute('aria-label','Perfil de cliente ideal');
  for(const p of profiles)picker.add(new Option(p.name,p.id));picker.value=profileId;
  picker.onchange=()=>{profileId=picker.value;mode='accounts';query='';resetPages();view(page);};
  bar.prepend(picker);
  if(manager)bar.append(button('Editar perfil',()=>edit(profile)));
  if(user.role!=='viewer')bar.append(button('Importar empresas',()=>csvImport(base+'/'+profile.id)));
  const criteria=node('p',Object.entries(labels).filter(([k])=>profile[k]).map(([k,label])=>label+' · '+profile[k]).join(' | '));
  const filters=node('form',undefined,'toolbar'),list=node('select');list.setAttribute('aria-label','Lista de prospecção');
  list.add(new Option('Empresas com os critérios do perfil','accounts'));list.add(new Option('Empresas-alvo selecionadas','targets'));list.add(new Option('Prioridade das empresas-alvo','priority'));list.value=mode;
  list.onchange=()=>{mode=list.value;resetPages();view(page);};
  const input=node('input');input.setAttribute('aria-label','Pesquisar empresa pelo nome');input.placeholder='Pesquisar empresa pelo nome';input.maxLength=250;input.value=query;
  filters.append(list,input,node('button','Pesquisar'));filters.onsubmit=e=>{e.preventDefault();query=input.value.trim();resetPages();view(page);};
  const path=base+'/'+profile.id,params=new URLSearchParams({limit:'25',q:query});if(cursor)params.set('cursor',cursor);
  const result=await api(path+'/'+mode+'?'+params),cards=[];
  for(const account of result.items){
   if(mode==='priority'){
    const parts=[node('p','Fonte da seleção: '+account.source_reference)];
    if(account.result){
     parts.push(node('p',account.result.classification+' · '+account.score+'/100'),node('p',account.result.approach));
     const evidence=node('details');evidence.append(node('summary','Critérios da classificação'));
     const methods={missing:'sem dado',match:'critério atendido',semantic:'similaridade semântica',different:'critério não atendido'};
     for(const c of account.result.criteria)evidence.append(node('p',labels[c.key]+' · perfil: '+c.wanted+' · empresa: '+(c.observed??'não informado')+' · '+methods[c.method]+' · '+c.points+'/100'));
     evidence.append(node('p',date(account.created_at)+(account.model_version?' · modelo '+account.model_version:' · critérios estruturados')));
     parts.push(evidence);
    }else{
     parts.push(node('p','Sem classificação para os dados atuais.'));
     if(user.role!=='viewer'){
      const assess=button('Classificar aderência',async()=>{
       assess.disabled=true;assess.textContent='Classificando…';
       try{await api(path+'/targets/'+account.id+'/assess','POST',{});resetPages();await view(page);}
       finally{assess.disabled=false;assess.textContent='Classificar aderência';}
      });
      parts.push(assess);
     }
    }
    parts.push(button('Decisores e conversão',()=>people(path,profile,account)));
    parts.push(button('Abrir empresa no CRM',()=>openAccount(account.id)));
    cards.push(panel(account.name,...parts));continue;
   }
   const details=[node('p',[account.segment,account.location,account.size_band,account.business_activity].filter(Boolean).join(' · ')),node('p','Decisores registrados: '+account.decision_makers)];
   if(account.selected_at)details.push(node('p','Fonte da seleção: '+account.source_reference),node('p','Selecionada em '+date(account.selected_at)));
   const sources=account.recent_sources.filter(v=>v!==account.source_reference);
   if(sources.length){const refs=node('details');refs.append(node('summary','Outras fontes registradas'));for(const ref of sources)refs.append(node('p',ref));details.push(refs);}
   if(account.selected_at)details.push(button('Decisores e conversão',()=>people(path,profile,account)));
   details.push(button('Abrir empresa no CRM',()=>openAccount(account.id)));
   if(user.role!=='viewer'){
    if(!account.selected_at)details.push(button('Selecionar empresa',()=>selectTarget(path,account)));
    else if(mode==='targets')details.push(button('Remover da lista',()=>removeTarget(path,account)));
   }
   cards.push(panel(account.name,...details));
  }
  const nav=node('div',undefined,'toolbar');
  if(previous.length)nav.append(button('Página anterior',()=>{cursor=previous.pop();return view(page);}));
  if(result.nextCursor)nav.append(button('Próxima página',()=>{previous.push(cursor);cursor=result.nextCursor;return view(page);}));
  return [bar,criteria,filters,...(cards.length?cards:[empty(mode==='targets'?'Nenhuma empresa selecionada.':'Nenhuma empresa corresponde aos critérios.')]),nav];
 };
}
