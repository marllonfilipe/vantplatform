ALTER TABLE vant.plan_assignments ADD COLUMN flow_starts_per_day integer CHECK(flow_starts_per_day >= 0);
ALTER TABLE vant.jobs ADD COLUMN flow_admitted_on date;
CREATE INDEX flow_admissions_by_tenant_day ON vant.jobs(tenant_id,flow_admitted_on) WHERE flow_admitted_on IS NOT NULL;

-- Preservar o consumo histórico e as entregas já preparadas antes da atualização.
UPDATE vant.jobs j SET flow_admitted_on=(first_action.created_at AT TIME ZONE 'America/Sao_Paulo')::date
FROM (
 SELECT DISTINCT ON (tenant_id,job_id) tenant_id,job_id,created_at
 FROM vant.automation_attempts WHERE outcome<>'skipped' ORDER BY tenant_id,job_id,attempt
) first_action WHERE (j.tenant_id,j.id)=(first_action.tenant_id,first_action.job_id);
UPDATE vant.jobs SET flow_admitted_on=(now() AT TIME ZONE 'America/Sao_Paulo')::date
 WHERE kind LIKE 'flow.%' AND flow_admitted_on IS NULL AND payload ? 'webhook_delivery';
