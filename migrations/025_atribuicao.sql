ALTER TABLE vant.automation_versions
 DROP CONSTRAINT automation_versions_action_kind_check,
 DROP CONSTRAINT automation_versions_else_kind_check,
 ADD CHECK(action_kind IN ('task','reminder','followup','assign_owner')),
 ADD CHECK(else_kind IN ('task','reminder','followup','assign_owner')),
 ADD COLUMN action_owner_id uuid,
 ADD COLUMN else_owner_id uuid,
 ADD FOREIGN KEY(tenant_id,action_owner_id) REFERENCES vant.members(tenant_id,id),
 ADD FOREIGN KEY(tenant_id,else_owner_id) REFERENCES vant.members(tenant_id,id),
 ADD CHECK((action_kind='assign_owner')=(action_owner_id IS NOT NULL)),
 ADD CHECK((else_kind IS NOT DISTINCT FROM 'assign_owner')=(else_owner_id IS NOT NULL));

ALTER TABLE vant.automation_attempts
 DROP CONSTRAINT automation_attempts_action_kind_check,
 DROP CONSTRAINT automation_attempts_reason_check,
 ADD CHECK(action_kind IN ('task','reminder','followup','assign_owner')),
 ADD CHECK(reason IN ('author_unavailable','action_failed','owner_unavailable')),
 ADD COLUMN assignment jsonb;
