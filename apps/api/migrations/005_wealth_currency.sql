ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_currency text NOT NULL DEFAULT 'GBP'
    CHECK (char_length(preferred_currency) BETWEEN 3 AND 8);

CREATE TABLE IF NOT EXISTS saving_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility IN ('PRIVATE', 'SHARED')),
  category text NOT NULL
    CHECK (category IN (
      'emergency',
      'six_month_salary',
      'holiday',
      'house_deposit',
      'custom'
    )),
  custom_label text CHECK (custom_label IS NULL OR char_length(custom_label) BETWEEN 1 AND 80),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  target_cents integer NOT NULL DEFAULT 0 CHECK (target_cents >= 0),
  current_cents integer NOT NULL DEFAULT 0 CHECK (current_cents >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (visibility = 'PRIVATE' AND household_id IS NULL)
    OR (visibility = 'SHARED' AND household_id IS NOT NULL)
  ),
  CHECK (
    (category = 'custom' AND custom_label IS NOT NULL)
    OR (category <> 'custom')
  )
);

CREATE INDEX IF NOT EXISTS saving_goals_owner_idx
  ON saving_goals (owner_user_id, sort_order ASC, updated_at DESC);

CREATE INDEX IF NOT EXISTS saving_goals_household_idx
  ON saving_goals (household_id, updated_at DESC)
  WHERE visibility = 'SHARED';

CREATE TABLE IF NOT EXISTS investment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility IN ('PRIVATE', 'SHARED')),
  account_type text NOT NULL
    CHECK (account_type IN (
      'fhsa',
      'tfsa',
      'rrsp',
      'isa',
      'stocks',
      'crypto',
      'pension',
      'other'
    )),
  custom_label text CHECK (custom_label IS NULL OR char_length(custom_label) BETWEEN 1 AND 80),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  goal_cents integer NOT NULL DEFAULT 0 CHECK (goal_cents >= 0),
  current_cents integer NOT NULL DEFAULT 0 CHECK (current_cents >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (visibility = 'PRIVATE' AND household_id IS NULL)
    OR (visibility = 'SHARED' AND household_id IS NOT NULL)
  ),
  CHECK (
    (account_type = 'other' AND custom_label IS NOT NULL)
    OR (account_type <> 'other')
  )
);

CREATE INDEX IF NOT EXISTS investment_accounts_owner_idx
  ON investment_accounts (owner_user_id, sort_order ASC, updated_at DESC);

CREATE INDEX IF NOT EXISTS investment_accounts_household_idx
  ON investment_accounts (household_id, updated_at DESC)
  WHERE visibility = 'SHARED';

CREATE TABLE IF NOT EXISTS budget_draft_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  category_id uuid REFERENCES budget_categories(id) ON DELETE SET NULL,
  day_of_month integer CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_draft_expenses_budget_idx
  ON budget_draft_expenses (budget_id, active, created_at DESC);
