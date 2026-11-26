// Datas de conclusão e vencimento representam coortes diferentes da mesma agenda.
export async function activityReport(db,filters){
 const {rows}=await db.query(`WITH bounds AS (
   SELECT $2::date::timestamp AT TIME ZONE 'America/Sao_Paulo' AS start_at,
    least(($3::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo',now()) AS end_at
  ), records AS (
   SELECT a.kind,a.owner_id,m.name AS owner,
    a.done_at>=b.start_at AND a.done_at<b.end_at AS completed,
    a.due_at>=b.start_at AND a.due_at<b.end_at AS due,
    a.done_at IS NOT NULL AND a.done_at<=a.due_at AS on_time,
    a.done_at IS NULL OR a.done_at>=b.end_at AS pending
   FROM vant.activities a CROSS JOIN bounds b
   JOIN vant.members m ON (m.tenant_id,m.id)=(a.tenant_id,a.owner_id)
   LEFT JOIN vant.deals d ON (d.tenant_id,d.id)=(a.tenant_id,a.deal_id)
   LEFT JOIN vant.leads l ON (l.tenant_id,l.id)=(a.tenant_id,coalesce(d.lead_id,a.lead_id))
   LEFT JOIN vant.accounts c ON (c.tenant_id,c.id)=(a.tenant_id,coalesce(d.account_id,l.account_id))
   WHERE a.tenant_id=$1 AND ($4::uuid IS NULL OR a.owner_id=$4)
    AND ($5::text IS NULL OR lower(coalesce(d.source,l.source))=lower($5))
    AND ($6::uuid IS NULL OR coalesce(d.team_id,l.team_id)=$6)
    AND ($7::uuid IS NULL OR d.pipeline_id=$7)
    AND ($8::text IS NULL OR lower(coalesce(c.segment,l.segment))=lower($8))
    AND ((a.done_at>=b.start_at AND a.done_at<b.end_at) OR (a.due_at>=b.start_at AND a.due_at<b.end_at))
  )
  SELECT dimension.kind,dimension.id,dimension.label,
   count(*) FILTER(WHERE completed)::int AS completed,
   count(*) FILTER(WHERE due)::int AS due,
   count(*) FILTER(WHERE due AND on_time)::int AS on_time,
   count(*) FILTER(WHERE due AND pending)::int AS pending,
   round(100.0*count(*) FILTER(WHERE due AND on_time)/nullif(count(*) FILTER(WHERE due),0),2)::text AS on_time_pct
  FROM records r CROSS JOIN LATERAL (VALUES
   ('total',null::text,'Total'),('owner',r.owner_id::text,r.owner),('kind',r.kind,r.kind)
  ) dimension(kind,id,label)
  GROUP BY dimension.kind,dimension.id,dimension.label ORDER BY dimension.kind,dimension.label,dimension.id`,filters);
 const empty={completed:0,due:0,on_time:0,pending:0,on_time_pct:null};
 return {total:rows.find(row=>row.kind==='total')??empty,groups:rows.filter(row=>row.kind!=='total')};
}
