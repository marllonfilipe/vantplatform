const kinds={branch:'Filial',department:'Departamento',commercial:'Unidade comercial'};
export function unitPage({api,node,panel,empty,button,pair,modal,view}){
 const list=node('div');
 function edit(row){
  const form=node('form',undefined,'stack'),name=node('input'),kind=node('select'),note=node('p');
  const id=row?.id??crypto.randomUUID();
  name.value=row?.name??'';name.maxLength=100;name.required=true;
  for(const [key,value] of Object.entries(kinds))kind.add(new Option(value,key));
  kind.value=row?.kind??'branch';
  for(const [label,control] of [['Nome da unidade',name],['Tipo de unidade',kind]]){
   const field=node('label',label);field.append(control);form.append(field);
  }
  const save=node('button','Salvar unidade');note.setAttribute('role','alert');form.append(save,note);
  form.onsubmit=async event=>{
   event.preventDefault();save.disabled=true;
   try{
    const body={name:name.value,kind:kind.value};
    if(row)await api('/business-units/'+id,'PATCH',{...body,revision:row.revision});
    else await api('/business-units','POST',{...body,id});
    document.getElementById('dialog').close();await view('Unidades');
   }catch(error){note.textContent=error.message;}
   finally{save.disabled=false;}
  };
  modal(row?'Editar unidade':'Cadastrar unidade',form);
 }
 async function manageTeams(unit){
  const route='/business-units/'+unit.id+'/teams';
  const list=node('div'),note=node('p');
  note.setAttribute('role','status');
  modal('Equipes · '+unit.name,list,note);
  async function read(cursor){
   const page=await api(route+'?limit=20'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
   for(const team of page.items){
    const row=node('div',undefined,'row');
    function render(assigned){
     const action=button(assigned?'Desvincular':'Vincular',async()=>{
      action.disabled=true;
      try{
       if(assigned)await api(route+'/'+team.id,'DELETE');
       else await api(route+'/'+team.id,'PUT',{});
       render(!assigned);
       note.textContent=assigned?'Equipe desvinculada.':'Equipe vinculada.';
      }catch(error){note.textContent=error.message;}finally{action.disabled=false;}
     });
     row.replaceChildren(pair(team.name,assigned?'Nesta unidade':'Sem unidade'),action);
    }
    render(team.unit_id!==null);list.append(row);
   }
   if(!page.items.length&&!cursor)list.append(empty('Nenhuma equipe disponível nesta unidade.'));
   if(page.nextCursor){
    const more=button('Mais equipes',async()=>{
     more.disabled=true;try{await read(page.nextCursor);more.remove();}finally{more.disabled=false;}
    });list.append(more);
   }
  }
  try{await read(null);}catch(error){note.textContent=error.message;}
 }
 async function load(cursor){
  const data=await api('/business-units?limit=20'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
  for(const row of data.items)list.append(panel(row.name,pair('Tipo',kinds[row.kind]),button('Editar unidade',()=>edit(row)),button('Gerenciar equipes',()=>manageTeams(row))));
  if(!data.items.length&&!cursor)list.append(empty('Nenhuma unidade cadastrada.'));
  if(data.nextCursor){
   const more=button('Mais unidades',async()=>{
    more.disabled=true;
    try{await load(data.nextCursor);more.remove();}finally{more.disabled=false;}
   });
   list.append(more);
  }
 }
 return load(null).then(()=>[button('Cadastrar unidade',()=>edit()),list]);
}
