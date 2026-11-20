ALTER TABLE vant.prospect_profiles ADD COLUMN target_role text;
CREATE TABLE vant.prospect_people (
 tenant_id uuid NOT NULL,contact_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),
 linkedin_url text,source_reference text NOT NULL,observed_on date NOT NULL,recorded_by uuid NOT NULL,
 PRIMARY KEY(tenant_id,contact_id),UNIQUE(tenant_id,linkedin_url),
 FOREIGN KEY(tenant_id,contact_id) REFERENCES vant.contacts(tenant_id,id),
 FOREIGN KEY(tenant_id,recorded_by) REFERENCES vant.members(tenant_id,id)
);
CREATE TABLE vant.prospect_person_history (
 tenant_id uuid NOT NULL,contact_id uuid NOT NULL,revision integer NOT NULL,snapshot jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),recorded_by uuid NOT NULL,
 PRIMARY KEY(tenant_id,contact_id,revision),FOREIGN KEY(tenant_id,contact_id) REFERENCES vant.prospect_people(tenant_id,contact_id),
 FOREIGN KEY(tenant_id,recorded_by) REFERENCES vant.members(tenant_id,id)
);
CREATE TABLE vant.prospect_conversions (
 tenant_id uuid NOT NULL,account_id uuid NOT NULL,profile_id uuid NOT NULL,lead_id uuid NOT NULL,
 source_reference text NOT NULL,created_lead boolean NOT NULL,actor_id uuid NOT NULL,converted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,account_id),FOREIGN KEY(tenant_id,account_id) REFERENCES vant.accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,profile_id) REFERENCES vant.prospect_profiles(tenant_id,id),
 FOREIGN KEY(tenant_id,lead_id) REFERENCES vant.leads(tenant_id,id) ON DELETE CASCADE,
 FOREIGN KEY(tenant_id,actor_id) REFERENCES vant.members(tenant_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['prospect_people','prospect_person_history','prospect_conversions'] LOOP
  EXECUTE format('ALTER TABLE vant.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE vant.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_scope ON vant.%I USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant())',t);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON vant.prospect_people TO vant_app;
GRANT SELECT,INSERT ON vant.prospect_person_history,vant.prospect_conversions TO vant_app;
