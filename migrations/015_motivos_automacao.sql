ALTER TABLE vant.automation_attempts ADD COLUMN reason text CHECK(reason IN ('author_unavailable','action_failed'));
