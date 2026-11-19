import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const {VANT_TEST_ORIGIN:origin,VANT_TEST_TENANT:tenantId,VANT_TEST_EMAIL:email,VANT_TEST_PASSWORD:password,
 VANT_TEST_INSTANCE:instanceId,VANT_TEST_PHONE:phone}=process.env;
if(!origin||!tenantId||!email||!password||!instanceId||!phone)throw Error('Configure o ambiente privado de homologação.');
if(new URL(origin).origin!==origin||!origin.startsWith('https://')||!/^\d{7,15}$/.test(phone))throw Error('Origem HTTPS ou telefone de homologação inválido.');
let cookie;
async function request(path,method='GET',body){
 const r=await fetch(origin+'/api/v1/'+path,{method,redirect:'error',signal:AbortSignal.timeout(25000),
 headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 if(!r.ok)throw Error('Falha na etapa de homologação. HTTP '+r.status+'.');
 if(path==='auth/login')cookie=r.headers.get('set-cookie')?.split(';')[0];
 return r.status===204?null:r.json();
}
const route='inbox/instances/'+instanceId;
async function awaitOpen(){
 for(let n=0;n<36;n++){const state=await request(route+'/status');if(state.state==='open')return;await delay(5000);}
 throw Error('A instância de homologação não reconectou no prazo.');
}
await request('auth/login','POST',{tenantId,email,password});
try{
 const state=await request(route+'/status');assert.equal(state.state,'open','É necessário parear antes do teste.');
 console.log('Instância de homologação conectada.');
 await request(route+'/restart','POST',{});await awaitOpen();console.log('Reconexão confirmada na Evolution.');
 const thread=await request('inbox/conversations','POST',{instanceId,phone,name:'Homologação do canal'});
 const url='inbox/conversations/'+thread.id+'/messages',nonce=randomBytes(5).toString('hex');
 const clientId=randomUUID(),expected='V4NT '+nonce;
 await request(url,'POST',{clientId,kind:'text',text:'Teste autorizado da V4NT. Responda a esta mensagem com '+expected});
 const sent=await request(url+'/'+clientId,'POST',{});assert.equal(sent.state,'sent');
 const mediaId=randomUUID();const attachment=Buffer.from('Arquivo de homologação '+nonce);
 await request(url,'POST',{clientId:mediaId,kind:'document',text:'Arquivo de homologação '+nonce,filename:'homologacao.txt',mime:'text/plain',base64:attachment.toString('base64')});
 assert.equal((await request(url+'/'+mediaId,'POST',{})).state,'sent');
 console.log('Envios aceitos pela Evolution. Aguardando resposta do aparelho de homologação.');
 for(let n=0;n<120;n++){
  const page=await request(url+'?limit=100');
  if(page.items.some(m=>!m.from_me&&m.kind==='text'&&m.body.trim()===expected)){
   const media=page.items.find(m=>m.from_me&&m.filename==='homologacao.txt'&&m.body==='Arquivo de homologação '+nonce);
   if(media){const data=await request(url+'/'+media.id);assert.ok(Buffer.from(data.base64,'base64').equals(attachment));}
   if(!media)throw Error('Documento enviado ainda sem histórico correlacionado.');
   console.log('Aceite ao vivo: reconexão, envio de texto e documento, resposta externa recebida e histórico verificado.');
   break;
  }if(n===119)throw Error('O aparelho de homologação não respondeu ao desafio no prazo.');await delay(5000);
 }
} finally {await request('auth/logout','POST').catch(()=>{});}
