import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pipedriveConfig,organizationsUrl,organizationPreview} from '../src/pipedrive.mjs';

test('A consulta utiliza somente o subdomínio privado e mantém a credencial fora da URL',()=>{
  const config=pipedriveConfig({company_domain:'exemplo-br',api_token:'teste-local'});
  assert.equal(organizationsUrl(config).href,'https://exemplo-br.pipedrive.com/api/v2/organizations?limit=50');
  for(const company_domain of ['',null,'sub.outro','url:443','https://destino','/rota','a@b','-h','h-','x'.repeat(64)]){
    assert.throws(()=>pipedriveConfig({company_domain,api_token:'teste-local'}),{code:'configuration'});
  }
  assert.throws(()=>pipedriveConfig({company_domain:'exemplo',api_token:'a b'}),{code:'configuration'});
});

test('As organizações expõem somente ID e nome e sinalizam a próxima página',()=>{
  const data=[{id:42,name:'Loja Exemplo',owner_id:123,address:'fora da prévia'}];
  assert.deepEqual(organizationPreview({success:true,data,additional_data:{next_cursor:'proxima'}}),
    {organizations:[{id:42,name:'Loja Exemplo'}],has_more:true});
  assert.deepEqual(organizationPreview({success:true,data:[],additional_data:{next_cursor:null}}),{organizations:[],has_more:false});
  for(const payload of [{success:false,data:[]},{success:true,data:null},{success:true,data:[{id:0,name:'Nome'}]},
    {success:true,data:[{id:1,name:{}}]},{success:true,data:Array(51).fill(data[0])}]){
    assert.throws(()=>organizationPreview(payload),{code:'upstream'});
  }
});
