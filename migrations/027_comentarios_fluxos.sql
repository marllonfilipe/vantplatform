ALTER TABLE vant.automation_versions
 DROP CONSTRAINT automation_versions_action_kind_check,
 DROP CONSTRAINT automation_versions_else_kind_check,
 ADD CONSTRAINT automation_versions_action_kind_check CHECK(action_kind IN ('task','reminder','followup','assign_owner','notify_owner','comment')),
 ADD CONSTRAINT automation_versions_else_kind_check CHECK(else_kind IN ('task','reminder','followup','assign_owner','notify_owner','comment'));
ALTER TABLE vant.automation_attempts
 DROP CONSTRAINT automation_attempts_action_kind_check,
 ADD CONSTRAINT automation_attempts_action_kind_check CHECK(action_kind IN ('task','reminder','followup','assign_owner','notify_owner','comment'));
