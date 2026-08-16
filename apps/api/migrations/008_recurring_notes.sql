ALTER TABLE budget_recurring_outgoings
  ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT ''
    CHECK (char_length(note) <= 500);
