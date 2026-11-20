ALTER TABLE vant.automation_versions
 DROP CONSTRAINT automation_versions_action_kind_check,
 DROP CONSTRAINT automation_versions_else_kind_check,
 ADD CONSTRAINT automation_versions_action_kind_check CHECK(action_kind IN ('task','reminder','followup','assign_owner','notify_owner','comment','update_record','summarize','run_agent','webhook')),
 ADD CONSTRAINT automation_versions_else_kind_check CHECK(else_kind IN ('task','reminder','followup','assign_owner','notify_owner','comment','update_record','summarize','run_agent','webhook'));
ALTER TABLE vant.automation_attempts
 DROP CONSTRAINT automation_attempts_action_kind_check,
 ADD CONSTRAINT automation_attempts_action_kind_check CHECK(action_kind IN ('task','reminder','followup','assign_owner','notify_owner','comment','update_record','summarize','run_agent','webhook')),
 ADD COLUMN webhook jsonb,
 DROP CONSTRAINT automation_attempts_reason_check,
 ADD CONSTRAINT automation_attempts_reason_check CHECK(reason IN ('author_unavailable','action_failed','owner_unavailable','webhook_config','webhook_destination_changed','webhook_network','webhook_http'));
