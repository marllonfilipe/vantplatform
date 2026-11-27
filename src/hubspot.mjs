import {ApiError} from './http.mjs';
import {readTenantConfig,boundedJson} from './integration-io.mjs';

const endpoint = 'https://api.hubapi.com/crm/objects/2026-09/companies';
const limit = 50;
const invalidConfig = () => new ApiError(503,'configuration','Revise a configuração privada do HubSpot.');
const invalidResponse = () => new ApiError(502,'upstream','O HubSpot retornou uma resposta inválida.');

export function hubspotConfig(input) {
  const token = input?.access_token;
  if (typeof token !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(token)) throw invalidConfig();
  return {token};
}

export const tenantHubspot = tenant => readTenantConfig(tenant,process.env.VANT_HUBSPOT_DIR,hubspotConfig,invalidConfig);

export function companiesUrl() {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({limit:String(limit),properties:'name,domain',archived:'false'});
  return url;
}

export function companiesPreview(data) {
  if (!Array.isArray(data?.results) || data.results.length > limit) throw invalidResponse();
  const companies = [];
  for (const item of data.results) {
    if (item?.archived === true) continue;
    const props = item?.properties;
    if (!props || typeof props !== 'object' || Array.isArray(props)) throw invalidResponse();
    for (const value of [props.name,props.domain]) {
      if (value != null && typeof value !== 'string') throw invalidResponse();
    }
    companies.push({name:props.name?.trim() || null,domain:props.domain?.trim() || null});
  }
  return {companies,has_more:data.paging?.next?.after != null};
}

export async function readHubspot({token}) {
  try {
    const response = await fetch(companiesUrl(),{headers:{Authorization:'Bearer '+token},
      redirect:'error',signal:AbortSignal.timeout(8000)});
    if (!response.ok) {
      await response.body?.cancel();
      if ([401,403].includes(response.status)) throw new ApiError(502,'access','Verifique o token e a permissão de leitura de empresas.');
      if (response.status===429) throw new ApiError(503,'quota','Limite de consultas do HubSpot atingido.');
      throw new ApiError(502,'upstream','O HubSpot não concluiu a consulta.');
    }
    return companiesPreview(await boundedJson(response,512000));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502,'upstream','Falha ao consultar o HubSpot.');
  }
}
