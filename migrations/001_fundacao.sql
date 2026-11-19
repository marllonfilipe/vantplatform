CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA vant;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA vant FROM PUBLIC;
GRANT USAGE ON SCHEMA vant TO vant_app;

CREATE TABLE vant.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vant.members (
  tenant_id uuid NOT NULL REFERENCES vant.tenants(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(email)),
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','manager','seller','viewer')),
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,email)
);
CREATE TABLE vant.teams (
  tenant_id uuid NOT NULL REFERENCES vant.tenants(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,name)
);
CREATE TABLE vant.team_members (
  tenant_id uuid NOT NULL, team_id uuid NOT NULL, member_id uuid NOT NULL,
  PRIMARY KEY (tenant_id,team_id,member_id),
  FOREIGN KEY (tenant_id,team_id) REFERENCES vant.teams(tenant_id,id),
  FOREIGN KEY (tenant_id,member_id) REFERENCES vant.members(tenant_id,id)
);
CREATE TABLE vant.invitations (
  tenant_id uuid NOT NULL REFERENCES vant.tenants(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(), email text NOT NULL,
  token_hash char(64) NOT NULL, expires_at timestamptz NOT NULL, accepted_at timestamptz,
  role text NOT NULL CHECK (role IN ('manager','seller','viewer')),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,token_hash)
);
CREATE TABLE vant.sessions (
  tenant_id uuid NOT NULL, token_hash char(64) NOT NULL,
  member_id uuid NOT NULL, expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,token_hash),
  FOREIGN KEY (tenant_id,member_id) REFERENCES vant.members(tenant_id,id)
);
CREATE INDEX sessions_expiry ON vant.sessions(expires_at);
CREATE TABLE vant.audit (
  tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id bigint GENERATED ALWAYS AS IDENTITY,
  actor_id uuid, action text NOT NULL, object_id text, request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,actor_id) REFERENCES vant.members(tenant_id,id)
);
CREATE INDEX audit_tenant_time ON vant.audit(tenant_id,created_at DESC,id DESC);
CREATE TABLE vant.integration_secrets (
  tenant_id uuid NOT NULL REFERENCES vant.tenants(id), provider text NOT NULL,
  envelope jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,provider)
);
CREATE TABLE vant.documents (
  tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  storage_key uuid NOT NULL DEFAULT gen_random_uuid(), filename text NOT NULL, media_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes>=0), created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id), UNIQUE (tenant_id,storage_key)
);
CREATE TABLE vant.document_chunks (
  tenant_id uuid NOT NULL, document_id uuid NOT NULL, chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  model text NOT NULL, content text NOT NULL, embedding vector NOT NULL,
  PRIMARY KEY (tenant_id,document_id,model,chunk_index),
  FOREIGN KEY (tenant_id,document_id) REFERENCES vant.documents(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE vant.jobs (
  tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
  kind text NOT NULL, dedup_key text NOT NULL, payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','done','failed')),
  available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id,id), UNIQUE(tenant_id,kind,dedup_key)
);
CREATE INDEX jobs_due ON vant.jobs(tenant_id,available_at) WHERE state='queued';
CREATE TABLE vant.rate_limits (
  key_hash char(64) PRIMARY KEY, window_start timestamptz NOT NULL, hits integer NOT NULL CHECK (hits>0)
);
REVOKE ALL ON ALL TABLES IN SCHEMA vant FROM PUBLIC;

CREATE FUNCTION vant.current_tenant() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('vant.tenant_id',true),'')::uuid $$;
ALTER TABLE vant.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.tenants USING (id=vant.current_tenant()) WITH CHECK (id=vant.current_tenant());
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['members','teams','team_members','invitations','sessions','audit','integration_secrets','documents','document_chunks','jobs']
  LOOP
    EXECUTE format('ALTER TABLE vant.%I ENABLE ROW LEVEL SECURITY',target);
    EXECUTE format('ALTER TABLE vant.%I FORCE ROW LEVEL SECURITY',target);
    EXECUTE format('CREATE POLICY tenant_scope ON vant.%I USING (tenant_id=vant.current_tenant()) WITH CHECK (tenant_id=vant.current_tenant())',target);
  END LOOP;
END $$;

GRANT SELECT ON vant.tenants, vant.members TO vant_app;
GRANT SELECT,INSERT ON vant.teams, vant.audit TO vant_app;
GRANT SELECT,INSERT,DELETE ON vant.sessions TO vant_app;
GRANT SELECT,INSERT,UPDATE ON vant.rate_limits TO vant_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA vant TO vant_app;
