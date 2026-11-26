ALTER TABLE vant.deals ADD COLUMN sales_channel text NOT NULL DEFAULT 'unknown'
 CHECK (sales_channel IN ('unknown','phone','email','website','in_person','social','messaging','other'));
