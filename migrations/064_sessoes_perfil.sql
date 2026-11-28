ALTER TABLE vant.sessions ADD COLUMN public_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX sessions_public_id ON vant.sessions(tenant_id,public_id);
CREATE INDEX sessions_member_recent ON vant.sessions(tenant_id,member_id,created_at DESC,public_id DESC);
