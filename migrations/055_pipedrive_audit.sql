CREATE INDEX integration_pipedrive_events ON vant.audit(tenant_id,created_at DESC,id DESC)
 WHERE action LIKE 'pipedrive.read.%';
CREATE INDEX integration_pipedrive_success ON vant.audit(tenant_id,created_at DESC)
 WHERE action='pipedrive.read.success';
