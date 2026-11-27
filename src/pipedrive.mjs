import {ApiError} from './http.mjs';
import {boundedJson,readTenantConfig} from './integration-io.mjs';

const limit=50;
const invalidConfig=()=>new ApiError(503,'configuration','Revise a configuração privada do Pipedrive.');
const invalidResponse=()=>new ApiError(502,'upstream','O Pipedrive retornou uma resposta inválida.');

export function pipedriveConfig(input) {
  const domain=input?.company_domain;
  const token=input?.api_token;
  // The operator provides a single company subdomain, never an arbitrary host or URL.
  if(typeof domain!=='string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain) ||
     typeof token!=='string' || !/^[\x21-\x7e]{1,4096}$/.test(token)) throw invalidConfig();
  return {domain,token};
}

export const tenantPipedrive=tenant=>readTenantConfig(tenant,process.env.VANT_PIPEDRIVE_DIR,pipedriveConfig,invalidConfig);

export function organizationsUrl(config) {
  const url=new URL('https://'+config.domain+'.pipedrive.com/api/v2/organizations');
  url.searchParams.set('limit',String(limit));
  return url;
}

export function organizationPreview(payload) {
  if(payload?.success!==true || !Array.isArray(payload.data) || payload.data.length>limit) throw invalidResponse();
  const organizations=payload.data.map(item=>{
    if(!Number.isSafeInteger(item?.id) || item.id<1 || typeof item.name!=='string') throw invalidResponse();
    return {id:item.id,name:item.name};
  });
  const next=payload.additional_data?.next_cursor;
  if(next!=null && typeof next!=='string') throw invalidResponse();
  return {organizations,has_more:Boolean(next)};
}

export async function readPipedrive(config) {
  try {
    const response=await fetch(organizationsUrl(config),{headers:{'x-api-token':config.token},
      redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!response.ok){
      await response.body?.cancel();
      if([401,403].includes(response.status))throw new ApiError(502,'access','Verifique o token e a permissão de leitura de organizações.');
      if(response.status===429)throw new ApiError(503,'quota','Limite de consultas do Pipedrive atingido.');
      throw new ApiError(502,'upstream','O Pipedrive não concluiu a consulta.');
    }
    return organizationPreview(await boundedJson(response,512000));
  }catch(error){
    if(error instanceof ApiError)throw error;
    throw new ApiError(502,'upstream','Falha ao consultar o Pipedrive.');
  }
}
