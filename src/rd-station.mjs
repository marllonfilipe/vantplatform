import {ApiError} from './http.mjs';
import {readCrmPage,validBearerToken} from './crm-reader.mjs';
import {readTenantConfig} from './integration-io.mjs';

const pageSize=50;
const endpoint='https://api.rd.services/crm/v2/organizations';
const invalidConfig=()=>new ApiError(503,'configuration','Revise o token privado do RD Station CRM.');
const invalidResponse=()=>new ApiError(502,'upstream','O RD Station CRM retornou uma página inválida.');

export function rdStationConfig(input) {
  const token=input?.access_token;
  if(!validBearerToken(token)) throw invalidConfig();
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
  return rdOrganizationsPreview(await readCrmPage(rdOrganizationsUrl(),token,'RD Station CRM'));
}
