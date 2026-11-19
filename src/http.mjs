export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function reject(status, code, message) { throw new ApiError(status,code,message); }
export async function readJson(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') reject(415,'media_type','Use application/json.');
  let length=0;
  const parts=[];
  for await (const part of req) {
    length+=part.length;
    if (length>65536) reject(413,'too_large','Corpo excede o limite.');
    parts.push(part);
  }
  let value;
  try { value=JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { reject(400,'invalid_json','JSON inválido.'); }
  if (!value || Array.isArray(value) || typeof value!=='object') reject(400,'invalid_body','Informe um objeto JSON.');
  return value;
}
export function textField(value, max=160) {
  if (typeof value!=='string' || !value.trim() || value.trim().length>max) reject(400,'invalid_field','Texto obrigatório ou fora do limite.');
  return value.trim();
}
export function pagination(params) {
  const limit=Number(params.get('limit')??30);
  if (!Number.isInteger(limit) || limit<1 || limit>100) reject(400,'invalid_limit','Limite de página entre 1 e 100.');
  return limit;
}
export function respond(res,status,data) {
  res.statusCode=status;
  if (data===undefined) return res.end();
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
