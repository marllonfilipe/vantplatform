import {test} from 'node:test';
import assert from 'node:assert/strict';
import {kommoConfig,kommoCompaniesUrl,kommoCompaniesPreview} from '../src/kommo.mjs';

test('Kommo limita a consulta ao subdomínio autorizado e mantém o token fora da URL',()=>{
  const config=kommoConfig({subdomain:'empresa-teste',access_token:'local-fixture'});
  const url=kommoCompaniesUrl(config);
  assert.equal(url.href,'https://empresa-teste.kommo.com/api/v4/companies?page=1&limit=50');
  for(const subdomain of ['','empresa.com','https://outro','a/b','-empresa','empresa-']) {
    assert.throws(()=>kommoConfig({subdomain,access_token:'local-fixture'}),{code:'configuration'});
  }
});
test('Kommo limita a prévia a ID e nome e trata uma página vazia',()=>{
  const companies=[{id:12,name:'Exemplo',custom_fields_values:['extra']}];
  assert.deepEqual(kommoCompaniesPreview({_embedded:{companies},_links:{next:{href:'outra-pagina'}}}),
    {companies:[{id:12,name:'Exemplo'}],has_more:true});
  assert.deepEqual(kommoCompaniesPreview(undefined),{companies:[],has_more:false});
  assert.deepEqual(kommoCompaniesPreview({_embedded:{companies:[]}}),{companies:[],has_more:false});
  for(const payload of [null,{}, {_embedded:{companies:Array(51).fill(companies[0])}}, {_embedded:{companies:[{id:0,name:'X'}]}}]) {
    assert.throws(()=>kommoCompaniesPreview(payload),{code:'upstream'});
  }
});
