import {audit} from './db.mjs';
import {textField,reject} from './http.mjs';
import {embed,modelVersion} from './inference.mjs';
import {isUuid} from './security.mjs';

const segmenter = new Intl.Segmenter('pt-BR',{granularity:'sentence'});
const themes = ['Decisões e condições comerciais acordadas na reunião.','Ações, responsáveis e prazos combinados.','Necessidades ou objeções levantadas pelo cliente.'];

async function summarize(notes) {
  const sentences = notes.split(/\r?\n/).flatMap(line=>Array.from(segmenter.segment(line),s=>s.segment.trim())).filter(Boolean);
  if(sentences.length>60) reject(400,'minutes_size','Use até 60 frases por registro.');
  let encoded;
  try { encoded=await embed([...themes,...sentences]); }
  catch(error) {
    if(error.code==='model_busy') reject(429,'model_busy','Fila do modelo cheia.');
    reject(503,'model_unavailable','Inferência local indisponível.');
  }
  const candidates=encoded.vectors.slice(themes.length);
  const selected=new Set();
  for(const theme of encoded.vectors.slice(0,themes.length)){
    let best=-1,score=-Infinity;
    for(const [i,vector] of candidates.entries()){
      if(selected.has(i)) continue;
      const similarity=vector.reduce((sum,v,j)=>sum+v*theme[j],0);
      if(similarity>score){score=similarity;best=i;}
    }
    if(best>=0) selected.add(best);
  }
  const excerpts=[...selected].sort((a,b)=>a-b).map(i=>({sentence:i+1,text:sentences[i]}));
  return {excerpts,latencyMs:encoded.latencyMs};
}

export async function minutesRoutes({db,tenant,member,requestId,url,method,body}){
  const match=/^\/api\/v1\/agents\/meetings\/([^/]+)\/minutes$/.exec(url.pathname);
  if(!match || !isUuid(match[1]) || !['GET','POST'].includes(method)) return;
  const id=match[1],seller=member.role==='seller'?member.id:null;
  if(method==='POST'&&member.role==='viewer') reject(403,'permission','Perfil de leitura.');
  const meeting=(await db.query(`SELECT done_at<=now() AS completed FROM vant.activities
    WHERE tenant_id=$1 AND id=$2 AND kind='meeting' AND ($3::uuid IS NULL OR owner_id=$3)`+(method==='POST'?' FOR UPDATE':''),[tenant,id,seller])).rows[0];
  if(!meeting) reject(404,'missing','Reunião não encontrada.');
  if(method==='GET'){
    const {rows}=await db.query(`SELECT revision,notes,excerpts,created_at,model_version,actor_id FROM vant.meeting_minutes
      WHERE tenant_id=$1 AND activity_id=$2 ORDER BY revision DESC LIMIT 10`,[tenant,id]);
    return [200,{items:rows}];
  }
  if(!meeting.completed) reject(409,'meeting_open','Conclua a atividade da reunião antes de registrar o resultado.');
  const notes=textField(body.notes,4000);
  if(notes.includes('\u0000')) reject(400,'notes','Notas inválidas.');
  const expected=body.expectedRevision;
  if(!Number.isSafeInteger(expected)||expected<0) reject(400,'revision','Informe a revisão lida.');
  const latest=(await db.query('SELECT * FROM vant.meeting_minutes WHERE tenant_id=$1 AND activity_id=$2 ORDER BY revision DESC LIMIT 1',[tenant,id])).rows[0];
  if(latest?.notes===notes) return [200,latest];
  if((latest?.revision??0)!==expected) reject(409,'revision','As notas foram atualizadas. Reabra o histórico antes de editar.');
  const {excerpts,latencyMs}=await summarize(notes);
  const {rows}=await db.query(`INSERT INTO vant.meeting_minutes(tenant_id,activity_id,revision,actor_id,notes,excerpts,model_version,inference_ms)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[tenant,id,expected+1,member.id,notes,JSON.stringify(excerpts),modelVersion,latencyMs]);
  await audit(db,tenant,member.id,'agent.meeting.minutes',id,requestId);
  return [201,rows[0]];
}
