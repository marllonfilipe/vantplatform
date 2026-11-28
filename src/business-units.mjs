import {audit} from './db.mjs';
import {reject,pagination,textField} from './http.mjs';
import {isUuid,mayManageTeams} from './security.mjs';

const path='/api/v1/business-units';
const fields='id,name,kind,revision';

export async function businessUnits({url,db,tenant,member,method,body,requestId}){
  const resource=url.pathname;
  if(resource!==path&&!resource.startsWith(path+'/'))return;
  if(!mayManageTeams(member.role))reject(403,'permission','A gestão de unidades exige perfil de gestão.');
  if(resource===path&&method==='GET'){
    const limit=pagination(url.searchParams),cursor=url.searchParams.get('cursor');
    if(cursor!==null&&!isUuid(cursor))reject(400,'cursor','Referência de página inválida.');
    const {rows}=await db.query(`SELECT ${fields} FROM vant.business_units WHERE tenant_id=$1
      AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3`,[tenant,cursor,limit+1]);
    const items=rows.slice(0,limit);
    return [200,{items,nextCursor:rows.length>limit?items.at(-1).id:null}];
  }
  const create=resource===path&&method==='POST';
  const id=create?body.id:resource.slice(path.length+1);
  if(!create&&method!=='PATCH')reject(405,'method','Método indisponível.');
  if(!isUuid(id))reject(400,'unit','Referência de unidade inválida.');
  const name=textField(body.name,100),kind=body.kind;
  if(!['branch','department','commercial'].includes(kind))reject(400,'kind','Tipo de unidade inválido.');
  if(create){
    const inserted=await db.query(`INSERT INTO vant.business_units(tenant_id,id,name,kind)
      VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,id) DO NOTHING RETURNING ${fields}`,[tenant,id,name,kind]);
    if(inserted.rowCount){
      await audit(db,tenant,member.id,'business_unit.created',id,requestId);
      return [201,inserted.rows[0]];
    }
    const {rows}=await db.query(`SELECT ${fields} FROM vant.business_units WHERE tenant_id=$1 AND id=$2`,[tenant,id]);
    if(rows[0]?.name===name && rows[0].kind===kind)return [200,rows[0]];
    reject(409,'reference','A referência já pertence a outro cadastro.');
  }
  if(!Number.isInteger(body.revision)||body.revision<1)reject(400,'revision','Informe a revisão da unidade.');
  const existing=await db.query(`SELECT ${fields} FROM vant.business_units WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[tenant,id]);
  if(!existing.rowCount)reject(404,'unit','Unidade não encontrada.');
  const current=existing.rows[0];
  if(current.name===name&&current.kind===kind)return [200,current];
  if(current.revision!==body.revision)reject(409,'revision','A unidade mudou. Consulte a revisão atual.');
  const {rows}=await db.query(`UPDATE vant.business_units SET name=$3,kind=$4,revision=revision+1
    WHERE tenant_id=$1 AND id=$2 RETURNING ${fields}`,[tenant,id,name,kind]);
  await audit(db,tenant,member.id,'business_unit.updated',id,requestId);
  return [200,rows[0]];
}
