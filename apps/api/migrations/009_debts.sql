CREATE TABLE IF NOT EXISTS debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility IN ('PRIVATE', 'SHARED')),
  debt_type text NOT NULL
    CHECK (debt_type IN (
      'credit_card',
      'personal_loan',
      'car',
      'mortgage',
      'student',
      'overdraft',
      'other'
    )),
  custom_label text CHECK (
    custom_label IS NULL OR char_length(custom_label) BETWEEN 1 AND 80
  ),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  balance_cents integer NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  interest_apr_percent numeric(7, 3) NOT NULL DEFAULT 0
    CHECK (interest_apr_percent >= 0 AND interest_apr_percent <= 100),
  monthly_payment_cents integer
    CHECK (monthly_payment_cents IS NULL OR monthly_payment_cents > 0),
  payment_day integer
    CHECK (payment_day IS NULL OR (payment_day BETWEEN 1 AND 28)),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (visibility = 'PRIVATE' AND household_id IS NULL)
    OR (visibility = 'SHARED' AND household_id IS NOT NULL)
  ),
  CHECK (
    (debt_type = 'other' AND custom_label IS NOT NULL)
    OR (debt_type <> 'other')
  ),
  CHECK (
    (
      monthly_payment_cents IS NULL
      AND payment_day IS NULL
    )
    OR (
      monthly_payment_cents IS NOT NULL
      AND payment_day IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS debts_owner_idx
  ON debts (owner_user_id, sort_order ASC, updated_at DESC);

CREATE INDEX IF NOT EXISTS debts_household_idx
  ON debts (household_id, updated_at DESC)
  WHERE visibility = 'SHARED';

ALTER TABLE payment_occurrences
  DROP CONSTRAINT IF EXISTS payment_occurrences_source_type_check;

ALTER TABLE payment_occurrences
  ADD CONSTRAINT payment_occurrences_source_type_check
  CHECK (source_type IN ('recurring_outgoing', 'saving_goal', 'debt'));
