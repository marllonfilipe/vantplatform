CREATE INDEX integration_sheets_events ON vant.audit(tenant_id,created_at DESC,id DESC)
 WHERE action LIKE 'sheets.read.%';
CREATE INDEX integration_sheets_success ON vant.audit(tenant_id,created_at DESC)
 WHERE action='sheets.read.success';
