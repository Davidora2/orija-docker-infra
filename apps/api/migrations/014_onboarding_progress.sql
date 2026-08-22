-- Resumable onboarding for web and mobile clients.
-- Completed users stay completed; incomplete and new users start at Welcome.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_step text;

UPDATE users
SET onboarding_step = 'welcome'
WHERE onboarding_completed_at IS NULL
  AND onboarding_step IS NULL;

ALTER TABLE users
  ALTER COLUMN onboarding_step SET DEFAULT 'welcome';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_onboarding_step_check;

ALTER TABLE users
  ADD CONSTRAINT users_onboarding_step_check
  CHECK (
    onboarding_step IS NULL
    OR onboarding_step IN (
      'welcome',
      'areas',
      'capacity',
      'ideas',
      'project',
      'action',
      'payoff',
      'deferred'
    )
  );
