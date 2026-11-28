import {ApiError} from './http.mjs';
import {boundedJson} from './integration-io.mjs';

export function validBearerToken(token) {
  return typeof token==='string' && token.length<=8192 && /^[A-Za-z0-9._~+/-]+=*$/.test(token);
}

export async function readCrmPage(url,token,provider) {
  try {
    const response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/json, application/hal+json'},
      redirect:'error',signal:AbortSignal.timeout(8000)});
    if(response.status===204) return undefined;
    if(!response.ok) {
      await response.body?.cancel();
      if([401,403].includes(response.status)) throw new ApiError(502,'access','Revise a validade e as permissões do token de '+provider+'.');
      if(response.status===429) throw new ApiError(503,'quota','Limite de consultas de '+provider+' atingido.');
      throw new ApiError(502,'upstream','Falha na consulta de empresas de '+provider+'.');
    }
    return await boundedJson(response,512000);
  } catch(error) {
    if(error instanceof ApiError) throw error;
    throw new ApiError(502,'upstream',provider+' não concluiu a consulta.');
  }
}
