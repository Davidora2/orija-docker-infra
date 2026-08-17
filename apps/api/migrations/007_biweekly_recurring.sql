-- Allow biweekly / four-weekly recurring outgoings anchored to a start date.
ALTER TABLE budget_recurring_outgoings
  ADD COLUMN IF NOT EXISTS anchor_date date;

ALTER TABLE budget_recurring_outgoings
  DROP CONSTRAINT IF EXISTS budget_recurring_outgoings_cadence_check;

ALTER TABLE budget_recurring_outgoings
  ADD CONSTRAINT budget_recurring_outgoings_cadence_check
  CHECK (cadence IN ('weekly', 'biweekly', 'four_weekly', 'monthly', 'yearly'));

ALTER TABLE budget_recurring_outgoings
  DROP CONSTRAINT IF EXISTS budget_recurring_outgoings_check;

ALTER TABLE budget_recurring_outgoings
  ADD CONSTRAINT budget_recurring_outgoings_schedule_check CHECK (
    (cadence = 'weekly' AND weekday IS NOT NULL)
    OR (cadence IN ('biweekly', 'four_weekly') AND anchor_date IS NOT NULL)
    OR (cadence IN ('monthly', 'yearly') AND day_of_month IS NOT NULL)
  );
