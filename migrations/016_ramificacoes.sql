ALTER TABLE vant.automation_versions
 ADD COLUMN action_kind text NOT NULL DEFAULT 'task' CHECK(action_kind IN ('task','reminder','followup')),
 ADD COLUMN else_kind text CHECK(else_kind IN ('task','reminder','followup')),
 ADD COLUMN else_title text,
 ADD COLUMN due_minutes integer CHECK(due_minutes BETWEEN 0 AND 43200),
 ADD CONSTRAINT valid_else CHECK((else_kind IS NULL AND else_title IS NULL) OR
 (source_filter IS NOT NULL AND else_kind IS NOT NULL AND else_title IS NOT NULL AND length(trim(else_title))>0));
ALTER TABLE vant.automation_attempts ADD COLUMN branch text CHECK(branch IN ('match','otherwise')),
 ADD COLUMN action_kind text CHECK(action_kind IN ('task','reminder','followup'));
