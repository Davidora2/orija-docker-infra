ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS pay_frequency text
    CHECK (
      pay_frequency IS NULL
      OR pay_frequency IN ('weekly', 'biweekly', 'four_weekly', 'monthly')
    ),
  ADD COLUMN IF NOT EXISTS next_pay_date date,
  ADD COLUMN IF NOT EXISTS typical_pay_cents integer
    CHECK (typical_pay_cents IS NULL OR typical_pay_cents >= 0);

CREATE TABLE IF NOT EXISTS budget_recurring_outgoings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id uuid REFERENCES budget_categories(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  cadence text NOT NULL CHECK (cadence IN ('weekly', 'monthly', 'yearly')),
  day_of_month integer CHECK (
    day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 28)
  ),
  weekday integer CHECK (
    weekday IS NULL OR (weekday BETWEEN 0 AND 6)
  ),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (cadence = 'weekly' AND weekday IS NOT NULL)
    OR (cadence IN ('monthly', 'yearly') AND day_of_month IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS budget_recurring_budget_idx
  ON budget_recurring_outgoings (budget_id, active, cadence);
