-- Link confirmed bill payments to budget entries for actual cashflow tracking.
ALTER TABLE payment_occurrences
  ADD COLUMN IF NOT EXISTS budget_entry_id uuid
    REFERENCES budget_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payment_occurrences_budget_entry_idx
  ON payment_occurrences (budget_entry_id)
  WHERE budget_entry_id IS NOT NULL;
