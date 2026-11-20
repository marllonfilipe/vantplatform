CREATE TABLE vant.meeting_minutes (
 tenant_id uuid NOT NULL, activity_id uuid NOT NULL, revision integer NOT NULL CHECK(revision>0), actor_id uuid NOT NULL,
 notes text NOT NULL, excerpts jsonb NOT NULL, model_version text NOT NULL, inference_ms integer NOT NULL CHECK(inference_ms>=0),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,activity_id,revision),
 FOREIGN KEY(tenant_id,activity_id) REFERENCES vant.activities(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES vant.members(tenant_id,id)
);
ALTER TABLE vant.meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.meeting_minutes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.meeting_minutes USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT ON vant.meeting_minutes TO vant_app;
