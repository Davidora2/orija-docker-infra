-- Track paid occurrences for recurring bills and monthly saving contributions.
CREATE TABLE IF NOT EXISTS payment_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_id uuid REFERENCES budgets(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('recurring_outgoing', 'saving_goal')),
  source_id uuid NOT NULL,
  due_date date NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  paid_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid REFERENCES users(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  UNIQUE (source_type, source_id, due_date)
);

CREATE INDEX IF NOT EXISTS payment_occurrences_owner_due_idx
  ON payment_occurrences (owner_user_id, due_date);

CREATE INDEX IF NOT EXISTS payment_occurrences_budget_due_idx
  ON payment_occurrences (budget_id, due_date)
  WHERE budget_id IS NOT NULL;

-- Avoid duplicate reminder emails for the same user + calendar day.
CREATE TABLE IF NOT EXISTS bill_reminder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  item_count integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, reminder_date)
);

-- Optional monthly contribution schedule on saving goals.
ALTER TABLE saving_goals
  ADD COLUMN IF NOT EXISTS monthly_contribution_cents integer
    CHECK (
      monthly_contribution_cents IS NULL OR monthly_contribution_cents > 0
    ),
  ADD COLUMN IF NOT EXISTS contribution_day integer
    CHECK (
      contribution_day IS NULL OR (contribution_day BETWEEN 1 AND 28)
    );

ALTER TABLE saving_goals
  DROP CONSTRAINT IF EXISTS saving_goals_contribution_schedule_check;

ALTER TABLE saving_goals
  ADD CONSTRAINT saving_goals_contribution_schedule_check CHECK (
    (
      monthly_contribution_cents IS NULL
      AND contribution_day IS NULL
    )
    OR (
      monthly_contribution_cents IS NOT NULL
      AND contribution_day IS NOT NULL
    )
  );
