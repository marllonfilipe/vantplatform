export function createMemoryPage({api, node, button, panel, empty, modal, view, getUser}) {
  const name = 'Memória comercial';
  const endpoint = '/core/documents';
  function field(form, label, control) {
    const text = node('label', label);
    text.append(control);
    form.append(text);
    control.required = true;
    return control;
  }
  function submit(form, label, action) {
    const save = node('button', label, 'primary');
    const status = node('p');
    status.setAttribute('role','status');
    form.append(save, status);
    form.onsubmit = async event => {
      event.preventDefault();
      save.disabled = true;
      status.textContent = 'Processando…';
      try { await action(); status.textContent = ''; }
      catch (error) { status.textContent = error.message; }
      finally { save.disabled = false; }
    };
  }
  async function refresh() {
    document.getElementById('dialog').close();
    await view(name);
  }
  function edit(record) {
    const form = node('form', undefined, 'stack');
    const title = field(form,'Título',node('input'));
    title.value = record?.title ?? '';
    title.maxLength = 180;
    const content = field(form,record ? 'Novo texto integral' : 'Texto do documento',node('textarea'));
    content.rows = 8;
    content.maxLength = 12000;
    submit(form,'Indexar documento',async () => {
      const data = {title:title.value, content:content.value};
      await api(record ? endpoint+'/'+record.id : endpoint, record ? 'PUT' : 'POST', data);
      await refresh();
    });
    modal(record ? 'Substituir documento' : 'Adicionar documento', form);
  }
  function remove(record) {
    const form = node('form',undefined,'stack');
    form.append(node('p','Excluir “'+record.title+'” e seus trechos da busca?'));
    submit(form,'Confirmar exclusão',async () => {
      await api(endpoint+'/'+record.id,'DELETE');
      await refresh();
    });
    modal('Excluir documento',form);
  }
  return async function page() {
    const manages = ['owner','manager'].includes(getUser().role);
    const {items} = await api(endpoint);
    const form = node('form',undefined,'stack');
    const query = field(form,'Pesquisar na memória comercial',node('input'));
    query.maxLength = 320;
    const results = node('div');
    results.setAttribute('aria-live','polite');
    submit(form,'Buscar trechos',async () => {
      results.replaceChildren();
      const hits = await api('/core/search','POST',{query:query.value});
      results.replaceChildren(...(hits.items.length ? hits.items.map(hit=>panel(hit.title,node('p',hit.content))) : [empty('Nenhum trecho encontrado.')]));
    });
    const list = items.map(record => {
      const row = node('div',undefined,'row');
      row.append(node('span',record.title));
      if (manages) row.append(button('Substituir',()=>edit(record)),button('Excluir',()=>remove(record)));
      return row;
    });
    const documents = panel('Documentos recentes',...(list.length ? list : [empty('Nenhum documento indexado.')]));
    if (manages) documents.prepend(button('Adicionar documento',()=>edit()));
    return [documents,panel('Busca semântica',form,results)];
  };
}
