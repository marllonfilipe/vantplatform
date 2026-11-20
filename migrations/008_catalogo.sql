ALTER TABLE vant.documents
  ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  ADD COLUMN category text NOT NULL DEFAULT 'reference' CHECK(category IN ('reference','offer'));
