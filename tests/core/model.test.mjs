import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {embed,model,stopInference} from '../../src/inference.mjs';
after(stopInference);
test('pesos locais em CPU distinguem conteúdo comercial de assunto alheio',async()=>{
 const {vectors,latencyMs}=await embed(['Prazo para pagar uma fatura','Qual é o prazo de pagamento da fatura?','Ciclo da água na floresta tropical']);
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 assert.equal(vectors[0].length,model.dimensions);assert.ok(dot(vectors[0],vectors[1])>dot(vectors[0],vectors[2]));
 assert.ok(Math.abs(dot(vectors[0],vectors[0])-1)<0.001);assert.ok(latencyMs>0);
 console.log('Inferência real em CPU para três textos:',latencyMs,'ms');
});

test('fila de CPU processa quatro consultas concorrentes por rodada',async()=>{
 const samples=[];
 const query='Quais as condições de pagamento e a validade da proposta comercial?';
 await embed([query]);
 for(let round=0;round<6;round++){
  const batch=await Promise.all(Array.from({length:4},()=>embed([query])));
  for(const sample of batch){
   assert.equal(sample.vectors[0].length,model.dimensions);
   samples.push(sample.latencyMs);
  }
 }
 samples.sort((a,b)=>a-b);
 const percentile=p=>samples[Math.ceil(samples.length*p)-1];
 console.log(JSON.stringify({scenario:'cpu-queue',requests:samples.length,concurrency:4,p50_ms:percentile(0.5),p95_ms:percentile(0.95),max_ms:samples.at(-1)}));
});
