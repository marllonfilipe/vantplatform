// As consultas que usam estas expressões expõem o lead com o alias l.
export const contactReference = `greatest(l.created_at,case when l.last_contact_at<=now() then l.last_contact_at end,
 (select max(a.done_at) from vant.activities a where a.tenant_id=l.tenant_id and a.lead_id=l.id
  and a.kind in ('followup','call','meeting') and a.done_at<=now()))`;
export const maySuggestFollowup = `((l.phone is not null or l.email is not null)
 and ${contactReference} <= now()-interval '14 days'
 and not exists(select from vant.activities a where a.tenant_id=l.tenant_id and a.lead_id=l.id and a.kind='followup' and a.done_at is null))`;
