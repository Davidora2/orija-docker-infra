CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 100),
  avatar_url text,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_household_id uuid
  REFERENCES households(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS household_members (
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER', 'PARTNER')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS household_single_owner
  ON household_members (household_id)
  WHERE role = 'OWNER';

CREATE TABLE IF NOT EXISTS household_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_email text CHECK (invited_email IS NULL OR invited_email = lower(invited_email)),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS household_invites_household_idx
  ON household_invites (household_id, created_at DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  device_name text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx
  ON refresh_tokens (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS life_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id uuid REFERENCES households(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES life_items(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (
    kind IN ('VISION', 'PILLAR', 'GOAL', 'PROJECT', 'ACTION', 'IDEA', 'DECISION')
  ),
  visibility text NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility IN ('PRIVATE', 'SHARED')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  status text NOT NULL DEFAULT 'ACTIVE',
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (visibility = 'PRIVATE' AND household_id IS NULL)
    OR (visibility = 'SHARED' AND household_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS life_items_owner_idx
  ON life_items (owner_user_id, kind, updated_at DESC);

CREATE INDEX IF NOT EXISTS life_items_household_idx
  ON life_items (household_id, kind, updated_at DESC)
  WHERE visibility = 'SHARED';
