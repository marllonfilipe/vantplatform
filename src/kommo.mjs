import {ApiError} from './http.mjs';
import {readTenantConfig} from './integration-io.mjs';
import {readCrmPage,validBearerToken} from './crm-reader.mjs';

const pageSize=50;
const invalidConfig=()=>new ApiError(503,'configuration','Revise o subdomínio e o token privados do Kommo.');
const invalidResponse=()=>new ApiError(502,'upstream','O Kommo retornou uma página inválida.');

export function kommoConfig(input) {
  const subdomain=input?.subdomain;
  if(typeof subdomain!=='string' || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain) ||
    !validBearerToken(input?.access_token)) throw invalidConfig();
  return {subdomain,token:input.access_token};
}
export const tenantKommo=tenant=>readTenantConfig(tenant,process.env.VANT_KOMMO_DIR,kommoConfig,invalidConfig);

export function kommoCompaniesUrl({subdomain}) {
  const url=new URL('https://'+subdomain+'.kommo.com/api/v4/companies');
  url.searchParams.set('page','1');
  url.searchParams.set('limit',String(pageSize));
  return url;
}
export function kommoCompaniesPreview(payload) {
  if(payload===undefined) return {companies:[],has_more:false};
  const items=payload?._embedded?.companies;
  if(!Array.isArray(items) || items.length>pageSize) throw invalidResponse();
  const companies=items.map(item=>{
    if(!Number.isSafeInteger(item?.id) || item.id<=0 || typeof item.name!=='string') throw invalidResponse();
    return {id:item.id,name:item.name};
  });
  const next=payload._links?.next;
  if(next!=null && typeof next.href!=='string') throw invalidResponse();
  return {companies,has_more:Boolean(next?.href)};
}
export async function readKommo(config) {
  return kommoCompaniesPreview(await readCrmPage(kommoCompaniesUrl(config),config.token,'Kommo'));
}
