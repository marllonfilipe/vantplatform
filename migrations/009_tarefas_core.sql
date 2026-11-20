CREATE INDEX core_tasks_by_lead ON vant.activities(tenant_id,lead_id,done_at,due_at) WHERE lead_id IS NOT NULL;
CREATE INDEX core_tasks_by_deal ON vant.activities(tenant_id,deal_id,done_at,due_at) WHERE deal_id IS NOT NULL;
