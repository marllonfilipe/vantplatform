import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { hashPassword,verifyPassword,issueSession,parseSession,sealSecret,openSecret,mayManageTeams } from '../src/security.mjs';
import { pagination,textField } from '../src/http.mjs';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPrivateFile,writePrivateFile,removePrivateFile } from '../src/storage.mjs';

test('armazenamento privado segrega empresa e impede sobrescrita',async()=>{
  const root=await mkdtemp(join(tmpdir(),'vant-files-'));
  const tenant=randomUUID(), id=randomUUID();
  try {
    await writePrivateFile(root,tenant,id,Buffer.from('documento'));
    assert.equal((await readPrivateFile(root,tenant,id)).toString(),'documento');
    await assert.rejects(readPrivateFile(root,randomUUID(),id),{code:'ENOENT'});
    await assert.rejects(writePrivateFile(root,tenant,id,Buffer.from('outro')),{code:'EEXIST'});
    assert.throws(()=>readPrivateFile(root,tenant,'../dados'));
    await removePrivateFile(root,tenant,id);
    await assert.rejects(readPrivateFile(root,tenant,id),{code:'ENOENT'});
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('senha com salt individual e verificação de valor incorreto',async()=>{
  const password='Frase exclusiva de teste 2026';
  const a=await hashPassword(password);
  assert.notEqual(a,await hashPassword(password));
  assert.equal(await verifyPassword(password,a),true);
  assert.equal(await verifyPassword(password+'!',a),false);
  await assert.rejects(hashPassword('curta'));
});
test('cookie opaco guarda apenas o hash do segredo no banco',()=>{
  const tenant=randomUUID(), session=issueSession(tenant);
  assert.deepEqual(parseSession(session.cookie),{tenant,tokenHash:session.tokenHash});
  assert.ok(!session.cookie.includes(session.tokenHash));
  for (const invalid of ['','x','_.xx',session.cookie+'.']) assert.equal(parseSession(invalid),null);
});
test('credencial cifrada é vinculada ao tenant e provedor',()=>{
  const key=randomBytes(32), tenant=randomUUID(), envelope=sealSecret(key,tenant,'evolution','teste');
  assert.equal(openSecret(key,tenant,'evolution',envelope),'teste');
  assert.throws(()=>openSecret(key,randomUUID(),'evolution',envelope));
  assert.throws(()=>openSecret(key,tenant,'billing',envelope));
  assert.throws(()=>openSecret(randomBytes(32),tenant,'evolution',envelope));
});
test('papéis e limites da API',()=>{
  assert.equal(mayManageTeams('seller'),false);
  assert.equal(mayManageTeams('owner'),true);
  assert.equal(mayManageTeams('manager'),true);
  assert.equal(pagination(new URLSearchParams()),30);
  assert.throws(()=>pagination(new URLSearchParams('limit=101')));
  assert.throws(()=>textField('  '));
});
