import {readFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {createPrivateKey,sign} from 'node:crypto';
import {isUuid} from './security.mjs';
import {ApiError} from './http.mjs';

const tokenUrl = 'https://oauth2.googleapis.com/token';
const readScope = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const fail = (status,code,message) => new ApiError(status,code,message);
const invalid = () => fail(503,'configuration','Revise a configuração privada do Google Sheets.');

export function sheetConfig(input) {
  if (!input || typeof input !== 'object') throw invalid();
  const {spreadsheet_id,tab,range,client_email,private_key} = input;
  if (typeof spreadsheet_id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(spreadsheet_id)
      || typeof tab !== 'string' || !tab.trim() || tab.length > 100 || /[\x00-\x1f\x7f]/.test(tab)
      || typeof range !== 'string' || typeof client_email !== 'string'
      || !/^[\w.+-]+@[\w.-]+\.gserviceaccount\.com$/.test(client_email)
      || typeof private_key !== 'string') throw invalid();
  const rect = /^([A-Z])([1-9]\d{0,6}):([A-Z])([1-9]\d{0,6})$/.exec(range);
  if (!rect || rect[1] > rect[3]) throw invalid();
  const rows = Number(rect[4]) - Number(rect[2]) + 1;
  if (rows < 1 || rows > 100) throw invalid();
  let key;
  try { key = createPrivateKey(private_key); } catch { throw invalid(); }
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 2048) throw invalid();
  return {spreadsheet_id,range:"'" + tab.replaceAll("'","''") + "'!" + range,
    rows,columns:rect[3].charCodeAt(0)-rect[1].charCodeAt(0)+1,client_email,key};
}

export async function tenantSheet(tenant) {
  if (!isUuid(tenant)) throw invalid();
  const directory = process.env.VANT_GOOGLE_SHEETS_DIR;
  if (!directory) return null;
  if (!isAbsolute(directory)) throw invalid();
  try {
    const raw = await readFile(join(directory,tenant + '.json'),'utf8');
    if (Buffer.byteLength(raw) > 32768) throw invalid();
    return sheetConfig(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw invalid();
  }
}

export function sheetAssertion(config,now = Math.floor(Date.now()/1000)) {
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = encode({alg:'RS256',typ:'JWT'}) + '.' + encode({iss:config.client_email,
    aud:tokenUrl,scope:readScope,iat:now,exp:now+300});
  return data + '.' + sign('RSA-SHA256',Buffer.from(data),config.key).toString('base64url');
}

async function googleJson(url,options,limit) {
  const response = await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(8000)});
  if (!response.ok) {
    await response.body?.cancel();
    if ([400,401,403,404].includes(response.status)) throw fail(502,'access','Confira as credenciais, o compartilhamento e o intervalo no Google Sheets.');
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

export async function readSheet(config) {
  try {
    const token = await googleJson(tokenUrl,{method:'POST',body:new URLSearchParams({
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:sheetAssertion(config)
    })},16384);
    if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('token');
    const url = new URL('https://sheets.googleapis.com/v4/spreadsheets/' + config.spreadsheet_id + '/values/' + encodeURIComponent(config.range));
    url.searchParams.set('majorDimension','ROWS');
    url.searchParams.set('valueRenderOption','FORMATTED_VALUE');
    const data = await googleJson(url,{headers:{Authorization:'Bearer '+token.access_token}},512000);
    const values = data.values ?? [];
    if (typeof data.range !== 'string' || !Array.isArray(values) || values.length > config.rows ||
        !values.every(row=>Array.isArray(row) && row.length <= config.columns && row.every(value=>typeof value === 'string'))) throw new Error('range');
    return values;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw fail(502,'upstream','Falha ao consultar o Google Sheets.');
  }
}
