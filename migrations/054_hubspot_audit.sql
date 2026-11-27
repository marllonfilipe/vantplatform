CREATE INDEX integration_hubspot_events ON vant.audit(tenant_id,created_at DESC,id DESC)
 WHERE action LIKE 'hubspot.read.%';
CREATE INDEX integration_hubspot_success ON vant.audit(tenant_id,created_at DESC)
 WHERE action='hubspot.read.success';
