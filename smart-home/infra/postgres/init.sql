-- Smart Home core schema — designed to grow with more device types & homes.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS homes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,
  home_id       UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  device_type   TEXT NOT NULL,
  source        TEXT NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}',
  online        BOOLEAN NOT NULL DEFAULT false,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id       UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL,
  label         TEXT NOT NULL,
  config        JSONB NOT NULL DEFAULT '{}',
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id       UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  enabled       BOOLEAN NOT NULL DEFAULT true,
  trigger_type  TEXT NOT NULL,
  conditions    JSONB NOT NULL DEFAULT '{}',
  actions       JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_log (
  id            UUID PRIMARY KEY,
  home_id       UUID NOT NULL,
  device_id     TEXT,
  event_type    TEXT NOT NULL,
  source        TEXT,
  payload       JSONB NOT NULL DEFAULT '{}',
  occurred_at   TIMESTAMPTZ NOT NULL,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_log_home_time
  ON event_log (home_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS notification_log (
  id              UUID PRIMARY KEY,
  home_id         UUID NOT NULL,
  correlation_id  UUID,
  channel         TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  status          TEXT NOT NULL,
  detail          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id       UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,
  scopes        TEXT[] NOT NULL DEFAULT ARRAY['read','write'],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ
);

INSERT INTO homes (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Home')
ON CONFLICT (id) DO NOTHING;

INSERT INTO devices (id, home_id, name, device_type, source, online, metadata)
VALUES (
  'ring-doorbell-1',
  '11111111-1111-1111-1111-111111111111',
  'Front Door Ring',
  'doorbell',
  'ring',
  true,
  '{"location":"front_door"}'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO notification_targets (home_id, channel, label, config)
SELECT
  '11111111-1111-1111-1111-111111111111',
  'fcm',
  'Primary phone',
  '{"token_env":"FCM_DEVICE_TOKEN"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM notification_targets
  WHERE home_id = '11111111-1111-1111-1111-111111111111' AND channel = 'fcm'
);

INSERT INTO notification_targets (home_id, channel, label, config)
SELECT
  '11111111-1111-1111-1111-111111111111',
  'console',
  'Ops console',
  '{}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM notification_targets
  WHERE home_id = '11111111-1111-1111-1111-111111111111' AND channel = 'console'
);

INSERT INTO automation_rules (home_id, name, trigger_type, actions)
SELECT
  '11111111-1111-1111-1111-111111111111',
  'Doorbell → phone notification',
  'doorbell.rung',
  '[
    {
      "type": "notify",
      "channels": ["fcm", "google_home_broadcast", "console"],
      "title": "Doorbell",
      "bodyTemplate": "Someone is at {{deviceName}}"
    }
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM automation_rules
  WHERE home_id = '11111111-1111-1111-1111-111111111111'
    AND name = 'Doorbell → phone notification'
);
