import { isUuid } from './security.mjs';
import { reject } from './http.mjs';
const domainLists={
 leads:['leads','name'],accounts:['accounts','name'],contacts:['contacts','name'],deals:['deals','name'],activities:['activities','title']
};
export async function dashboardRoutes({db,member,url,method}) {
 if (method!=='GET') return;
 const path=url.pathname;
 if (path==='/api/v1/search') {
   const term=(url.searchParams.get('q')??'').trim();
   if (!term || term.length>100) reject(400,'search','Informe de 1 a 100 caracteres.');
   const results=[];
   for (const [kind,[table,label]] of Object.entries(domainLists)) {
     const {rows}=await db.query('SELECT id,'+label+' AS name FROM vant.'+table+' WHERE strpos(lower('+label+'),lower($1))>0 ORDER BY '+label+',id LIMIT 8',[term]);
     results.push(...rows.map(r=>({...r,kind})));
   }
   return [200,{items:results}];
 }
 if (path!=='/api/v1/dashboard') return;
 const days=Number(url.searchParams.get('days')??30);
 if (![7,30,90].includes(days)) reject(400,'period','Período inválido.');
 const team=url.searchParams.get('team')||null;
 if (team && !isUuid(team)) reject(400,'team','Equipe inválida.');
 if (team && !(await db.query('SELECT 1 FROM vant.teams WHERE id=$1',[team])).rowCount) reject(404,'team','Equipe não encontrada.');
 const mine=url.searchParams.get('mine')==='1'?member.id:null;
 const parameters=[days,team,mine];
 const base=`WITH owners AS (SELECT id FROM vant.members m WHERE active AND ($3::uuid IS NULL OR m.id=$3)
     AND ($2::uuid IS NULL OR EXISTS (SELECT FROM vant.team_members tm WHERE tm.member_id=m.id AND tm.team_id=$2))),
   bounds AS (SELECT ((now() AT TIME ZONE 'America/Sao_Paulo')::date-($1::int-1))::timestamp AT TIME ZONE 'America/Sao_Paulo' AS since),
   l AS (SELECT * FROM vant.leads WHERE owner_id IN (SELECT id FROM owners)),
   d AS (SELECT * FROM vant.deals WHERE owner_id IN (SELECT id FROM owners)),
   a AS (SELECT * FROM vant.activities WHERE owner_id IN (SELECT id FROM owners)) `;
 const q=async sql=>(await db.query(base+sql,parameters)).rows;
 const [totals]=await q(`SELECT (SELECT count(*)::int FROM l) AS leads,
   (SELECT count(*)::int FROM l,bounds WHERE created_at>=since) AS new_leads,
   (SELECT count(*)::int FROM l WHERE last_contact_at IS NULL) AS untouched,
   (SELECT count(*)::int FROM l WHERE score>=80) AS priority,
   (SELECT count(*)::int FROM d WHERE status='open') AS open_deals,
   (SELECT coalesce(sum(amount_cents),0)::text FROM d WHERE status='open') AS pipeline,
   (SELECT coalesce(round(sum(amount_cents*probability/100.0)),0)::text FROM d WHERE status='open') AS weighted,
   (SELECT coalesce(sum(amount_cents),0)::text FROM d,bounds WHERE status='won' AND closed_at>=since) AS won,
   (SELECT round(100.0*count(*) FILTER(WHERE status='won')/nullif(count(*),0),1) FROM d,bounds WHERE status<>'open' AND closed_at>=since) AS conversion,
   (SELECT count(*)::int FROM a WHERE done_at IS NULL) AS pending,
   (SELECT count(*)::int FROM a WHERE done_at IS NULL AND due_at<now()) AS overdue,
   (SELECT count(*)::int FROM a WHERE kind='meeting' AND due_at>=now() AND done_at IS NULL) AS meetings`);
 const trend=await q(`SELECT to_char(day,'YYYY-MM-DD') AS day, count(d.id)::int AS count
   FROM generate_series((now() AT TIME ZONE 'America/Sao_Paulo')::date-($1::int-1),(now() AT TIME ZONE 'America/Sao_Paulo')::date,interval '1 day') day
   LEFT JOIN d ON (d.created_at AT TIME ZONE 'America/Sao_Paulo')::date=day::date GROUP BY day ORDER BY day`);
 const stages=await q(`SELECT p.name AS pipeline,s.name AS label,count(d.id)::int AS count FROM vant.stages s
   JOIN vant.pipelines p ON p.id=s.pipeline_id LEFT JOIN d ON d.stage_id=s.id AND d.status='open' GROUP BY p.id,p.name,s.id,s.position,s.name ORDER BY p.name,s.position`);
 const sources=await q('SELECT source AS label,count(*)::int AS count FROM l,bounds WHERE created_at>=since GROUP BY source ORDER BY count DESC,source LIMIT 8');
 const performance=await q(`SELECT m.name AS label,count(d.id)::int AS count FROM owners o JOIN vant.members m ON m.id=o.id
   LEFT JOIN d ON d.owner_id=o.id AND d.status='won' AND d.closed_at>=(SELECT since FROM bounds) GROUP BY m.id,m.name ORDER BY count DESC,m.name LIMIT 12`);
 const next=await q("SELECT id,title,kind,due_at FROM a WHERE done_at IS NULL ORDER BY due_at NULLS LAST,id LIMIT 12");
 const recent=await q("SELECT id,title,kind,created_at FROM a,bounds WHERE created_at>=since ORDER BY created_at DESC,id LIMIT 10");
 const recommendations=await q("SELECT title,detail FROM vant.recommendations,bounds WHERE owner_id IN (SELECT id FROM owners) AND dismissed_at IS NULL AND created_at>=since ORDER BY created_at DESC,id LIMIT 6");
 return [200,{totals,trend,stages,sources,performance,next,recent,recommendations}];
}
