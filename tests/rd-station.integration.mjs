import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rdStationConfig,rdOrganizationsPreview,rdOrganizationsUrl} from '../src/rd-station.mjs';

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
