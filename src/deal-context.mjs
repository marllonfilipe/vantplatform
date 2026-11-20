// Este fragmento usa o alias d para a oportunidade e só considera interações concluídas.
export const lastDealTouch = `greatest(d.updated_at, (
 SELECT max(t.done_at) FROM vant.activities t WHERE t.tenant_id=d.tenant_id AND t.deal_id=d.id
 AND t.kind IN ('call','meeting','followup') AND t.done_at<=now()
))`;
