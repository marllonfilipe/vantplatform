import {ApiError} from './http.mjs';
import {boundedJson, readTenantConfig} from './integration-io.mjs';

const pageSize=50;
const endpoint='https://api.rd.services/crm/v2/organizations';
const invalidConfig=()=>new ApiError(503,'configuration','Revise o token privado do RD Station CRM.');
const invalidResponse=()=>new ApiError(502,'upstream','O RD Station CRM retornou uma página inválida.');

export function rdStationConfig(input) {
  const token=input?.access_token;
  if(typeof token!=='string' || !/^[A-Za-z0-9._~+/-]+=*$/.test(token) || token.length>8192) throw invalidConfig();
  return {token};
}
export const tenantRdStation=tenant=>readTenantConfig(tenant,process.env.VANT_RD_STATION_DIR,rdStationConfig,invalidConfig);

export function rdOrganizationsUrl() {
  const url=new URL(endpoint);
  url.searchParams.set('page[number]','1');
  url.searchParams.set('page[size]',String(pageSize));
  return url;
}
export function rdOrganizationsPreview(payload) {
  if(!Array.isArray(payload?.data) || payload.data.length>pageSize) throw invalidResponse();
  const organizations=payload.data.map(item=>{
    if(typeof item?.id!=='string' || !item.id.trim() || typeof item.name!=='string') throw invalidResponse();
    return {id:item.id,name:item.name};
  });
  const next=payload.links?.next;
  if(next!=null && typeof next!=='string') throw invalidResponse();
  return {organizations,has_more:Boolean(next)};
}
export async function readRdStation({token}) {
  try {
    const response=await fetch(rdOrganizationsUrl(),{headers:{Authorization:'Bearer '+token,Accept:'application/json'},
      redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!response.ok) {
      await response.body?.cancel();
      if([401,403].includes(response.status)) throw new ApiError(502,'access','Revise a validade e as permissões do token do RD Station CRM.');
      if(response.status===429) throw new ApiError(503,'quota','Limite de consultas do RD Station CRM atingido.');
      throw new ApiError(502,'upstream','Falha na consulta de empresas do RD Station CRM.');
    }
    return rdOrganizationsPreview(await boundedJson(response,512000));
  } catch(error) {
    if(error instanceof ApiError) throw error;
    throw new ApiError(502,'upstream','O RD Station CRM não concluiu a consulta.');
  }
}
