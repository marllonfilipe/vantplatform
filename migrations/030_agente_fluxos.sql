ALTER TABLE vant.automation_versions
 DROP CONSTRAINT automation_versions_action_kind_check,
 DROP CONSTRAINT automation_versions_else_kind_check,
 ADD CONSTRAINT automation_versions_action_kind_check CHECK(action_kind IN ('task','reminder','followup','assign_owner','notify_owner','comment','update_record','summarize','run_agent')),
 ADD CONSTRAINT automation_versions_else_kind_check CHECK(else_kind IN ('task','reminder','followup','assign_owner','notify_owner','comment','update_record','summarize','run_agent'));
ALTER TABLE vant.automation_attempts
 DROP CONSTRAINT automation_attempts_action_kind_check,
 ADD CONSTRAINT automation_attempts_action_kind_check CHECK(action_kind IN ('task','reminder','followup','assign_owner','notify_owner','comment','update_record','summarize','run_agent')),
 ADD COLUMN agent_run_id uuid,
 ADD FOREIGN KEY(tenant_id,agent_run_id) REFERENCES vant.core_runs(tenant_id,id);
ALTER TABLE vant.agent_controls ADD COLUMN flow_agent_enabled boolean NOT NULL DEFAULT false;
