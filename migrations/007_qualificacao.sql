ALTER TABLE vant.leads
  ADD COLUMN stated_need text,
  ADD COLUMN purchase_intent text NOT NULL DEFAULT 'unknown' CHECK (purchase_intent IN ('unknown','exploring','evaluating','requested_proposal')),
  ADD COLUMN budget_state text NOT NULL DEFAULT 'unknown' CHECK (budget_state IN ('unknown','unconfirmed','confirmed','unavailable')),
  ADD COLUMN purchase_window text NOT NULL DEFAULT 'unknown' CHECK (purchase_window IN ('unknown','month','quarter','later')),
  ADD COLUMN stated_objection text;

CREATE INDEX core_runs_tenant_period ON vant.core_runs(tenant_id,created_at DESC);
