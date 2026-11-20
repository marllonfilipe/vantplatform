CREATE TABLE vant.automation_flows (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id),id uuid NOT NULL DEFAULT gen_random_uuid(),
 name text NOT NULL,version integer NOT NULL CHECK(version>0),enabled boolean NOT NULL,PRIMARY KEY(tenant_id,id)
);
CREATE TABLE vant.automation_versions (
 tenant_id uuid NOT NULL,flow_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),author_id uuid NOT NULL,
 task_title text NOT NULL,wait_minutes integer NOT NULL CHECK(wait_minutes BETWEEN 0 AND 43200),
 source_filter text,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,flow_id,version),
 FOREIGN KEY(tenant_id,flow_id) REFERENCES vant.automation_flows(tenant_id,id),
 FOREIGN KEY(tenant_id,author_id) REFERENCES vant.members(tenant_id,id)
);
CREATE TABLE vant.automation_attempts (
 tenant_id uuid NOT NULL,job_id uuid NOT NULL,attempt integer NOT NULL,outcome text NOT NULL,
 activity_id uuid,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,job_id,attempt),
 FOREIGN KEY(tenant_id,job_id) REFERENCES vant.jobs(tenant_id,id),
 FOREIGN KEY(tenant_id,activity_id) REFERENCES vant.activities(tenant_id,id)
);
DO $$ DECLARE target text; BEGIN
 FOREACH target IN ARRAY ARRAY['automation_flows','automation_versions','automation_attempts'] LOOP
  EXECUTE format('ALTER TABLE vant.%I ENABLE ROW LEVEL SECURITY',target);
  EXECUTE format('ALTER TABLE vant.%I FORCE ROW LEVEL SECURITY',target);
  EXECUTE format('CREATE POLICY tenant_scope ON vant.%I USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant())',target);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON vant.automation_flows,vant.jobs TO vant_app;
GRANT SELECT,INSERT ON vant.automation_versions,vant.automation_attempts TO vant_app;

CREATE FUNCTION vant.enqueue_created_lead() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO vant.jobs(tenant_id,kind,dedup_key,payload,available_at)
 SELECT NEW.tenant_id,'flow.lead_created',f.id::text||':'||NEW.id::text,
        jsonb_build_object('flow',f.id,'version',f.version,'lead',NEW.id,'source',NEW.source),now()+make_interval(mins=>v.wait_minutes)
 FROM vant.automation_flows f JOIN vant.automation_versions v ON (v.tenant_id,v.flow_id,v.version)=(f.tenant_id,f.id,f.version)
 WHERE f.tenant_id=NEW.tenant_id AND f.enabled
 ON CONFLICT(tenant_id,kind,dedup_key) DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER automation_lead_created AFTER INSERT ON vant.leads FOR EACH ROW EXECUTE FUNCTION vant.enqueue_created_lead();
