import {readFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {isUuid} from './security.mjs';
import {ApiError} from './http.mjs';

export async function readTenantConfig(tenant,directory,parse,invalid) {
  if (!isUuid(tenant)) throw invalid();
  if (!directory) return null;
  if (!isAbsolute(directory)) throw invalid();
  try {
    const raw = await readFile(join(directory,tenant + '.json'),'utf8');
    if (Buffer.byteLength(raw) > 32768) throw invalid();
    return parse(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw invalid();
  }
}

export async function boundedJson(response,limit) {
  const parts = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new ApiError(502,'size','A resposta excede o limite da consulta.');
    parts.push(chunk);
  }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
