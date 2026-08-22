ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile_body jsonb NOT NULL DEFAULT '{}'::jsonb;
