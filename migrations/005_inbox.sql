CREATE TABLE vant.wa_instances (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id),id uuid NOT NULL DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL,FOREIGN KEY(tenant_id,owner_id) REFERENCES vant.members(tenant_id,id),
 label text NOT NULL,state text NOT NULL DEFAULT 'local',phone text,disabled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,label)
);
ALTER TABLE vant.conversations ADD COLUMN instance_id uuid,ADD COLUMN remote_jid text,
 ADD COLUMN tags text[] NOT NULL DEFAULT '{}',ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','high','urgent')),
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
 ADD FOREIGN KEY(tenant_id,instance_id) REFERENCES vant.wa_instances(tenant_id,id),
 ADD UNIQUE(tenant_id,instance_id,remote_jid);
CREATE TABLE vant.wa_messages (
 tenant_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL,
 instance_id uuid NOT NULL,provider_id text,client_id uuid,from_me boolean NOT NULL,kind text NOT NULL,
 body text NOT NULL DEFAULT '',media bytea,filename text,mime text,state text NOT NULL,provider_key jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),
 UNIQUE(tenant_id,instance_id,provider_id),UNIQUE(tenant_id,conversation_id,client_id),
 FOREIGN KEY(tenant_id,instance_id) REFERENCES vant.wa_instances(tenant_id,id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES vant.conversations(tenant_id,id)
);
CREATE INDEX wa_message_history ON vant.wa_messages(tenant_id,conversation_id,created_at DESC,id DESC);
CREATE TABLE vant.wa_receipts (
 tenant_id uuid NOT NULL,instance_id uuid NOT NULL,provider_id text NOT NULL,status_rank smallint NOT NULL,
 PRIMARY KEY(tenant_id,instance_id,provider_id),FOREIGN KEY(tenant_id,instance_id) REFERENCES vant.wa_instances(tenant_id,id)
);
CREATE TABLE vant.wa_notes (
 tenant_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL,actor_id uuid NOT NULL,
 body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(tenant_id,id),
 FOREIGN KEY(tenant_id,conversation_id) REFERENCES vant.conversations(tenant_id,id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES vant.members(tenant_id,id)
);
CREATE TABLE vant.wa_outbox (
 tenant_id uuid NOT NULL,id uuid NOT NULL,conversation_id uuid NOT NULL,kind text NOT NULL,body text NOT NULL,
 filename text,mime text,media bytea,state text NOT NULL DEFAULT 'queued',provider_id text,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,id),FOREIGN KEY(tenant_id,conversation_id) REFERENCES vant.conversations(tenant_id,id)
);
GRANT SELECT, INSERT, UPDATE ON vant.wa_outbox TO vant_app;
DO $ DECLARE target text; BEGIN
 FOREACH target IN ARRAY ARRAY['wa_instances','wa_messages','wa_receipts','wa_notes','wa_outbox'] LOOP
  EXECUTE format('ALTER TABLE vant.%I ENABLE ROW LEVEL SECURITY',target);
  EXECUTE format('ALTER TABLE vant.%I FORCE ROW LEVEL SECURITY',target);
  EXECUTE format('CREATE POLICY tenant_scope ON vant.%I USING (tenant_id=vant.current_tenant()) WITH CHECK (tenant_id=vant.current_tenant())',target);
 END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE ON vant.wa_instances,vant.wa_messages,vant.wa_receipts TO vant_app;
GRANT SELECT,INSERT ON vant.wa_notes TO vant_app;
