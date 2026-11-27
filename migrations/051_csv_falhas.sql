CREATE INDEX integration_csv_failures ON vant.audit(tenant_id,created_at DESC,id DESC)
 WHERE action LIKE 'csv.failure.%';
