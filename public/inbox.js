export function createInbox({api,node,button,pair,panel,empty,modal,date,view,getUser}){
 const base='/inbox/',manages=()=>['owner','manager'].includes(getUser().role);
 const allowed=c=>getUser().role!=='viewer'&&(manages()||!c?.owner_id||c.owner_id===getUser().id);
 let search='',priority='',tag='',cursor='',previous=[];
 function field(f,title,c=node('input')){const l=node('label',title);l.append(c);f.append(l);return c;}
 function select(rows,first){const n=node('select');if(first)n.add(new Option(first,''));for(const [k,v] of rows)n.add(new Option(v,k));return n;}
 async function all(path){let c,rows=[];do{const r=await api(path+(path.includes('?')?'&':'?')+'limit=100'+(c?'&cursor='+c:''));rows.push(...r.items);c=r.nextCursor;}while(c);return rows;}
 function form(title,build,save,after){
  const f=node('form',undefined,'stack'),note=node('p'),input=build(f),b=node('button','Salvar','primary');note.setAttribute('role','alert');f.append(b,note);
  f.onsubmit=async e=>{e.preventDefault();b.disabled=true;try{await save(input);document.getElementById('dialog').close();await after();}catch(err){note.textContent=err.message;}finally{b.disabled=false;}};modal(title,f);
 }
 function simple(title,fieldName,save,after){form(title,f=>{const i=field(f,fieldName);i.required=true;return i;},i=>save(i.value),after);}
 async function wa(){
  const instances=(await api(base+'instances')).items,bar=node('div',undefined,'toolbar');
  if(manages())bar.append(button('Cadastrar instância',()=>simple('Cadastrar instância','Nome da instância',label=>api(base+'instances','POST',{label}),()=>view('WhatsApp'))));
  const nodes=[bar];for(const i of instances){const url=base+'instances/'+i.id,controls=node('div',undefined,'toolbar');
   if(manages()){
    for(const [action,title] of [['activate','Configurar conexão'],['qr','Exibir QR Code'],['status','Consultar estado'],['restart','Reconectar'],['disconnect','Desconectar'],['remove','Excluir instância']]){
     controls.append(button(title,async()=>{async function run(){const r=await api(url+'/'+action,action==='status'?'GET':'POST',action==='status'?undefined:{});
      if(action==='qr'){if(r.qr){const image=node('img');image.src=r.qr;image.alt='QR Code de vinculação do WhatsApp';image.width=256;modal('Vincular aparelho',image,empty('Abra Aparelhos conectados no WhatsApp e escaneie o código.'));}else modal('Conexão',empty('Estado: '+r.state+'. Consulte novamente para renovar o QR Code.'));}
      else if(action==='status')modal(i.label,pair('Estado',r.state),pair('Número',r.phone??'Aguardando pareamento'));
      else{if(document.getElementById('dialog').open)document.getElementById('dialog').close();await view('WhatsApp');}}
      if(['remove','disconnect'].includes(action))modal(title,empty(i.label),button('Confirmar',run));else await run();}));
    }
   }nodes.push(panel(i.label,pair('Estado registrado',i.state),pair('Número',i.phone??'Aguardando pareamento'),controls));
  }if(!instances.length)nodes.push(empty('Nenhuma instância cadastrada.'));return nodes;
 }
 async function open(id,before){
  const url=base+'conversations/'+id;const [conv,msg,notes]=await Promise.all([api(url),api(url+'/messages?limit=40'+(before?'&before='+encodeURIComponent(before):'')),api(url+'/notes')]);
  const children=[pair('Telefone',conv.phone??'Indisponível'),pair('Prioridade',conv.priority),pair('Tags',conv.tags.join(', ')),button('Atualizar histórico',()=>open(id))];
  for(const m of [...msg.items].reverse()){const div=node('article',undefined,'panel');div.append(node('small',(m.from_me?'Enviada':'Recebida')+' · '+date(m.created_at)+' · '+m.state),node('p',m.body||m.kind));
   if(['audio','image','video','document'].includes(m.kind))div.append(button('Baixar '+(m.filename??m.kind),async()=>{const data=await api(url+'/messages/'+m.id);const a=document.createElement('a');a.download=data.filename;a.href=URL.createObjectURL(new Blob([Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0))]));a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}));children.push(div);}
  if(msg.before)children.push(button('Mensagens anteriores',()=>open(id,msg.before)));
  for(const pending of msg.outbox){children.push(pair(pending.body||pending.kind,pending.state));if(allowed(conv)&&pending.state==='queued')children.push(button('Enviar pendente',async()=>{await api(url+'/messages/'+pending.id,'POST',{});await open(id);}));}
  if(allowed(conv)){
   children.push(button('Enviar mensagem',()=>{const clientId=crypto.randomUUID();form('Mensagem para '+conv.name,f=>{
    const text=field(f,'Mensagem ou legenda',node('textarea')),file=field(f,'Anexo de até 4 MB');file.type='file';return {text,file};
   },async({text,file})=>{const attachment=file.files[0],body={clientId,kind:'text',text:text.value};
    if(attachment){if(attachment.size>4194304)throw Error('Limite de 4 MB.');const group=attachment.type.split('/')[0];body.kind=['audio','video','image'].includes(group)?group:'document';body.filename=attachment.name;body.mime=attachment.type||'application/octet-stream';
     body.base64=await new Promise((ok,fail)=>{const r=new FileReader();r.onload=()=>ok(r.result.split(',')[1]);r.onerror=fail;r.readAsDataURL(attachment);});}
    const saved=await api(url+'/messages','POST',body);const result=await api(url+'/messages/'+saved.id,'POST',{});if(result.state!=='sent')throw Error('Estado do envio: '+result.state);
   },()=>open(id));}),button('Adicionar nota interna',()=>simple('Nova nota','Nota interna',body=>api(url+'/notes','POST',{body}),()=>open(id))),
   button('Editar atendimento',async()=>{const keys=['lead_id','contact_id','account_id',...(manages()?['owner_id']:[])],kinds={lead_id:'leads',contact_id:'contacts',account_id:'accounts',owner_id:'members'},names={lead_id:'Lead',contact_id:'Contato',account_id:'Empresa',owner_id:'Responsável'},lists={};await Promise.all(keys.map(async k=>lists[k]=await all('/crm/'+kinds[k])));
    form('Editar atendimento',f=>{const controls={};for(const k of keys){const n=select(lists[k].map(x=>[x.id,x.name]),'Selecione');n.value=conv[k]??'';controls[k]=field(f,names[k],n);}
     const pr=select([['normal','Normal'],['high','Alta'],['urgent','Urgente']]);pr.value=conv.priority;controls.priority=field(f,'Prioridade',pr);controls.tags=field(f,'Tags separadas por vírgula');controls.tags.value=conv.tags.join(', ');return controls;},
     c=>api(url,'PATCH',Object.fromEntries(Object.entries(c).map(([k,v])=>[k,k==='tags'?v.value.split(',').map(s=>s.trim()).filter(Boolean):v.value||null]))),()=>open(id));}));
   if(!conv.lead_id)children.push(button('Criar lead da conversa',async()=>{await api('/crm/conversations/'+id+'/lead','POST',{});await open(id);}));
  }
  children.push(node('h3','Notas internas'),...notes.items.map(n=>pair(n.body,n.author+' · '+date(n.created_at))));modal(conv.name,...children);
 }
 async function inbox(){
  const filter=node('form',undefined,'toolbar'),q=field(filter,'Buscar por nome ou telefone'),t=field(filter,'Tag'),p=field(filter,'Prioridade',select([['normal','Normal'],['high','Alta'],['urgent','Urgente']],'Todas'));q.value=search;t.value=tag;p.value=priority;
  filter.append(node('button','Filtrar'));filter.onsubmit=e=>{e.preventDefault();search=q.value;tag=t.value;priority=p.value;cursor='';previous=[];view('Caixa de entrada');};
  const list=await api(base+'conversations?'+new URLSearchParams({q:search,tag,priority,limit:30,...(cursor?{cursor}:{})}));
  const bar=node('div',undefined,'toolbar');bar.append(button('Atualizar',()=>view('Caixa de entrada')));if(allowed())bar.append(button('Nova conversa',async()=>{const inst=(await api(base+'instances')).items;
   form('Nova conversa',f=>{const i=field(f,'Instância',select(inst.map(x=>[x.id,x.label]),'Selecione'));i.required=true;const phone=field(f,'Número com DDI e DDD');phone.required=true;return {instance:i,phone,name:field(f,'Nome do contato')};},c=>api(base+'conversations','POST',{instanceId:c.instance.value,phone:c.phone.value,name:c.name.value}),()=>view('Caixa de entrada'));}));
  const rows=list.items.map(c=>button(c.name+' · '+(c.phone??'WhatsApp'),()=>open(c.id)));if(previous.length)bar.append(button('Anterior',()=>{cursor=previous.pop();return view('Caixa de entrada');}));if(list.nextCursor)bar.append(button('Próxima página',()=>{previous.push(cursor);cursor=list.nextCursor;return view('Caixa de entrada');}));
  return [filter,bar,panel('Conversas do WhatsApp',...(rows.length?rows:[empty('Nenhuma conversa nos filtros atuais.')]))];
 }
 return {page:name=>name==='WhatsApp'?wa():inbox()};
}
