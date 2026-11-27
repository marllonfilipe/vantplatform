CREATE INDEX integration_calendar_events ON vant.audit(tenant_id,created_at DESC,id DESC)
 WHERE action LIKE 'calendar.read.%';
CREATE INDEX integration_calendar_success ON vant.audit(tenant_id,created_at DESC)
 WHERE action='calendar.read.success';
