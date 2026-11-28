ALTER TABLE vant.teams ADD COLUMN unit_id uuid,
 ADD FOREIGN KEY(tenant_id,unit_id) REFERENCES vant.business_units(tenant_id,id);
CREATE INDEX teams_by_unit ON vant.teams(tenant_id,unit_id,id);
GRANT UPDATE(unit_id) ON vant.teams TO vant_app;
