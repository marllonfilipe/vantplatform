CREATE TABLE vant.business_units (
 tenant_id uuid NOT NULL REFERENCES vant.tenants(id),
 id uuid NOT NULL DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
 kind text NOT NULL CHECK(kind IN ('branch','department','commercial')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 PRIMARY KEY(tenant_id,id)
);
CREATE UNIQUE INDEX business_unit_name ON vant.business_units(tenant_id,kind,lower(name));
ALTER TABLE vant.business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE vant.business_units FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON vant.business_units
 USING(tenant_id=vant.current_tenant()) WITH CHECK(tenant_id=vant.current_tenant());
GRANT SELECT,INSERT ON vant.business_units TO vant_app;
GRANT UPDATE(name,kind,revision) ON vant.business_units TO vant_app;
