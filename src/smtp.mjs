import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ApiError} from './http.mjs';
import {readTenantConfig} from './integration-io.mjs';

const invalid=()=>new ApiError(503,'configuration','Revise a configuração privada do SMTP.');
export function smtpConfig(input) {
  const {host,mode,port,username,password}=input??{};
  if(typeof host!=='string' || host.length>253 || !host.split('.').every(label=>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw invalid();
  if(!['tls','starttls'].includes(mode) || !Number.isInteger(port) || port<1 || port>65535) throw invalid();
  for(const field of [username,password]) {
    if(typeof field!=='string' || !field || field.length>1024 || /[^\x20-\x7e]/.test(field)) throw invalid();
  }
  return {host,mode,port,username,password};
}
export const tenantSmtp=tenant=>readTenantConfig(tenant,process.env.VANT_SMTP_DIR,smtpConfig,invalid);

export async function verifySmtp(config) {
  const script=fileURLToPath(new URL('../scripts/smtp-session.py',import.meta.url));
  const result=await new Promise(resolve=>{
    const env={PATH:process.env.PATH};
    if(process.env.SSL_CERT_FILE) env.SSL_CERT_FILE=process.env.SSL_CERT_FILE;
    const child=execFile(process.env.VANT_PYTHON||'python3',['-I',script],
      {env,timeout:15000,killSignal:'SIGKILL',maxBuffer:1024},(error,stdout)=>resolve(error?'upstream':stdout.trim()));
    child.stdin.on('error',()=>{});
    child.stdin.end(JSON.stringify(config));
  });
  if(result==='success') return {authenticated:true};
  if(result==='access') throw new ApiError(502,'access','O relay recusou as credenciais SMTP.');
  if(result==='protocol') throw new ApiError(502,'protocol','Confira TLS, certificado e autenticação do relay SMTP.');
  throw new ApiError(502,'upstream','Não foi possível confirmar a conexão SMTP.');
}
