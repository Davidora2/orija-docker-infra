ALTER TABLE users
  ADD COLUMN IF NOT EXISTS microsoft_sub text;

CREATE UNIQUE INDEX IF NOT EXISTS users_microsoft_sub_uidx
  ON users (microsoft_sub)
  WHERE microsoft_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  account_email text,
  access_token_enc text NOT NULL,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scope text,
  calendar_id text NOT NULL DEFAULT 'primary',
  sync_tasks boolean NOT NULL DEFAULT true,
  sync_payments boolean NOT NULL DEFAULT true,
  sync_paydays boolean NOT NULL DEFAULT true,
  reminder_minutes integer NOT NULL DEFAULT 60,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS calendar_sync_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  life_event_key text NOT NULL,
  external_event_id text NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, life_event_key)
);

CREATE TABLE IF NOT EXISTS calendar_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  code_verifier text,
  redirect_path text NOT NULL DEFAULT '/?tab=calendar',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_oauth_states_expires_idx
  ON calendar_oauth_states (expires_at);
