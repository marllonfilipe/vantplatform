ALTER TABLE vant.leads ADD COLUMN team_id uuid, ADD FOREIGN KEY(tenant_id,team_id) REFERENCES vant.teams(tenant_id,id);
ALTER TABLE vant.deals ADD COLUMN team_id uuid, ADD FOREIGN KEY(tenant_id,team_id) REFERENCES vant.teams(tenant_id,id);
CREATE TABLE vant.crm_history (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id bigint GENERATED ALWAYS AS IDENTITY, actor_id uuid NOT NULL,
 kind text NOT NULL, record_id uuid NOT NULL, action text NOT NULL, changes jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id),
 FOREIGN KEY (tenant_id,actor_id) REFERENCES vant.members(tenant_id,id)
);
CREATE INDEX crm_history_record ON vant.crm_history(tenant_id,kind,record_id,id DESC);
CREATE TABLE vant.lead_files (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), lead_id uuid NOT NULL, filename text NOT NULL,
 contents bytea NOT NULL CHECK(octet_length(contents) BETWEEN 1 AND 2097152), PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,lead_id) REFERENCES vant.leads(tenant_id,id) ON DELETE CASCADE
);
CREATE TABLE vant.conversations (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(), channel text NOT NULL DEFAULT 'manual',
 name text NOT NULL, phone text, account_id uuid,contact_id uuid,lead_id uuid,owner_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,owner_id) REFERENCES vant.members(tenant_id,id), FOREIGN KEY(tenant_id,lead_id) REFERENCES vant.leads(tenant_id,id),
 FOREIGN KEY(tenant_id,contact_id) REFERENCES vant.contacts(tenant_id,id), FOREIGN KEY(tenant_id,account_id) REFERENCES vant.accounts(tenant_id,id)
);
DO $$ DECLARE target text; BEGIN
 FOREACH target IN ARRAY ARRAY['crm_history','lead_files','conversations'] LOOP
  EXECUTE format('ALTER TABLE vant.%I ENABLE ROW LEVEL SECURITY',target);
  EXECUTE format('ALTER TABLE vant.%I FORCE ROW LEVEL SECURITY',target);
  EXECUTE format('CREATE POLICY tenant_scope ON vant.%I USING (tenant_id=vant.current_tenant()) WITH CHECK (tenant_id=vant.current_tenant())',target);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON vant.leads,vant.accounts,vant.contacts,vant.deals,vant.pipelines,vant.stages,vant.activities,vant.conversations TO vant_app;
GRANT DELETE ON vant.leads TO vant_app;
GRANT SELECT,INSERT ON vant.crm_history,vant.lead_files TO vant_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA vant TO vant_app;
