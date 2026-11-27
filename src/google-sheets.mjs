import {serviceCredentials,privateGoogleConfig,serviceAssertion,googleToken,googleJson} from './google-auth.mjs';
import {ApiError} from './http.mjs';
const readScope = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const fail = (status,code,message) => new ApiError(status,code,message);
const invalid = () => fail(503,'configuration','Revise a configuração privada do Google Sheets.');

export function sheetConfig(input) {
  if (!input || typeof input !== 'object') throw invalid();
  const {spreadsheet_id,tab,range} = input;
  if (typeof spreadsheet_id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(spreadsheet_id)
      || typeof tab !== 'string' || !tab.trim() || tab.length > 100 || /[\x00-\x1f\x7f]/.test(tab)
      || typeof range !== 'string') throw invalid();
  const rect = /^([A-Z])([1-9]\d{0,6}):([A-Z])([1-9]\d{0,6})$/.exec(range);
  if (!rect || rect[1] > rect[3]) throw invalid();
  const rows = Number(rect[4]) - Number(rect[2]) + 1;
  if (rows < 1 || rows > 100) throw invalid();
  return {spreadsheet_id,range:"'" + tab.replaceAll("'","''") + "'!" + range,
    rows,columns:rect[3].charCodeAt(0)-rect[1].charCodeAt(0)+1,...serviceCredentials(input)};
}

export const tenantSheet = tenant => privateGoogleConfig(tenant,process.env.VANT_GOOGLE_SHEETS_DIR,sheetConfig);
export const sheetAssertion = (config,now) => serviceAssertion(config,readScope,now);

export function sheetValues(data,config) {
  const values = data?.values === undefined ? [] : data.values;
  if (typeof data?.range !== 'string' || !data.range || !Array.isArray(values) || values.length > config.rows ||
      !values.every(row=>Array.isArray(row) && row.length <= config.columns && row.every(value=>typeof value === 'string'))) {
    throw fail(502,'upstream','O Google retornou dados incompatíveis com o intervalo.');
  }
  return values;
}

export async function readSheet(config) {
  try {
    const token = await googleToken(config,readScope);
    const url = new URL('https://sheets.googleapis.com/v4/spreadsheets/' + config.spreadsheet_id + '/values/' + encodeURIComponent(config.range));
    url.searchParams.set('majorDimension','ROWS');
    url.searchParams.set('valueRenderOption','FORMATTED_VALUE');
    const data = await googleJson(url,{headers:{Authorization:'Bearer '+token}},512000);
    return sheetValues(data,config);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw fail(502,'upstream','Falha ao consultar o Google Sheets.');
  }
}
