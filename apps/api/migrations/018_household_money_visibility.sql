ALTER TABLE household_members
  ADD COLUMN IF NOT EXISTS money_visibility_grant text NOT NULL DEFAULT 'SHARED_BILLS_ONLY'
    CHECK (money_visibility_grant IN ('SHARED_BILLS_ONLY', 'FULL_VISIBILITY'));
