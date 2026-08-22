-- Remove empty duplicate Personal/Shared budgets created during 2026-08-22
-- agent debugging for david@orijadesign.co.uk. Keeps the populated GBP budget
-- (208eb2bc-78be-494d-9e4f-64b688a32b6e) and any budget with entries, recurring,
-- or pay schedule data (including partner shared budgets).
DELETE FROM budgets b
WHERE b.owner_user_id = 'f5d5994a-7883-4894-b77e-8bc226a868cd'
  AND b.id <> '208eb2bc-78be-494d-9e4f-64b688a32b6e'
  AND b.name IN ('Personal budget', 'Shared budget')
  AND b.created_at >= TIMESTAMPTZ '2026-08-22'
  AND b.created_at < TIMESTAMPTZ '2026-08-23'
  AND COALESCE(b.typical_pay_cents, 0) <= 0
  AND b.pay_frequency IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM budget_entries e WHERE e.budget_id = b.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM budget_recurring_outgoings r
    WHERE r.budget_id = b.id AND r.active = TRUE
  );
