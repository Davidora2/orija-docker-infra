ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility IN ('PRIVATE', 'SHARED')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  currency text NOT NULL DEFAULT 'GBP' CHECK (char_length(currency) BETWEEN 3 AND 8),
  period text NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (visibility = 'PRIVATE' AND household_id IS NULL)
    OR (visibility = 'SHARED' AND household_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS budgets_owner_idx
  ON budgets (owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS budgets_household_idx
  ON budgets (household_id, updated_at DESC)
  WHERE visibility = 'SHARED';

CREATE TABLE IF NOT EXISTS budget_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  planned_cents integer NOT NULL DEFAULT 0 CHECK (planned_cents >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_categories_budget_idx
  ON budget_categories (budget_id, sort_order ASC);

CREATE TABLE IF NOT EXISTS budget_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id uuid REFERENCES budget_categories(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  occurred_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_entries_budget_idx
  ON budget_entries (budget_id, occurred_on DESC);
