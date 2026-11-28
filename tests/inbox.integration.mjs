import {createServer} from 'node:http';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import {chromium} from 'playwright-core';
import {createPool} from '../src/db.mjs';
import {hashPassword} from '../src/security.mjs';
import {createApp} from '../src/app.mjs';
import {featureRoutes} from '../src/routes.mjs';
import {servePage} from '../src/pages.mjs';
import {webhookToken,instanceName} from '../src/evolution.mjs';

test('inbox: webhooks HTTP, duplicação, CRM, mídia, falhas e segregação',async()=>{
 if(process.env.APP_ENV!=='test')throw Error('Banco de testes exigido.');
 process.env.WA_WEBHOOK_KEY=randomBytes(32).toString('hex');
 const admin=new pg.Client({connectionString:process.env.ADMIN_DATABASE_URL});await admin.connect();
 const pool=createPool(process.env.DATABASE_URL),origin='http://127.0.0.1:3192';
 const server=createApp({pool,origin,featureRoutes,servePage,environment:'test'});let browser;
 const a=randomUUID(),b=randomUUID(),pw=randomUUID(),email='inbox@vant.invalid';
 try{
  await admin.query("INSERT INTO vant.tenants(id,name) VALUES($1,'Inbox A'),($2,'Inbox B')",[a,b]);
  await admin.query("INSERT INTO vant.members(tenant_id,email,name,role,password_hash) VALUES($1,$3,'A','owner',$4),($2,$3,'B','owner',$4)",[a,b,email,await hashPassword(pw)]);
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(3192,'127.0.0.1',ok);});
  async function login(tenantId){const r=await fetch(origin+'/api/v1/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({tenantId,email,password:pw})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
  const ca=await login(a),cb=await login(b);
  async function api(path,method='GET',body,status=200,cookie=ca){const r=await fetch(origin+'/api/v1/'+path,{method,headers:{origin,cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
  const inst=await api('inbox/instances','POST',{label:'Canal de testes'},201);const token=webhookToken(a,inst.id);
  async function hook(event,data,key=token){const r=await fetch(origin+'/hooks/evolution/'+a+'/'+inst.id,{method:'POST',headers:{'Content-Type':'application/json',authorization:'Bearer '+key},body:JSON.stringify({instance:instanceName(inst.id),event,data})});return r.status;}
  const summary=async cookie=>(await api('integrations','GET',undefined,200,cookie)).whatsapp;
  const none={registered:0,connected:0,connecting:0,disconnected:0,last_observed_at:null};
  assert.deepEqual(await summary(ca),{...none,registered:1});
  assert.deepEqual(await summary(cb),none);
  const disposable=await api('inbox/instances','POST',{label:'Removível'},201);
  await api('inbox/instances/'+disposable.id+'/remove','POST',{});
  assert.deepEqual(await summary(ca),{...none,registered:1});
  assert.equal(await hook('connection.update',{state:'open'},'errada'),401);
  assert.equal((await summary(ca)).last_observed_at,null);
  assert.equal(await hook('connection.update',{state:'open'}),200);
  const observed=await summary(ca);
  assert.ok(Number.isFinite(Date.parse(observed.last_observed_at)));
  assert.deepEqual(observed,{...none,registered:1,connected:1,last_observed_at:observed.last_observed_at});
  assert.equal(await hook('connection.update',{state:'close'}),200);
  const closed=await summary(ca);assert.equal(closed.connected,0);assert.equal(closed.disconnected,1);
  assert.deepEqual(await summary(cb),none);
  const key={id:'fixture-entrada',remoteJid:'5511999000111@s.whatsapp.net',fromMe:false};
  const msg={key,pushName:'Cliente Inbox',message:{conversation:'Gostaria de uma proposta.'}};
  assert.equal(await hook('messages.upsert',msg,'errada'),401);
  assert.deepEqual(await Promise.all([hook('messages.upsert',msg),hook('messages.upsert',msg)]),[200,200]);
  const list=await api('inbox/conversations?q=Cliente');assert.equal(list.items.length,1);const conv=list.items[0],url='inbox/conversations/'+conv.id;
  assert.equal((await api(url+'/messages')).items.length,1);await api(url,'GET',undefined,404,cb);
  await api(url,'PATCH',{tags:['orcamento'],priority:'high'});assert.equal((await api('inbox/conversations?tag=orcamento&priority=high')).items.length,1);
  await api(url+'/notes','POST',{body:'Conferir condições.'},201);assert.equal((await api(url+'/notes')).items[0].body,'Conferir condições.');
  const lead=await api('crm/conversations/'+conv.id+'/lead','POST',{},201);assert.equal(lead.source,'WhatsApp');
  const outKey={...key,id:'fixture-saida',fromMe:true};await hook('messages.update',{key:outKey,status:'READ'});await hook('messages.update',{key:outKey,status:'SERVER_ACK'});
  await hook('messages.upsert',{key:outKey,message:{imageMessage:{caption:'Catálogo',mimetype:'image/png'}}});
  assert.equal((await api(url+'/messages')).items.find(x=>x.provider_id===outKey.id).state,'read');
  await hook('connection.update',{state:'close'});assert.equal((await api('inbox/instances')).items[0].state,'close');
  const id=randomUUID();await api(url+'/messages','POST',{clientId:id,kind:'text',text:'Envio de validação'});await api(url+'/messages','POST',{clientId:id,kind:'text',text:'Envio de validação'});
  assert.equal((await api(url+'/messages')).outbox.length,1);
  await admin.query(`INSERT INTO vant.plan_assignments
    (tenant_id,revision,plan_code,user_limit,active_lead_limit,pipeline_limit,outbound_messages_per_day)
    VALUES($1,1,'growth',3,2000,3,1)`,[a]);
  const volume=async(cookie=ca)=>(await api('billing/usage','GET',undefined,200,cookie)).outbound_messages_today;
  assert.equal(await volume(),'0');
  // Ambiente isolado, sem provedor configurado ou destinatário externo.
  delete process.env.EVOLUTION_URL;delete process.env.EVOLUTION_API_KEY;
  await api(url+'/messages/'+id,'POST',{},503);
  assert.equal((await api(url+'/messages')).outbox.find(x=>x.id===id)?.state,'queued');
  assert.equal(await volume(),'0','Falha de configuração desfaz a admissão.');
  // O servidor recebe a tentativa e fecha a conexão antes de confirmar o envio.
  let attempts=0;
  const interrupted=createServer((req,res)=>{attempts++;req.resume();req.on('end',()=>res.destroy());});
  await new Promise((ok,fail)=>{interrupted.once('error',fail);interrupted.listen(0,'127.0.0.1',ok);});
  try{
   process.env.EVOLUTION_URL='http://127.0.0.1:'+interrupted.address().port;
   process.env.EVOLUTION_API_KEY=randomBytes(32).toString('hex');
   const another=randomUUID();
   await api(url+'/messages','POST',{clientId:another,kind:'text',text:'Segunda mensagem local'});
   const headers={origin,cookie:ca,'content-type':'application/json'};
   const refs=[id,another];
   const attemptsById=await Promise.all(refs.map(ref=>fetch(origin+'/api/v1/'+url+'/messages/'+ref,{method:'POST',headers,body:'{}'})));
   assert.deepEqual(attemptsById.map(r=>r.status).sort(),[409,502]);
   const admitted=refs[attemptsById.findIndex(r=>r.status===502)];
   const waiting=refs[attemptsById.findIndex(r=>r.status===409)];
   assert.equal((await api(url+'/messages/'+admitted,'POST',{})).state,'unknown');
   assert.equal(await volume(),'1');assert.equal(await volume(cb),'0');
   assert.equal((await api(url+'/messages')).outbox.find(row=>row.id===waiting).state,'queued');
   assert.equal(attempts,1,'Uma entrega incerta não pode ser reenviada automaticamente');
   await admin.query("UPDATE vant.wa_outbox SET admitted_on=admitted_on-1 WHERE tenant_id=$1 AND id=$2",[a,admitted]);
   assert.equal(await volume(),'0');
   await api(url+'/messages/'+waiting,'POST',{},502);assert.equal(await volume(),'1');
   assert.equal(attempts,2);
  }finally{await new Promise(ok=>interrupted.close(ok));delete process.env.EVOLUTION_URL;delete process.env.EVOLUTION_API_KEY;}
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN??'/usr/bin/google-chrome',args:['--no-sandbox']});const ctx=await browser.newContext();await ctx.addCookies([{name:'vant_session',value:ca.slice(13),url:origin}]);
  const page=await ctx.newPage();await page.goto(origin);await page.getByRole('button',{name:'Caixa de entrada',exact:true}).click();await page.getByRole('button',{name:/Cliente Inbox/}).click();await page.getByText('Gostaria de uma proposta.',{exact:true}).waitFor();
  await page.locator('#closeDialog').click();
  await page.getByRole('button',{name:'Central de integrações',exact:true}).click();
  const wa=page.locator('section').filter({has:page.getByRole('heading',{name:'WhatsApp · Evolution API',exact:true})});
  await wa.getByRole('button',{name:'Gerenciar instâncias de WhatsApp'}).click();
  await page.getByRole('button',{name:'Cadastrar instância',exact:true}).waitFor();
 }finally{await browser?.close();if(server.listening)await new Promise(ok=>server.close(ok));await pool.end();await admin.end();}
});
