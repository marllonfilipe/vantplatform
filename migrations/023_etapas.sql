ALTER TABLE vant.automation_versions ADD COLUMN steps jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(steps)='object');
ALTER TABLE vant.automation_attempts ADD COLUMN step_index integer NOT NULL DEFAULT 0 CHECK(step_index BETWEEN 0 AND 7);
