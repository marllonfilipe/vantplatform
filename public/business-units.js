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
 async function load(cursor){
  const data=await api('/business-units?limit=20'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
  for(const row of data.items)list.append(panel(row.name,pair('Tipo',kinds[row.kind]),button('Editar unidade',()=>edit(row))));
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
