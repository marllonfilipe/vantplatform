import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer as createTcpServer} from 'node:net';
import {createServer as createTlsServer,createSecureContext,TLSSocket} from 'node:tls';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {smtpConfig,verifySmtp} from '../src/smtp.mjs';

test('SMTP valida configuração privada e exige TLS',()=>{
  const good={host:'relay.example.invalid',port:465,mode:'tls',username:'local',password:'local'};
  assert.deepEqual(smtpConfig(good),good);
  for(const change of [{host:'https://relay.invalid'},{port:0},{mode:'plain'},{username:'a\nb'},{password:''}])
    assert.throws(()=>smtpConfig({...good,...change}),{code:'configuration'});
});

test('SMTP negocia TLS, autentica e encerra sem transmitir mensagens',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'vant-smtp-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const certPath=join(dir,'cert.pem'),keyPath=join(dir,'key.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost',
    '-addext','subjectAltName=DNS:localhost','-keyout',keyPath,'-out',certPath],{stdio:'ignore'});
  const tls={cert:await readFile(certPath),key:await readFile(keyPath)};
  const secret=randomUUID(),user='local-test';
  const expected=Buffer.from('\0'+user+'\0'+secret).toString('base64');
  const previous=process.env.SSL_CERT_FILE;
  t.after(()=>{if(previous===undefined)delete process.env.SSL_CERT_FILE;else process.env.SSL_CERT_FILE=previous;});
  const commands=[];
  function attach(socket,secure,upgrade){
    let buffer='';
    const receive=data=>{
      buffer+=data.toString('ascii');
      let pos;
      while((pos=buffer.indexOf('\r\n'))>=0){
        const line=buffer.slice(0,pos);buffer=buffer.slice(pos+2);
        const command=line.split(' ')[0].toUpperCase();commands.push([command,secure]);
        if(command==='EHLO')socket.write(secure?'250-localhost\r\n250 AUTH PLAIN\r\n':
          (upgrade?'250-localhost\r\n250 STARTTLS\r\n':'250 localhost\r\n'));
        else if(command==='STARTTLS'&&upgrade&&!secure){
          socket.removeListener('data',receive);
          socket.write('220 Ready\r\n',()=>{
            const encrypted=new TLSSocket(socket,{isServer:true,secureContext:createSecureContext(tls)});
            encrypted.on('error',()=>{});
            attach(encrypted,true,false);
          });
          return;
        }else if(command==='AUTH'&&secure) socket.write(line==='AUTH PLAIN '+expected?'235 OK\r\n':'535 Denied\r\n');
        else if(command==='NOOP'&&secure)socket.write('250 OK\r\n');
        else socket.write('502 Unsupported\r\n');
      }
    };
    socket.on('error',()=>{});
    socket.on('data',receive);
  }
  for(const mode of ['tls','starttls','no-upgrade']){
    const implicit=mode==='tls';
    const connected=socket=>{attach(socket,implicit,mode==='starttls');socket.write('220 localhost ESMTP\r\n');};
    const server=implicit?createTlsServer(tls,connected):createTcpServer(connected);
    server.listen(0,'127.0.0.1');await once(server,'listening');
    const config={host:'localhost',port:server.address().port,mode:implicit?'tls':'starttls',username:user,password:secret};
    try{
      if(implicit){
        delete process.env.SSL_CERT_FILE;
        await assert.rejects(verifySmtp(config),{code:'protocol'});
      }
      process.env.SSL_CERT_FILE=certPath;
      if(mode==='no-upgrade')await assert.rejects(verifySmtp(config),{code:'protocol'});
      else{
        assert.deepEqual(await verifySmtp(config),{authenticated:true});
        await assert.rejects(verifySmtp({...config,password:'incorrect'}),{code:'access'});
      }
    }finally{await new Promise(resolve=>server.close(resolve));}
  }
  assert.ok(commands.some(([c,s])=>c==='AUTH'&&s));
  assert.ok(commands.every(([c,s])=>(c!=='AUTH'||s)&&!['MAIL','RCPT','DATA'].includes(c)));
});
