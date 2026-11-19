import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const cost = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
export const isUuid = value => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
export const digest = value => createHash('sha256').update(value).digest('hex');

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 256) throw new Error('Senha deve ter pelo menos 12 caracteres e até 256 bytes.');
  const salt = randomBytes(16);
  const hash = await derive(password,salt,64,cost);
  return ['scrypt-v1',salt.toString('hex'),hash.toString('hex')].join('$');
}
export async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || !password.length || Buffer.byteLength(password)>256) return false;
  const [version,salt,hash] = String(encoded).split('$');
  if (version !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const candidate = await derive(password,Buffer.from(salt,'hex'),64,cost);
  return timingSafeEqual(candidate,Buffer.from(hash,'hex'));
}
export const dummyHash = ['scrypt-v1','0'.repeat(32),'0'.repeat(128)].join('$');
export function issueSession(tenant) {
  const secret = randomBytes(32).toString('hex');
  return { cookie: tenant+'.'+secret, tokenHash: digest(secret) };
}
export function parseSession(value) {
  const parts = String(value || '').split('.');
  if (parts.length !== 2 || !isUuid(parts[0]) || !/^[0-9a-f]{64}$/.test(parts[1])) return null;
  return { tenant: parts[0], tokenHash: digest(parts[1]) };
}
export function mayManageTeams(role) { return role === 'owner' || role === 'manager'; }

function checkedKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Chave AES-256 inválida.');
  return key;
}
export function sealSecret(key,tenant,provider,value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',checkedKey(key),iv);
  cipher.setAAD(Buffer.from(JSON.stringify([tenant,provider])));
  const body = Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return { version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), body: body.toString('base64') };
}
export function openSecret(key,tenant,provider,envelope) {
  if (envelope.version !== 1) throw new Error('Versão de credencial desconhecida.');
  const decipher = createDecipheriv('aes-256-gcm',checkedKey(key),Buffer.from(envelope.iv,'base64'));
  decipher.setAAD(Buffer.from(JSON.stringify([tenant,provider])));
  decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.body,'base64')),decipher.final()]).toString('utf8');
}
