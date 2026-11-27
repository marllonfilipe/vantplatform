import {test} from 'node:test';
import assert from 'node:assert/strict';
import {companiesPreview,companiesUrl} from '../src/hubspot.mjs';

test('Prévia de empresas limita registros e campos retornados',()=>{
  const url=companiesUrl();
  assert.equal(url.origin,'https://api.hubapi.com');
  assert.equal(url.pathname,'/crm/objects/2026-09/companies');
  assert.deepEqual(Object.fromEntries(url.searchParams),{limit:'50',properties:'name,domain',archived:'false'});
  const record={id:'82',properties:{name:'  Loja  ',domain:'loja.example',phone:'campo fora da prévia'}};
  const preview=companiesPreview({results:[record,{properties:{}},{archived:true}],paging:{next:{after:'83'}}});
  assert.deepEqual(preview,{companies:[{name:'Loja',domain:'loja.example'},{name:null,domain:null}],has_more:true});
  assert.deepEqual(companiesPreview({results:[]}),{companies:[],has_more:false});
  for(const input of [{},{results:[{}]},{results:[{properties:{name:{}}}]},{results:Array(51).fill(record)}]){
    assert.throws(()=>companiesPreview(input),{code:'upstream'});
  }
});
