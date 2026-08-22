-- Email verification for password accounts + OAuth linking codes.
-- Prevents silent OAuth merge into attacker-pre-registered emails.

ALTER TABLE auth_codes DROP CONSTRAINT IF EXISTS auth_codes_purpose_check;

ALTER TABLE auth_codes
  ADD CONSTRAINT auth_codes_purpose_check
  CHECK (purpose IN ('password_reset', 'email_verification', 'oauth_link'));

-- Grandfather existing password accounts so production users are not locked out.
UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE password_hash IS NOT NULL
  AND email_verified_at IS NULL;

-- OAuth-only accounts that already signed in via IdP are treated as verified.
UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE password_hash IS NULL
  AND (google_sub IS NOT NULL OR microsoft_sub IS NOT NULL)
  AND email_verified_at IS NULL;
