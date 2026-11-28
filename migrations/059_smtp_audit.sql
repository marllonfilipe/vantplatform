CREATE INDEX integration_smtp_events ON vant.audit(tenant_id,created_at DESC,id DESC)
 WHERE action LIKE 'smtp.read.%';
CREATE INDEX integration_smtp_success ON vant.audit(tenant_id,created_at DESC)
 WHERE action='smtp.read.success';
