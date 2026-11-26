ALTER TABLE vant.plan_assignments ADD COLUMN storage_limit_bytes bigint
 CHECK (storage_limit_bytes BETWEEN 0 AND 9007199254740991);

-- Conteúdo lógico persistido, excluindo índices, vetores derivados e backups.
CREATE FUNCTION vant.stored_content_bytes(company uuid) RETURNS numeric
LANGUAGE sql STABLE AS $$
 SELECT (SELECT coalesce(sum(size_bytes),0) FROM vant.documents WHERE tenant_id=company) +
        (SELECT coalesce(sum(octet_length(contents)::bigint),0) FROM vant.lead_files WHERE tenant_id=company)
$$;

CREATE FUNCTION vant.check_storage_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 delta numeric;
 maximum bigint;
BEGIN
 IF TG_TABLE_NAME='documents' THEN
  delta := NEW.size_bytes;
  IF TG_OP='UPDATE' THEN delta := delta - OLD.size_bytes; END IF;
 ELSE
  delta := octet_length(NEW.contents);
  IF TG_OP='UPDATE' THEN delta := delta - octet_length(OLD.contents); END IF;
 END IF;
 IF delta <= 0 THEN RETURN NEW; END IF;
 PERFORM vant.lock_plan_assignment(NEW.tenant_id);
 SELECT storage_limit_bytes INTO maximum FROM vant.plan_assignments
 WHERE tenant_id=NEW.tenant_id ORDER BY revision DESC LIMIT 1;
 IF maximum IS NOT NULL AND vant.stored_content_bytes(NEW.tenant_id) + delta > maximum THEN
  RAISE EXCEPTION USING ERRCODE='V4001', MESSAGE='Franquia de armazenamento atingida.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER document_storage_limit BEFORE INSERT OR UPDATE OF size_bytes ON vant.documents
 FOR EACH ROW EXECUTE FUNCTION vant.check_storage_capacity();
CREATE TRIGGER lead_file_storage_limit BEFORE INSERT OR UPDATE OF contents ON vant.lead_files
 FOR EACH ROW EXECUTE FUNCTION vant.check_storage_capacity();
