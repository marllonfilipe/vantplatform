import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rdStationConfig,rdOrganizationsPreview,rdOrganizationsUrl,readRdStation} from '../src/rd-station.mjs';

test('RD Station CRM v2 consulta a primeira página no destino fixo',()=>{
  const url=rdOrganizationsUrl();
  assert.equal(url.origin,'https://api.rd.services');
  assert.equal(url.pathname,'/crm/v2/organizations');
  assert.deepEqual(Object.fromEntries(url.searchParams),{'page[number]':'1','page[size]':'50'});
  for(const access_token of [null,'','valor com espaço','x'.repeat(8193)]) {
    assert.throws(()=>rdStationConfig({access_token}),{code:'configuration'});
  }
});
test('RD Station CRM projeta empresas e sinaliza continuação sem expor links',()=>{
  const data=[{id:'crm-id',name:'Empresa de teste',custom_fields:{extra:true}}];
  assert.deepEqual(rdOrganizationsPreview({data,links:{next:'pagina-seguinte'}}),
    {organizations:[{id:'crm-id',name:'Empresa de teste'}],has_more:true});
  assert.deepEqual(rdOrganizationsPreview({data:[],links:{next:null}}),{organizations:[],has_more:false});
  for(const payload of [{},{data:[{id:'',name:'Sem ID'}]},{data:Array(51).fill(data[0])},{data,links:{next:42}}]) {
    assert.throws(()=>rdOrganizationsPreview(payload),{code:'upstream'});
  }
});

test('RD Station CRM envia autorização e lê empresas sem seguir redirecionamentos',async t=>{
  const token='token-de-teste';
  const request=t.mock.method(globalThis,'fetch',async ()=>Response.json({
    data:[{id:'empresa-1',name:'Empresa de teste'}],
    links:{next:null}
  }));
  assert.deepEqual(await readRdStation({token}),{
    organizations:[{id:'empresa-1',name:'Empresa de teste'}],
    has_more:false
  });
  assert.equal(request.mock.callCount(),1);
  const [url,options]=request.mock.calls[0].arguments;
  assert.equal(String(url),String(rdOrganizationsUrl()));
  assert.equal(options.headers.Authorization,'Bearer '+token);
  assert.equal(options.redirect,'error');
  assert.ok(options.signal instanceof AbortSignal);
});

test('RD Station CRM classifica falhas externas para a Central de integrações',async t=>{
  const request=t.mock.method(globalThis,'fetch');
  for(const [status,expected] of [
    [401,{status:502,code:'access'}],
    [403,{status:502,code:'access'}],
    [429,{status:503,code:'quota'}],
    [500,{status:502,code:'upstream'}]
  ]) {
    request.mock.mockImplementation(async ()=>new Response(null,{status}));
    await assert.rejects(readRdStation({token:'token-de-teste'}),expected);
  }
});
