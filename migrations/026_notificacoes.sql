ALTER TABLE vant.automation_versions
 DROP CONSTRAINT automation_versions_action_kind_check,
 DROP CONSTRAINT automation_versions_else_kind_check,
 ADD CONSTRAINT automation_versions_action_kind_check CHECK(action_kind IN ('task','reminder','followup','assign_owner','notify_owner')),
 ADD CONSTRAINT automation_versions_else_kind_check CHECK(else_kind IN ('task','reminder','followup','assign_owner','notify_owner'));
ALTER TABLE vant.automation_attempts
 DROP CONSTRAINT automation_attempts_action_kind_check,
 ADD CONSTRAINT automation_attempts_action_kind_check CHECK(action_kind IN ('task','reminder','followup','assign_owner','notify_owner'));

CREATE TABLE vant.notifications (
 tenant_id uuid NOT NULL,
 id bigint GENERATED ALWAYS AS IDENTITY,
 recipient_id uuid NOT NULL,
 job_id uuid NOT NULL,
 step_index integer NOT NULL CHECK(step_index BETWEEN 0 AND 7),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 240),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,job_id,step_index),
 FOREIGN KEY(tenant_id,recipient_id) REFERENCES vant.members(tenant_id,id),
 FOREIGN KEY(tenant_id,job_id) REFERENCES vant.jobs(tenant_id,id)
);
CREATE INDEX notifications_recipient ON vant.notifications(tenant_id,recipient_id,id DESC);
ALTER TABLE vant.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.notifications
 USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT,UPDATE(read_at) ON vant.notifications TO vant_app;
GRANT USAGE ON SEQUENCE vant.notifications_id_seq TO vant_app;
