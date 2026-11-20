import { audit } from './db.mjs';
import { reject, textField } from './http.mjs';
import { embed, modelVersion } from './inference.mjs';
import { isUuid, mayManageTeams } from './security.mjs';

const documentsPath = '/api/v1/core/documents';
const searchPath = '/api/v1/core/search';
const purpose = 'commercial_memory';

function fragments(value) {
  const content = textField(value, 12000);
  if (content.includes('\u0000')) reject(400, 'invalid_field', 'O texto contém um caractere inválido.');
  // Preserve todas as palavras, inclusive identificadores extensos.
  const chunks = content.match(/[^\s]{1,240}/gu);
  const result = [];
  let chunk = '';
  for (const word of chunks) {
    if (chunk && chunk.length + word.length + 1 > 320) {
      result.push(chunk);
      chunk = '';
    }
    chunk += (chunk ? ' ' : '') + word;
  }
  if (chunk) result.push(chunk);
  if (result.length > 64) reject(400, 'document_size', 'Divida o documento em partes menores.');
  return result;
}

async function encode(texts) {
  try {
    return await embed(texts);
  } catch (error) {
    if (error.code === 'model_busy') reject(429, 'model_busy', 'Fila do modelo cheia.');
    reject(503, 'model_unavailable', 'Inferência local indisponível.');
  }
}

export async function retrieveKnowledge(db, tenant, query, limit, includeOffer=false) {
  const { vectors, latencyMs } = await encode([query]);
  const vector = JSON.stringify(vectors[0]);
  async function find(limit, category) {
    const {rows} = await db.query(
      `SELECT d.id AS document_id,d.filename AS title,d.revision,d.category,c.chunk_index,c.content,
              1-(c.embedding <=> $1::vector) AS similarity
         FROM vant.documents d JOIN vant.document_chunks c
           ON (c.tenant_id,c.document_id)=(d.tenant_id,d.id)
        WHERE d.tenant_id=$2 AND d.purpose=$3 AND c.model=$4 AND ($6::text IS NULL OR d.category=$6)
        ORDER BY c.embedding <=> $1::vector,d.id,c.chunk_index LIMIT $5`,
      [vector,tenant,purpose,modelVersion,limit,category]
    );
    return rows;
  }
  const items = await find(limit,null);
  const offer = includeOffer ? (await find(1,'offer'))[0] : null;
  return {items,model:modelVersion,latencyMs,offer:offer??null};
}

export async function knowledgeRoutes({ db, tenant, member, requestId, url, method, body }) {
  const path = url.pathname;
  if (path === searchPath && method === 'POST') {
    const query = textField(body.query, 320);
    const limit = body.limit ?? 5;
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) reject(400, 'limit', 'Use um limite de 1 a 20.');
    return [200, await retrieveKnowledge(db, tenant, query, limit)];
  }
  if (path === documentsPath && method === 'GET') {
    const { rows } = await db.query(
      'SELECT id, filename AS title, revision, category, size_bytes, updated_at FROM vant.documents WHERE tenant_id=$1 AND purpose=$2 ORDER BY updated_at DESC,id LIMIT 100',
      [tenant, purpose]
    );
    return [200, { items: rows }];
  }
  const create = path === documentsPath && method === 'POST';
  const id = path.startsWith(documentsPath + '/') ? path.slice(documentsPath.length + 1) : null;
  if (!create && !(isUuid(id) && ['PUT', 'DELETE'].includes(method))) return;
  if (!mayManageTeams(member.role)) reject(403, 'role', 'Gestor ou proprietário obrigatório.');
  if (!create) {
    const existing = await db.query('SELECT id FROM vant.documents WHERE tenant_id=$1 AND id=$2 AND purpose=$3 FOR UPDATE', [tenant, id, purpose]);
    if (!existing.rowCount) reject(404, 'document', 'Documento não encontrado.');
  }
  if (method === 'DELETE') {
    await db.query('DELETE FROM vant.documents WHERE tenant_id=$1 AND id=$2', [tenant, id]);
    await audit(db, tenant, member.id, 'core.document.deleted', id, requestId);
    return [204];
  }
  const category = body.category;
  if (category !== undefined && !['reference','offer'].includes(category)) reject(400,'category','Categoria inválida.');
  const title = textField(body.title, 180);
  if (title.includes('\u0000')) reject(400, 'invalid_field', 'Título inválido.');
  const chunks = fragments(body.content);
  const { vectors, latencyMs } = await encode(chunks);
  const size = Buffer.byteLength(body.content.trim());
  const document = create
    ? (await db.query("INSERT INTO vant.documents(tenant_id,filename,media_type,size_bytes,purpose,category) VALUES($1,$2,'text/plain',$3,$4,$5) RETURNING id", [tenant, title, size, purpose, category??'reference'])).rows[0].id
    : id;
  if (!create) {
    await db.query('UPDATE vant.documents SET filename=$3,size_bytes=$4,category=coalesce($5,category),revision=revision+1,updated_at=now() WHERE tenant_id=$1 AND id=$2', [tenant, id, title, size, category??null]);
    await db.query('DELETE FROM vant.document_chunks WHERE tenant_id=$1 AND document_id=$2', [tenant, id]);
  }
  await db.query(
    `INSERT INTO vant.document_chunks(tenant_id,document_id,model,chunk_index,content,embedding)
     SELECT $1,$2,$3,(part.ord-1)::integer,part.content,part.embedding::vector
       FROM unnest($4::text[],$5::text[]) WITH ORDINALITY AS part(content,embedding,ord)`,
    [tenant, document, modelVersion, chunks, vectors.map(v => JSON.stringify(v))]
  );
  await audit(db, tenant, member.id, create ? 'core.document.created' : 'core.document.updated', document, requestId);
  return [create ? 201 : 200, { id: document, chunks: chunks.length, model: modelVersion, latencyMs }];
}
