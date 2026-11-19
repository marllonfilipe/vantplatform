import { mkdir,writeFile,readFile,unlink } from 'node:fs/promises';
import { join,resolve } from 'node:path';
import { isUuid } from './security.mjs';
function location(root,tenant,id) {
  if (!root || !isUuid(tenant) || !isUuid(id)) throw new Error('Identificador de arquivo inválido.');
  return join(resolve(root),tenant,id);
}
export async function writePrivateFile(root,tenant,id,bytes) {
  const path=location(root,tenant,id);
  await mkdir(join(resolve(root),tenant),{recursive:true,mode:0o700});
  await writeFile(path,bytes,{flag:'wx',mode:0o600});
}
export function readPrivateFile(root,tenant,id) { return readFile(location(root,tenant,id)); }
export function removePrivateFile(root,tenant,id) { return unlink(location(root,tenant,id)); }
