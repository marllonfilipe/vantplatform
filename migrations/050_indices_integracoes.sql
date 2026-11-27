CREATE INDEX integration_csv_audit ON vant.audit(tenant_id,created_at DESC,id DESC)
 WHERE action IN ('crm.leads.import','prospecting.import');
CREATE INDEX integration_webhook_log ON vant.automation_attempts(tenant_id,created_at DESC,job_id DESC,attempt DESC)
 WHERE action_kind='webhook';
CREATE INDEX integration_webhook_delivered ON vant.automation_attempts(tenant_id,created_at DESC)
 WHERE action_kind='webhook' AND outcome='delivered';
