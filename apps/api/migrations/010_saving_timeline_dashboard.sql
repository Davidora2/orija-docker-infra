-- Timeline + brainstorm notes for saving goals.
ALTER TABLE saving_goals
  ADD COLUMN IF NOT EXISTS target_date date,
  ADD COLUMN IF NOT EXISTS gap_notes text NOT NULL DEFAULT ''
    CHECK (char_length(gap_notes) <= 4000);

-- Optional freeform ideas tied to closing savings/investment gaps.
CREATE TABLE IF NOT EXISTS wealth_gap_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility IN ('PRIVATE', 'SHARED')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  related_saving_goal_id uuid REFERENCES saving_goals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wealth_gap_ideas_owner_idx
  ON wealth_gap_ideas (owner_user_id, created_at DESC);
