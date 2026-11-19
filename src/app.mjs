import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { audit, withTenant } from './db.mjs';
import { digest, dummyHash, isUuid, issueSession, mayManageTeams, parseSession, verifyPassword } from './security.mjs';
import { ApiError, pagination, readJson, reject, respond, textField } from './http.mjs';

const ttlSeconds=8*60*60;
function sessionCookie(value, secure, ttl) {
  return 'vant_session='+value+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+ttl+(secure?'; Secure':'');
}
function cookieValue(req) {
  const cookie=(req.headers.cookie??'').split(';').map(v=>v.trim()).find(v=>v.startsWith('vant_session='));
  return parseSession(cookie?.slice('vant_session='.length));
}
async function rateLimit(pool,key,limit) {
  const result=await pool.query(`INSERT INTO vant.rate_limits(key_hash,window_start,hits) VALUES($1,now(),1)
    ON CONFLICT (key_hash) DO UPDATE SET
    hits=CASE WHEN vant.rate_limits.window_start<=now()-interval '15 minutes' THEN 1 ELSE least(vant.rate_limits.hits+1,1000) END,
    window_start=CASE WHEN vant.rate_limits.window_start<=now()-interval '15 minutes' THEN now() ELSE vant.rate_limits.window_start END
    RETURNING hits`,[digest(key)]);
  if (result.rows[0].hits>limit) reject(429,'rate_limit','Tente novamente em alguns minutos.');
}
export function createApp({pool,origin,environment='development',featureRoutes,servePage}) {
  if (!['development','test','staging','production'].includes(environment)) throw new Error('APP_ENV inválido.');
  const secure=['production','staging'].includes(environment);
  const parsed=new URL(origin);
  if (parsed.origin!==origin || (secure && parsed.protocol!=='https:')) throw new Error('Configure APP_ORIGIN com a origem pública correta.');
  let hashing=0;
  return createServer({requestTimeout:20000,headersTimeout:12000},async(req,res)=>{
    const requestId=randomUUID();
    const started=Date.now();
    res.setHeader('X-Request-Id',requestId);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('Cache-Control','no-store');
    const url=new URL(req.url,'http://localhost');
    const path=url.pathname;
    try {
      if (req.method==='GET' && path==='/health/live') return respond(res,200,{status:'live'});
      if (req.method==='GET' && path==='/health/ready') {
        await pool.query('SELECT id FROM vant.tenants LIMIT 0');
        return respond(res,200,{status:'ready'});
      }
      if (!path.startsWith('/api/v1/')) {
        if (servePage && await servePage(req,res,url)) return;
        reject(404,'missing','Recurso não encontrado.');
      }
      if (!['GET','HEAD'].includes(req.method) && req.headers.origin!==origin) reject(403,'origin','Origem inválida.');
      if (path==='/api/v1/auth/login' && req.method==='POST') {
        await rateLimit(pool,'login-ip:'+req.socket.remoteAddress,100);
        const {tenantId,email,password}=await readJson(req);
        if (!isUuid(tenantId) || typeof email!=='string' || email.length>254 || typeof password!=='string' || Buffer.byteLength(password)>256) reject(400,'invalid_login','Credenciais inválidas.');
        const address=email.trim().toLowerCase();
        await rateLimit(pool,'login-account:'+tenantId+':'+address,15);
        if (hashing>=4) reject(429,'busy','Tente novamente em instantes.');
        hashing++;
        try {
          const session=await withTenant(pool,tenantId,async db=>{
            const {rows}=await db.query('SELECT id,password_hash FROM vant.members WHERE email=$1 AND active',[address]);
            const valid=await verifyPassword(password,rows[0]?.password_hash??dummyHash);
            if (!valid || !rows.length) reject(401,'credentials','Credenciais inválidas.');
            const issued=issueSession(tenantId);
            await db.query("INSERT INTO vant.sessions(tenant_id,member_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')",[tenantId,rows[0].id,issued.tokenHash]);
            await audit(db,tenantId,rows[0].id,'session.created',null,requestId);
            return issued;
          });
          res.setHeader('Set-Cookie',sessionCookie(session.cookie,secure,ttlSeconds));
          return respond(res,200,{authenticated:true});
        } finally { hashing--; }
      }
      const session=cookieValue(req);
      if (!session) reject(401,'session','Entre para continuar.');
      const body=['POST','PUT','PATCH'].includes(req.method) && path!=='/api/v1/auth/logout' ? await readJson(req) : {};
      const result=await withTenant(pool,session.tenant,async db=>{
        const {rows}=await db.query(`SELECT m.id,m.email,m.name,m.role,t.name AS tenant_name
          FROM vant.sessions s JOIN vant.members m ON (m.tenant_id,m.id)=(s.tenant_id,s.member_id)
          JOIN vant.tenants t ON t.id=s.tenant_id
          WHERE s.token_hash=$1 AND s.expires_at>now() AND m.active`,[session.tokenHash]);
        if (!rows.length) reject(401,'session','Sessão expirada ou inválida.');
        const member=rows[0];
        const tenant=session.tenant;
        if (path==='/api/v1/auth/me' && req.method==='GET') return [200,{tenantId:tenant,...member}];
        if (path==='/api/v1/auth/logout' && req.method==='POST') {
          await db.query('DELETE FROM vant.sessions WHERE token_hash=$1',[session.tokenHash]);
          await audit(db,tenant,member.id,'session.revoked',null,requestId);
          return [204];
        }
        if (path==='/api/v1/teams' && req.method==='GET') {
          const limit=pagination(url.searchParams);
          const cursor=url.searchParams.get('cursor');
          if (cursor!==null && !isUuid(cursor)) reject(400,'invalid_cursor','Cursor inválido.');
          const {rows}=await db.query('SELECT id,name FROM vant.teams WHERE ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT $2',[cursor,limit+1]);
          return [200,{items:rows.slice(0,limit),nextCursor:rows.length>limit?rows[limit-1].id:null}];
        }
        if (path==='/api/v1/teams' && req.method==='POST') {
          if (!mayManageTeams(member.role)) reject(403,'permission','Permissão insuficiente.');
          const name=textField(body.name,100);
          const {rows}=await db.query('INSERT INTO vant.teams(tenant_id,name) VALUES($1,$2) RETURNING id,name',[tenant,name]);
          await audit(db,tenant,member.id,'team.created',rows[0].id,requestId);
          return [201,rows[0]];
        }
        if (featureRoutes) {
          const response=await featureRoutes({db,tenant,member,requestId,url,method:req.method,body});
          if (response) return response;
        }
        reject(404,'missing','Recurso não encontrado.');
      });
      if (path==='/api/v1/auth/logout' && req.method==='POST') res.setHeader('Set-Cookie',sessionCookie('',secure,0));
      respond(res,...result);
    } catch (err) {
      const mapped=err instanceof ApiError ? [err.status,err.code,err.message] :
        err.code==='23505' ? [409,'conflict','Registro já existe.'] :
        ['23503','23514','22P02','22007','22008','22003'].includes(err.code) ? [400,'invalid_field','Dados inválidos.'] :
        path==='/health/ready' || ['ECONNREFUSED','57P01','08006'].includes(err.code) ? [503,'dependency','Serviço temporariamente indisponível.'] :
        [500,'internal','Falha interna.'];
      respond(res,mapped[0],{error:{code:mapped[1],message:mapped[2]},requestId});
    } finally {
      if (environment!=='test') console.log(JSON.stringify({event:'http',method:req.method,requestId,status:res.statusCode,durationMs:Date.now()-started}));
    }
  });
}
