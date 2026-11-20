ALTER TABLE vant.automation_versions DROP CONSTRAINT valid_else,
 ADD CONSTRAINT valid_else CHECK(
  (else_kind IS NULL AND else_title IS NULL)
  OR ((source_filter IS NOT NULL OR conditions <> '{}'::jsonb)
      AND else_kind IS NOT NULL AND else_title IS NOT NULL AND length(trim(else_title))>0)
 );
