import {readFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {createPrivateKey,sign} from 'node:crypto';
import {isUuid} from './security.mjs';
import {ApiError} from './http.mjs';

const tokenUrl = 'https://oauth2.googleapis.com/token';
const fail = (status,code,message) => new ApiError(status,code,message);
export const invalidGoogleConfig = () => fail(503,'configuration','Revise a configuração privada da integração Google.');

export function serviceCredentials({client_email,private_key}) {
  if (typeof client_email !== 'string' || !/^[\w.+-]+@[\w.-]+\.gserviceaccount\.com$/.test(client_email)
      || typeof private_key !== 'string') throw invalidGoogleConfig();
  let key;
  try { key = createPrivateKey(private_key); } catch { throw invalidGoogleConfig(); }
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 2048) throw invalidGoogleConfig();
  return {client_email,key};
}

export async function privateGoogleConfig(tenant,directory,parse) {
  if (!isUuid(tenant)) throw invalidGoogleConfig();
  if (!directory) return null;
  if (!isAbsolute(directory)) throw invalidGoogleConfig();
  try {
    const raw = await readFile(join(directory,tenant + '.json'),'utf8');
    if (Buffer.byteLength(raw) > 32768) throw invalidGoogleConfig();
    return parse(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw invalidGoogleConfig();
  }
}

export function serviceAssertion(config,scope,now = Math.floor(Date.now()/1000)) {
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = encode({alg:'RS256',typ:'JWT'}) + '.' + encode({iss:config.client_email,
    aud:tokenUrl,scope,iat:now,exp:now+300});
  return data + '.' + sign('RSA-SHA256',Buffer.from(data),config.key).toString('base64url');
}

export async function googleJson(url,options,limit) {
  const response = await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(8000)});
  if (!response.ok) {
    await response.body?.cancel();
    if ([400,401,403,404].includes(response.status)) throw fail(502,'access','Confira as credenciais, o compartilhamento e o recurso configurado no Google.');
    if (response.status === 429) throw fail(503,'quota','O Google limitou a consulta. Tente novamente mais tarde.');
    throw fail(502,'upstream','O Google não concluiu a consulta.');
  }
  const parts = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw fail(502,'size','A resposta excede o limite. Reduza o intervalo configurado.');
    parts.push(chunk);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}

export async function googleToken(config,scope) {
  const token=await googleJson(tokenUrl,{method:'POST',body:new URLSearchParams({
    grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:serviceAssertion(config,scope)
  })},16384);
  if (typeof token.access_token!=='string' || !token.access_token) throw fail(502,'upstream','O Google não retornou um token de acesso.');
  return token.access_token;
}
