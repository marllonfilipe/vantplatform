export function createMemoryPage({api, node, button, panel, empty, modal, view, getUser}) {
  const name = 'Memória comercial';
  const endpoint = '/core/documents';
  const versioned=record=>endpoint+'/'+record.id+'?revision='+encodeURIComponent(record.revision);
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
    const category = field(form,'Categoria',node('select'));
    category.add(new Option('Documento de referência','reference'));
    category.add(new Option('Oferta do catálogo','offer'));
    category.value = record?.category ?? 'reference';
    const content = field(form,record ? 'Novo texto integral' : 'Texto do documento',node('textarea'));
    content.rows = 8;
    content.maxLength = 12000;
    submit(form,'Indexar documento',async () => {
      const data = {title:title.value, content:content.value, category:category.value};
      await api(record ? versioned(record) : endpoint, record ? 'PUT' : 'POST', data);
      await refresh();
    });
    modal(record ? 'Substituir documento' : 'Adicionar documento', form);
  }
  function remove(record) {
    const form = node('form',undefined,'stack');
    form.append(node('p','Excluir “'+record.title+'” e seus trechos da busca?'));
    submit(form,'Confirmar exclusão',async () => {
      await api(versioned(record),'DELETE');
      await refresh();
    });
    modal('Excluir documento',form);
  }
  return async function page() {
    const manages = ['owner','manager'].includes(getUser().role);
    const first = await api(endpoint);
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
    const documents=panel('Documentos recentes');
    function appendPage(page) {
      for (const record of page.items) {
        const row=node('div',undefined,'row');
        row.append(node('span',record.title));
        if (manages) row.append(button('Substituir',()=>edit(record)),button('Excluir',()=>remove(record)));
        documents.append(row);
      }
      if (page.nextCursor) {
        const more=button('Ver documentos anteriores',async()=>{
          more.disabled=true;
          try {
            const next=await api(endpoint+'?cursor='+encodeURIComponent(page.nextCursor));
            more.remove();
            appendPage(next);
          } finally {more.disabled=false;}
        });
        documents.append(more);
      }
    }
    appendPage(first);
    if (!first.items.length) documents.append(empty('Nenhum documento indexado.'));
    if (manages) documents.prepend(button('Adicionar documento',()=>edit()));
    const sections = [documents,panel('Busca semântica',form,results)];
    if (manages) {
      const metrics = await api('/core/metrics?days=30');
      const rows = metrics.items.map(item => {
        const group = item.subject_kind === 'lead' ? 'Leads' : 'Oportunidades';
        return node('p',group+' · '+item.runs+' análises · mediana '+item.p50_ms+' ms · p95 '+item.p95_ms+' ms · '+item.model_version);
      });
      sections.push(panel('Inferência nas análises dos últimos 30 dias',...(rows.length ? rows : [empty('Nenhuma análise registrada no período.')])));
    }
    return sections;
  };
}
