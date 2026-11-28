CREATE INDEX integration_rdstation_events ON vant.audit(tenant_id,created_at DESC,id DESC)
 WHERE action LIKE 'rdstation.read.%';
CREATE INDEX integration_rdstation_success ON vant.audit(tenant_id,created_at DESC)
 WHERE action='rdstation.read.success';
