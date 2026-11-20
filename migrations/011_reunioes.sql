CREATE TABLE vant.meeting_briefs (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), activity_id uuid NOT NULL, actor_id uuid NOT NULL,
 model_version text NOT NULL, inference_ms integer NOT NULL CHECK(inference_ms>=0), result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,activity_id) REFERENCES vant.activities(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES vant.members(tenant_id,id)
);
CREATE INDEX briefs_by_meeting ON vant.meeting_briefs(tenant_id,activity_id,created_at DESC);
ALTER TABLE vant.meeting_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.meeting_briefs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.meeting_briefs USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT ON vant.meeting_briefs TO vant_app;
