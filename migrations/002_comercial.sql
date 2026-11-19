CREATE TABLE vant.accounts (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 name text NOT NULL, segment text, website text, size_band text, location text, cnpj text,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,cnpj)
);
CREATE TABLE vant.contacts (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 name text NOT NULL, email text, phone text, title text, decision_maker boolean NOT NULL DEFAULT false, account_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES vant.accounts(tenant_id,id)
);
CREATE TABLE vant.leads (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 name text NOT NULL, email text, phone text, source text NOT NULL DEFAULT 'Cadastro manual',
 owner_id uuid NOT NULL, contact_id uuid, account_id uuid, tags text[] NOT NULL DEFAULT '{}', notes text NOT NULL DEFAULT '',
 segment text, score smallint CHECK(score BETWEEN 0 AND 100), last_contact_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,owner_id) REFERENCES vant.members(tenant_id,id),
 FOREIGN KEY(tenant_id,contact_id) REFERENCES vant.contacts(tenant_id,id), FOREIGN KEY(tenant_id,account_id) REFERENCES vant.accounts(tenant_id,id)
);
CREATE UNIQUE INDEX lead_email_unique ON vant.leads(tenant_id,lower(email)) WHERE email IS NOT NULL;
CREATE TABLE vant.pipelines (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(), name text NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,name)
);
CREATE TABLE vant.stages (
 tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), pipeline_id uuid NOT NULL, name text NOT NULL, position integer NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,pipeline_id,id), UNIQUE(tenant_id,pipeline_id,position),
 FOREIGN KEY(tenant_id,pipeline_id) REFERENCES vant.pipelines(tenant_id,id)
);
CREATE TABLE vant.deals (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(), name text NOT NULL,
 account_id uuid, contact_id uuid, lead_id uuid, pipeline_id uuid NOT NULL, stage_id uuid NOT NULL, owner_id uuid NOT NULL,
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 0 AND 999999999999), probability smallint NOT NULL CHECK(probability BETWEEN 0 AND 100),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','won','lost')), close_on date, source text, products text, loss_reason text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz,
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,pipeline_id,stage_id) REFERENCES vant.stages(tenant_id,pipeline_id,id),
 FOREIGN KEY(tenant_id,account_id) REFERENCES vant.accounts(tenant_id,id), FOREIGN KEY(tenant_id,contact_id) REFERENCES vant.contacts(tenant_id,id),
 FOREIGN KEY(tenant_id,lead_id) REFERENCES vant.leads(tenant_id,id), FOREIGN KEY(tenant_id,owner_id) REFERENCES vant.members(tenant_id,id)
);
CREATE TABLE vant.activities (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id), id uuid NOT NULL DEFAULT gen_random_uuid(), title text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('task','call','meeting','comment','reminder','followup')),
 owner_id uuid NOT NULL, lead_id uuid, deal_id uuid, due_at timestamptz, done_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id), FOREIGN KEY(tenant_id,owner_id) REFERENCES vant.members(tenant_id,id),
 FOREIGN KEY(tenant_id,lead_id) REFERENCES vant.leads(tenant_id,id), FOREIGN KEY(tenant_id,deal_id) REFERENCES vant.deals(tenant_id,id)
);
CREATE INDEX leads_created ON vant.leads(tenant_id,created_at,owner_id);
CREATE INDEX deals_created ON vant.deals(tenant_id,created_at,owner_id);
CREATE INDEX activities_due ON vant.activities(tenant_id,owner_id,due_at) WHERE done_at IS NULL;
DO $$
DECLARE target text;
BEGIN
 FOREACH target IN ARRAY ARRAY['accounts','contacts','leads','pipelines','stages','deals','activities'] LOOP
   EXECUTE format('ALTER TABLE vant.%I ENABLE ROW LEVEL SECURITY',target);
   EXECUTE format('ALTER TABLE vant.%I FORCE ROW LEVEL SECURITY',target);
   EXECUTE format('CREATE POLICY tenant_scope ON vant.%I USING (tenant_id=vant.current_tenant()) WITH CHECK (tenant_id=vant.current_tenant())',target);
   EXECUTE format('GRANT SELECT ON vant.%I TO vant_app',target);
 END LOOP;
END $$;
GRANT SELECT ON vant.team_members TO vant_app;
