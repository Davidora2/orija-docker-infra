-- Weekly Review v1, privacy preferences, and deletion audit support.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_reminders_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE auth_codes DROP CONSTRAINT IF EXISTS auth_codes_purpose_check;

ALTER TABLE auth_codes
  ADD CONSTRAINT auth_codes_purpose_check
  CHECK (
    purpose IN (
      'password_reset',
      'email_verification',
      'oauth_link',
      'account_deletion'
    )
  );

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  capacity jsonb NOT NULL DEFAULT '{}'::jsonb,
  bottlenecks text NOT NULL DEFAULT '',
  start_doing text NOT NULL DEFAULT '',
  stop_doing text NOT NULL DEFAULT '',
  continue_doing text NOT NULL DEFAULT '',
  next_week_priorities jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, household_id, week_start)
);

CREATE INDEX IF NOT EXISTS weekly_reviews_user_history_idx
  ON weekly_reviews (user_id, household_id, week_start DESC);

CREATE TABLE IF NOT EXISTS account_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_user_id uuid NOT NULL,
  email_sha256 text NOT NULL CHECK (char_length(email_sha256) = 64),
  household_ids uuid[] NOT NULL DEFAULT '{}',
  transferred_household_ids uuid[] NOT NULL DEFAULT '{}',
  deleted_at timestamptz NOT NULL DEFAULT now()
);
