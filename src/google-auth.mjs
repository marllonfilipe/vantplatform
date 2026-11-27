import {readTenantConfig,boundedJson} from './integration-io.mjs';
import {createPrivateKey,sign} from 'node:crypto';
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

export const privateGoogleConfig = (tenant,directory,parse) =>
  readTenantConfig(tenant,directory,parse,invalidGoogleConfig);

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
  return boundedJson(response,limit);
}

export async function googleToken(config,scope) {
  const token=await googleJson(tokenUrl,{method:'POST',body:new URLSearchParams({
    grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:serviceAssertion(config,scope)
  })},16384);
  if (typeof token.access_token!=='string' || !token.access_token) throw fail(502,'upstream','O Google não retornou um token de acesso.');
  return token.access_token;
}
