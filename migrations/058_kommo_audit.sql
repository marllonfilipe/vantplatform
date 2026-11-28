CREATE INDEX integration_kommo_events ON vant.audit(tenant_id,created_at DESC,id DESC)
 WHERE action LIKE 'kommo.read.%';
CREATE INDEX integration_kommo_success ON vant.audit(tenant_id,created_at DESC)
 WHERE action='kommo.read.success';
