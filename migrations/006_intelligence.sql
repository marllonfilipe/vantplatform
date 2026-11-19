ALTER TABLE vant.documents ADD COLUMN purpose text NOT NULL DEFAULT 'file',ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX document_purpose ON vant.documents(tenant_id,purpose);
CREATE TABLE vant.core_runs (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL, subject_kind text NOT NULL CHECK(subject_kind IN ('lead','deal')), subject_id uuid NOT NULL,
 model_version text NOT NULL, latency_ms integer NOT NULL CHECK(latency_ms>=0), result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES vant.members(tenant_id,id)
);
CREATE INDEX core_subject_history ON vant.core_runs(tenant_id,subject_kind,subject_id,created_at DESC);
ALTER TABLE vant.core_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.core_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.core_runs USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT ON vant.core_runs TO vant_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON vant.documents,vant.document_chunks TO vant_app;
GRANT SELECT,INSERT ON vant.recommendations TO vant_app;
